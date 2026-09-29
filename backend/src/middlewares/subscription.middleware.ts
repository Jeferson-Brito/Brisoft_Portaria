import { FastifyReply, FastifyRequest } from 'fastify';
import { subscriptionService, STRIPE_PAYMENT_LINK } from '../modules/subscriptions/subscription.service.js';

export async function subscriptionGuard(request: FastifyRequest, reply: FastifyReply) {
  // SUPER_ADMIN tem acesso ilimitado a todas as funções
  if (request.user?.role === 'SUPER_ADMIN') {
    return;
  }

  const organizationId = request.user?.organizationId;
  if (!organizationId) {
    return;
  }

  try {
    const sub = await subscriptionService.getSubscriptionByOrgId(organizationId);
    if (sub.isBlocked) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'SUBSCRIPTION_REQUIRED',
          message:
            'Período de teste gratuito expirado ou assinatura suspensa. Efetue o pagamento para realizar esta ação.',
          paymentLink: STRIPE_PAYMENT_LINK,
          subscription: sub,
        },
      });
    }
  } catch (e: any) {
    // Se não encontrou a organização, segue o fluxo normal de erro das rotas
  }
}

export function invalidateSubscriptionCache(organizationId: string) {
  // No-op
}
