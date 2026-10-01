import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

const authController = new AuthController();

export async function authRoutes(app: FastifyInstance) {
  // Rota pública: registro de nova empresa (self-service, trial de 7 dias)
  app.post('/register', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '5 minutes',
      },
    },
    handler: authController.register.bind(authController),
  });

  // Rota pública de login
  app.post('/login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
      },
    },
    handler: authController.login.bind(authController),
  });

  app.post('/register/whatsapp-code', {
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    handler: authController.sendRegisterCode.bind(authController),
  });

  app.post('/register/confirm-whatsapp', {
    config: { rateLimit: { max: 8, timeWindow: '10 minutes' } },
    handler: authController.confirmRegisterCode.bind(authController),
  });

  app.post('/register/check-document', {
    config: { rateLimit: { max: 20, timeWindow: '10 minutes' } },
    handler: authController.checkDocument.bind(authController),
  });

  app.post('/forgot-password', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    handler: authController.forgotPassword.bind(authController),
  });

  app.post('/forgot-password/check', {
    config: { rateLimit: { max: 8, timeWindow: '15 minutes' } },
    handler: authController.checkResetCode.bind(authController),
  });

  app.post('/reset-password', {
    config: { rateLimit: { max: 8, timeWindow: '15 minutes' } },
    handler: authController.resetPassword.bind(authController),
  });

  app.post('/whatsapp-code', {
    preHandler: [authMiddleware],
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    handler: authController.sendOwnWhatsappCode.bind(authController),
  });

  app.post('/whatsapp-code/confirm', {
    preHandler: [authMiddleware],
    config: { rateLimit: { max: 8, timeWindow: '10 minutes' } },
    handler: authController.confirmOwnWhatsappCode.bind(authController),
  });

  app.post('/complete-profile', {
    preHandler: [authMiddleware],
    handler: authController.completeProfile.bind(authController),
  });

  // Rota privada de perfil (retorna info da assinatura)
  app.get('/me', {
    preHandler: [authMiddleware],
    handler: authController.me.bind(authController),
  });
}
