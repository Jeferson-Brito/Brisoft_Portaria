import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { UserService } from './user.service.js';
import { Role } from '../../middlewares/rbac.middleware.js';

const createUserSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  role: z.enum(['ADMIN', 'SUPERVISOR', 'CONCIERGE', 'CLIENT']),
  phone: z.string().optional(),
  clientId: z.string().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').optional(),
  email: z.string().email('E-mail inválido').optional(),
  phone: z.string().optional().nullable(),
  role: z.enum(['ADMIN', 'SUPERVISOR', 'CONCIERGE']).optional(),
  newPassword: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').optional(),
});

const listUsersQuerySchema = z.object({
  role: z.string().optional(),
  search: z.string().optional(),
});

const userService = new UserService();

export class UserController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = createUserSchema.safeParse(request.body);

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
      const user = await userService.create({
        ...parseResult.data,
        organizationId: request.user.organizationId,
        creatorRole: request.user.role as Role,
      });

      return reply.status(201).send({
        success: true,
        data: { user },
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message || 'Erro ao criar usuário.',
        },
      });
    }
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const parseQuery = listUsersQuerySchema.safeParse(request.query);
    const query = parseQuery.success ? parseQuery.data : {};

    try {
      const users = await userService.list({
        organizationId: request.user.organizationId,
        role: query.role,
        search: query.search,
      });

      return reply.status(200).send({
        success: true,
        data: { users },
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message,
        },
      });
    }
  }

  async toggleActive(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const { id } = request.params;
      const user = await userService.toggleActive(
        id,
        request.user.organizationId,
        request.user.role as Role
      );

      return reply.status(200).send({
        success: true,
        data: { user },
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message,
        },
      });
    }
  }

  async delete(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const { id } = request.params;
      await userService.delete(
        id,
        request.user.organizationId,
        request.user.role as Role
      );

      return reply.status(200).send({
        success: true,
        message: 'Usuário desativado com sucesso.',
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message,
        },
      });
    }
  }

  async updateUser(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const parseResult = updateUserSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message },
      });
    }
    try {
      const { id } = request.params;
      const updated = await userService.updateUser(
        id,
        request.user.organizationId,
        request.user.role as Role,
        parseResult.data
      );
      return reply.status(200).send({ success: true, data: { user: updated } });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
      });
    }
  }

  async updateProfile(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any;
      const updated = await userService.updateProfile(request.user.sub, body || {});
      return reply.status(200).send({
        success: true,
        data: { user: updated },
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message || 'Erro ao atualizar perfil.',
        },
      });
    }
  }
}

