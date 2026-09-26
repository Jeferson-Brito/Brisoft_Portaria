import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AuthService } from './auth.service.js';

const loginBodySchema = z.object({
  email: z.string().email('E-mail em formato inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

const registerBodySchema = z.object({
  organizationName: z.string().min(2, 'Nome da empresa deve ter ao menos 2 caracteres'),
  organizationDocument: z.string().optional(),
  adminName: z.string().min(2, 'Seu nome deve ter ao menos 2 caracteres'),
  adminEmail: z.string().email('E-mail em formato inválido'),
  adminPassword: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres'),
  adminPhone: z.string().optional(),
});

const authService = new AuthService();

export class AuthController {
  // Registro público de nova empresa (self-service)
  async register(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = registerBodySchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
        },
      });
    }

    try {
      const result = await authService.register(parseResult.data);

      // Gera token JWT para login automático após registro
      const token = await reply.jwtSign(
        {
          organizationId: result.admin.organizationId,
          role: result.admin.role,
          email: result.admin.email,
          name: result.admin.name,
        },
        {
          sign: {
            sub: result.admin.id,
            expiresIn: '1d',
          },
        }
      );

      return reply.status(201).send({
        success: true,
        message: 'Empresa cadastrada com sucesso! Seu período de teste de 7 dias começou.',
        data: {
          ...result,
          token,
        },
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message || 'Erro ao criar a conta.',
        },
      });
    }
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = loginBodySchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
        },
      });
    }

    try {
      const { user } = await authService.authenticate(parseResult.data);

      // Gera token de acesso JWT
      const token = await reply.jwtSign(
        {
          organizationId: user.organizationId,
          role: user.role,
          email: user.email,
          name: user.name,
        },
        {
          sign: {
            sub: user.id,
            expiresIn: '1d',
          },
        }
      );

      // Gera refresh token
      const refreshToken = await reply.jwtSign(
        {
          sub: user.id,
          organizationId: user.organizationId,
        },
        {
          sign: {
            expiresIn: '7d',
          },
        }
      );

      return reply.status(200).send({
        success: true,
        data: {
          user,
          token,
          refreshToken,
        },
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message || 'Erro interno ao autenticar usuário.',
        },
      });
    }
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user.sub;
      const user = await authService.getProfile(userId);

      return reply.status(200).send({
        success: true,
        data: { user },
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message || 'Erro ao obter dados do usuário logado.',
        },
      });
    }
  }
}
