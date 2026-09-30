import { FastifyInstance } from 'fastify';
import { VisitorController } from './visitor.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

const visitorController = new VisitorController();

export async function visitorRoutes(app: FastifyInstance) {
  // Rota autenticada para servir foto (proteção LGPD)
  app.get('/photo/:fileName', {
    preHandler: [authMiddleware],
    handler: visitorController.servePhoto.bind(visitorController),
  });

  // Todas as demais rotas exigem autenticação
  app.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', authMiddleware);

    // Upload de foto do visitante (Porteiro, Supervisor, Admin)
    protectedRoutes.post('/upload-photo', {
      handler: visitorController.uploadPhoto.bind(visitorController),
    });

    // Busca rápida de visitantes (por nome, documento, placa ou telefone)
    protectedRoutes.get('/search', {
      handler: visitorController.search.bind(visitorController),
    });

    // Detalhes do visitante por ID
    protectedRoutes.get('/:id', {
      handler: visitorController.getById.bind(visitorController),
    });

    // Cadastrar ou atualizar visitante (com veículo opcional)
    protectedRoutes.post('/', {
      handler: visitorController.createOrUpdate.bind(visitorController),
    });
  });
}
