import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/rbac.middleware.js';
import { subscriptionGuard } from '../../middlewares/subscription.middleware.js';
import { restrictionService } from './restriction.service.js';
import { AppError } from '../../core/errors/app-error.js';

const createSchema = z.object({
  name: z.string().min(2),
  documentNumber: z.string().optional(),
  reason: z.string().min(3),
});

function handleError(reply: FastifyReply, err: any) {
  if (err instanceof AppError) {
    return reply.status(err.statusCode).send({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }
  return reply.status(500).send({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Não foi possível concluir a ação.' },
  });
}

export async function restrictionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', subscriptionGuard);

  app.get('/', {
    preHandler: [requireRole(['ADMIN', 'SUPERVISOR', 'CONCIERGE'])],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = await restrictionService.list(request.user.organizationId);
        return reply.send({ success: true, data });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  });

  app.post('/', {
    preHandler: [requireRole(['ADMIN', 'SUPERVISOR'])],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = createSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
        });
      }
      try {
        const data = await restrictionService.create(request.user.organizationId, parsed.data);
        return reply.status(201).send({ success: true, data });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  });

  app.patch('/:id', {
    preHandler: [requireRole(['ADMIN', 'SUPERVISOR'])],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = z.object({ active: z.boolean() }).safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Informe se a restrição continua ativa.' },
        });
      }
      try {
        const data = await restrictionService.setActive(id, request.user.organizationId, body.data.active);
        return reply.send({ success: true, data });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  });
}
