import { FastifyInstance } from 'fastify';
import { PreAuthorizationController } from './pre-authorization.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRole, STAFF_ROLES } from '../../middlewares/rbac.middleware.js';

export async function preAuthorizationRoutes(app: FastifyInstance) {
  const controller = new PreAuthorizationController();

  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', requireRole(STAFF_ROLES));

  app.post('/', controller.create.bind(controller));
  app.get('/today', controller.listActiveToday.bind(controller));
  app.get('/token/:token', controller.findByToken.bind(controller));
  app.get('/', controller.listAll.bind(controller));
  app.get('/:id', controller.getById.bind(controller));
  app.post('/:id/checkin', controller.checkIn.bind(controller));
  app.delete('/:id', controller.cancel.bind(controller));
}
