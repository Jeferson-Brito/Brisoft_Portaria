import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { subscriptionService } from '../subscriptions/subscription.service.js';
import { cnpjExistsAtRevenue, isValidCnpj, isValidCpf, onlyDigits } from '../../utils/cnpj.js';
import { isDisposableEmail, isGmailAddress, normalizeEmail } from '../../utils/email.js';
import { verificationService } from '../../services/verification.service.js';
import { adminNotificationService } from '../../services/admin-notification.service.js';
import { formatWhatsAppNumber, sameWhatsappNumber } from '../../utils/phone.util.js';
import { invalidateAuthCache } from '../../middlewares/auth.middleware.js';

export interface LoginParams {
  email: string;
  password: string;
}

export interface RegisterParams {
  // Dados da empresa
  organizationName: string;
  organizationDocument?: string;
  documentType?: 'CPF' | 'CNPJ';
  // Dados do administrador (dono da assinatura)
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  adminPhone?: string;
  verificationCode?: string;
}

export class AuthService {
  async register({
    organizationName,
    organizationDocument,
    documentType = 'CNPJ',
    adminName,
    adminEmail,
    adminPassword,
    adminPhone,
    verificationCode,
  }: RegisterParams) {
    if (adminPassword.length < 8) {
      throw new AppError('A senha deve ter no mínimo 8 caracteres.', 400, 'INVALID_PASSWORD');
    }

    const documentDigits = onlyDigits(organizationDocument || '');
    await this.assertDocument(documentType, documentDigits);

    const rawEmail = adminEmail.trim().toLowerCase();
    const email = normalizeEmail(rawEmail);
    if (isDisposableEmail(email)) {
      throw new AppError('Use um e-mail permanente. Endereços temporários não podem criar conta.', 400, 'DISPOSABLE_EMAIL');
    }

    if (await this.emailAlreadyClaimed(rawEmail, email)) {
      throw new AppError('Este e-mail já está em uso. Faça login ou utilize outro e-mail.', 409, 'EMAIL_IN_USE');
    }

    if (await this.documentAlreadyClaimed(documentDigits)) {
      throw new AppError(
        documentType === 'CPF' ? 'Este CPF já está cadastrado.' : 'Este CNPJ já está cadastrado.',
        409,
        'DOCUMENT_IN_USE'
      );
    }

    let whatsappNumber = '';
    try {
      whatsappNumber = formatWhatsAppNumber(adminPhone || '');
    } catch {
      throw new AppError('Informe um WhatsApp válido com DDD e 9 dígitos.', 400, 'INVALID_PHONE');
    }
    if (await this.whatsappAlreadyUsed(whatsappNumber)) {
      throw new AppError('Este número de WhatsApp já está cadastrado.', 409, 'PHONE_IN_USE');
    }
    if (!verificationCode || !/^\d{6}$/.test(verificationCode.trim())) {
      throw new AppError('Confirme o código de 6 números enviado no WhatsApp.', 400, 'CODE_REQUIRED');
    }
    await verificationService.consume({
      email,
      phone: whatsappNumber,
      purpose: 'REGISTER',
      code: verificationCode,
    });

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

    try {
      const result = await prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: {
            name: organizationName.trim(),
            slug,
            document: documentDigits,
            settings: JSON.stringify({
              type: 'RESIDENTIAL',
              companyName: organizationName.trim(),
              unitLabel: 'Apartamento / Unidade',
              clientLabel: 'Morador',
            }),
          },
        });

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

        const admin = await tx.user.create({
          data: {
            organizationId: organization.id,
            name: adminName.trim(),
            email,
            passwordHash,
            role: 'ADMIN',
            phone: whatsappNumber,
            whatsappNumber,
            whatsappVerifiedAt: new Date(),
            mustCompleteProfile: false,
          },
        });

        await tx.trialClaim.create({
          data: {
            documentDigits,
            emailNormalized: email,
          },
        });

        return { organization, admin };
      });

      adminNotificationService.notifyQuietly(async () => {
        await adminNotificationService.notifyNewOrganization({
          organizationId: result.organization.id,
          organizationName: result.organization.name,
          adminName: result.admin.name,
          adminEmail: result.admin.email,
          createdAt: result.organization.createdAt,
        });
        await adminNotificationService.notifyNewUser({
          userId: result.admin.id,
          name: result.admin.name,
          email: result.admin.email,
          role: result.admin.role,
          organizationId: result.organization.id,
          organizationName: result.organization.name,
          createdAt: result.admin.createdAt,
        });
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
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = JSON.stringify(err.meta?.target || '');
        if (target.includes('document')) {
          throw new AppError('Este documento já está cadastrado.', 409, 'DOCUMENT_IN_USE');
        }
        throw new AppError('Este e-mail já está em uso. Faça login ou utilize outro e-mail.', 409, 'EMAIL_IN_USE');
      }
      throw err;
    }
  }

  async assertDocument(documentType: 'CPF' | 'CNPJ', document: string) {
    const documentDigits = onlyDigits(document);
    if (documentType === 'CPF') {
      if (!isValidCpf(documentDigits)) {
        throw new AppError('Este CPF é inválido. Confira os números digitados.', 400, 'INVALID_CPF');
      }
    } else if (!isValidCnpj(documentDigits)) {
      throw new AppError('Este CNPJ é inválido. Confira os números digitados.', 400, 'INVALID_CNPJ');
    } else {
      try {
        const exists = await cnpjExistsAtRevenue(documentDigits);
        if (!exists) {
          throw new AppError('Este CNPJ não existe na Receita Federal.', 400, 'INVALID_CNPJ');
        }
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError('Não foi possível confirmar o CNPJ agora. Tente novamente.', 503, 'CNPJ_LOOKUP_FAILED');
      }
    }

    if (await this.documentAlreadyClaimed(documentDigits)) {
      throw new AppError(
        documentType === 'CPF' ? 'Este CPF já está cadastrado.' : 'Este CNPJ já está cadastrado.',
        409,
        'DOCUMENT_IN_USE'
      );
    }
  }

  async whatsappAlreadyUsed(phone: string, exceptUserId?: string) {
    const digits = onlyDigits(phone);
    const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
    if (local.length < 10) return false;

    if (exceptUserId) {
      const owner = await prisma.user.findUnique({
        where: { id: exceptUserId },
        select: { client: { select: { whatsappNumber: true } } },
      });
      const ownNumber = owner?.client?.whatsappNumber;
      if (ownNumber && sameWhatsappNumber(phone, ownNumber)) return false;
    }

    const candidates = await prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [{ whatsappNumber: { contains: local.slice(-8) } }, { phone: { contains: local.slice(-8) } }],
      },
      select: { id: true, whatsappNumber: true, phone: true },
    });
    return candidates.some((item) => {
      if (exceptUserId && item.id === exceptUserId) return false;
      const saved = item.whatsappNumber || item.phone || '';
      return sameWhatsappNumber(phone, saved);
    });
  }

  private async emailAlreadyClaimed(rawEmail: string, canonicalEmail: string) {
    const direct = await prisma.user.findFirst({
      where: { OR: [{ email: rawEmail }, { email: canonicalEmail }] },
      select: { id: true },
    });
    if (direct) return true;

    const claim = await prisma.trialClaim.findUnique({
      where: { emailNormalized: canonicalEmail },
      select: { id: true },
    });
    if (claim) return true;

    if (!isGmailAddress(rawEmail)) return false;

    const candidates = await prisma.user.findMany({
      where: {
        OR: [{ email: { endsWith: '@gmail.com' } }, { email: { endsWith: '@googlemail.com' } }],
      },
      select: { email: true },
    });
    return candidates.some((candidate) => normalizeEmail(candidate.email) === canonicalEmail);
  }

  private async documentAlreadyClaimed(documentDigits: string) {
    const claim = await prisma.trialClaim.findUnique({
      where: { documentDigits },
      select: { id: true },
    });
    if (claim) return true;

    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM organizations
      WHERE regexp_replace(coalesce(document, ''), '[^0-9]', '', 'g') = ${documentDigits}
      LIMIT 1
    `;
    return rows.length > 0;
  }

  private async findUserByEmail(rawEmail: string, canonicalEmail: string) {
    const include = {
      organization: true,
      client: {
        include: {
          destinations: { include: { destination: true } },
        },
      },
    } as const;

    const direct = await prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ email: rawEmail }, { email: canonicalEmail }],
      },
      include,
    });
    if (direct) return direct;
    if (!isGmailAddress(rawEmail)) return null;

    const candidates = await prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [{ email: { endsWith: '@gmail.com' } }, { email: { endsWith: '@googlemail.com' } }],
      },
      select: { id: true, email: true },
    });
    const match = candidates.find((candidate) => normalizeEmail(candidate.email) === canonicalEmail);
    if (!match) return null;

    return prisma.user.findFirst({
      where: { id: match.id, deletedAt: null },
      include,
    });
  }

  async requestPasswordReset(email: string) {
    const rawEmail = email.trim().toLowerCase();
    const canonicalEmail = normalizeEmail(rawEmail);
    const user = await this.findUserByEmail(rawEmail, canonicalEmail);

    // Sempre responde de forma genérica ao cliente (anti-enumeração).
    // Só envia o código quando a conta existe e tem WhatsApp confirmado.
    if (user?.whatsappVerifiedAt && user.whatsappNumber) {
      try {
        await verificationService.send({
          email: user.email,
          phone: user.whatsappNumber,
          purpose: 'PASSWORD_RESET',
          userId: user.id,
          organizationId: user.organizationId,
        });
      } catch (err: any) {
        console.error('[Auth] Falha ao enviar código de reset:', err?.message || err);
      }
    }
  }

  async checkResetCode(email: string, code: string) {
    const rawEmail = email.trim().toLowerCase();
    const user = await this.findUserByEmail(rawEmail, normalizeEmail(rawEmail));
    if (!user) {
      throw new AppError('Código incorreto ou expirado. Peça um novo código.', 400, 'CODE_INVALID');
    }
    await verificationService.matches({
      email: user.email,
      purpose: 'PASSWORD_RESET',
      code,
    });
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    if (newPassword.length < 8) {
      throw new AppError('A nova senha deve ter no mínimo 8 caracteres.', 400, 'INVALID_PASSWORD');
    }

    const rawEmail = email.trim().toLowerCase();
    const canonicalEmail = normalizeEmail(rawEmail);
    const user = await this.findUserByEmail(rawEmail, canonicalEmail);
    if (!user) {
      throw new AppError('Código incorreto ou expirado. Peça um novo código.', 400, 'CODE_INVALID');
    }

    await verificationService.consume({
      email: user.email,
      purpose: 'PASSWORD_RESET',
      code,
    });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustCompleteProfile: false },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        action: 'PASSWORD_RESET',
        entity: 'User',
        entityId: user.id,
        payload: JSON.stringify({ email: user.email }),
      },
    });
  }

  async sendWhatsappCode(userId: string, phone: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new AppError('Usuário não encontrado.', 404, 'USER_NOT_FOUND');
    }
    const whatsappNumber = formatWhatsAppNumber(phone);
    if (await this.whatsappAlreadyUsed(whatsappNumber, user.id)) {
      throw new AppError('Este número de WhatsApp já está cadastrado.', 409, 'PHONE_IN_USE');
    }
    await verificationService.send({
      email: user.email,
      phone: whatsappNumber,
      purpose: 'WHATSAPP_CONFIRM',
      userId: user.id,
      organizationId: user.organizationId,
    });
    return { phone: whatsappNumber };
  }

  async confirmOwnWhatsappCode(userId: string, phone: string, code: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new AppError('Usuário não encontrado.', 404, 'USER_NOT_FOUND');
    }
    const whatsappNumber = formatWhatsAppNumber(phone);
    if (await this.whatsappAlreadyUsed(whatsappNumber, user.id)) {
      throw new AppError('Este número de WhatsApp já está cadastrado.', 409, 'PHONE_IN_USE');
    }
    await verificationService.consume({
      email: user.email,
      phone: whatsappNumber,
      purpose: 'WHATSAPP_CONFIRM',
      code,
    });
    await prisma.user.update({
      where: { id: user.id },
      data: {
        phone: whatsappNumber,
        whatsappNumber,
        whatsappVerifiedAt: new Date(),
      },
    });
    invalidateAuthCache(user.id);
    return { phone: whatsappNumber, whatsappVerified: true };
  }

  async completeProfile(userId: string, newPassword: string, phone: string, code: string) {
    if (newPassword.length < 8) {
      throw new AppError('A nova senha deve ter no mínimo 8 caracteres.', 400, 'INVALID_PASSWORD');
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new AppError('Usuário não encontrado.', 404, 'USER_NOT_FOUND');
    }
    const whatsappNumber = formatWhatsAppNumber(phone);
    if (await this.whatsappAlreadyUsed(whatsappNumber, user.id)) {
      throw new AppError('Este número de WhatsApp já está cadastrado.', 409, 'PHONE_IN_USE');
    }

    const alreadyVerified =
      Boolean(user.whatsappVerifiedAt) &&
      Boolean(user.whatsappNumber) &&
      sameWhatsappNumber(user.whatsappNumber || '', whatsappNumber);

    if (!alreadyVerified) {
      await verificationService.consume({
        email: user.email,
        phone: whatsappNumber,
        purpose: 'WHATSAPP_CONFIRM',
        code,
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        phone: whatsappNumber,
        whatsappNumber,
        whatsappVerifiedAt: new Date(),
        mustCompleteProfile: false,
      },
    });
    if (user.clientId) {
      await prisma.client.update({
        where: { id: user.clientId },
        data: { whatsappNumber },
      });
    }
    invalidateAuthCache(user.id);
    return this.getProfile(user.id);
  }

  async authenticate({ email, password }: LoginParams) {
    const rawEmail = email.trim().toLowerCase();
    const canonicalEmail = normalizeEmail(rawEmail);
    const user = await this.findUserByEmail(rawEmail, canonicalEmail);

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
    const subscriptionInfo = subscriptionService.calculateSubscription(user.organization);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
        subscription: subscriptionInfo,
        clientId: user.clientId,
        mustCompleteProfile: user.mustCompleteProfile,
        whatsappVerified: Boolean(user.whatsappVerifiedAt),
        whatsappNumber: user.client?.whatsappNumber || user.whatsappNumber || user.phone || null,
        resident: user.client
          ? {
              id: user.client.id,
              name: user.client.name,
              units: user.client.destinations.map((item) => ({
                id: item.destination.id,
                name: item.destination.name,
                block: item.destination.block,
                isPrimary: item.isPrimary,
              })),
            }
          : null,
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
            createdAt: true,
            settings: true,
          },
        },
        client: {
          include: { destinations: { include: { destination: true } } },
        },
      },
    });

    if (!user || user.deletedAt) {
      throw new AppError('Usuário não encontrado.', 404, 'USER_NOT_FOUND');
    }

    const subscriptionInfo = subscriptionService.calculateSubscription(user.organization);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      clientId: user.clientId,
      mustCompleteProfile: user.mustCompleteProfile,
      whatsappVerified: Boolean(user.whatsappVerifiedAt),
      whatsappNumber: user.client?.whatsappNumber || user.whatsappNumber || user.phone || null,
      resident: user.client
        ? {
            id: user.client.id,
            name: user.client.name,
            units: user.client.destinations.map((item) => ({
              id: item.destination.id,
              name: item.destination.name,
              block: item.destination.block,
              isPrimary: item.isPrimary,
            })),
          }
        : null,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        slug: user.organization.slug,
        isActive: user.organization.isActive,
      },
      subscription: subscriptionInfo,
    };
  }
}
