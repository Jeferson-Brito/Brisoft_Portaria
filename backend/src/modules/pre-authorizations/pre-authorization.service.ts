import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { realtimeService } from '../../services/realtime/realtime.service.js';
import { randomBytes } from 'crypto';
import { matchesWeekday, normalizeWeekdays } from '../../utils/weekdays.js';
import { restrictionService } from '../restrictions/restriction.service.js';

export interface CreatePreAuthorizationParams {
  organizationId: string;
  clientId: string;
  destinationId: string;
  visitorName: string;
  visitorDocument?: string;
  company?: string;
  phone?: string;
  visitorType?: string;
  startDate: string; // ISO date string (YYYY-MM-DD ou ISO)
  endDate: string;
  expectedTimeStart?: string; // "14:00"
  expectedTimeEnd?: string;   // "18:00"
  vehicleModel?: string;
  vehiclePlate?: string;
  notes?: string;
  weekdays?: number[] | string | null;
}

export interface CheckInPreAuthorizedParams {
  preAuthorizationId: string;
  organizationId: string;
  conciergeUserId: string;
  photoUrl?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  vehicleColor?: string;
  notes?: string;
  acknowledgeRestriction?: boolean;
}

export class PreAuthorizationService {
  // Gera código amigável de solicitação ao efetivar entrada
  private async generateRequestCode(organizationId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.visitRequest.count({
      where: { organizationId },
    });
    const seq = String(count + 1).padStart(6, '0');
    return `REQ-${year}-${seq}`;
  }

  // Cadastrar pré-autorização (Seção 27)
  async create(data: CreatePreAuthorizationParams) {
    if (!data.visitorName || data.visitorName.trim().length === 0) {
      throw new AppError('O nome do visitante é obrigatório para a pré-autorização.', 400, 'VISITOR_NAME_REQUIRED');
    }

    // Valida cliente
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, organizationId: data.organizationId, deletedAt: null },
    });
    if (!client) {
      throw new AppError('Cliente responsável não encontrado.', 404, 'CLIENT_NOT_FOUND');
    }

    // Valida destino
    const destination = await prisma.destination.findFirst({
      where: { id: data.destinationId, organizationId: data.organizationId, deletedAt: null },
    });
    if (!destination) {
      throw new AppError('Destino/unidade não encontrado.', 404, 'DESTINATION_NOT_FOUND');
    }

    const start = parseCalendarDate(data.startDate, false);
    const end = parseCalendarDate(data.endDate, true);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError('Datas de início e término inválidas.', 400, 'INVALID_DATES');
    }

    if (end < start) {
      throw new AppError('A data de término não pode ser anterior à data de início.', 400, 'END_DATE_BEFORE_START');
    }

    const preAuth = await prisma.preAuthorization.create({
      data: {
        organizationId: data.organizationId,
        clientId: data.clientId,
        destinationId: data.destinationId,
        visitorName: data.visitorName.trim(),
        visitorDocument: data.visitorDocument ? data.visitorDocument.trim() : null,
        company: data.company ? data.company.trim() : null,
        phone: data.phone ? data.phone.trim() : null,
        visitorType: data.visitorType || 'Visitante',
        startDate: start,
        endDate: end,
        expectedTimeStart: data.expectedTimeStart || null,
        expectedTimeEnd: data.expectedTimeEnd || null,
        notes: data.notes ? data.notes.trim() : null,
        vehicleModel: data.vehicleModel ? data.vehicleModel.trim() : null,
        vehiclePlate: data.vehiclePlate ? data.vehiclePlate.trim() : null,
        qrToken: `VIS-${randomBytes(4).toString('hex').toUpperCase()}`,
        weekdays: normalizeWeekdays(data.weekdays),
        isUsed: false,
      },
      include: {
        client: true,
        destination: true,
      },
    });

    return preAuth;
  }

  // Lista pré-autorizações válidas hoje com busca rápida (Seção 27)
  async listActiveToday(organizationId: string, search?: string) {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Margem de 24h para cobrir variações de fusos locais (ex: UTC-3 vs UTC)
    const startOfToday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const whereClause: any = {
      organizationId,
      isUsed: false,
      cancelledAt: null,
      startDate: { lte: endOfToday },
      endDate: { gte: startOfToday },
    };

    if (search && search.trim().length > 0) {
      const q = search.trim();
      whereClause.OR = [
        { visitorName: { contains: q } },
        { visitorDocument: { contains: q } },
        { company: { contains: q } },
        { client: { name: { contains: q } } },
        { destination: { name: { contains: q } } },
      ];
    }

    const items = await prisma.preAuthorization.findMany({
      where: whereClause,
      include: {
        client: true,
        destination: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return items.filter((item) => matchesWeekday(item.weekdays));
  }

  // Listar todas as pré-autorizações (com paginação e filtros)
  async listAll(organizationId: string, options: { isUsed?: boolean; page?: number; limit?: number }) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 20));
    const skip = (page - 1) * limit;

    const whereClause: any = {
      organizationId,
    };

    if (typeof options.isUsed === 'boolean') {
      whereClause.isUsed = options.isUsed;
    }

    const [total, items] = await Promise.all([
      prisma.preAuthorization.count({ where: whereClause }),
      prisma.preAuthorization.findMany({
        where: whereClause,
        include: {
          client: true,
          destination: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Detalhes da pré-autorização
  async getById(id: string, organizationId: string) {
    const item = await prisma.preAuthorization.findFirst({
      where: { id, organizationId },
      include: {
        client: true,
        destination: true,
      },
    });

    if (!item) {
      throw new AppError('Pré-autorização não encontrada.', 404, 'PRE_AUTH_NOT_FOUND');
    }

    return item;
  }

  // Efetivar entrada do visitante pré-autorizado na portaria (Seção 27)
  async checkInPreAuthorized(params: CheckInPreAuthorizedParams) {
    const preAuth = await prisma.preAuthorization.findFirst({
      where: { id: params.preAuthorizationId, organizationId: params.organizationId },
      include: {
        client: true,
        destination: true,
      },
    });

    if (!preAuth) {
      throw new AppError('Pré-autorização não encontrada.', 404, 'PRE_AUTH_NOT_FOUND');
    }

    const recurring = Boolean(preAuth.weekdays);
    if (preAuth.isUsed && !recurring) {
      throw new AppError('Esta pré-autorização já foi utilizada para entrada.', 400, 'PRE_AUTH_ALREADY_USED');
    }
    if (recurring && !matchesWeekday(preAuth.weekdays)) {
      throw new AppError('Este convite recorrente não vale neste dia da semana.', 400, 'QR_WRONG_WEEKDAY');
    }

    await restrictionService.assertReleaseAllowed({
      organizationId: params.organizationId,
      actorUserId: params.conciergeUserId,
      name: preAuth.visitorName,
      documentNumber: preAuth.visitorDocument,
      acknowledge: params.acknowledgeRestriction,
      entity: 'PreAuthorization',
      entityId: preAuth.id,
    });

    // Localiza ou cadastra o visitante no sistema
    let visitor = await prisma.visitor.findFirst({
      where: {
        organizationId: params.organizationId,
        OR: [
          preAuth.visitorDocument ? { documentNumber: preAuth.visitorDocument } : { name: preAuth.visitorName },
          { name: preAuth.visitorName },
        ],
      },
    });

    if (!visitor) {
      visitor = await prisma.visitor.create({
        data: {
          organizationId: params.organizationId,
          name: preAuth.visitorName,
          documentNumber: preAuth.visitorDocument || null,
          phone: preAuth.phone || null,
          company: preAuth.company || null,
          photoUrl: params.photoUrl || null,
        },
      });
    } else if (params.photoUrl && !visitor.photoUrl) {
      visitor = await prisma.visitor.update({
        where: { id: visitor.id },
        data: { photoUrl: params.photoUrl },
      });
    }

    // Veículo se informado
    let vehicleId: string | null = null;
    if (params.vehicleModel) {
      const vehicle = await prisma.vehicle.create({
        data: {
          visitorId: visitor.id,
          model: params.vehicleModel.trim(),
          licensePlate: params.vehiclePlate ? params.vehiclePlate.trim().toUpperCase() : null,
          color: params.vehicleColor ? params.vehicleColor.trim() : null,
        },
      });
      vehicleId = vehicle.id;
    }

    const code = await this.generateRequestCode(params.organizationId);

    // Cria a solicitação já no estado AUTHORIZED com entrada liberada
    const visitRequest = await prisma.visitRequest.create({
      data: {
        organizationId: params.organizationId,
        code,
        clientId: preAuth.clientId,
        destinationId: preAuth.destinationId,
        visitorId: visitor.id,
        vehicleId,
        conciergeUserId: params.conciergeUserId,
        visitorType: preAuth.visitorType,
        visitReason: preAuth.notes || 'Entrada pré-autorizada pelo cliente',
        status: 'AUTHORIZED',
        answeredAt: new Date(),
        notes: params.notes ? params.notes.trim() : null,
      },
      include: {
        client: true,
        destination: true,
        visitor: true,
        vehicle: true,
        conciergeUser: { select: { id: true, name: true } },
      },
    });

    // Registra eventos na timeline
    await prisma.visitEvent.createMany({
      data: [
        {
          visitRequestId: visitRequest.id,
          eventType: 'CREATED',
          description: `Solicitação criada a partir da pré-autorização #${preAuth.id.substring(0, 8)}.`,
          actorType: 'USER',
          actorId: params.conciergeUserId,
        },
        {
          visitRequestId: visitRequest.id,
          eventType: 'AUTHORIZED',
          description: `Entrada liberada de forma imediata por pré-autorização do cliente ${preAuth.client.name}.`,
          actorType: 'USER',
          actorId: params.conciergeUserId,
        },
      ],
    });

    if (!preAuth.weekdays) {
      await prisma.preAuthorization.update({
        where: { id: preAuth.id },
        data: { isUsed: true },
      });
    }

    // Notifica em tempo real via WebSocket
    realtimeService.notifyVisitRequestCreated(params.organizationId, visitRequest);

    realtimeService.notifyAlert(params.organizationId, {
      title: 'Entrada Pré-Autorizada Liberada!',
      message: `Visitante ${preAuth.visitorName} liberado para ${preAuth.destination.name} (Cliente: ${preAuth.client.name}).`,
      type: 'AUTHORIZED',
      visitRequestId: visitRequest.id,
      visitorName: preAuth.visitorName,
      clientName: preAuth.client.name,
      destinationName: preAuth.destination.name,
    });

    return {
      success: true,
      message: `Entrada do visitante pré-autorizado ${preAuth.visitorName} liberada com sucesso!`,
      visitRequest,
    };
  }

  async findByToken(token: string, organizationId: string) {
    const code = token.trim().toUpperCase();
    const item = await prisma.preAuthorization.findFirst({
      where: { qrToken: code, organizationId },
      include: { client: true, destination: true },
    });
    if (!item) {
      throw new AppError('Convite não encontrado nesta empresa.', 404, 'QR_NOT_FOUND');
    }
    if (item.cancelledAt) {
      throw new AppError('Este convite foi cancelado.', 400, 'QR_CANCELLED');
    }
    if (item.isUsed && !item.weekdays) {
      throw new AppError('Este convite já foi utilizado.', 400, 'QR_USED');
    }
    if (item.weekdays && !matchesWeekday(item.weekdays)) {
      throw new AppError('Este convite não vale neste dia da semana.', 400, 'QR_WRONG_WEEKDAY');
    }
    const now = new Date();
    if (now < item.startDate || now > item.endDate) {
      throw new AppError('Este convite está fora do período autorizado.', 400, 'QR_EXPIRED');
    }
    const clock = new Date().toLocaleTimeString('en-GB', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    if (item.expectedTimeStart && clock < item.expectedTimeStart) {
      throw new AppError('Ainda não chegou o horário autorizado deste convite.', 400, 'QR_TOO_EARLY');
    }
    if (item.expectedTimeEnd && clock > item.expectedTimeEnd) {
      throw new AppError('O horário autorizado deste convite já terminou.', 400, 'QR_EXPIRED');
    }
    return item;
  }

  // Cancelar ou remover pré-autorização
  async cancel(id: string, organizationId: string) {
    const item = await prisma.preAuthorization.findFirst({
      where: { id, organizationId },
    });

    if (!item) {
      throw new AppError('Pré-autorização não encontrada.', 404, 'PRE_AUTH_NOT_FOUND');
    }

    if (item.isUsed) {
      throw new AppError('Não é possível cancelar uma pré-autorização já utilizada.', 400, 'ALREADY_USED');
    }

    await prisma.preAuthorization.update({
      where: { id },
      data: { cancelledAt: new Date() },
    });

    return { success: true, message: 'Pré-autorização cancelada com sucesso.' };
  }
}

export const preAuthorizationService = new PreAuthorizationService();

function parseCalendarDate(value: string, endOfDay: boolean) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return new Date(value);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const iso = `${match[1]}-${match[2]}-${match[3]}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}-03:00`;
  const date = new Date(iso);
  if (date.getUTCFullYear() < year - 1) return date;
  if (month < 1 || month > 12 || day < 1 || day > 31) return new Date(NaN);
  return date;
}
