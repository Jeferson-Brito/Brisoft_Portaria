import { FastifyInstance } from 'fastify';
import { reportsController } from './reports.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/rbac.middleware.js';

export async function reportsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.get('/visits', {
    preHandler: [requireRole(['ADMIN', 'SUPERVISOR', 'CONCIERGE'])],
    handler: reportsController.getVisits,
  });

  app.get('/metrics', {
    preHandler: [requireRole(['ADMIN', 'SUPERVISOR', 'CONCIERGE'])],
    handler: reportsController.getMetrics,
  });
}
