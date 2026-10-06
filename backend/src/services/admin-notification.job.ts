import { prisma } from '../lib/prisma.js';
import { subscriptionService } from '../modules/subscriptions/subscription.service.js';
import { adminNotificationService } from './admin-notification.service.js';

function isCustomerOrganization(org: { slug?: string | null; name?: string | null }) {
  const slug = org.slug || '';
  const name = org.name || '';
  if (slug === 'saas-master' || slug.startsWith('system-')) return false;
  if (/saas master/i.test(name) || /brisoft portaria \[system\]/i.test(name)) return false;
  return true;
}

async function loadPrimaryAdmin(organizationId: string) {
  return prisma.user.findFirst({
    where: {
      organizationId,
      deletedAt: null,
      role: { in: ['ADMIN', 'SUPERVISOR'] },
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: { name: true, email: true },
  });
}

export class AdminNotificationJob {
  private timer: NodeJS.Timeout | null = null;

  async runOnce() {
    const config = await adminNotificationService.getConfig();
    if (!config.active) return;

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

      const subscription = subscriptionService.calculateSubscription(org);
      if (subscription.status === 'TRIAL' || subscription.status === 'ACTIVE') continue;

      const admin = await loadPrimaryAdmin(org.id);

      if (subscription.status === 'EXPIRED') {
        const history = Array.isArray(subscription.paymentHistory) ? subscription.paymentHistory : [];
        const everPaid = history.some((item) => item.source !== 'COMPLIMENTARY' && item.amount > 0);
        if (!everPaid) {
          await adminNotificationService.notifyTrialEnded({
            organizationId: org.id,
            organizationName: org.name,
            adminName: admin?.name,
            adminEmail: admin?.email,
            createdAt: org.createdAt,
            plan: subscription.plan,
          });
        } else {
          await adminNotificationService.notifySubscriptionPending({
            organizationId: org.id,
            organizationName: org.name,
            status: subscription.status,
            reason: 'A assinatura desta empresa venceu e o acesso está bloqueado.',
            adminName: admin?.name,
            adminEmail: admin?.email,
          });
        }
        continue;
      }

      if (subscription.status === 'SUSPENDED' || subscription.status === 'CANCELLED') {
        await adminNotificationService.notifySubscriptionPending({
          organizationId: org.id,
          organizationName: org.name,
          status: subscription.status,
          reason:
            subscription.status === 'SUSPENDED'
              ? 'A assinatura desta empresa está suspensa.'
              : 'A assinatura desta empresa foi cancelada.',
          adminName: admin?.name,
          adminEmail: admin?.email,
        });
      }
    }
  }

  start() {
    const ONE_HOUR = 60 * 60 * 1000;
    this.runOnce().catch((err) => {
      console.error('[AdminNotificationJob] Erro na primeira execução:', err?.message || err);
    });
    this.timer = setInterval(() => {
      this.runOnce().catch((err) => {
        console.error('[AdminNotificationJob] Erro na execução periódica:', err?.message || err);
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

export const adminNotificationJob = new AdminNotificationJob();
