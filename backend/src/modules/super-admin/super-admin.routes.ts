import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireSuperAdmin } from '../../middlewares/rbac.middleware.js';
import { SuperAdminService } from './super-admin.service.js';

const service = new SuperAdminService();

export async function superAdminRoutes(app: FastifyInstance) {
  // Todas as rotas exigem autenticação + role SUPER_ADMIN
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', requireSuperAdmin());

  // ─── Dashboard ───────────────────────────────────────────────
  app.get('/dashboard', async (_req, reply) => {
    const metrics = await service.getDashboardMetrics();
    return reply.send({ success: true, data: metrics });
  });

  // ─── Organizações ────────────────────────────────────────────
  app.get('/organizations', async (req: FastifyRequest, reply: FastifyReply) => {
    const { search, status, page, limit } = req.query as any;
    const result = await service.listOrganizations({
      search,
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
    return reply.send({ success: true, ...result });
  });

  app.get('/organizations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const org = await service.getOrganizationDetails(id);
    return reply.send({ success: true, data: org });
  });

  app.post('/organizations', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;
    const result = await service.createOrganizationManually(body);
    return reply.status(201).send({ success: true, data: result });
  });

  app.patch('/organizations/:id/toggle-active', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const updated = await service.toggleOrganizationActive(id);
    return reply.send({
      success: true,
      message: `Organização ${updated.isActive ? 'ativada' : 'desativada'} com sucesso.`,
      data: updated,
    });
  });

  // ─── Assinaturas ─────────────────────────────────────────────
  app.get('/subscriptions', async (req: FastifyRequest, reply: FastifyReply) => {
    const { status, plan, page, limit } = req.query as any;
    const result = await service.listSubscriptions({
      status,
      plan,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
    return reply.send({ success: true, ...result });
  });

  app.patch('/subscriptions/:orgId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { orgId } = req.params as { orgId: string };
    const body = req.body as any;
    const updated = await service.updateSubscription(orgId, body);
    return reply.send({ success: true, message: 'Assinatura atualizada.', data: updated });
  });

  app.post('/subscriptions/:orgId/activate', async (req: FastifyRequest, reply: FastifyReply) => {
    const { orgId } = req.params as { orgId: string };
    const { periodDays } = req.body as { periodDays?: number };
    const updated = await service.activateSubscription(orgId, periodDays || 30);
    return reply.send({ success: true, message: 'Assinatura ativada com sucesso!', data: updated });
  });

  app.post('/subscriptions/:orgId/suspend', async (req: FastifyRequest, reply: FastifyReply) => {
    const { orgId } = req.params as { orgId: string };
    const updated = await service.suspendSubscription(orgId);
    return reply.send({ success: true, message: 'Assinatura suspensa.', data: updated });
  });
}
