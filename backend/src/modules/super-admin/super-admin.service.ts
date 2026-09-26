import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { invalidateSubscriptionCache } from '../../middlewares/subscription.middleware.js';
import bcrypt from 'bcryptjs';

export class SuperAdminService {
  // ─── Organizações ───────────────────────────────────────────

  async listOrganizations(filters: { search?: string; status?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.status === 'active') where.isActive = true;
    if (filters.status === 'inactive') where.isActive = false;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
        { document: { contains: filters.search } },
      ];
    }

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        include: {
          subscription: true,
          _count: {
            select: { users: true, visitRequests: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.organization.count({ where }),
    ]);

    return {
      organizations,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOrganizationDetails(orgId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        subscription: true,
        users: {
          where: { deletedAt: null },
          select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
          orderBy: { role: 'asc' },
        },
        _count: {
          select: { visitRequests: true, clients: true, visitors: true, packages: true },
        },
      },
    });

    if (!org) throw new AppError('Organização não encontrada.', 404, 'NOT_FOUND');
    return org;
  }

  async toggleOrganizationActive(orgId: string) {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new AppError('Organização não encontrada.', 404, 'NOT_FOUND');

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: { isActive: !org.isActive },
    });

    invalidateSubscriptionCache(orgId);
    return updated;
  }

  // ─── Assinaturas ────────────────────────────────────────────

  async listSubscriptions(filters: { status?: string; plan?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.plan) where.plan = filters.plan;

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          organization: {
            select: { id: true, name: true, slug: true, isActive: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.subscription.count({ where }),
    ]);

    return {
      subscriptions,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateSubscription(
    orgId: string,
    data: {
      plan?: string;
      status?: string;
      trialEndsAt?: string;
      currentPeriodEnd?: string;
      maxUsers?: number;
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
    }
  ) {
    const sub = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
    if (!sub) throw new AppError('Assinatura não encontrada para esta organização.', 404, 'NOT_FOUND');

    const updated = await prisma.subscription.update({
      where: { organizationId: orgId },
      data: {
        ...(data.plan && { plan: data.plan }),
        ...(data.status && { status: data.status }),
        ...(data.trialEndsAt !== undefined && { trialEndsAt: data.trialEndsAt ? new Date(data.trialEndsAt) : null }),
        ...(data.currentPeriodEnd !== undefined && { currentPeriodEnd: data.currentPeriodEnd ? new Date(data.currentPeriodEnd) : null }),
        ...(data.maxUsers !== undefined && { maxUsers: data.maxUsers }),
        ...(data.stripeCustomerId !== undefined && { stripeCustomerId: data.stripeCustomerId }),
        ...(data.stripeSubscriptionId !== undefined && { stripeSubscriptionId: data.stripeSubscriptionId }),
      },
      include: {
        organization: { select: { name: true, slug: true } },
      },
    });

    invalidateSubscriptionCache(orgId);
    return updated;
  }

  // Ativa manualmente uma assinatura (ex: após confirmar pagamento manual)
  async activateSubscription(orgId: string, periodDays = 30) {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + periodDays);

    const updated = await prisma.subscription.update({
      where: { organizationId: orgId },
      data: {
        plan: 'BASIC',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialEndsAt: null,
      },
    });

    invalidateSubscriptionCache(orgId);
    return updated;
  }

  // Suspende uma assinatura (ex: inadimplência)
  async suspendSubscription(orgId: string) {
    const updated = await prisma.subscription.update({
      where: { organizationId: orgId },
      data: { status: 'SUSPENDED' },
    });

    invalidateSubscriptionCache(orgId);
    return updated;
  }

  // ─── Métricas do SaaS ───────────────────────────────────────

  async getDashboardMetrics() {
    const [
      totalOrgs,
      activeOrgs,
      trialOrgs,
      activeSubscriptions,
      suspendedSubscriptions,
      expiredSubscriptions,
      totalUsers,
      totalVisitRequests,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { isActive: true } }),
      prisma.subscription.count({ where: { status: 'TRIAL' } }),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { status: 'SUSPENDED' } }),
      prisma.subscription.count({ where: { status: 'EXPIRED' } }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.visitRequest.count(),
    ]);

    return {
      organizations: { total: totalOrgs, active: activeOrgs },
      subscriptions: {
        trial: trialOrgs,
        active: activeSubscriptions,
        suspended: suspendedSubscriptions,
        expired: expiredSubscriptions,
        mrr: activeSubscriptions * 149, // R$149 por assinatura ativa
      },
      usage: { totalUsers, totalVisitRequests },
    };
  }

  // Cria uma organização manualmente (pelo SUPER_ADMIN)
  async createOrganizationManually(data: {
    organizationName: string;
    organizationDocument?: string;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
    adminPhone?: string;
    plan?: string;
    trialDays?: number;
  }) {
    // Reutiliza a mesma lógica do register público
    const { AuthService } = await import('../auth/auth.service.js');
    const authService = new AuthService();
    const result = await authService.register({
      organizationName: data.organizationName,
      organizationDocument: data.organizationDocument,
      adminName: data.adminName,
      adminEmail: data.adminEmail,
      adminPassword: data.adminPassword,
      adminPhone: data.adminPhone,
    });

    // Se super admin especificou um plano diferente, atualiza
    if (data.plan && data.plan !== 'TRIAL') {
      await this.activateSubscription(result.organization.id, data.trialDays || 30);
    } else if (data.trialDays) {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + data.trialDays);
      await prisma.subscription.update({
        where: { organizationId: result.organization.id },
        data: { trialEndsAt },
      });
    }

    return result;
  }
}
