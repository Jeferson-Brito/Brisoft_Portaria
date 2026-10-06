import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { realtimeService } from '../../services/realtime/realtime.service.js';
import { invalidateAuthCache } from '../../middlewares/auth.middleware.js';

export const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/4gM3coh0P3IWdi6dGfg7e00';

let cachedPlanPrice = 99.9;

export function currentPlanPrice() {
  return cachedPlanPrice;
}

export function rememberPlanPrice(price: number) {
  if (Number.isFinite(price) && price > 0) cachedPlanPrice = price;
}

export async function loadGlobalPlanPrice() {
  const setting = await prisma.systemSetting.findFirst({
    where: { key: 'saas_plan_monthly_price' },
  });
  const parsed = setting ? Number(String(setting.value).replace(',', '.')) : 99.9;
  rememberPlanPrice(parsed);
  return currentPlanPrice();
}

export interface SubscriptionInfo {
  plan: string;
  status: 'TRIAL' | 'ACTIVE' | 'LATE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';
  daysRemaining: number;
  daysPastDue: number;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  isBlocked: boolean;
  priceMonthly: number;
  paymentLink: string;
  paymentHistory: PaymentHistoryItem[];
}

/** Dias de carência após o vencimento antes da suspensão automática. */
export const SUBSCRIPTION_GRACE_DAYS = 2;

/** Dias antes do fim do trial em que enviamos lembretes (3 e 1). */
export const TRIAL_REMINDER_DAYS = [3, 1] as const;

export interface PaymentHistoryItem {
  id: string;
  paidAt: string;
  periodEnd: string;
  source: 'STRIPE' | 'COMPLIMENTARY' | 'MANUAL';
  label: string;
  amount: number;
}

export class SubscriptionService {
  /**
   * Calcula as regras de assinatura e carência de 7 dias para uma organização
   */
  public calculateSubscription(org: {
    id: string;
    createdAt: Date | string;
    settings?: string | null;
    isActive: boolean;
    slug?: string;
  }): SubscriptionInfo {
    // SuperAdmin / Organização mestre nunca expira
    if (org.slug === 'system-brisoft-portaria' || org.slug === 'system-combate-portaria' || org.slug === 'saas-master') {
      return {
        plan: 'ENTERPRISE',
        status: 'ACTIVE',
        daysRemaining: 9999,
        daysPastDue: 0,
        trialEndsAt: null,
        currentPeriodEnd: null,
        isBlocked: false,
        priceMonthly: 0,
        paymentLink: STRIPE_PAYMENT_LINK,
        paymentHistory: [],
      };
    }

    let settings: any = {};
    try {
      settings = org.settings ? JSON.parse(org.settings) : {};
    } catch (e) {}

    const now = Date.now();
    const createdTime = new Date(org.createdAt).getTime();
    const trialDays = typeof settings.trialDays === 'number' ? settings.trialDays : 7;
    const trialEndsAt = settings.trialEndsAt
      ? new Date(settings.trialEndsAt)
      : new Date(createdTime + trialDays * 24 * 60 * 60 * 1000);

    const plan = settings.plan || 'PRO';
    const monthlyPrice = currentPlanPrice();
    const paymentHistory = Array.isArray(settings.paymentHistory) ? settings.paymentHistory : [];

    let paymentStatus: 'TRIAL' | 'ACTIVE' | 'LATE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED' =
      settings.paymentStatus;
    let daysPastDue = 0;

    // Se desativada manualmente pelo superadmin
    if (!org.isActive) {
      paymentStatus = 'SUSPENDED';
    }

    // Se não tem status explicitamente gravado nos settings
    if (!paymentStatus) {
      if (now < trialEndsAt.getTime()) {
        paymentStatus = 'TRIAL';
      } else {
        paymentStatus = 'EXPIRED';
      }
    }

    // PENDING legado: trata como atraso se ainda houver período de referência
    if ((settings.paymentStatus as string) === 'PENDING') {
      paymentStatus = 'LATE';
    }

    // Se estiver em TRIAL mas a data de término já passou
    if (paymentStatus === 'TRIAL' && now >= trialEndsAt.getTime()) {
      paymentStatus = 'EXPIRED';
    }

    // Ciclo pago: ACTIVE → LATE (carência) → SUSPENDED (após GRACE_DAYS)
    // Também reconcilia EXPIRED recente de clientes que já pagaram (migração da regra antiga).
    if (
      (paymentStatus === 'ACTIVE' ||
        paymentStatus === 'LATE' ||
        (paymentStatus === 'EXPIRED' &&
          paymentHistory.some((item: PaymentHistoryItem) => item.source !== 'COMPLIMENTARY' && item.amount > 0))) &&
      settings.currentPeriodEnd &&
      org.isActive
    ) {
      const periodEndTime = new Date(settings.currentPeriodEnd).getTime();
      if (now >= periodEndTime) {
        daysPastDue = Math.max(
          0,
          Math.floor((now - periodEndTime) / (1000 * 60 * 60 * 24))
        );
        if (daysPastDue >= SUBSCRIPTION_GRACE_DAYS) {
          paymentStatus = 'SUSPENDED';
        } else {
          paymentStatus = 'LATE';
        }
      }
    }

    let daysRemaining = 0;
    if (paymentStatus === 'TRIAL') {
      daysRemaining = Math.max(0, Math.ceil((trialEndsAt.getTime() - now) / (1000 * 60 * 60 * 24)));
    } else if (paymentStatus === 'ACTIVE') {
      if (settings.currentPeriodEnd) {
        const periodEndTime = new Date(settings.currentPeriodEnd).getTime();
        daysRemaining = Math.max(0, Math.ceil((periodEndTime - now) / (1000 * 60 * 60 * 24)));
      } else {
        daysRemaining = 30;
      }
    } else if (paymentStatus === 'LATE') {
      daysRemaining = Math.max(0, SUBSCRIPTION_GRACE_DAYS - daysPastDue);
    }

    // LATE ainda permite uso (carência). Bloqueio em EXPIRED / SUSPENDED / CANCELLED.
    const isBlocked =
      !org.isActive ||
      paymentStatus === 'EXPIRED' ||
      paymentStatus === 'SUSPENDED' ||
      paymentStatus === 'CANCELLED';

    return {
      plan,
      status: paymentStatus,
      daysRemaining,
      daysPastDue,
      trialEndsAt: trialEndsAt.toISOString(),
      currentPeriodEnd: settings.currentPeriodEnd || null,
      isBlocked,
      priceMonthly: monthlyPrice,
      paymentLink: STRIPE_PAYMENT_LINK,
      paymentHistory,
    };
  }

  /**
   * Obtém a assinatura da organização
   */
  async getSubscriptionByOrgId(organizationId: string): Promise<SubscriptionInfo> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, createdAt: true, settings: true, isActive: true, slug: true },
    });

    if (!org) {
      throw new AppError('Organização não encontrada.', 404, 'NOT_FOUND');
    }

    return this.calculateSubscription(org);
  }

  /**
   * SuperAdmin: Remove o período de teste e força bloqueio imediato para pagamento
   */
  async expireTrial(orgId: string): Promise<SubscriptionInfo> {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new AppError('Organização não encontrada.', 404, 'NOT_FOUND');

    let settings: any = {};
    try {
      settings = org.settings ? JSON.parse(org.settings) : {};
    } catch (e) {}

    const now = new Date();
    settings.trialEndsAt = new Date(now.getTime() - 60000).toISOString(); // 1 minuto no passado
    settings.trialDays = 0;
    settings.paymentStatus = 'EXPIRED';

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: {
        settings: JSON.stringify(settings),
      },
      select: { id: true, createdAt: true, settings: true, isActive: true, slug: true },
    });

    const info = this.calculateSubscription(updated);

    // Emite evento em tempo real para o app mobile travar as ações instantaneamente
    realtimeService.emitToOrganization(orgId, 'subscription:updated', info);

    void import('../../services/admin-notification.service.js')
      .then(async ({ adminNotificationService }) => {
        const admin = await prisma.user.findFirst({
          where: { organizationId: orgId, deletedAt: null, role: { in: ['ADMIN', 'SUPERVISOR'] } },
          orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
          select: { name: true, email: true },
        });
        await adminNotificationService.notifyTrialEnded({
          organizationId: orgId,
          organizationName: org.name,
          adminName: admin?.name,
          adminEmail: admin?.email,
          createdAt: org.createdAt,
          plan: info.plan,
        });
      })
      .catch((err) => {
        console.error('[AdminNotification] Falha ao avisar fim de teste:', err?.message || err);
      });

    return info;
  }

  /**
   * Ativa / renova assinatura por X dias (padrão 30 dias)
   */
  async activateSubscription(
    orgId: string,
    periodDays = 30,
    options?: { source?: 'STRIPE' | 'COMPLIMENTARY' | 'MANUAL'; externalId?: string }
  ): Promise<SubscriptionInfo> {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new AppError('Organização não encontrada.', 404, 'NOT_FOUND');

    let settings: any = {};
    try {
      settings = org.settings ? JSON.parse(org.settings) : {};
    } catch (e) {}

    const source = options?.source || 'STRIPE';
    const history: PaymentHistoryItem[] = Array.isArray(settings.paymentHistory) ? settings.paymentHistory : [];
    if (options?.externalId && history.some((item) => item.id === options.externalId)) {
      return this.calculateSubscription(org);
    }

    const now = new Date();
    const existingPeriodEnd = settings.currentPeriodEnd ? new Date(settings.currentPeriodEnd) : null;
    const baseDate =
      existingPeriodEnd && !Number.isNaN(existingPeriodEnd.getTime()) && existingPeriodEnd.getTime() > now.getTime()
        ? existingPeriodEnd
        : now;
    const currentPeriodEnd = new Date(baseDate.getTime() + periodDays * 24 * 60 * 60 * 1000);
    const chargedAmount = currentPlanPrice();
    const label = source === 'COMPLIMENTARY'
      ? 'Cortesia'
      : source === 'MANUAL'
        ? 'Pagamento registrado'
        : 'Pagamento Stripe';
    history.unshift({
      id: options?.externalId || `${source}-${now.getTime()}`,
      paidAt: now.toISOString(),
      periodEnd: currentPeriodEnd.toISOString(),
      source,
      label,
      amount: source === 'COMPLIMENTARY' ? 0 : chargedAmount,
    });

    settings.paymentStatus = 'ACTIVE';
    settings.paidAt = now.toISOString();
    settings.currentPeriodEnd = currentPeriodEnd.toISOString();
    settings.monthlyPrice = currentPlanPrice();
    settings.paymentHistory = history.slice(0, 36);
    delete settings.lateSince;
    delete settings.suspendedAt;

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: {
        isActive: true,
        settings: JSON.stringify(settings),
      },
      select: { id: true, createdAt: true, settings: true, isActive: true, slug: true, name: true },
    });
    invalidateAuthCache();

    const info = this.calculateSubscription(updated);

    // Emite evento em tempo real para desbloquear o app imediatamente
    realtimeService.emitToOrganization(orgId, 'subscription:updated', info);

    // Push + alerta no app (cobre casos em que o WebSocket estava em segundo plano)
    void realtimeService.notifyAlert(orgId, {
      title: 'Assinatura ativada',
      message: 'Pagamento confirmado. O acesso da empresa foi liberado por mais 30 dias.',
      type: 'INFO',
    });

    return info;
  }

  /**
   * Suspende assinatura por inadimplência.
   * Mantém a organização ativa no login para permitir pagamento e reativação automática.
   */
  async suspendSubscription(orgId: string): Promise<SubscriptionInfo> {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new AppError('Organização não encontrada.', 404, 'NOT_FOUND');

    let settings: any = {};
    try {
      settings = org.settings ? JSON.parse(org.settings) : {};
    } catch (e) {}

    settings.paymentStatus = 'SUSPENDED';
    settings.suspendedAt = new Date().toISOString();

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: {
        settings: JSON.stringify(settings),
      },
      select: { id: true, createdAt: true, settings: true, isActive: true, slug: true },
    });
    invalidateAuthCache();

    const info = this.calculateSubscription(updated);
    realtimeService.emitToOrganization(orgId, 'subscription:updated', info);

    return info;
  }

  /**
   * Webhook do Stripe: Processa checkout concluído ou fatura paga
   */
  async processStripeWebhook(event: any) {
    console.log(`💳 [Stripe-Webhook] Evento recebido: ${event.type}`);

    // Extrai dados da sessão ou pagamento
    const session = event.data?.object || {};
    const customerEmail =
      session.customer_details?.email ||
      session.customer_email ||
      session.billing_details?.email;

    const clientReferenceId = session.client_reference_id; // orgId se fornecido na URL
    const metadataOrgId = session.metadata?.organizationId;

    let targetOrgId: string | null = clientReferenceId || metadataOrgId || null;

    // Se não veio o orgId diretamente, busca pela conta do administrador através do email de pagamento
    if (!targetOrgId && customerEmail) {
      const user = await prisma.user.findFirst({
        where: {
          email: { equals: customerEmail.trim().toLowerCase(), mode: 'insensitive' },
          deletedAt: null,
        },
        select: { organizationId: true },
      });

      if (user) {
        targetOrgId = user.organizationId;
      }
    }

    if (event.type !== 'checkout.session.completed' && event.type !== 'invoice.paid' && event.type !== 'invoice.payment_succeeded') {
      return { success: true, ignored: true, message: 'Evento ignorado. Nenhum plano foi ativado.' };
    }

    if (event.type === 'checkout.session.completed' && session.payment_status && session.payment_status !== 'paid') {
      return { success: false, message: 'Pagamento ainda não confirmado pela Stripe.' };
    }

    if (!targetOrgId) {
      console.warn('⚠️ [Stripe-Webhook] Não foi possível vincular o pagamento a nenhuma organização:', {
        customerEmail,
        clientReferenceId,
      });
      return { success: false, message: 'Organização não identificada para este pagamento.' };
    }

    // Ativa a assinatura por 30 dias
    console.log(`✅ [Stripe-Webhook] Pagamento confirmado! Ativando assinatura para org ${targetOrgId}...`);
    const info = await this.activateSubscription(targetOrgId, 30, {
      source: 'STRIPE',
      externalId: event.id || session.id,
    });

    return {
      success: true,
      message: 'Assinatura ativada com sucesso via Stripe.',
      organizationId: targetOrgId,
      subscription: info,
    };
  }
}

export const subscriptionService = new SubscriptionService();
