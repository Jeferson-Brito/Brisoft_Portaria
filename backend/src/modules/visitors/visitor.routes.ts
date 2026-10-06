import { FastifyInstance } from 'fastify';
import { VisitorController } from './visitor.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRole, STAFF_ROLES } from '../../middlewares/rbac.middleware.js';

const visitorController = new VisitorController();

export async function visitorRoutes(app: FastifyInstance) {
  // Rota autenticada para servir foto (proteção LGPD) — staff e morador autenticado
  app.get('/photo/:fileName', {
    preHandler: [authMiddleware],
    handler: visitorController.servePhoto.bind(visitorController),
  });

  // Demais rotas: apenas equipe da portaria
  app.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', authMiddleware);
    protectedRoutes.addHook('preHandler', requireRole(STAFF_ROLES));

    protectedRoutes.post('/upload-photo', {
      handler: visitorController.uploadPhoto.bind(visitorController),
    });

    protectedRoutes.get('/search', {
      handler: visitorController.search.bind(visitorController),
    });

    protectedRoutes.get('/:id', {
      handler: visitorController.getById.bind(visitorController),
    });

    protectedRoutes.post('/', {
      handler: visitorController.createOrUpdate.bind(visitorController),
    });
  });
}
