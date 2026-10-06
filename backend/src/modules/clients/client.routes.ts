import { FastifyInstance } from 'fastify';
import { ClientController } from './client.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/rbac.middleware.js';
import { subscriptionGuard } from '../../middlewares/subscription.middleware.js';

const clientController = new ClientController();

export async function clientRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', async (request, reply) => {
    return subscriptionGuard(request, reply);
  });

  // Busca rápida de clientes para o Porteiro (Nome, Unidade, Telefone, Código)
  app.get('/search', {
    handler: clientController.search.bind(clientController),
  });

  // Listagem paginada (Porteiro, Supervisor, Admin)
  app.get('/', {
    handler: clientController.list.bind(clientController),
  });

  // Detalhes do cliente (Porteiro, Supervisor, Admin)
  app.get('/:id', {
    handler: clientController.getById.bind(clientController),
  });

  // Criar cliente (Admin, Supervisor)
  app.post('/', {
    preHandler: [requireRole(['ADMIN', 'SUPERVISOR'])],
    handler: clientController.create.bind(clientController),
  });

  // Editar cliente (Supervisor, Admin)
  app.put('/:id', {
    preHandler: [requireRole(['ADMIN', 'SUPERVISOR'])],
    handler: clientController.update.bind(clientController),
  });

  // Excluir cliente (Supervisor, Admin)
  app.delete('/:id', {
    preHandler: [requireRole(['ADMIN', 'SUPERVISOR'])],
    handler: clientController.delete.bind(clientController),
  });
}
