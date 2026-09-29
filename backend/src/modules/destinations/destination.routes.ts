import { FastifyInstance } from 'fastify';
import { DestinationController } from './destination.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/rbac.middleware.js';
import { subscriptionGuard } from '../../middlewares/subscription.middleware.js';

const destinationController = new DestinationController();

export async function destinationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', async (request, reply) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      return subscriptionGuard(request, reply);
    }
  });

  // Listar destinos (Porteiro, Supervisor, Admin)
  app.get('/', {
    handler: destinationController.list.bind(destinationController),
  });

  // Obter destino por ID (Porteiro, Supervisor, Admin)
  app.get('/:id', {
    handler: destinationController.getById.bind(destinationController),
  });

  // Criar destino (Admin, Supervisor, Porteiro)
  app.post('/', {
    preHandler: [requireRole(['ADMIN', 'SUPERVISOR', 'CONCIERGE'])],
    handler: destinationController.create.bind(destinationController),
  });

  // Editar destino (Supervisor, Admin)
  app.put('/:id', {
    preHandler: [requireRole(['ADMIN', 'SUPERVISOR'])],
    handler: destinationController.update.bind(destinationController),
  });

  // Excluir destino (Supervisor, Admin)
  app.delete('/:id', {
    preHandler: [requireRole(['ADMIN', 'SUPERVISOR'])],
    handler: destinationController.delete.bind(destinationController),
  });
}
