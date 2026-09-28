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
    return {
      subscriptions: [],
      meta: { total: 0, page, limit, totalPages: 0 },
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
    return { id: orgId, organizationId: orgId, plan: data.plan || 'ACTIVE', status: data.status || 'ACTIVE' };
  }

  // Ativa manualmente uma assinatura (ex: após confirmar pagamento manual)
  async activateSubscription(orgId: string, periodDays = 30) {
    return { id: orgId, organizationId: orgId, plan: 'BASIC', status: 'ACTIVE' };
  }

  // Suspende uma assinatura (ex: inadimplência)
  async suspendSubscription(orgId: string) {
    return { id: orgId, organizationId: orgId, plan: 'BASIC', status: 'SUSPENDED' };
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
      Promise.resolve(0), // prisma.subscription.count({ where: { status: 'TRIAL' } }),
      Promise.resolve(0), // prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      Promise.resolve(0), // prisma.subscription.count({ where: { status: 'SUSPENDED' } }),
      Promise.resolve(0), // prisma.subscription.count({ where: { status: 'EXPIRED' } }),
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

    // Assinaturas removidas temporariamente.

    return result;
  }
}
