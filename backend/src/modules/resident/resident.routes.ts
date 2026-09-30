import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { subscriptionGuard } from '../../middlewares/subscription.middleware.js';
import { residentService } from './resident.service.js';
import { AppError } from '../../core/errors/app-error.js';

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

export async function residentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.get('/context', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await residentService.context(request.user.sub);
      return reply.send({ success: true, data });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  app.get('/visits', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await residentService.listVisits(request.user.sub);
      return reply.send({ success: true, data });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  app.get('/visits/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = await residentService.getVisit(request.user.sub, id);
      return reply.send({ success: true, data });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  app.post('/visits', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await subscriptionGuard(request, reply);
      if (reply.sent) return;
      const data = await residentService.createVisit(request.user.sub, request.body as any);
      return reply.status(201).send({ success: true, data });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  app.patch('/visits/:id/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = await residentService.cancelVisit(request.user.sub, id);
      return reply.send({ success: true, data });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  app.get('/packages', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await residentService.listPackages(request.user.sub);
      return reply.send({ success: true, data });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  app.get('/amenities', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await residentService.listAmenities(request.user.sub);
      return reply.send({ success: true, data });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  app.get('/amenities/calendar', async (request: FastifyRequest, reply: FastifyReply) => {
    const { month } = request.query as { month?: string };
    try {
      const data = await residentService.amenityMonth(request.user.sub, month || new Date().toISOString().slice(0, 7));
      return reply.send({ success: true, data });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  app.post('/amenities/:id/bookings', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      await subscriptionGuard(request, reply);
      if (reply.sent) return;
      const data = await residentService.bookAmenity(request.user.sub, id, request.body as any);
      return reply.status(201).send({ success: true, data });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  app.patch('/amenities/bookings/:id/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    try {
      const data = await residentService.cancelAmenity(request.user.sub, id);
      return reply.send({ success: true, data });
    } catch (err) {
      return handleError(reply, err);
    }
  });
}
