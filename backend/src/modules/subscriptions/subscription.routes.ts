import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { subscriptionService, STRIPE_PAYMENT_LINK } from './subscription.service.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

export async function subscriptionRoutes(app: FastifyInstance) {
  // Webhook Stripe (Acesso Público sem JWT para receber do Stripe)
  app.post('/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const event = request.body as any;
      const result = await subscriptionService.processStripeWebhook(event || {});
      return reply.status(200).send({ received: true, ...result });
    } catch (err: any) {
      console.warn('Erro ao processar webhook do Stripe:', err);
      return reply.status(200).send({ received: true, error: err.message });
    }
  });

  // Obter status da assinatura da organização atual (Requer autenticação)
  app.get('/current', {
    preHandler: [authMiddleware],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = request.user?.organizationId;
      if (!orgId) {
        return reply.status(400).send({ success: false, message: 'Organização não identificada.' });
      }

      const info = await subscriptionService.getSubscriptionByOrgId(orgId);
      return reply.send({
        success: true,
        data: info,
      });
    },
  });

  // Obter link de pagamento com referência da organização
  app.get('/payment-link', {
    preHandler: [authMiddleware],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = request.user?.organizationId;
      const userEmail = request.user?.email || '';

      // Adiciona o email do cliente pré-preenchido e client_reference_id da organização
      const url = new URL(STRIPE_PAYMENT_LINK);
      if (userEmail) {
        url.searchParams.set('prefilled_email', userEmail);
      }
      if (orgId) {
        url.searchParams.set('client_reference_id', orgId);
      }

      return reply.send({
        success: true,
        paymentUrl: url.toString(),
      });
    },
  });
}
