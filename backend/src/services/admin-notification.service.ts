import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../core/errors/app-error.js';
import { formatWhatsAppNumber } from '../utils/phone.util.js';
import { whatsappService } from './whatsapp/whatsapp.service.js';

export type AdminNotificationType =
  | 'NEW_ORGANIZATION'
  | 'NEW_USER'
  | 'TRIAL_ENDED'
  | 'TRIAL_ENDING'
  | 'SUBSCRIPTION_PENDING'
  | 'SUBSCRIPTION_DUE'
  | 'SUBSCRIPTION_LATE'
  | 'SUBSCRIPTION_SUSPENDED'
  | 'TRIAL_ENDED_CUSTOMER';

const KEY_PHONE = 'admin_notifications_phone';
const KEY_ENABLED = 'admin_notifications_enabled';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Superadministrador',
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  CONCIERGE: 'Porteiro',
  CLIENT: 'Morador',
};

function brazilDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );
  return {
    data: `${parts.day}/${parts.month}/${parts.year}`,
    hora: `${parts.hour}:${parts.minute}`,
  };
}

async function resolvePlatformOrganizationId() {
  const admin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN', deletedAt: null, isActive: true },
    select: { organizationId: true },
  });
  if (admin?.organizationId) return admin.organizationId;

  const anchor =
    (await prisma.organization.findFirst({
      where: {
        OR: [
          { slug: 'saas-master' },
          { slug: { startsWith: 'system-' } },
          { name: { contains: 'SaaS Master', mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    })) || (await prisma.organization.findFirst({ select: { id: true } }));

  return anchor?.id || null;
}

export class AdminNotificationService {
  async getConfig() {
    const organizationId = await resolvePlatformOrganizationId();
    if (!organizationId) {
      return { phone: null as string | null, enabled: false, active: false };
    }

    const rows = await prisma.systemSetting.findMany({
      where: {
        organizationId,
        key: { in: [KEY_PHONE, KEY_ENABLED] },
      },
    });
    const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    const phone = map[KEY_PHONE] || null;
    const enabled = map[KEY_ENABLED] !== 'false' && Boolean(phone);
    return {
      phone,
      enabled: map[KEY_ENABLED] !== 'false',
      active: enabled,
    };
  }

  async saveConfig(input: { phone?: string | null; enabled?: boolean; clearPhone?: boolean }) {
    const organizationId = await resolvePlatformOrganizationId();
    if (!organizationId) {
      throw new AppError('Organização da plataforma não encontrada.', 404, 'NOT_FOUND');
    }

    if (input.clearPhone) {
      await prisma.systemSetting.deleteMany({
        where: { organizationId, key: KEY_PHONE },
      });
    } else if (input.phone !== undefined) {
      if (!input.phone?.trim()) {
        await prisma.systemSetting.deleteMany({
          where: { organizationId, key: KEY_PHONE },
        });
      } else {
        let formatted = '';
        try {
          formatted = formatWhatsAppNumber(input.phone);
        } catch {
          throw new AppError('Informe um WhatsApp válido com DDD.', 400, 'INVALID_PHONE');
        }
        await prisma.systemSetting.upsert({
          where: { organizationId_key: { organizationId, key: KEY_PHONE } },
          update: { value: formatted },
          create: { organizationId, key: KEY_PHONE, value: formatted },
        });
      }
    }

    if (typeof input.enabled === 'boolean') {
      await prisma.systemSetting.upsert({
        where: { organizationId_key: { organizationId, key: KEY_ENABLED } },
        update: { value: input.enabled ? 'true' : 'false' },
        create: { organizationId, key: KEY_ENABLED, value: input.enabled ? 'true' : 'false' },
      });
    }

    return this.getConfig();
  }

  notifyQuietly(task: () => Promise<void>) {
    void task().catch((err) => {
      console.error('[AdminNotification] Falha não bloqueante:', err?.message || err);
    });
  }

  async notifyNewOrganization(params: {
    organizationId: string;
    organizationName: string;
    adminName: string;
    adminEmail: string;
    createdAt?: Date;
  }) {
    const { data, hora } = brazilDateParts(params.createdAt || new Date());
    const message =
      `🔔 *Nova empresa cadastrada*\n\n` +
      `Uma nova empresa acabou de se cadastrar na plataforma.\n\n` +
      `*Empresa:* ${params.organizationName}\n` +
      `*Responsável:* ${params.adminName}\n` +
      `*E-mail:* ${params.adminEmail}\n` +
      `*Data:* ${data}\n` +
      `*Horário:* ${hora}\n\n` +
      `Acesse o painel administrativo para visualizar os detalhes.`;

    await this.dispatch({
      type: 'NEW_ORGANIZATION',
      dedupeKey: `NEW_ORGANIZATION:${params.organizationId}`,
      message,
      relatedEntity: 'Organization',
      relatedEntityId: params.organizationId,
      payload: params,
    });
  }

  async notifyNewUser(params: {
    userId: string;
    name: string;
    email: string;
    role: string;
    organizationId: string;
    organizationName: string;
    createdAt?: Date;
  }) {
    if (params.role === 'SUPER_ADMIN') return;

    const { data, hora } = brazilDateParts(params.createdAt || new Date());
    const message =
      `👤 *Novo usuário cadastrado*\n\n` +
      `Um novo usuário foi cadastrado na plataforma.\n\n` +
      `*Nome:* ${params.name}\n` +
      `*E-mail:* ${params.email}\n` +
      `*Empresa:* ${params.organizationName}\n` +
      `*Perfil:* ${ROLE_LABELS[params.role] || params.role}\n` +
      `*Data:* ${data}\n` +
      `*Horário:* ${hora}`;

    await this.dispatch({
      type: 'NEW_USER',
      dedupeKey: `NEW_USER:${params.userId}`,
      message,
      relatedEntity: 'User',
      relatedEntityId: params.userId,
      payload: params,
    });
  }

  async notifyTrialEnded(params: {
    organizationId: string;
    organizationName: string;
    adminName?: string | null;
    adminEmail?: string | null;
    createdAt?: Date | string | null;
    plan?: string | null;
  }) {
    const created = params.createdAt ? brazilDateParts(new Date(params.createdAt)) : null;
    const message =
      `⚠️ *Período de teste encerrado*\n\n` +
      `A empresa abaixo atingiu o fim do período de teste e ainda não possui uma assinatura ativa.\n\n` +
      `*Empresa:* ${params.organizationName}\n` +
      `*Responsável:* ${params.adminName || 'Não informado'}\n` +
      `*E-mail:* ${params.adminEmail || 'Não informado'}\n` +
      `*Data de cadastro:* ${created?.data || 'Não informada'}\n` +
      `*Plano:* ${params.plan || 'PRO'}\n\n` +
      `Verifique o status da assinatura no painel administrativo.`;

    await this.dispatch({
      type: 'TRIAL_ENDED',
      dedupeKey: `TRIAL_ENDED:${params.organizationId}`,
      message,
      relatedEntity: 'Organization',
      relatedEntityId: params.organizationId,
      payload: params,
    });
  }

  async notifySubscriptionPending(params: {
    organizationId: string;
    organizationName: string;
    status: string;
    reason: string;
    adminName?: string | null;
    adminEmail?: string | null;
  }) {
    const message =
      `💳 *Assinatura pendente*\n\n` +
      `${params.reason}\n\n` +
      `*Empresa:* ${params.organizationName}\n` +
      `*Status:* ${params.status}\n` +
      `*Responsável:* ${params.adminName || 'Não informado'}\n` +
      `*E-mail:* ${params.adminEmail || 'Não informado'}\n\n` +
      `Verifique o status da assinatura no painel administrativo.`;

    await this.dispatch({
      type: 'SUBSCRIPTION_PENDING',
      dedupeKey: `SUBSCRIPTION_PENDING:${params.organizationId}:${params.status}`,
      message,
      relatedEntity: 'Organization',
      relatedEntityId: params.organizationId,
      payload: params,
    });
  }

  /**
   * Envia WhatsApp ao cliente (admin da empresa) com dedupe próprio.
   * Usa o número WhatsApp da plataforma.
   */
  async dispatchCustomerWhatsApp(params: {
    type: string;
    dedupeKey: string;
    phone: string;
    message: string;
    relatedEntity?: string;
    relatedEntityId?: string;
    payload?: unknown;
  }) {
    let logId: string | null = null;
    try {
      const created = await prisma.adminNotificationLog.create({
        data: {
          type: params.type,
          dedupeKey: params.dedupeKey,
          destinationPhone: params.phone,
          status: 'PENDING',
          relatedEntity: params.relatedEntity,
          relatedEntityId: params.relatedEntityId,
          messagePreview: params.message.slice(0, 500),
          payload: params.payload ? JSON.stringify(params.payload) : null,
        },
        select: { id: true },
      });
      logId = created.id;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return;
      }
      throw err;
    }

    try {
      await whatsappService.sendPlatformMessage(params.phone, params.message);
      await prisma.adminNotificationLog.update({
        where: { id: logId! },
        data: { status: 'SENT', errorMessage: null },
      });
    } catch (err: any) {
      const errorMessage = err?.message || 'Falha ao enviar notificação ao cliente.';
      console.error(`[AdminNotification] ${params.type} CUSTOMER FAILED:`, errorMessage);
      await prisma.adminNotificationLog.update({
        where: { id: logId! },
        data: { status: 'FAILED', errorMessage: errorMessage.slice(0, 500) },
      });
    }
  }

  private async dispatch(params: {
    type: AdminNotificationType;
    dedupeKey: string;
    message: string;
    relatedEntity?: string;
    relatedEntityId?: string;
    payload?: unknown;
  }) {
    const config = await this.getConfig();
    if (!config.active || !config.phone) {
      return;
    }

    let logId: string | null = null;
    try {
      const created = await prisma.adminNotificationLog.create({
        data: {
          type: params.type,
          dedupeKey: params.dedupeKey,
          destinationPhone: config.phone,
          status: 'PENDING',
          relatedEntity: params.relatedEntity,
          relatedEntityId: params.relatedEntityId,
          messagePreview: params.message.slice(0, 500),
          payload: params.payload ? JSON.stringify(params.payload) : null,
        },
        select: { id: true },
      });
      logId = created.id;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return;
      }
      throw err;
    }

    try {
      await whatsappService.sendPlatformMessage(config.phone, params.message);
      await prisma.adminNotificationLog.update({
        where: { id: logId },
        data: { status: 'SENT', errorMessage: null },
      });
    } catch (err: any) {
      const errorMessage = err?.message || 'Falha ao enviar notificação administrativa.';
      console.error(`[AdminNotification] ${params.type} FAILED:`, errorMessage);
      await prisma.adminNotificationLog.update({
        where: { id: logId },
        data: { status: 'FAILED', errorMessage: errorMessage.slice(0, 500) },
      });
    }
  }
}

export const adminNotificationService = new AdminNotificationService();
