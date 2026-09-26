import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';

// Cache simples em memória para evitar queries desnecessárias no banco
// (TTL de 60 segundos por organização)
const subscriptionCache = new Map<string, { status: string; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

export async function subscriptionGuard(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;

  // SUPER_ADMIN nunca é bloqueado por assinatura
  if (!user || user.role === 'SUPER_ADMIN') return;

  const { organizationId } = user;
  if (!organizationId) return;

  // Consulta cache primeiro
  const now = Date.now();
  const cached = subscriptionCache.get(organizationId);
  if (cached && cached.expiresAt > now) {
    return checkSubscriptionStatus(reply, cached.status, organizationId);
  }

  // Busca no banco
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    select: { status: true, trialEndsAt: true },
  });

  // Organização sem assinatura (estado inconsistente) — bloqueia
  if (!subscription) {
    subscriptionCache.set(organizationId, { status: 'MISSING', expiresAt: now + CACHE_TTL_MS });
    return reply.status(402).send({
      success: false,
      error: {
        code: 'SUBSCRIPTION_MISSING',
        message: 'Nenhuma assinatura encontrada para esta organização.',
      },
    });
  }

  // Verifica expiração do trial automaticamente
  let effectiveStatus = subscription.status;
  if (subscription.status === 'TRIAL' && subscription.trialEndsAt) {
    if (new Date() > subscription.trialEndsAt) {
      effectiveStatus = 'EXPIRED';
      // Atualiza no banco de forma assíncrona (não bloqueia a resposta do cache)
      prisma.subscription.update({
        where: { organizationId },
        data: { status: 'EXPIRED' },
      }).catch(console.error);
    }
  }

  subscriptionCache.set(organizationId, { status: effectiveStatus, expiresAt: now + CACHE_TTL_MS });
  return checkSubscriptionStatus(reply, effectiveStatus, organizationId);
}

function checkSubscriptionStatus(reply: FastifyReply, status: string, organizationId: string) {
  if (status === 'ACTIVE' || status === 'TRIAL') return; // OK, deixa passar

  const messages: Record<string, { code: string; message: string; httpStatus: number }> = {
    EXPIRED: {
      code: 'SUBSCRIPTION_EXPIRED',
      message: 'Seu período de teste expirou. Assine o plano para continuar usando o sistema.',
      httpStatus: 402,
    },
    SUSPENDED: {
      code: 'SUBSCRIPTION_SUSPENDED',
      message: 'Sua assinatura está suspensa. Entre em contato com o suporte.',
      httpStatus: 402,
    },
    CANCELLED: {
      code: 'SUBSCRIPTION_CANCELLED',
      message: 'Sua assinatura foi cancelada.',
      httpStatus: 402,
    },
  };

  const info = messages[status] || {
    code: 'SUBSCRIPTION_INACTIVE',
    message: 'Assinatura inativa. Contate o suporte.',
    httpStatus: 402,
  };

  return reply.status(info.httpStatus).send({
    success: false,
    error: {
      code: info.code,
      message: info.message,
      organizationId,
    },
  });
}

// Invalida cache de uma org (útil após ativar assinatura)
export function invalidateSubscriptionCache(organizationId: string) {
  subscriptionCache.delete(organizationId);
}
