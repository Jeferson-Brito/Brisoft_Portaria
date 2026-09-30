import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { VisitRequestService } from './visit-request.service.js';

const createVisitRequestSchema = z.object({
  clientId: z.string().uuid('ID do cliente inválido'),
  destinationId: z.string().uuid('ID do destino inválido'),
  visitorId: z.string().uuid('ID do visitante inválido'),
  vehicleId: z.string().uuid().optional(),
  visitorType: z.string().optional().default('Visitante'),
  visitReason: z.string().min(1, 'Motivo da visita é obrigatório'),
  notes: z.string().optional(),
});

const historyQuerySchema = z.object({
  status: z.string().optional(),
  clientId: z.string().optional(),
  visitorId: z.string().optional(),
  conciergeUserId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

const actionReasonSchema = z.object({
  reason: z.string().optional(),
  acknowledgeRestriction: z.boolean().optional(),
});

const visitRequestService = new VisitRequestService();

export class VisitRequestController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = createVisitRequestSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
        },
      });
    }

    try {
      const visitRequest = await visitRequestService.create({
        ...parseResult.data,
        organizationId: request.user.organizationId,
        conciergeUserId: request.user.sub,
      });

      return reply.status(201).send({
        success: true,
        data: { visitRequest },
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message,
        },
      });
    }
  }

  async listPending(request: FastifyRequest, reply: FastifyReply) {
    try {
      const requests = await visitRequestService.listPending(request.user.organizationId);

      return reply.status(200).send({
        success: true,
        data: { requests },
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message,
        },
      });
    }
  }

  async getSummary(request: FastifyRequest, reply: FastifyReply) {
    try {
      const summary = await visitRequestService.getDashboardSummary(request.user.organizationId);

      return reply.status(200).send({
        success: true,
        data: summary,
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message,
        },
      });
    }
  }

  async getById(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const { id } = request.params;
      const visitRequest = await visitRequestService.getById(id, request.user.organizationId);

      return reply.status(200).send({
        success: true,
        data: { visitRequest },
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message,
        },
      });
    }
  }

  async remind(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const { id } = request.params;
      const updated = await visitRequestService.remind(id, request.user.organizationId, request.user.sub);

      return reply.status(200).send({
        success: true,
        message: 'Lembrete reenviado com sucesso.',
        data: { visitRequest: updated },
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message,
        },
      });
    }
  }

  async cancel(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const parseBody = actionReasonSchema.safeParse(request.body || {});
    const reason = parseBody.success ? parseBody.data.reason : undefined;

    try {
      const { id } = request.params;
      const updated = await visitRequestService.cancel(id, request.user.organizationId, request.user.sub, reason);

      return reply.status(200).send({
        success: true,
        message: 'Solicitação cancelada com sucesso.',
        data: { visitRequest: updated },
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message,
        },
      });
    }
  }

  async manualAuthorize(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const parseBody = actionReasonSchema.safeParse(request.body || {});
    const reason = parseBody.success ? parseBody.data.reason : undefined;

    try {
      const { id } = request.params;
      const updated = await visitRequestService.manualAuthorize(
        id,
        request.user.organizationId,
        request.user.sub,
        reason,
        parseBody.success ? parseBody.data.acknowledgeRestriction : false,
      );

      return reply.status(200).send({
        success: true,
        message: 'Entrada autorizada com sucesso.',
        data: { visitRequest: updated },
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message,
        },
      });
    }
  }

  // Registrar Entrada física (Seção 30)
  async registerEntry(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const parseBody = actionReasonSchema.safeParse(request.body || {});
    const notes = parseBody.success ? parseBody.data.reason : undefined;

    try {
      const { id } = request.params;
      const updated = await visitRequestService.registerEntry(
        id,
        request.user.organizationId,
        request.user.sub,
        notes,
        parseBody.success ? parseBody.data.acknowledgeRestriction : false,
      );

      return reply.status(200).send({
        success: true,
        message: 'Entrada registrada com sucesso.',
        data: { visitRequest: updated },
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: { code: err.code || 'ENTRY_ERROR', message: err.message },
      });
    }
  }

  // Registrar Saída física (Seção 30)
  async registerExit(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const parseBody = actionReasonSchema.safeParse(request.body || {});
    const notes = parseBody.success ? parseBody.data.reason : undefined;

    try {
      const { id } = request.params;
      const updated = await visitRequestService.registerExit(
        id,
        request.user.organizationId,
        request.user.sub,
        notes
      );

      return reply.status(200).send({
        success: true,
        message: 'Saída registrada com sucesso.',
        data: { visitRequest: updated },
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: { code: err.code || 'EXIT_ERROR', message: err.message },
      });
    }
  }

  // Listar Visitantes Presentes no Local (Seção 30)
  async listPresent(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as { q?: string; format?: string };

    try {
      const visitors = await visitRequestService.listPresent(
        request.user.organizationId,
        query.q
      );

      if (query.format === 'csv') {
        const header = 'Nome;Documento;Unidade;Morador;Tipo;Entrada;Permanencia;Placa;Porteiro';
        const rows = visitors.map((item) => [
          item.visitor?.name,
          item.visitor?.documentNumber,
          [item.destination?.name, item.destination?.block].filter(Boolean).join(' '),
          item.client?.name,
          item.visitorType,
          item.entryAt ? new Date(item.entryAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '',
          item.stayDurationFormatted,
          item.vehicle?.licensePlate,
          item.conciergeUser?.name,
        ].map(csvCell).join(';'));
        const stamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        return reply
          .header('Content-Type', 'text/csv; charset=utf-8')
          .header('Content-Disposition', 'attachment; filename="presentes.csv"')
          .send(`\uFEFFPessoas no local em ${stamp}\n${header}\n${rows.join('\n')}\n`);
      }

      return reply.status(200).send({
        success: true,
        data: { visitors, count: visitors.length },
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'LIST_PRESENT_ERROR', message: err.message },
      });
    }
  }

  async listHistory(request: FastifyRequest, reply: FastifyReply) {
    const parseQuery = historyQuerySchema.safeParse(request.query);
    const query = parseQuery.success ? parseQuery.data : {};

    try {
      const result = await visitRequestService.listHistory(request.user.organizationId, {
        status: query.status,
        clientId: query.clientId,
        visitorId: query.visitorId,
        conciergeUserId: query.conciergeUserId,
        startDate: query.startDate,
        endDate: query.endDate,
        search: query.search,
        page: query.page ? parseInt(query.page, 10) : 1,
        limit: query.limit ? parseInt(query.limit, 10) : 20,
      });

      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message,
        },
      });
    }
  }
}

function csvCell(value: unknown) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ');
  return `"${text.replace(/"/g, '""')}"`;
}
