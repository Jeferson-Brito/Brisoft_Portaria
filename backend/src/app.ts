import fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { env } from './config/env.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/users/user.routes.js';
import { destinationRoutes } from './modules/destinations/destination.routes.js';
import { clientRoutes } from './modules/clients/client.routes.js';
import { visitorRoutes } from './modules/visitors/visitor.routes.js';
import { visitRequestRoutes } from './modules/visit-requests/visit-request.routes.js';
import { whatsAppRoutes } from './modules/whatsapp/whatsapp.routes.js';
import { preAuthorizationRoutes } from './modules/pre-authorizations/pre-authorization.routes.js';
import { reportsRoutes } from './modules/reports/reports.routes.js';
import { auditRoutes } from './modules/audit/audit.routes.js';
import { packageRoutes } from './modules/packages/packages.routes.js';
import { organizationRoutes } from './modules/organizations/organization.routes.js';
import { superAdminRoutes } from './modules/super-admin/super-admin.routes.js';
import { subscriptionRoutes } from './modules/subscriptions/subscription.routes.js';
import { residentRoutes } from './modules/resident/resident.routes.js';
import { invitePageRoutes } from './modules/invites/invite.routes.js';

export function buildApp() {
  const app = fastify({
    bodyLimit: 15 * 1024 * 1024,
    logger: env.NODE_ENV === 'development'
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
        }
      : true,
  });

  // Plugins
  app.register(cors, {
    origin: true,
    credentials: true,
  });

  app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
  });

  app.register(multipart, {
    limits: {
      fileSize: 15 * 1024 * 1024,
    },
  });

  // Healthcheck para Render e monitoramento
  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'combate-portaria-backend',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      database: 'sqlite (prepared for supabase)',
    };
  });

  // Rotas da API v1
  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(userRoutes, { prefix: '/api/v1/users' });
  app.register(destinationRoutes, { prefix: '/api/v1/destinations' });
  app.register(clientRoutes, { prefix: '/api/v1/clients' });
  app.register(visitorRoutes, { prefix: '/api/v1/visitors' });
  app.register(visitRequestRoutes, { prefix: '/api/v1/visit-requests' });
  app.register(whatsAppRoutes, { prefix: '/api/v1/whatsapp' });
  app.register(preAuthorizationRoutes, { prefix: '/api/v1/pre-authorizations' });
  app.register(reportsRoutes, { prefix: '/api/v1/reports' });
  app.register(auditRoutes, { prefix: '/api/v1/audit' });
  app.register(packageRoutes, { prefix: '/api/v1/packages' });
  app.register(organizationRoutes, { prefix: '/api/v1/organizations' });
  app.register(superAdminRoutes, { prefix: '/api/v1/super-admin' });
  app.register(subscriptionRoutes, { prefix: '/api/v1/subscriptions' });
  app.register(subscriptionRoutes, { prefix: '/api/v1/stripe' });
  app.register(residentRoutes, { prefix: '/api/v1/me' });
  app.register(invitePageRoutes);

  return app;
}
