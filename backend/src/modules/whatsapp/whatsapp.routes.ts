import { FastifyInstance } from 'fastify';
import { WhatsAppController } from './whatsapp.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/rbac.middleware.js';
import { env } from '../../config/env.js';

const whatsAppController = new WhatsAppController();

export async function whatsAppRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // Status da conexão do WhatsApp (Admin, Supervisor e Porteiro)
  app.get('/status', {
    preHandler: [requireRole(['ADMIN', 'SUPERVISOR', 'CONCIERGE'])],
    handler: whatsAppController.getStatus.bind(whatsAppController),
  });

  // Conectar e gerar QR Code (Somente Admin - Seção 19)
  app.post('/connect', {
    preHandler: [requireRole(['ADMIN'])],
    handler: whatsAppController.connect.bind(whatsAppController),
  });

  // Desconectar sessão (Somente Admin)
  app.post('/disconnect', {
    preHandler: [requireRole(['ADMIN'])],
    handler: whatsAppController.disconnect.bind(whatsAppController),
  });

  // Simular mensagem recebida de morador (1=Autorizar / 2=Recusar) para testes
  app.post('/simulate-incoming', {
    preHandler: [
      async (_request, reply) => {
        if (env.NODE_ENV === 'production') {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' },
          });
        }
      },
      requireRole(['ADMIN']),
    ],
    handler: whatsAppController.simulateIncoming.bind(whatsAppController),
  });

  // Enviar mensagem de teste para verificar entrega no celular real
  app.post('/test-send', {
    preHandler: [requireRole(['ADMIN'])],
    handler: whatsAppController.testSend.bind(whatsAppController),
  });

  // Templates de mensagens (Admin)
  app.get('/templates', {
    preHandler: [requireRole(['ADMIN', 'SUPERVISOR'])],
    handler: whatsAppController.getTemplates.bind(whatsAppController),
  });

  app.put('/templates', {
    preHandler: [requireRole(['ADMIN'])],
    handler: whatsAppController.updateTemplate.bind(whatsAppController),
  });
}
