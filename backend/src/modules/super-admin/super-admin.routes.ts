import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireSuperAdmin } from '../../middlewares/rbac.middleware.js';
import { SuperAdminService } from './super-admin.service.js';
import { subscriptionService } from '../subscriptions/subscription.service.js';

const service = new SuperAdminService();

export async function superAdminRoutes(app: FastifyInstance) {
  // Todas as rotas exigem autenticação + role SUPER_ADMIN
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', requireSuperAdmin());

  // ─── Dashboard SaaS Master ──────────────────────────────────
  app.get('/dashboard', async (_req, reply) => {
    const metrics = await service.getDashboardMetrics();
    return reply.send({ success: true, data: metrics });
  });

  // ─── Organizações (Empresas / Condomínios) ───────────────────
  app.get('/organizations', async (req: FastifyRequest, reply: FastifyReply) => {
    const { search, status, page, limit } = req.query as any;
    const result = await service.listOrganizations({
      search,
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
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

  app.put('/organizations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const updated = await service.updateOrganization(id, body);
    return reply.send({ success: true, message: 'Empresa atualizada com sucesso.', data: updated });
  });

  app.patch('/organizations/:id/toggle-active', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const updated = await service.toggleOrganizationActive(id);
    return reply.send({
      success: true,
      message: `Empresa ${updated.isActive ? 'ativada' : 'suspensa'} com sucesso.`,
      data: updated,
    });
  });

  // Remover período de teste e forçar pagamento imediato (Requisito 4)
  app.post('/organizations/:id/expire-trial', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const result = await subscriptionService.expireTrial(id);
    return reply.send({
      success: true,
      message: 'Período de teste removido com sucesso. A empresa foi bloqueada para pagamento.',
      data: result,
    });
  });

  // Ativar / renovar assinatura manualmente por X dias
  app.post('/organizations/:id/activate-subscription', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { periodDays } = (req.body as any) || {};
    const result = await subscriptionService.activateSubscription(id, periodDays || 30, {
      source: 'COMPLIMENTARY',
    });
    return reply.send({
      success: true,
      message: 'Assinatura ativada com sucesso!',
      data: result,
    });
  });

  app.delete('/organizations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const result = await service.deleteOrganization(id);
    return reply.send(result);
  });

  // ─── Usuários Multi-empresa ─────────────────────────────────
  app.get('/users', async (req: FastifyRequest, reply: FastifyReply) => {
    const { search, organizationId, role, page, limit } = req.query as any;
    const result = await service.listUsers({
      search,
      organizationId,
      role,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
    return reply.send({ success: true, ...result });
  });

  app.post('/users', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;
    const user = await service.createUser(body);
    return reply.status(201).send({ success: true, message: 'Usuário criado com sucesso.', data: user });
  });

  app.put('/users/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const updated = await service.updateUser(id, body);
    return reply.send({ success: true, message: 'Usuário atualizado com sucesso.', data: updated });
  });

  app.patch('/users/:id/password', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { newPassword } = req.body as { newPassword: string };
    const result = await service.updateUserPassword(id, newPassword);
    return reply.send(result);
  });

  app.delete('/users/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const result = await service.deleteUser(id);
    return reply.send(result);
  });

  // ─── Assinaturas & Financeiro ───────────────────────────────
  app.get('/subscriptions', async (req: FastifyRequest, reply: FastifyReply) => {
    const { status, plan, page, limit } = req.query as any;
    const result = await service.listSubscriptions({
      status,
      plan,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
    return reply.send({ success: true, ...result });
  });

  app.patch('/subscriptions/:orgId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { orgId } = req.params as { orgId: string };
    const body = req.body as any;
    const updated = await service.updateSubscription(orgId, body);
    return reply.send({ success: true, message: 'Assinatura atualizada com sucesso.', data: updated });
  });

  app.post('/subscriptions/:orgId/activate', async (req: FastifyRequest, reply: FastifyReply) => {
    const { orgId } = req.params as { orgId: string };
    const { periodDays } = req.body as { periodDays?: number };
    const updated = await service.activateSubscription(orgId, periodDays || 30);
    return reply.send({ success: true, message: 'Assinatura ativada / renovada com sucesso!', data: updated });
  });

  app.get('/plan-price', async (_req, reply) => {
    const price = await service.getPlanPrice();
    return reply.send({ success: true, data: { price } });
  });

  app.put('/plan-price', async (req: FastifyRequest, reply: FastifyReply) => {
    const { price } = (req.body as { price?: number }) || {};
    const updated = await service.setPlanPrice(Number(price));
    return reply.send({ success: true, message: 'Valor do plano atualizado.', data: { price: updated } });
  });

  app.post('/subscriptions/:orgId/suspend', async (req: FastifyRequest, reply: FastifyReply) => {
    const { orgId } = req.params as { orgId: string };
    const updated = await service.suspendSubscription(orgId);
    return reply.send({ success: true, message: 'Assinatura suspensa.', data: updated });
  });
}
