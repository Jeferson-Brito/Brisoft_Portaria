import crypto from 'crypto';
import { Readable } from 'stream';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { subscriptionService, STRIPE_PAYMENT_LINK } from './subscription.service.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { env } from '../../config/env.js';

function verifyStripeSignature(rawBody: string, header: string | undefined, secret: string): boolean {
  if (!header) return false;

  const parts = header.split(',').map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false;

  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const expectedBuffer = Buffer.from(expected);
  return signatures.some((signature) => {
    const received = Buffer.from(signature);
    return received.length === expectedBuffer.length && crypto.timingSafeEqual(received, expectedBuffer);
  });
}

export async function subscriptionRoutes(app: FastifyInstance) {
  app.post('/webhook', {
    preParsing: async (request, _reply, payload) => {
      const chunks: Buffer[] = [];
      for await (const chunk of payload) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const raw = Buffer.concat(chunks);
      (request as FastifyRequest & { rawBody?: string }).rawBody = raw.toString('utf8');
      return Readable.from(raw);
    },
    handler: async (request: FastifyRequest & { rawBody?: string }, reply: FastifyReply) => {
      const secret = env.STRIPE_WEBHOOK_SECRET;
      if (!secret) {
        return reply.status(503).send({
          received: false,
          error: 'Webhook da Stripe sem STRIPE_WEBHOOK_SECRET configurado.',
        });
      }

      const signatureHeader = request.headers['stripe-signature'];
      const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
      if (!verifyStripeSignature(request.rawBody || '', signature, secret)) {
        return reply.status(400).send({ received: false, error: 'Assinatura do webhook invalida.' });
      }

      try {
        const event = request.body as any;
        const result = await subscriptionService.processStripeWebhook(event || {});
        return reply.status(200).send({ received: true, ...result });
      } catch (err: any) {
        console.warn('Erro ao processar webhook do Stripe:', err);
        return reply.status(200).send({ received: true, error: err.message });
      }
    },
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
