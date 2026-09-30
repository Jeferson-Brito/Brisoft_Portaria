import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/rbac.middleware.js';
import { amenityService } from './amenity.service.js';
import { AppError } from '../../core/errors/app-error.js';

function handleError(reply: FastifyReply, err: any) {
  if (err instanceof AppError) {
    return reply.status(err.statusCode).send({ success: false, error: { code: err.code, message: err.message } });
  }
  return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Não foi possível concluir a ação.' } });
}

export async function amenityRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.get('/', { preHandler: [requireRole(['ADMIN', 'SUPERVISOR', 'CONCIERGE'])] }, async (request, reply) => {
    try {
      const data = await amenityService.list(request.user.organizationId);
      return reply.send({ success: true, data });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  app.post('/', { preHandler: [requireRole(['ADMIN', 'SUPERVISOR'])] }, async (request, reply) => {
    const parsed = z.object({ name: z.string().min(2), kind: z.string().optional() }).safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Informe o nome da área.' } });
    }
    try {
      const data = await amenityService.create(request.user.organizationId, parsed.data);
      return reply.status(201).send({ success: true, data });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  app.get('/calendar', { preHandler: [requireRole(['ADMIN', 'SUPERVISOR', 'CONCIERGE'])] }, async (request, reply) => {
    const { month } = request.query as { month?: string };
    try {
      const data = await amenityService.month(request.user.organizationId, month || new Date().toISOString().slice(0, 7));
      return reply.send({ success: true, data });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  app.patch('/:id', { preHandler: [requireRole(['ADMIN', 'SUPERVISOR'])] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ active: z.boolean() }).safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Informe se a área continua ativa.' } });
    }
    try {
      const data = await amenityService.setActive(id, request.user.organizationId, body.data.active);
      return reply.send({ success: true, data });
    } catch (err) {
      return handleError(reply, err);
    }
  });
}
