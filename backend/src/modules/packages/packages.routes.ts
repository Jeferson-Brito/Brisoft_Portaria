import { FastifyInstance } from 'fastify';
import { packagesController } from './packages.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { STAFF_ROLES, requireRole } from '../../middlewares/rbac.middleware.js';
import { subscriptionGuard } from '../../middlewares/subscription.middleware.js';
import { getStorageService, photoBelongsToOrganization, safeImageMime } from '../../services/storage/storage.service.js';

export async function packageRoutes(app: FastifyInstance) {
  app.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', authMiddleware);
    protectedRoutes.addHook('preHandler', requireRole(STAFF_ROLES));
    protectedRoutes.addHook('preHandler', async (request, reply) => {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
        return subscriptionGuard(request, reply);
      }
    });

    protectedRoutes.get('/photo/:fileName', async (req, reply) => {
      try {
        const { fileName } = req.params as { fileName: string };
        const allowed = await photoBelongsToOrganization(fileName, req.user.organizationId);
        if (!allowed) {
          return reply.status(404).send({ success: false, error: { message: 'Foto não encontrada.' } });
        }
        const fileData = await getStorageService().getFile(fileName);
        if (!fileData) {
          return reply.status(404).send({ success: false, error: { message: 'Foto não encontrada.' } });
        }
        return reply
          .header('Cache-Control', 'private, no-store')
          .header('Content-Disposition', 'inline; filename="photo.jpg"')
          .type(safeImageMime(fileData.mimeType))
          .send(fileData.buffer);
      } catch {
        return reply.status(500).send({ success: false, error: { message: 'Não foi possível carregar a foto.' } });
      }
    });

    protectedRoutes.post('/', packagesController.create);
    protectedRoutes.get('/pending', packagesController.listPending);
    protectedRoutes.get('/history', packagesController.listHistory);
    protectedRoutes.post('/:id/pickup', packagesController.pickup);
    protectedRoutes.post('/:id/resend-code', packagesController.resendCode);
  });
}
