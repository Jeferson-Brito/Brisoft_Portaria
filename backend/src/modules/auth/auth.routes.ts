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

  // Rota privada de perfil (retorna info da assinatura)
  app.get('/me', {
    preHandler: [authMiddleware],
    handler: authController.me.bind(authController),
  });
}
