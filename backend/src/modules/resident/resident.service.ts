import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { preAuthorizationService } from '../pre-authorizations/pre-authorization.service.js';
import { whatsappService } from '../../services/whatsapp/whatsapp.service.js';
import QRCode from 'qrcode';
import { inviteUrl } from '../invites/invite.routes.js';
import { formatWhatsAppNumber } from '../../utils/phone.util.js';

async function loadResident(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organization: { select: { id: true, name: true } },
      client: {
        include: {
          destinations: {
            include: { destination: true },
          },
        },
      },
    },
  });

  if (!user || user.deletedAt || user.role !== 'CLIENT' || !user.client || user.client.deletedAt) {
    throw new AppError('Seu usuário não está vinculado a um morador desta empresa.', 403, 'RESIDENT_NOT_LINKED');
  }

  if (user.client.organizationId !== user.organizationId) {
    throw new AppError('Vínculo de morador inválido para esta empresa.', 403, 'TENANT_MISMATCH');
  }

  const units = user.client.destinations
    .filter((item) => item.destination && !item.destination.deletedAt)
    .map((item) => ({
      id: item.destination.id,
      name: item.destination.name,
      block: item.destination.block,
      isPrimary: item.isPrimary,
    }));

  return { user, client: user.client, units };
}

export class ResidentService {
  async context(userId: string) {
    const { user, client, units } = await loadResident(userId);
    const pendingPackages = await prisma.package.count({
      where: {
        organizationId: user.organizationId,
        clientId: client.id,
        status: 'RECEIVED',
      },
    });

    return {
      resident: { id: client.id, name: client.name },
      organization: { id: user.organization.id, name: user.organization.name },
      units,
      pendingPackages,
    };
  }

  async listVisits(userId: string) {
    const { user, client } = await loadResident(userId);
    return prisma.preAuthorization.findMany({
      where: { organizationId: user.organizationId, clientId: client.id },
      include: { destination: { select: { id: true, name: true, block: true } } },
      orderBy: { startDate: 'desc' },
      take: 100,
    });
  }

  async getVisit(userId: string, visitId: string) {
    const { user, client } = await loadResident(userId);
    const visit = await prisma.preAuthorization.findFirst({
      where: { id: visitId, organizationId: user.organizationId, clientId: client.id },
      include: { destination: { select: { id: true, name: true, block: true } } },
    });
    if (!visit) {
      throw new AppError('Visita não encontrada.', 404, 'VISIT_NOT_FOUND');
    }
    return visit;
  }

  async createVisit(userId: string, input: {
    visitorName: string;
    phone?: string;
    document?: string;
    company?: string;
    reason?: string;
    date: string;
    entryTime?: string;
    exitTime?: string;
    vehicleModel?: string;
    vehiclePlate?: string;
    notes?: string;
    destinationId?: string;
  }) {
    const { user, client, units } = await loadResident(userId);
    const destinationId = input.destinationId || units.find((unit) => unit.isPrimary)?.id || units[0]?.id;
    if (!destinationId || !units.some((unit) => unit.id === destinationId)) {
      throw new AppError('A unidade informada não pertence a este morador.', 403, 'UNIT_FORBIDDEN');
    }

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    if (input.date < today) {
      throw new AppError('Não é possível agendar uma visita para uma data que já passou.', 400, 'PAST_DATE');
    }

    let phone = input.phone?.replace(/\D/g, '') || '';
    if (phone) {
      try {
        phone = formatWhatsAppNumber(phone);
      } catch {
        throw new AppError('Informe o celular do visitante com DDD.', 400, 'INVALID_PHONE');
      }
    }

    const visit = await preAuthorizationService.create({
      organizationId: user.organizationId,
      clientId: client.id,
      destinationId,
      visitorName: input.visitorName,
      visitorDocument: input.document,
      company: input.company,
      phone,
      visitorType: input.reason || 'Visita',
      startDate: input.date,
      endDate: input.date,
      expectedTimeStart: input.entryTime,
      expectedTimeEnd: input.exitTime,
      notes: input.notes,
      vehicleModel: input.vehicleModel,
      vehiclePlate: input.vehiclePlate,
    });

    await prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        action: 'RESIDENT_VISIT_CREATED',
        entity: 'PreAuthorization',
        entityId: visit.id,
        payload: JSON.stringify({ clientId: client.id, destinationId }),
      },
    });

    if (phone && visit.qrToken) {
      sendVisitorInvite(user.organizationId, user.organization.name, visit, phone).catch((err) => {
        console.warn('Convite não enviado no WhatsApp:', err?.message || err);
      });
    }

    return visit;
  }

  async cancelVisit(userId: string, visitId: string) {
    const { user, client } = await loadResident(userId);
    const visit = await prisma.preAuthorization.findFirst({
      where: { id: visitId, organizationId: user.organizationId, clientId: client.id },
    });
    if (!visit) {
      throw new AppError('Visita não encontrada.', 404, 'VISIT_NOT_FOUND');
    }
    if (visit.isUsed || visit.cancelledAt) {
      throw new AppError('Esta visita não pode mais ser cancelada.', 400, 'VISIT_NOT_CANCELLABLE');
    }

    const updated = await prisma.preAuthorization.update({
      where: { id: visit.id },
      data: { cancelledAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        action: 'RESIDENT_VISIT_CANCELLED',
        entity: 'PreAuthorization',
        entityId: visit.id,
        payload: JSON.stringify({ clientId: client.id, destinationId: visit.destinationId }),
      },
    });

    return updated;
  }

  async listPackages(userId: string) {
    const { user, client } = await loadResident(userId);
    return prisma.package.findMany({
      where: { organizationId: user.organizationId, clientId: client.id },
      select: {
        id: true,
        code: true,
        carrier: true,
        sender: true,
        trackingCode: true,
        status: true,
        receivedAt: true,
        pickupCode: true,
        recipientName: true,
        notes: true,
        destination: { select: { name: true, block: true } },
      },
      orderBy: { receivedAt: 'desc' },
      take: 50,
    });
  }
}

async function sendVisitorInvite(organizationId: string, organizationName: string, visit: any, phone: string) {
  const link = inviteUrl(visit.qrToken);
  const unit = `${visit.destination?.name || 'Unidade'}${visit.destination?.block ? ` · ${visit.destination.block}` : ''}`;
  const date = new Date(visit.startDate).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const text = `Você foi convidado por *${visit.client?.name || 'um morador'}* para visitar:\n\n*${organizationName}*\n${unit}\n\nData: ${date}\nHorário: ${visit.expectedTimeStart || '00:00'} às ${visit.expectedTimeEnd || '23:59'}\nVisitante: ${visit.visitorName}\n\nApresente este QR Code na portaria.\n${link}`;
  const qr = await QRCode.toDataURL(visit.qrToken, { width: 480, margin: 1 });
  await whatsappService.sendImageMessage(organizationId, phone, qr, text);
}

export const residentService = new ResidentService();
