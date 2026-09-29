import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { whatsappService } from '../../services/whatsapp/whatsapp.service.js';
import { realtimeService } from '../../services/realtime/realtime.service.js';

export interface CreateVisitRequestParams {
  organizationId: string;
  conciergeUserId: string;
  clientId: string;
  destinationId: string;
  visitorId: string;
  vehicleId?: string;
  visitorType: string;
  visitReason: string;
  notes?: string;
}

export interface HistoryFilters {
  status?: string;
  clientId?: string;
  visitorId?: string;
  conciergeUserId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class VisitRequestService {
  // Gera código sequencial amigável: REQ-2026-000001
  private async generateRequestCode(organizationId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.visitRequest.count({
      where: { organizationId },
    });
    const seq = String(count + 1).padStart(6, '0');
    return `REQ-${year}-${seq}`;
  }

  // Formata segundos em MM:SS ou HH:MM:SS para exibição do tempo de espera
  public formatWaitTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${String(hrs).padStart(2, '0')}:${String(remainingMins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  async create(data: CreateVisitRequestParams) {
    if (!data.visitReason || data.visitReason.trim().length === 0) {
      throw new AppError('O motivo da visita é obrigatório.', 400, 'VISIT_REASON_REQUIRED');
    }

    // Validações em paralelo com Promise.all para máxima performance de resposta
    const [client, destination, visitor, reqCount] = await Promise.all([
      prisma.client.findFirst({
        where: { id: data.clientId, organizationId: data.organizationId, deletedAt: null },
      }),
      prisma.destination.findFirst({
        where: { id: data.destinationId, organizationId: data.organizationId, deletedAt: null },
      }),
      prisma.visitor.findFirst({
        where: { id: data.visitorId, organizationId: data.organizationId },
      }),
      prisma.visitRequest.count({
        where: { organizationId: data.organizationId },
      }),
    ]);

    if (!client) {
      throw new AppError('Cliente responsável não encontrado.', 404, 'CLIENT_NOT_FOUND');
    }
    if (!destination) {
      throw new AppError('Destino/unidade não encontrado.', 404, 'DESTINATION_NOT_FOUND');
    }
    if (!visitor) {
      throw new AppError('Visitante não encontrado.', 404, 'VISITOR_NOT_FOUND');
    }

    const year = new Date().getFullYear();
    const seq = String(reqCount + 1).padStart(6, '0');
    const code = `REQ-${year}-${seq}`;

    const visitRequest = await prisma.visitRequest.create({
      data: {
        organizationId: data.organizationId,
        code,
        clientId: data.clientId,
        destinationId: data.destinationId,
        visitorId: data.visitorId,
        vehicleId: data.vehicleId || null,
        conciergeUserId: data.conciergeUserId,
        visitorType: data.visitorType || 'Visitante',
        visitReason: data.visitReason.trim(),
        notes: data.notes ? data.notes.trim() : null,
        status: 'PENDING',
      },
      include: {
        client: true,
        destination: true,
        visitor: true,
        vehicle: true,
        conciergeUser: { select: { id: true, name: true } },
      },
    });

    // Registra evento 1: Criação da solicitação na Timeline
    await prisma.visitEvent.create({
      data: {
        visitRequestId: visitRequest.id,
        eventType: 'CREATED',
        description: `Solicitação criada pelo porteiro ${visitRequest.conciergeUser.name} para ${destination.name}.`,
        actorType: 'USER',
        actorId: data.conciergeUserId,
        metadata: JSON.stringify({
          clientName: client.name,
          clientWhatsApp: client.whatsappNumber,
          visitorName: visitor.name,
          reason: data.visitReason,
        }),
      },
    });

    // Dispara mensagem de WhatsApp para o morador de forma desacoplada (Seção 20)
    whatsappService.dispatchApprovalNotification(visitRequest.id, data.organizationId).catch((err) => {
      console.warn('Erro ao despachar notificação WhatsApp:', err);
    });

    // Notifica instantaneamente a portaria via WebSocket em tempo real
    realtimeService.notifyVisitRequestCreated(data.organizationId, visitRequest);

    return visitRequest;
  }

  // Lista solicitações em aberto (PENDING) com cálculo de tempo pelo servidor (Seções 24 e 25)
  async listPending(organizationId: string) {
    const serverNow = new Date();

    const requests = await prisma.visitRequest.findMany({
      where: {
        organizationId,
        status: 'PENDING',
      },
      include: {
        client: true,
        destination: true,
        visitor: true,
        vehicle: true,
        conciergeUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((req) => {
      const waitSeconds = Math.max(0, Math.floor((serverNow.getTime() - req.createdAt.getTime()) / 1000));
      return {
        ...req,
        serverTime: serverNow.toISOString(),
        waitingTimeSeconds: waitSeconds,
        waitingTimeFormatted: this.formatWaitTime(waitSeconds),
      };
    });
  }

  // Contadores para o Dashboard
  async getDashboardSummary(organizationId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [pendingCount, authorizedCount, presentCount, deniedTodayCount] = await Promise.all([
      prisma.visitRequest.count({
        where: { organizationId, status: 'PENDING' },
      }),
      prisma.visitRequest.count({
        where: { organizationId, status: 'AUTHORIZED' },
      }),
      prisma.visitRequest.count({
        where: { organizationId, status: 'ENTERED' },
      }),
      prisma.visitRequest.count({
        where: {
          organizationId,
          status: 'DENIED',
          updatedAt: { gte: today },
        },
      }),
    ]);

    return {
      pendingCount,
      authorizedCount,
      presentCount,
      deniedTodayCount,
    };
  }

  // Reenviar mensagem de WhatsApp com limite de reenvios (Seção 26)
  async remind(id: string, organizationId: string, actorUserId: string) {
    const req = await prisma.visitRequest.findFirst({
      where: { id, organizationId },
      include: { conciergeUser: true, client: true, visitor: true },
    });

    if (!req) {
      throw new AppError('Solicitação não encontrada.', 404, 'NOT_FOUND');
    }

    if (req.status !== 'PENDING') {
      throw new AppError('Apenas solicitações com status PENDING podem ser reenviadas.', 400, 'INVALID_STATUS');
    }

    // Limite de reenvios (máximo de 3 conforme regra de negócio)
    const MAX_REMINDERS = 3;
    if (req.remindersSentCount >= MAX_REMINDERS) {
      throw new AppError(`Limite máximo de ${MAX_REMINDERS} lembretes atingido para esta solicitação.`, 429, 'MAX_REMINDERS_EXCEEDED');
    }

    const updated = await prisma.visitRequest.update({
      where: { id },
      data: {
        remindersSentCount: req.remindersSentCount + 1,
        lastReminderAt: new Date(),
      },
    });

    // Registra evento na timeline
    await prisma.visitEvent.create({
      data: {
        visitRequestId: id,
        eventType: 'REMINDER_SENT',
        description: `Lembrete ${updated.remindersSentCount}/${MAX_REMINDERS} reenviado para o morador ${req.client.name}.`,
        actorType: 'USER',
        actorId: actorUserId,
      },
    });

    // Despacha lembrete no WhatsApp
    whatsappService.dispatchReminderNotification(id, organizationId).catch((err) => {
      console.warn('Erro ao despachar lembrete WhatsApp:', err);
    });

    realtimeService.notifyVisitRequestUpdated(organizationId, updated);

    return updated;
  }

  // Cancelar solicitação aberta
  async cancel(id: string, organizationId: string, actorUserId: string, reason?: string) {
    const req = await prisma.visitRequest.findFirst({
      where: { id, organizationId },
    });

    if (!req) {
      throw new AppError('Solicitação não encontrada.', 404, 'NOT_FOUND');
    }

    if (req.status !== 'PENDING' && req.status !== 'AUTHORIZED') {
      throw new AppError('Esta solicitação não pode mais ser cancelada.', 400, 'INVALID_STATUS');
    }

    const updated = await prisma.visitRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await prisma.visitEvent.create({
      data: {
        visitRequestId: id,
        eventType: 'CANCELLED',
        description: `Solicitação cancelada na portaria. Motivo: ${reason || 'Cancelado pelo porteiro'}.`,
        actorType: 'USER',
        actorId: actorUserId,
      },
    });

    realtimeService.notifyVisitRequestUpdated(organizationId, updated);

    return updated;
  }

  // Autorização manual de contingência (pelo porteiro, supervisor ou contato telefônico)
  async manualAuthorize(id: string, organizationId: string, actorUserId: string, reason?: string) {
    const req = await prisma.visitRequest.findFirst({
      where: { id, organizationId },
    });

    if (!req) {
      throw new AppError('Solicitação não encontrada.', 404, 'NOT_FOUND');
    }

    if (req.status !== 'PENDING') {
      throw new AppError('Apenas solicitações pendentes podem ser autorizadas.', 400, 'INVALID_STATUS');
    }

    const updated = await prisma.visitRequest.update({
      where: { id },
      data: {
        status: 'AUTHORIZED',
        answeredAt: new Date(),
      },
    });

    await prisma.visitEvent.create({
      data: {
        visitRequestId: id,
        eventType: 'AUTHORIZED',
        description: `Entrada autorizada manualmente na portaria. Canal: ${reason || 'Contato telefônico com morador'}.`,
        actorType: 'USER',
        actorId: actorUserId,
      },
    });

    realtimeService.notifyVisitRequestUpdated(organizationId, updated);

    realtimeService.notifyAlert(organizationId, {
      title: 'Entrada Autorizada (Manual)',
      message: `Solicitação ${req.code} foi autorizada manualmente na portaria.`,
      type: 'AUTHORIZED',
      visitRequestId: id,
    });

    return updated;
  }

  // Registrar Entrada do Visitante no local (Seção 30 da especificação)
  async registerEntry(id: string, organizationId: string, actorUserId: string, notes?: string) {
    const req = await prisma.visitRequest.findFirst({
      where: { id, organizationId },
      include: { visitor: true, destination: true, client: true },
    });

    if (!req) {
      throw new AppError('Solicitação não encontrada.', 404, 'NOT_FOUND');
    }

    if (req.status !== 'AUTHORIZED') {
      throw new AppError(
        `Apenas solicitações com status AUTHORIZED podem ter a entrada registrada. Status atual: ${req.status}`,
        400,
        'INVALID_STATUS'
      );
    }

    const updated = await prisma.visitRequest.update({
      where: { id },
      data: {
        status: 'ENTERED',
        entryAt: new Date(),
        notes: notes ? (req.notes ? `${req.notes} | ${notes}` : notes) : req.notes,
      },
      include: {
        visitor: true,
        destination: true,
        client: true,
        vehicle: true,
      },
    });

    await prisma.visitEvent.create({
      data: {
        visitRequestId: id,
        eventType: 'ENTRY_RECORDED',
        description: `Entrada física registrada na portaria às ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false })}.`,
        actorType: 'USER',
        actorId: actorUserId,
      },
    });

    realtimeService.notifyVisitRequestUpdated(organizationId, updated);

    realtimeService.notifyAlert(organizationId, {
      title: 'Visitante Entrou no Local',
      message: `Entrada registrada para ${req.visitor.name} (${req.destination.name}).`,
      type: 'INFO',
      visitRequestId: id,
      visitorName: req.visitor.name,
      destinationName: req.destination.name,
    });

    return updated;
  }

  // Registrar Saída do Visitante do local (Seção 30 da especificação)
  async registerExit(id: string, organizationId: string, actorUserId: string, notes?: string) {
    const req = await prisma.visitRequest.findFirst({
      where: { id, organizationId },
      include: { visitor: true, destination: true, client: true },
    });

    if (!req) {
      throw new AppError('Solicitação não encontrada.', 404, 'NOT_FOUND');
    }

    if (req.status !== 'ENTERED') {
      throw new AppError(
        `Apenas visitantes presentes (ENTERED) podem ter a saída registrada. Status atual: ${req.status}`,
        400,
        'INVALID_STATUS'
      );
    }

    const exitDate = new Date();
    const durationMins = req.entryAt
      ? Math.round((exitDate.getTime() - req.entryAt.getTime()) / 60000)
      : null;

    const updated = await prisma.visitRequest.update({
      where: { id },
      data: {
        status: 'EXITED',
        exitAt: exitDate,
        notes: notes ? (req.notes ? `${req.notes} | ${notes}` : notes) : req.notes,
      },
      include: {
        visitor: true,
        destination: true,
        client: true,
        vehicle: true,
      },
    });

    await prisma.visitEvent.create({
      data: {
        visitRequestId: id,
        eventType: 'EXIT_RECORDED',
        description: `Saída física registrada na portaria às ${exitDate.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false })}${
          durationMins !== null ? ` (Tempo no local: ${durationMins} min)` : ''
        }.`,
        actorType: 'USER',
        actorId: actorUserId,
      },
    });

    realtimeService.notifyVisitRequestUpdated(organizationId, updated);

    return updated;
  }

  // Listar Visitantes Presentes no Local (Seção 30 da especificação)
  async listPresent(organizationId: string, search?: string) {
    const serverNow = new Date();

    const whereClause: any = {
      organizationId,
      status: 'ENTERED',
    };

    if (search && search.trim().length > 0) {
      const q = search.trim();
      whereClause.OR = [
        { visitor: { name: { contains: q } } },
        { visitor: { documentNumber: { contains: q } } },
        { visitor: { company: { contains: q } } },
        { client: { name: { contains: q } } },
        { destination: { name: { contains: q } } },
        { vehicle: { licensePlate: { contains: q } } },
      ];
    }

    const requests = await prisma.visitRequest.findMany({
      where: whereClause,
      include: {
        client: true,
        destination: true,
        visitor: true,
        vehicle: true,
        conciergeUser: { select: { id: true, name: true } },
      },
      orderBy: { entryAt: 'desc' },
    });

    return requests.map((req) => {
      const staySeconds = req.entryAt
        ? Math.max(0, Math.floor((serverNow.getTime() - req.entryAt.getTime()) / 1000))
        : 0;

      return {
        ...req,
        stayDurationSeconds: staySeconds,
        stayDurationFormatted: this.formatWaitTime(staySeconds),
      };
    });
  }

  // Detalhes completos com Timeline de Auditoria (Seção 29)
  async getById(id: string, organizationId: string) {
    const req = await prisma.visitRequest.findFirst({
      where: { id, organizationId },
      include: {
        client: true,
        destination: true,
        visitor: true,
        vehicle: true,
        conciergeUser: { select: { id: true, name: true, email: true } },
        events: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!req) {
      throw new AppError('Solicitação não encontrada.', 404, 'NOT_FOUND');
    }

    const serverNow = new Date();
    const waitSeconds = Math.max(0, Math.floor((serverNow.getTime() - req.createdAt.getTime()) / 1000));

    return {
      ...req,
      waitingTimeSeconds: waitSeconds,
      waitingTimeFormatted: this.formatWaitTime(waitSeconds),
    };
  }

  // Histórico com filtros múltiplos e paginação (Seção 28)
  async listHistory(organizationId: string, filters: HistoryFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { organizationId };

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.clientId) {
      where.clientId = filters.clientId;
    }
    if (filters.visitorId) {
      where.visitorId = filters.visitorId;
    }
    if (filters.conciergeUserId) {
      where.conciergeUserId = filters.conciergeUserId;
    }
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }
    if (filters.search) {
      const s = filters.search.trim();
      where.OR = [
        { code: { contains: s } },
        { visitor: { name: { contains: s } } },
        { client: { name: { contains: s } } },
        { destination: { name: { contains: s } } },
        { vehicle: { licensePlate: { contains: s.toUpperCase() } } },
      ];
    }

    const [requests, total] = await Promise.all([
      prisma.visitRequest.findMany({
        where,
        include: {
          client: true,
          destination: true,
          visitor: true,
          vehicle: true,
          conciergeUser: { select: { id: true, name: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.visitRequest.count({ where }),
    ]);

    return {
      requests,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
