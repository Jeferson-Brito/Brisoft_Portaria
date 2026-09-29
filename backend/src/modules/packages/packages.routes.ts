import { FastifyInstance } from 'fastify';
import { packagesController } from './packages.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { subscriptionGuard } from '../../middlewares/subscription.middleware.js';
import { getStorageService } from '../../services/storage/storage.service.js';

export async function packageRoutes(app: FastifyInstance) {
  // Rota pública para servir foto da encomenda no app e na web
  app.get('/photo/:fileName', async (req, reply) => {
    try {
      const { fileName } = req.params as { fileName: string };
      const fileData = await getStorageService().getFile(fileName);
      if (!fileData) {
        return reply.status(404).send({ success: false, error: { message: 'Foto não encontrada.' } });
      }
      return reply.type(fileData.mimeType).send(fileData.buffer);
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: { message: err.message } });
    }
  });

  app.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', authMiddleware);
    protectedRoutes.addHook('preHandler', async (request, reply) => {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
        return subscriptionGuard(request, reply);
      }
    });

    protectedRoutes.post('/', packagesController.create);
    protectedRoutes.get('/pending', packagesController.listPending);
    protectedRoutes.get('/history', packagesController.listHistory);
    protectedRoutes.post('/:id/pickup', packagesController.pickup);
    protectedRoutes.post('/:id/resend-code', packagesController.resendCode);
  });
}
