import { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../core/errors/app-error.js';

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'SUPERVISOR' | 'CONCIERGE' | 'CLIENT';

export function requireRole(allowedRoles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userRole = request.user?.role as Role;

    // SUPER_ADMIN tem acesso a tudo
    if (userRole === 'SUPER_ADMIN') return;

    if (!userRole || !allowedRoles.includes(userRole)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Você não possui permissão para executar esta ação.',
        },
      });
    }
  };
}

// Guard exclusivo para rotas de SUPER_ADMIN
export function requireSuperAdmin() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userRole = request.user?.role as Role;

    if (userRole !== 'SUPER_ADMIN') {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Acesso restrito ao administrador do sistema.',
        },
      });
    }
  };
}
