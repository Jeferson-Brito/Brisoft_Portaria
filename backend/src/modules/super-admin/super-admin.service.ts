import { prisma } from '../../lib/prisma.js';
import { subscriptionService, rememberPlanPrice } from '../subscriptions/subscription.service.js';
import { whatsappService } from '../../services/whatsapp/whatsapp.service.js';
import { AppError } from '../../core/errors/app-error.js';
import { invalidateSubscriptionCache } from '../../middlewares/subscription.middleware.js';
import { invalidateAuthCache } from '../../middlewares/auth.middleware.js';
import bcrypt from 'bcryptjs';

function isCustomerOrganization(org: { slug?: string | null; name?: string | null }) {
  const slug = org.slug || '';
  const name = org.name || '';
  if (slug === 'saas-master' || slug.startsWith('system-')) return false;
  if (/saas master/i.test(name)) return false;
  return true;
}

export class SuperAdminService {
  // ─── Organizações ───────────────────────────────────────────

  async listOrganizations(filters: { search?: string; status?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {
      NOT: {
        OR: [
          { slug: 'saas-master' },
          { slug: { startsWith: 'system-' } },
          { name: { contains: 'SaaS Master', mode: 'insensitive' } },
        ],
      },
    };
    if (filters.status === 'active') where.isActive = true;
    if (filters.status === 'inactive') where.isActive = false;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
        { document: { contains: filters.search } },
      ];
    }

    const [organizationsRaw, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        include: {
          whatsappConnection: {
            select: { status: true, phoneConnected: true, lastConnectedAt: true, updatedAt: true },
          },
          _count: {
            select: { users: true, visitRequests: true, clients: true, destinations: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.organization.count({ where }),
    ]);

    const liveWhatsApp = await whatsappService.liveStatuses();
    const organizations = organizationsRaw.map((org) => {
      let settings: any = {};
      try {
        settings = org.settings ? JSON.parse(org.settings) : {};
      } catch (e) {}

      const subscription = subscriptionService.calculateSubscription({
        id: org.id,
        createdAt: org.createdAt,
        settings: org.settings,
        isActive: org.isActive,
        slug: org.slug,
      });
      const paymentStatus = subscription.status;
      const monthlyPrice = paymentStatus === 'ACTIVE' ? subscription.priceMonthly : 0;

      return {
        ...org,
        plan: subscription.plan,
        monthlyPrice,
        paymentStatus,
        address: typeof settings.address === 'string' ? settings.address : '',
        trialEndsAt: subscription.trialEndsAt,
        currentPeriodEnd: subscription.currentPeriodEnd,
        paymentHistory: subscription.paymentHistory,
        isTrial: paymentStatus === 'TRIAL',
        whatsappStatus: liveWhatsApp[org.id]?.status === 'CONNECTED' || org.whatsappConnection?.status === 'CONNECTED'
          ? 'CONNECTED'
          : (liveWhatsApp[org.id]?.status || org.whatsappConnection?.status || 'DISCONNECTED'),
      };
    });

    return {
      organizations,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOrganizationDetails(orgId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        whatsappConnection: {
          select: { status: true, phoneConnected: true, lastConnectedAt: true, updatedAt: true },
        },
        users: {
          where: { deletedAt: null },
          select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
          orderBy: { role: 'asc' },
        },
        _count: {
          select: { visitRequests: true, clients: true, visitors: true, packages: true, destinations: true },
        },
      },
    });

    if (!org) throw new AppError('Organização não encontrada.', 404, 'NOT_FOUND');

    let settings: any = {};
    try {
      settings = org.settings ? JSON.parse(org.settings) : {};
    } catch (e) {}

    const trialDurationMs = (settings.trialDays || 7) * 24 * 60 * 60 * 1000;
    const trialEndsAt = settings.trialEndsAt ? new Date(settings.trialEndsAt) : new Date(new Date(org.createdAt).getTime() + trialDurationMs);
    const isTrial = settings.paymentStatus === 'TRIAL' || (!settings.paymentStatus && Date.now() < trialEndsAt.getTime());
    const paymentStatus = settings.paymentStatus || (isTrial ? 'TRIAL' : (org.isActive ? 'ACTIVE' : 'SUSPENDED'));

    return {
      ...org,
      plan: settings.plan || 'PRO',
      monthlyPrice: typeof settings.monthlyPrice === 'number' ? settings.monthlyPrice : 99.9,
      paymentStatus,
      trialEndsAt: trialEndsAt.toISOString(),
      currentPeriodEnd: settings.currentPeriodEnd || null,
      paymentHistory: Array.isArray(settings.paymentHistory) ? settings.paymentHistory : [],
      isTrial,
      settingsParsed: settings,
      whatsappStatus: org.whatsappConnection?.status || 'DISCONNECTED',
    };
  }

  async createOrganizationManually(data: {
    organizationName: string;
    organizationDocument?: string;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
    adminPhone?: string;
    plan?: string;
    monthlyPrice?: number;
    trialDays?: number;
    paymentStatus?: string;
    address?: string;
  }) {
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

    // Configura os metadados de assinatura / gestão no settings da organização
    const trialDays = data.trialDays ?? 7;
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
    const initialSettings = {
      plan: data.plan || 'PRO',
      monthlyPrice: await this.getPlanPrice(),
      trialDays,
      trialEndsAt: trialEndsAt.toISOString(),
      paymentStatus: data.paymentStatus || 'TRIAL',
      ...(data.address ? { address: data.address.trim() } : {}),
    };

    await prisma.organization.update({
      where: { id: result.organization.id },
      data: {
        settings: JSON.stringify(initialSettings),
      },
    });

    return result;
  }

  async updateOrganization(
    orgId: string,
    data: {
      name?: string;
      document?: string;
      slug?: string;
      isActive?: boolean;
      plan?: string;
      monthlyPrice?: number;
      paymentStatus?: string;
      trialEndsAt?: string;
      settings?: Record<string, any>;
    }
  ) {
    const current = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!current) throw new AppError('Organização não encontrada.', 404, 'NOT_FOUND');

    let currentSettings: any = {};
    try {
      currentSettings = current.settings ? JSON.parse(current.settings) : {};
    } catch (e) {}

    const updatedSettings = {
      ...currentSettings,
      ...(data.settings || {}),
      ...(data.plan ? { plan: data.plan } : {}),
      ...(data.paymentStatus ? { paymentStatus: data.paymentStatus } : {}),
      ...(data.trialEndsAt ? { trialEndsAt: data.trialEndsAt } : {}),
    };

    if (updatedSettings.paymentStatus === 'TRIAL') {
      const end = new Date(updatedSettings.trialEndsAt || 0).getTime();
      if (!updatedSettings.trialEndsAt || end <= Date.now()) {
        const days = updatedSettings.trialDays || 7;
        updatedSettings.trialEndsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      }
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.document !== undefined ? { document: data.document } : {}),
        ...(data.slug ? { slug: data.slug } : {}),
        ...(typeof data.isActive === 'boolean' ? { isActive: data.isActive } : {}),
        ...(data.paymentStatus === 'TRIAL' || data.paymentStatus === 'ACTIVE' ? { isActive: true } : {}),
        settings: JSON.stringify(updatedSettings),
      },
    });

    invalidateSubscriptionCache(orgId);
    invalidateAuthCache();
    return updated;
  }

  async toggleOrganizationActive(orgId: string) {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new AppError('Organização não encontrada.', 404, 'NOT_FOUND');

    const newActiveState = !org.isActive;

    let settings: any = {};
    try {
      settings = org.settings ? JSON.parse(org.settings) : {};
    } catch (e) {}

    settings.paymentStatus = newActiveState ? (settings.paymentStatus === 'SUSPENDED' ? 'ACTIVE' : settings.paymentStatus || 'ACTIVE') : 'SUSPENDED';

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: {
        isActive: newActiveState,
        settings: JSON.stringify(settings),
      },
    });

    invalidateSubscriptionCache(orgId);
    invalidateAuthCache();
    return updated;
  }

  async deleteOrganization(orgId: string) {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new AppError('Organização não encontrada.', 404, 'NOT_FOUND');

    // Remove toda estrutura da organização
    await prisma.organization.delete({
      where: { id: orgId },
    });

    invalidateSubscriptionCache(orgId);
    invalidateAuthCache();
    return { success: true, message: `Organização ${org.name} excluída com sucesso.` };
  }

  // ─── Usuários Multi-empresa ─────────────────────────────────

  async listUsers(filters: { search?: string; organizationId?: string; role?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (filters.organizationId) where.organizationId = filters.organizationId;
    if (filters.role) where.role = filters.role;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          organizationId: true,
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    const usersView = users.map((user) => (
      user.role === 'SUPER_ADMIN'
        ? { ...user, organizationId: null, organization: null }
        : user
    ));

    return {
      users: usersView,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async createUser(data: {
    organizationId: string;
    name: string;
    email: string;
    password: string;
    role?: string;
    phone?: string;
  }) {
    const org = await prisma.organization.findUnique({ where: { id: data.organizationId } });
    if (!org) throw new AppError('Organização não encontrada.', 404, 'NOT_FOUND');

    const existingUser = await prisma.user.findUnique({ where: { email: data.email.toLowerCase().trim() } });
    if (existingUser) throw new AppError('Este e-mail já está cadastrado no sistema.', 409, 'CONFLICT');

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        organizationId: data.organizationId,
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        passwordHash,
        role: data.role || 'CONCIERGE',
        phone: data.phone?.trim() || null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        organizationId: true,
        createdAt: true,
        organization: { select: { id: true, name: true } },
      },
    });

    return user;
  }

  async updateUser(
    userId: string,
    data: {
      name?: string;
      email?: string;
      phone?: string;
      role?: string;
      isActive?: boolean;
      organizationId?: string;
    }
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('Usuário não encontrado.', 404, 'NOT_FOUND');

    if (data.email && data.email.toLowerCase().trim() !== user.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email: data.email.toLowerCase().trim() } });
      if (emailTaken) throw new AppError('Este e-mail já está em uso por outro usuário.', 409, 'CONFLICT');
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.email ? { email: data.email.toLowerCase().trim() } : {}),
        ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
        ...(data.role ? { role: data.role } : {}),
        ...(typeof data.isActive === 'boolean' ? { isActive: data.isActive } : {}),
        ...(data.organizationId ? { organizationId: data.organizationId } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        organizationId: true,
        updatedAt: true,
        organization: { select: { id: true, name: true } },
      },
    });
    invalidateAuthCache(userId);

    return updated;
  }

  async updateUserPassword(userId: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('Usuário não encontrado.', 404, 'NOT_FOUND');

    if (!newPassword || newPassword.length < 6) {
      throw new AppError('A nova senha deve ter no mínimo 6 caracteres.', 400, 'BAD_REQUEST');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { success: true, message: `Senha do usuário ${user.name} alterada com sucesso.` };
  }

  async deleteUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('Usuário não encontrado.', 404, 'NOT_FOUND');

    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), isActive: false },
    });
    invalidateAuthCache(userId);

    return { success: true, message: `Usuário ${user.name} excluído com sucesso.` };
  }

  // ─── Assinaturas & Financeiro ───────────────────────────────

  async listSubscriptions(filters: { status?: string; plan?: string; page?: number; limit?: number }) {
    const orgsResult = await this.listOrganizations({ limit: 100 });
    let subs = orgsResult.organizations;

    if (filters.status) {
      subs = subs.filter((s) => s.paymentStatus.toLowerCase() === filters.status?.toLowerCase());
    }
    if (filters.plan) {
      subs = subs.filter((s) => s.plan.toLowerCase() === filters.plan?.toLowerCase());
    }

    return {
      subscriptions: subs,
      meta: { total: subs.length, page: 1, limit: 100, totalPages: 1 },
    };
  }

  async updateSubscription(
    orgId: string,
    data: {
      plan?: string;
      paymentStatus?: string;
      monthlyPrice?: number;
      trialDays?: number;
      trialEndsAt?: string;
    }
  ) {
    return this.updateOrganization(orgId, {
      plan: data.plan,
      paymentStatus: data.paymentStatus,
      monthlyPrice: data.monthlyPrice,
      trialEndsAt: data.trialEndsAt,
    });
  }

  async activateSubscription(orgId: string, periodDays = 30) {
    return subscriptionService.activateSubscription(orgId, periodDays, { source: 'MANUAL' });
  }

  async getPlanPrice() {
    const setting = await prisma.systemSetting.findFirst({
      where: { key: 'saas_plan_monthly_price' },
    });
    const parsed = setting ? Number(String(setting.value).replace(',', '.')) : 99.9;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 99.9;
  }

  async setPlanPrice(price: number) {
    if (!Number.isFinite(price) || price <= 0) {
      throw new AppError('Informe um valor maior que zero.', 400, 'INVALID_PRICE');
    }
    const anchor = await prisma.organization.findFirst({
      where: {
        OR: [
          { slug: 'saas-master' },
          { slug: { startsWith: 'system-' } },
          { name: { contains: 'SaaS Master', mode: 'insensitive' } },
        ],
      },
    }) || await prisma.organization.findFirst();
    if (!anchor) throw new AppError('Nenhuma empresa base encontrada para gravar o preço.', 404, 'NOT_FOUND');

    await prisma.systemSetting.upsert({
      where: { organizationId_key: { organizationId: anchor.id, key: 'saas_plan_monthly_price' } },
      update: { value: String(price) },
      create: { organizationId: anchor.id, key: 'saas_plan_monthly_price', value: String(price) },
    });

    const companies = await prisma.organization.findMany();
    for (const company of companies) {
      if (!isCustomerOrganization(company)) continue;
      let settings: any = {};
      try {
        settings = company.settings ? JSON.parse(company.settings) : {};
      } catch (e) {}
      settings.monthlyPrice = price;
      await prisma.organization.update({
        where: { id: company.id },
        data: { settings: JSON.stringify(settings) },
      });
      invalidateSubscriptionCache(company.id);
    }
    rememberPlanPrice(price);
    return price;
  }

  async suspendSubscription(orgId: string) {
    return this.updateOrganization(orgId, {
      isActive: false,
      paymentStatus: 'SUSPENDED',
    });
  }

  // ─── Métricas do SaaS Master ────────────────────────────────

  async getDashboardMetrics() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [allOrgs, totalUsers, totalVisits, newOrgsLast30Days] = await Promise.all([
      prisma.organization.findMany({
        where: {
          NOT: {
            OR: [
              { slug: 'saas-master' },
              { slug: { startsWith: 'system-' } },
              { name: { contains: 'SaaS Master', mode: 'insensitive' } },
            ],
          },
        },
        include: {
          whatsappConnection: {
            select: { status: true, phoneConnected: true, updatedAt: true },
          },
          users: {
            where: { role: 'ADMIN' },
            select: { name: true, email: true, phone: true },
            take: 1,
          },
          _count: {
            select: { users: true, clients: true, visitRequests: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.visitRequest.count(),
      prisma.organization.count({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          NOT: {
            OR: [
              { slug: 'saas-master' },
              { slug: { startsWith: 'system-' } },
              { name: { contains: 'SaaS Master', mode: 'insensitive' } },
            ],
          },
        },
      }),
    ]);

    let trialCount = 0;
    let paidActiveCount = 0;
    let pendingPaymentCount = 0;
    let suspendedCount = 0;
    let totalMRR = 0;
    let trialMRR = 0;

    const whatsappDisconnectedAlerts: any[] = [];
    const pendingPaymentAlerts: any[] = [];

    const liveWhatsApp = await whatsappService.liveStatuses();
    const customers = allOrgs.filter(isCustomerOrganization);

    customers.forEach((org) => {
      const subscription = subscriptionService.calculateSubscription({
        id: org.id,
        createdAt: org.createdAt,
        settings: org.settings,
        isActive: org.isActive,
        slug: org.slug,
      });
      const paymentStatus = subscription.status;
      const monthlyPrice = paymentStatus === 'ACTIVE' ? subscription.priceMonthly : 0;

      if (paymentStatus === 'SUSPENDED' || paymentStatus === 'CANCELLED') {
        suspendedCount++;
      } else if (paymentStatus === 'EXPIRED') {
        pendingPaymentCount++;
        pendingPaymentAlerts.push({
          id: org.id,
          name: org.name,
          slug: org.slug,
          monthlyPrice: subscription.priceMonthly,
          admin: org.users[0] || null,
        });
      } else if (paymentStatus === 'TRIAL') {
        trialCount++;
      } else if (paymentStatus === 'ACTIVE') {
        paidActiveCount++;
        totalMRR += monthlyPrice;
      }

      const live = liveWhatsApp[org.id];
      const savedStatus = org.whatsappConnection?.status || 'DISCONNECTED';
      const waStatus = live?.status === 'CONNECTED' || savedStatus === 'CONNECTED'
        ? 'CONNECTED'
        : (live?.status || savedStatus);
      if (waStatus !== 'CONNECTED') {
        whatsappDisconnectedAlerts.push({
          id: org.id,
          name: org.name,
          slug: org.slug,
          status: waStatus,
          phoneConnected: live?.phoneConnected || org.whatsappConnection?.phoneConnected || null,
          admin: org.users[0] || null,
        });
      }
    });

    const recentOrganizations = customers.slice(0, 6).map((org) => {
      const subscription = subscriptionService.calculateSubscription({
        id: org.id,
        createdAt: org.createdAt,
        settings: org.settings,
        isActive: org.isActive,
        slug: org.slug,
      });
      const live = liveWhatsApp[org.id];
      const savedStatus = org.whatsappConnection?.status || 'DISCONNECTED';
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        document: org.document,
        createdAt: org.createdAt,
        isActive: org.isActive,
        plan: subscription.plan,
        monthlyPrice: subscription.status === 'ACTIVE' ? subscription.priceMonthly : 0,
        paymentStatus: subscription.status,
        admin: org.users[0] || null,
        usersCount: org._count.users,
        clientsCount: org._count.clients,
        whatsappStatus: live?.status === 'CONNECTED' || savedStatus === 'CONNECTED' ? 'CONNECTED' : (live?.status || savedStatus),
      };
    });

    return {
      organizations: {
        total: customers.length,
        active: customers.filter((org) => org.isActive).length,
        suspended: suspendedCount,
        newLast30Days: newOrgsLast30Days,
      },
      subscriptions: {
        paidActive: paidActiveCount,
        trial: trialCount,
        pending: pendingPaymentCount,
        suspended: suspendedCount,
        totalMRR,
        trialMRR,
      },
      whatsapp: {
        total: customers.length,
        connected: customers.length - whatsappDisconnectedAlerts.length,
        disconnected: whatsappDisconnectedAlerts.length,
        disconnectedList: whatsappDisconnectedAlerts,
      },
      alerts: {
        whatsappDisconnected: whatsappDisconnectedAlerts,
        pendingPayments: pendingPaymentAlerts,
      },
      recentOrganizations,
      usage: {
        totalUsers,
        totalVisits,
      },
    };
  }
}
