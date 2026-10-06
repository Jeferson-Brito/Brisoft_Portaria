import { FastifyInstance } from 'fastify';
import { UserController } from './user.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/rbac.middleware.js';
import { subscriptionGuard } from '../../middlewares/subscription.middleware.js';
import { realtimeService } from '../../services/realtime/realtime.service.js';

const userController = new UserController();

export async function userRoutes(app: FastifyInstance) {
  // Todas as rotas de usuários exigem autenticação
  app.addHook('preHandler', authMiddleware);

  // Registrar Expo Push Token do aparelho (com log de diagnóstico)
  app.post('/push-token', async (request, reply) => {
    const { pushToken, error, debugInfo } = request.body as {
      pushToken?: string;
      error?: string;
      debugInfo?: any;
    };

    if (error) {
      console.warn(`⚠️ [Push-Client-Diagnostic] Dispositivo reportou erro ao obter token:`, {
        error,
        debugInfo,
        user: request.user?.email,
        organizationId: request.user?.organizationId,
      });
    }

    if (pushToken && request.user?.organizationId) {
      await realtimeService.registerPushToken(request.user.organizationId, pushToken);
    }
    return reply.status(200).send({ success: true });
  });

  // Atualizar perfil próprio — bloqueado se assinatura inadimplente
  app.patch('/me', {
    preHandler: [subscriptionGuard],
    handler: userController.updateProfile.bind(userController),
  });

  // Listar usuários: apenas Admin e Supervisor
  app.get('/', {
    preHandler: [requireRole(['ADMIN', 'SUPERVISOR']), subscriptionGuard],
    handler: userController.list.bind(userController),
  });

  // Criar novo usuário: apenas Admin e Supervisor (com validação interna de hierarquia)
  app.post('/', {
    preHandler: [requireRole(['ADMIN', 'SUPERVISOR']), subscriptionGuard],
    handler: userController.create.bind(userController),
  });

  // Editar usuário (nome, telefone, senha) - Admin pode editar todos; Supervisor só porteiros
  app.patch('/:id', {
    preHandler: [requireRole(['ADMIN', 'SUPERVISOR']), subscriptionGuard],
    handler: userController.updateUser.bind(userController),
  });

  // Ativar/Desativar usuário
  app.patch('/:id/toggle-active', {
    preHandler: [requireRole(['ADMIN', 'SUPERVISOR']), subscriptionGuard],
    handler: userController.toggleActive.bind(userController),
  });

  // Excluir (soft delete) usuário
  app.delete('/:id', {
    preHandler: [requireRole(['ADMIN', 'SUPERVISOR']), subscriptionGuard],
    handler: userController.delete.bind(userController),
  });
}
