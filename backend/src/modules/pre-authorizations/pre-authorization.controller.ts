import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { preAuthorizationService } from './pre-authorization.service.js';

const createPreAuthSchema = z.object({
  clientId: z.string().uuid('ID do cliente inválido'),
  destinationId: z.string().uuid('ID do destino inválido'),
  visitorName: z.string().min(2, 'Nome do visitante deve ter pelo menos 2 caracteres'),
  visitorDocument: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  visitorType: z.string().optional(),
  startDate: z.string().min(8, 'Data inicial é obrigatória (ex: YYYY-MM-DD)'),
  endDate: z.string().min(8, 'Data final é obrigatória (ex: YYYY-MM-DD)'),
  expectedTimeStart: z.string().optional(),
  expectedTimeEnd: z.string().optional(),
  notes: z.string().optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
});

const checkInSchema = z.object({
  photoUrl: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehiclePlate: z.string().optional(),
  vehicleColor: z.string().optional(),
  notes: z.string().optional(),
  acknowledgeRestriction: z.boolean().optional(),
});

export class PreAuthorizationController {
  // Criar pré-autorização
  async create(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = createPreAuthSchema.safeParse(request.body);

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
      const preAuth = await preAuthorizationService.create({
        ...parseResult.data,
        organizationId: request.user.organizationId,
      });

      return reply.status(201).send({
        success: true,
        data: preAuth,
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: { code: err.code || 'PRE_AUTH_ERROR', message: err.message },
      });
    }
  }

  // Listar pré-autorizações válidas hoje (busca rápida da portaria)
  async listActiveToday(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as { q?: string };

    try {
      const items = await preAuthorizationService.listActiveToday(
        request.user.organizationId,
        query.q
      );

      return reply.status(200).send({
        success: true,
        data: { items, count: items.length },
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'LIST_PRE_AUTH_ERROR', message: err.message },
      });
    }
  }

  // Listar todas com paginação
  async listAll(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as { isUsed?: string; page?: string; limit?: string };

    const isUsed = query.isUsed === 'true' ? true : query.isUsed === 'false' ? false : undefined;
    const page = query.page ? parseInt(query.page, 10) : 1;
    const limit = query.limit ? parseInt(query.limit, 10) : 20;

    try {
      const result = await preAuthorizationService.listAll(request.user.organizationId, {
        isUsed,
        page,
        limit,
      });

      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'LIST_ALL_PRE_AUTH_ERROR', message: err.message },
      });
    }
  }

  // Buscar detalhes
  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    try {
      const preAuth = await preAuthorizationService.getById(id, request.user.organizationId);

      return reply.status(200).send({
        success: true,
        data: preAuth,
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: { code: err.code || 'GET_PRE_AUTH_ERROR', message: err.message },
      });
    }
  }

  async findByToken(request: FastifyRequest, reply: FastifyReply) {
    const { token } = request.params as { token: string };
    try {
      const preAuth = await preAuthorizationService.findByToken(token, request.user.organizationId);
      return reply.status(200).send({ success: true, data: preAuth });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: { code: err.code || 'QR_LOOKUP_ERROR', message: err.message },
      });
    }
  }

  // Check-in / Liberação na portaria
  async checkIn(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const parseResult = checkInSchema.safeParse(request.body || {});

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
      const result = await preAuthorizationService.checkInPreAuthorized({
        preAuthorizationId: id,
        organizationId: request.user.organizationId,
        conciergeUserId: request.user.sub || (request.user as any).id,
        ...parseResult.data,
      });

      return reply.status(200).send({
        success: true,
        message: result.message,
        data: result.visitRequest,
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: { code: err.code || 'CHECKIN_ERROR', message: err.message },
      });
    }
  }

  // Cancelar
  async cancel(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    try {
      const result = await preAuthorizationService.cancel(id, request.user.organizationId);

      return reply.status(200).send({
        success: true,
        message: result.message,
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: { code: err.code || 'CANCEL_PRE_AUTH_ERROR', message: err.message },
      });
    }
  }
}
