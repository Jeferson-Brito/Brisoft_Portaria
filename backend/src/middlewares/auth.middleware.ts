import { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../core/errors/app-error.js';
import { prisma } from '../lib/prisma.js';

export interface TokenPayload {
  sub: string;
  organizationId: string;
  role: string;
  email: string;
  name: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: TokenPayload;
  }
}

const userCache = new Map<string, { payload: TokenPayload; expiresAt: number }>();

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

    const decoded = await request.jwtVerify<TokenPayload>();
    const cached = userCache.get(decoded.sub);
    if (cached && cached.expiresAt > Date.now()) {
      request.user = cached.payload;
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        isActive: true,
        deletedAt: true,
        role: true,
        organizationId: true,
        email: true,
        name: true,
        organization: { select: { isActive: true } },
      },
    });

    if (!user || user.deletedAt || !user.isActive) {
      userCache.delete(decoded.sub);
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
    };
    userCache.set(user.id, { payload, expiresAt: Date.now() + 20000 });
    request.user = payload;
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

