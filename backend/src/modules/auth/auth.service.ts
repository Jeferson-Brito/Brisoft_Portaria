import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../core/errors/app-error.js';

export interface LoginParams {
  email: string;
  password: string;
}

export interface RegisterParams {
  // Dados da empresa
  organizationName: string;
  organizationDocument?: string; // CNPJ
  // Dados do administrador (dono da assinatura)
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  adminPhone?: string;
}

export class AuthService {
  // Registro público: cria empresa + admin + subscription trial (7 dias)
  async register({ organizationName, organizationDocument, adminName, adminEmail, adminPassword, adminPhone }: RegisterParams) {
    if (adminPassword.length < 8) {
      throw new AppError('A senha deve ter no mínimo 8 caracteres.', 400, 'INVALID_PASSWORD');
    }

    // Verifica e-mail único
    const existingUser = await prisma.user.findFirst({
      where: { email: adminEmail.trim().toLowerCase(), deletedAt: null },
    });
    if (existingUser) {
      throw new AppError('Este e-mail já está em uso. Faça login ou utilize outro e-mail.', 409, 'EMAIL_IN_USE');
    }

    // Gera slug único a partir do nome da empresa
    let slug = organizationName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);

    const existingSlug = await prisma.organization.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    // Trial de 7 dias
    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);

    // Transação atômica: tudo ou nada
    const result = await prisma.$transaction(async (tx) => {
      // 1. Organização
      const organization = await tx.organization.create({
        data: {
          name: organizationName.trim(),
          slug,
          document: organizationDocument?.trim() || null,
          settings: JSON.stringify({
            type: 'RESIDENTIAL',
            companyName: organizationName.trim(),
            unitLabel: 'Apartamento / Unidade',
            clientLabel: 'Morador',
          }),
        },
      });

      // 2. Assinatura Trial
      const subscription = await tx.subscription.create({
        data: {
          organizationId: organization.id,
          plan: 'TRIAL',
          status: 'TRIAL',
          trialEndsAt,
          maxUsers: 10,
        },
      });

      // 3. Templates de mensagem padrão
      await tx.messageTemplate.createMany({
        data: [
          {
            organizationId: organization.id,
            type: 'APPROVAL_REQUEST',
            title: 'Solicitação de Autorização',
            content:
              'Olá, {{cliente}}! Há um visitante aguardando sua autorização na portaria.\n\n👤 *Visitante:* {{visitante}}\n🏢 *Empresa:* {{empresa}}\n📋 *Motivo:* {{motivo}}\n⏰ *Chegada:* {{horario}}\n🚗 *Veículo:* {{veiculo}}\n\nPor favor, responda com:\n*1* para *AUTORIZAR*\n*2* para *RECUSAR*',
          },
          {
            organizationId: organization.id,
            type: 'REMINDER',
            title: 'Lembrete de Autorização',
            content:
              '⏳ Olá, {{cliente}}! O visitante *{{visitante}}* ainda aguarda sua liberação na portaria.\n\nPor favor, responda com *1* para *AUTORIZAR* ou *2* para *RECUSAR*.',
          },
        ],
      });

      // 4. Usuário administrador (dono da assinatura)
      const admin = await tx.user.create({
        data: {
          organizationId: organization.id,
          name: adminName.trim(),
          email: adminEmail.trim().toLowerCase(),
          passwordHash,
          role: 'ADMIN',
          phone: adminPhone?.trim() || null,
        },
      });

      return { organization, admin, subscription };
    });

    return {
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
      },
      admin: {
        id: result.admin.id,
        name: result.admin.name,
        email: result.admin.email,
        role: result.admin.role,
        organizationId: result.organization.id,
        organizationName: result.organization.name,
      },
      subscription: {
        plan: 'TRIAL',
        status: 'TRIAL',
        trialEndsAt: trialEndsAt.toISOString(),
        daysRemaining: 7,
      },
    };
  }

  async authenticate({ email, password }: LoginParams) {
    const user = await prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        deletedAt: null,
      },
      include: {
        organization: {
          include: {
            subscription: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('E-mail ou senha incorretos.', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      throw new AppError('Este usuário está inativo. Contate o administrador.', 403, 'USER_INACTIVE');
    }

    // SUPER_ADMIN não precisa de org ativa
    if (user.role !== 'SUPER_ADMIN' && !user.organization.isActive) {
      throw new AppError('A organização está inativa no sistema.', 403, 'ORGANIZATION_INACTIVE');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      throw new AppError('E-mail ou senha incorretos.', 401, 'INVALID_CREDENTIALS');
    }

    // Atualiza último login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Log de auditoria
    await prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        action: 'LOGIN',
        entity: 'User',
        entityId: user.id,
        payload: JSON.stringify({ role: user.role, email: user.email }),
      },
    });

    // Calcula info da assinatura
    const sub = user.organization.subscription;
    let subscriptionInfo: any = null;
    if (sub && user.role !== 'SUPER_ADMIN') {
      const now = new Date();
      let daysRemaining = null;
      if (sub.trialEndsAt) {
        daysRemaining = Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - now.getTime()) / 86400000));
      }
      subscriptionInfo = {
        plan: sub.plan,
        status: sub.status,
        trialEndsAt: sub.trialEndsAt,
        daysRemaining,
      };
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
        subscription: subscriptionInfo,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
            subscription: {
              select: {
                plan: true,
                status: true,
                trialEndsAt: true,
                currentPeriodEnd: true,
              },
            },
          },
        },
      },
    });

    if (!user || user.deletedAt) {
      throw new AppError('Usuário não encontrado.', 404, 'USER_NOT_FOUND');
    }

    const sub = user.organization.subscription;
    const now = new Date();
    let daysRemaining = null;
    if (sub?.trialEndsAt) {
      daysRemaining = Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - now.getTime()) / 86400000));
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        slug: user.organization.slug,
        isActive: user.organization.isActive,
      },
      subscription: sub
        ? {
            plan: sub.plan,
            status: sub.status,
            trialEndsAt: sub.trialEndsAt,
            currentPeriodEnd: sub.currentPeriodEnd,
            daysRemaining,
          }
        : null,
    };
  }
}
