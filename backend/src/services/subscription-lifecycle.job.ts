import { prisma } from '../lib/prisma.js';
import {
  STRIPE_PAYMENT_LINK,
  SUBSCRIPTION_GRACE_DAYS,
  TRIAL_REMINDER_DAYS,
  subscriptionService,
} from '../modules/subscriptions/subscription.service.js';
import { adminNotificationService } from './admin-notification.service.js';
import { realtimeService } from './realtime/realtime.service.js';

function isCustomerOrganization(org: { slug?: string | null; name?: string | null }) {
  const slug = org.slug || '';
  const name = org.name || '';
  if (slug === 'saas-master' || slug.startsWith('system-')) return false;
  if (/saas master/i.test(name) || /brisoft portaria \[system\]/i.test(name)) return false;
  return true;
}

function brazilDayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

async function loadOrgAdmins(organizationId: string) {
  return prisma.user.findMany({
    where: {
      organizationId,
      deletedAt: null,
      isActive: true,
      role: { in: ['ADMIN', 'SUPERVISOR'] },
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      whatsappNumber: true,
      phone: true,
    },
  });
}

async function persistPaymentStatus(orgId: string, paymentStatus: 'LATE' | 'SUSPENDED' | 'EXPIRED') {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { settings: true, isActive: true },
  });
  if (!org) return null;

  let settings: Record<string, unknown> = {};
  try {
    settings = org.settings ? JSON.parse(org.settings) : {};
  } catch {
    settings = {};
  }

  if (settings.paymentStatus === paymentStatus && (paymentStatus !== 'SUSPENDED' || !org.isActive)) {
    return subscriptionService.getSubscriptionByOrgId(orgId);
  }

  settings.paymentStatus = paymentStatus;
  if (paymentStatus === 'LATE') {
    settings.lateSince = settings.lateSince || new Date().toISOString();
  }
  if (paymentStatus === 'SUSPENDED') {
    settings.suspendedAt = new Date().toISOString();
  }

  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: {
      settings: JSON.stringify(settings),
      ...(paymentStatus === 'SUSPENDED' ? { isActive: false } : {}),
    },
    select: { id: true, createdAt: true, settings: true, isActive: true, slug: true },
  });

  const info = subscriptionService.calculateSubscription(updated);
  realtimeService.emitToOrganization(orgId, 'subscription:updated', info);
  return info;
}

async function notifyCustomerOrg(params: {
  organizationId: string;
  title: string;
  message: string;
  alertType?: 'INFO' | 'WARNING';
  whatsappText: string;
  dedupeType: string;
  dedupeKey: string;
}) {
  await realtimeService.notifyAlert(params.organizationId, {
    title: params.title,
    message: params.message,
    type: params.alertType || 'WARNING',
  });

  const admins = await loadOrgAdmins(params.organizationId);
  const phones = new Set<string>();
  for (const admin of admins) {
    const raw = admin.whatsappNumber || admin.phone;
    if (!raw) continue;
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length >= 10) phones.add(digits.startsWith('55') ? digits : `55${digits}`);
  }

  for (const phone of phones) {
    try {
      await adminNotificationService.dispatchCustomerWhatsApp({
        type: params.dedupeType,
        dedupeKey: `${params.dedupeKey}:${phone}`,
        phone,
        message: params.whatsappText,
        relatedEntity: 'Organization',
        relatedEntityId: params.organizationId,
      });
    } catch (err: any) {
      console.warn(
        `[SubscriptionLifecycle] WhatsApp cliente falhou (${phone}):`,
        err?.message || err
      );
    }
  }
}

export class SubscriptionLifecycleJob {
  private timer: NodeJS.Timeout | null = null;

  async runOnce() {
    const dayKey = brazilDayKey();
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        settings: true,
        isActive: true,
      },
    });

    for (const org of organizations) {
      if (!isCustomerOrganization(org)) continue;

      try {
        await this.processOrganization(org, dayKey);
      } catch (err: any) {
        console.error(
          `[SubscriptionLifecycle] Erro na org ${org.id}:`,
          err?.message || err
        );
      }
    }
  }

  private async processOrganization(
    org: {
      id: string;
      name: string;
      slug: string | null;
      createdAt: Date;
      settings: string | null;
      isActive: boolean;
    },
    dayKey: string
  ) {
    const subscription = subscriptionService.calculateSubscription({
      ...org,
      slug: org.slug || undefined,
    });
    const admins = await loadOrgAdmins(org.id);
    const primaryAdmin = admins[0];
    const payLink = subscription.paymentLink || STRIPE_PAYMENT_LINK;

    // --- Trial: lembretes antes do fim ---
    if (subscription.status === 'TRIAL') {
      const days = subscription.daysRemaining;
      if ((TRIAL_REMINDER_DAYS as readonly number[]).includes(days)) {
        const title =
          days === 1
            ? 'Seu período de teste acaba amanhã'
            : `Seu período de teste acaba em ${days} dias`;
        const message =
          `O teste gratuito da ${org.name} termina em ${days} dia(s). ` +
          `Antecipe o pagamento para evitar a suspensão do acesso.`;
        const whatsappText =
          `⏳ *Lembrete — período de teste*\n\n` +
          `Olá${primaryAdmin?.name ? `, ${primaryAdmin.name.split(' ')[0]}` : ''}!\n\n` +
          `O teste gratuito de *${org.name}* termina em *${days} dia(s)*.\n\n` +
          `Quer antecipar o pagamento e manter o acesso sem interrupção?\n` +
          `Pague aqui: ${payLink}`;

        await notifyCustomerOrg({
          organizationId: org.id,
          title,
          message,
          whatsappText,
          dedupeType: 'TRIAL_ENDING',
          dedupeKey: `TRIAL_ENDING:${org.id}:D${days}:${dayKey}`,
        });

        await adminNotificationService.notifyQuietly(async () => {
          await adminNotificationService.notifySubscriptionPending({
            organizationId: org.id,
            organizationName: org.name,
            status: `TRIAL_ENDING_D${days}`,
            reason: `O período de teste desta empresa termina em ${days} dia(s).`,
            adminName: primaryAdmin?.name,
            adminEmail: primaryAdmin?.email,
          });
        });
      }
      return;
    }

    // --- Plano ativo: alerta no último dia ---
    if (subscription.status === 'ACTIVE' && subscription.daysRemaining === 1) {
      const dueDate = subscription.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR')
        : 'hoje';
      const title = 'Alerta de vencimento da assinatura';
      const message =
        `A assinatura de ${org.name} vence em ${dueDate}. ` +
        `Renove agora para evitar atraso e suspensão do acesso.`;
      const whatsappText =
        `💳 *Alerta de vencimento*\n\n` +
        `Olá${primaryAdmin?.name ? `, ${primaryAdmin.name.split(' ')[0]}` : ''}!\n\n` +
        `A assinatura de *${org.name}* vence em *${dueDate}* (último dia).\n\n` +
        `Renove para liberar mais 30 dias de uso:\n${payLink}`;

      await notifyCustomerOrg({
        organizationId: org.id,
        title,
        message,
        whatsappText,
        dedupeType: 'SUBSCRIPTION_DUE',
        dedupeKey: `SUBSCRIPTION_DUE:${org.id}:${dayKey}`,
      });
      return;
    }

    // --- Venceu: entra em atraso (carência) ---
    if (subscription.status === 'LATE') {
      await persistPaymentStatus(org.id, 'LATE');

      const daysLeft = Math.max(0, SUBSCRIPTION_GRACE_DAYS - (subscription.daysPastDue || 0));
      const title = 'Assinatura em atraso';
      const message =
        daysLeft > 0
          ? `O pagamento de ${org.name} está em atraso. Regularize em até ${daysLeft} dia(s) para evitar a suspensão.`
          : `O pagamento de ${org.name} está em atraso. Regularize agora para evitar a suspensão.`;
      const whatsappText =
        `⚠️ *Assinatura em atraso*\n\n` +
        `Olá${primaryAdmin?.name ? `, ${primaryAdmin.name.split(' ')[0]}` : ''}!\n\n` +
        `A assinatura de *${org.name}* venceu e está em atraso.\n` +
        (daysLeft > 0
          ? `Você tem *${daysLeft} dia(s)* de carência antes da suspensão automática.\n\n`
          : `A carência está no fim — regularize imediatamente.\n\n`) +
        `Pague aqui para liberar mais 30 dias:\n${payLink}`;

      await notifyCustomerOrg({
        organizationId: org.id,
        title,
        message,
        whatsappText,
        dedupeType: 'SUBSCRIPTION_LATE',
        dedupeKey: `SUBSCRIPTION_LATE:${org.id}:D${subscription.daysPastDue}:${dayKey}`,
      });

      await adminNotificationService.notifyQuietly(async () => {
        await adminNotificationService.notifySubscriptionPending({
          organizationId: org.id,
          organizationName: org.name,
          status: 'LATE',
          reason: `Assinatura em atraso (dia ${subscription.daysPastDue} da carência de ${SUBSCRIPTION_GRACE_DAYS}).`,
          adminName: primaryAdmin?.name,
          adminEmail: primaryAdmin?.email,
        });
      });
      return;
    }

    // --- Após carência: suspensão automática ---
    if (
      subscription.status === 'SUSPENDED' &&
      org.isActive &&
      subscription.daysPastDue >= SUBSCRIPTION_GRACE_DAYS
    ) {
      await persistPaymentStatus(org.id, 'SUSPENDED');

      const title = 'Acesso suspenso por falta de pagamento';
      const message =
        `A assinatura de ${org.name} foi suspensa após ${SUBSCRIPTION_GRACE_DAYS} dias de atraso. ` +
        `Regularize o pagamento para reativar o acesso.`;
      const whatsappText =
        `🛑 *Acesso suspenso*\n\n` +
        `Olá${primaryAdmin?.name ? `, ${primaryAdmin.name.split(' ')[0]}` : ''}!\n\n` +
        `A assinatura de *${org.name}* foi *suspensa* automaticamente após ${SUBSCRIPTION_GRACE_DAYS} dias sem pagamento.\n\n` +
        `Regularize para reativar:\n${payLink}`;

      await notifyCustomerOrg({
        organizationId: org.id,
        title,
        message,
        alertType: 'WARNING',
        whatsappText,
        dedupeType: 'SUBSCRIPTION_SUSPENDED',
        dedupeKey: `SUBSCRIPTION_SUSPENDED:${org.id}:${dayKey}`,
      });

      await adminNotificationService.notifyQuietly(async () => {
        await adminNotificationService.notifySubscriptionPending({
          organizationId: org.id,
          organizationName: org.name,
          status: 'SUSPENDED',
          reason: `Suspensão automática após ${SUBSCRIPTION_GRACE_DAYS} dias de atraso.`,
          adminName: primaryAdmin?.name,
          adminEmail: primaryAdmin?.email,
        });
      });
      return;
    }

    // Trial encerrado / expirado — mantém aviso ao admin da plataforma
    if (subscription.status === 'EXPIRED') {
      const history = Array.isArray(subscription.paymentHistory) ? subscription.paymentHistory : [];
      const everPaid = history.some((item) => item.source !== 'COMPLIMENTARY' && item.amount > 0);
      if (!everPaid) {
        await adminNotificationService.notifyQuietly(async () => {
          await adminNotificationService.notifyTrialEnded({
            organizationId: org.id,
            organizationName: org.name,
            adminName: primaryAdmin?.name,
            adminEmail: primaryAdmin?.email,
            createdAt: org.createdAt,
            plan: subscription.plan,
          });
        });

        await notifyCustomerOrg({
          organizationId: org.id,
          title: 'Período de teste encerrado',
          message:
            `O teste gratuito de ${org.name} terminou. Regularize o pagamento para continuar usando a portaria.`,
          whatsappText:
            `⏰ *Período de teste encerrado*\n\n` +
            `O teste gratuito de *${org.name}* terminou e o acesso está bloqueado.\n\n` +
            `Assine para liberar:\n${payLink}`,
          dedupeType: 'TRIAL_ENDED_CUSTOMER',
          dedupeKey: `TRIAL_ENDED_CUSTOMER:${org.id}`,
        });
      }
    }
  }

  start() {
    const ONE_HOUR = 60 * 60 * 1000;
    this.runOnce().catch((err) => {
      console.error('[SubscriptionLifecycle] Erro na primeira execução:', err?.message || err);
    });
    this.timer = setInterval(() => {
      this.runOnce().catch((err) => {
        console.error('[SubscriptionLifecycle] Erro na execução periódica:', err?.message || err);
      });
    }, ONE_HOUR);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const subscriptionLifecycleJob = new SubscriptionLifecycleJob();
