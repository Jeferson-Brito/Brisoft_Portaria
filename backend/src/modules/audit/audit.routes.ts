import { FastifyInstance } from 'fastify';
import { auditController } from './audit.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/rbac.middleware.js';

export async function auditRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', requireRole(['ADMIN', 'SUPERVISOR']));

  app.get('/logs', auditController.getLogs);
  app.get('/timeline', auditController.getTimeline);
}
