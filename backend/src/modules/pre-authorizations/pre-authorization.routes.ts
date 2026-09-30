import { FastifyInstance } from 'fastify';
import { PreAuthorizationController } from './pre-authorization.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

export async function preAuthorizationRoutes(app: FastifyInstance) {
  const controller = new PreAuthorizationController();

  app.addHook('preHandler', authMiddleware);

  // Criar pré-autorização
  app.post('/', controller.create.bind(controller));

  // Listar ativas de hoje com busca rápida (para a portaria)
  app.get('/today', controller.listActiveToday.bind(controller));

  app.get('/token/:token', controller.findByToken.bind(controller));

  // Listar todas com paginação
  app.get('/', controller.listAll.bind(controller));

  // Obter detalhes
  app.get('/:id', controller.getById.bind(controller));

  // Efetivar entrada do visitante pré-autorizado na portaria
  app.post('/:id/checkin', controller.checkIn.bind(controller));

  // Cancelar
  app.delete('/:id', controller.cancel.bind(controller));
}
