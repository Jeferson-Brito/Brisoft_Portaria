import { FastifyReply, FastifyRequest } from 'fastify';

export async function subscriptionGuard(request: FastifyRequest, reply: FastifyReply) {
  // Assinaturas removidas temporariamente do banco
  return;
}

export function invalidateSubscriptionCache(organizationId: string) {
  // No-op
}
