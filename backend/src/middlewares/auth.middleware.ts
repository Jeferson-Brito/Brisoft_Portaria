import { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../core/errors/app-error.js';
import { prisma } from '../lib/prisma.js';

export interface TokenPayload {
  sub: string;
  organizationId: string;
  role: string;
  email: string;
  name: string;
  clientId?: string | null;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: TokenPayload;
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new AppError('Token de autenticação não fornecido', 401, 'TOKEN_MISSING');
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new AppError('Formato de token inválido. Esperado Bearer <token>', 401, 'TOKEN_MALFORMED');
    }

    const decoded = await request.jwtVerify<TokenPayload & { typ?: string }>();
    if (!decoded.role || decoded.typ === 'refresh') {
      throw new AppError('Token inválido ou expirado. Faça login novamente.', 401, 'TOKEN_INVALID');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        isActive: true,
        deletedAt: true,
        role: true,
        organizationId: true,
        clientId: true,
        email: true,
        name: true,
        organization: { select: { isActive: true } },
      },
    });

    if (!user || user.deletedAt || !user.isActive) {
      throw new AppError('Sessão encerrada. Faça login novamente.', 401, 'USER_INACTIVE');
    }

    if (user.role !== 'SUPER_ADMIN' && !user.organization.isActive) {
      throw new AppError('A organização está inativa no sistema.', 403, 'ORGANIZATION_INACTIVE');
    }

    const payload: TokenPayload = {
      sub: user.id,
      organizationId: user.organizationId,
      role: user.role,
      email: user.email,
      name: user.name,
      clientId: user.clientId,
    };
    request.user = payload;

    if (user.role === 'CLIENT') {
      const path = request.url.split('?')[0];
      const allowed =
        path === '/api/v1/auth/me' ||
        path === '/api/v1/auth/whatsapp-code' ||
        path === '/api/v1/auth/whatsapp-code/confirm' ||
        path === '/api/v1/auth/complete-profile' ||
        path === '/api/v1/users/me' ||
        path.startsWith('/api/v1/me/');
      if (!allowed) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Seu acesso é apenas à área do morador.',
          },
        });
      }
    }
  } catch (err: any) {
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({
        success: false,
        error: {
          code: err.code || 'UNAUTHORIZED',
          message: err.message,
        },
      });
    }

    return reply.status(401).send({
      success: false,
      error: {
        code: 'TOKEN_INVALID',
        message: 'Token inválido ou expirado. Faça login novamente.',
      },
    });
  }
}

