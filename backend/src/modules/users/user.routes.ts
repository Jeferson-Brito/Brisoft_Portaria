import { FastifyInstance } from 'fastify';
import { UserController } from './user.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/rbac.middleware.js';
import { realtimeService } from '../../services/realtime/realtime.service.js';

const userController = new UserController();

export async function userRoutes(app: FastifyInstance) {
  // Todas as rotas de usuários exigem autenticação
  app.addHook('preHandler', authMiddleware);

  // Registrar Expo Push Token do aparelho
  app.post('/push-token', async (request, reply) => {
    const { pushToken } = request.body as { pushToken?: string };
    if (pushToken && request.user?.organizationId) {
      await realtimeService.registerPushToken(request.user.organizationId, pushToken);
    }
    return reply.status(200).send({ success: true });
  });

  // Atualizar perfil próprio (Nome, Telefone, Foto, Senha) - Aberto a Porteiro, Supervisor e Admin
  app.patch('/me', {
    handler: userController.updateProfile.bind(userController),
  });

  // Listar usuários: apenas Admin e Supervisor
  app.get('/', {
    preHandler: [requireRole(['ADMIN', 'SUPERVISOR'])],
    handler: userController.list.bind(userController),
  });

  // Criar novo usuário: apenas Admin e Supervisor (com validação interna de hierarquia)
  app.post('/', {
    preHandler: [requireRole(['ADMIN', 'SUPERVISOR'])],
    handler: userController.create.bind(userController),
  });

  // Ativar/Desativar usuário
  app.patch('/:id/toggle-active', {
    preHandler: [requireRole(['ADMIN', 'SUPERVISOR'])],
    handler: userController.toggleActive.bind(userController),
  });

  // Excluir (soft delete) usuário
  app.delete('/:id', {
    preHandler: [requireRole(['ADMIN', 'SUPERVISOR'])],
    handler: userController.delete.bind(userController),
  });
}
