import { createHmac } from 'crypto';
import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { AuthService } from './auth.service.js';
import { verificationService } from '../../services/verification.service.js';

function signRefreshToken(userId: string, organizationId: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      organizationId,
      typ: 'refresh',
      iat: now,
      exp: now + 7 * 24 * 60 * 60,
    })
  ).toString('base64url');
  const signature = createHmac('sha256', env.JWT_REFRESH_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

const resetPasswordBodySchema = z.object({
  email: z.string().email('E-mail em formato inválido'),
  code: z.string().regex(/^\d{8}$/, 'Informe o código de 8 números.'),
  newPassword: z.string().min(8, 'A nova senha deve ter no mínimo 8 caracteres'),
});

const loginBodySchema = z.object({
  email: z.string().email('E-mail em formato inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

const registerBodySchema = z.object({
  organizationName: z.string().min(2, 'Nome da empresa deve ter ao menos 2 caracteres'),
  organizationDocument: z.string().min(11, 'Informe o CPF ou o CNPJ.'),
  documentType: z.enum(['CPF', 'CNPJ']).default('CNPJ'),
  adminName: z.string().min(2, 'Seu nome deve ter ao menos 2 caracteres'),
  adminEmail: z.string().email('E-mail em formato inválido'),
  adminPassword: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres'),
  adminPhone: z.string().min(10, 'Informe o WhatsApp com DDD.'),
  verificationCode: z.string().regex(/^\d{8}$/, 'Informe o código de 8 números enviado no WhatsApp.'),
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
          typ: 'access',
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
          typ: 'access',
        },
        {
          sign: {
            sub: user.id,
            expiresIn: '1d',
          },
        }
      );

      const refreshToken = signRefreshToken(user.id, user.organizationId);

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

  async checkResetCode(request: FastifyRequest, reply: FastifyReply) {
    const schema = z.object({
      email: z.string().email('E-mail em formato inválido'),
      code: z.string().regex(/^\d{8}$/, 'Informe o código de 8 números.'),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }
    try {
      await authService.checkResetCode(parsed.data.email, parsed.data.code);
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Código inválido.' },
      });
    }
  }

  async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = resetPasswordBodySchema.safeParse(request.body);

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
      await authService.resetPassword(parseResult.data.email, parseResult.data.code, parseResult.data.newPassword);
      return reply.status(200).send({
        success: true,
        message: 'Senha redefinida. Entre com a nova senha.',
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message || 'Não foi possível redefinir a senha.',
        },
      });
    }
  }

  async sendRegisterCode(request: FastifyRequest, reply: FastifyReply) {
    const schema = z.object({
      email: z.string().email('E-mail em formato inválido'),
      phone: z.string().min(10, 'Informe o WhatsApp com DDD.'),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }
    try {
      if (await authService.whatsappAlreadyUsed(parsed.data.phone)) {
        return reply.status(409).send({
          success: false,
          error: { code: 'PHONE_IN_USE', message: 'Este número de WhatsApp já está cadastrado.' },
        });
      }
      await verificationService.send({
        email: parsed.data.email,
        phone: parsed.data.phone,
        purpose: 'REGISTER',
      });
      return reply.send({ success: true, message: 'Código enviado no WhatsApp.' });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Não foi possível enviar o código.' },
      });
    }
  }

  async confirmRegisterCode(request: FastifyRequest, reply: FastifyReply) {
    const schema = z.object({
      email: z.string().email('E-mail em formato inválido'),
      phone: z.string().min(10, 'Informe o WhatsApp com DDD.'),
      code: z.string().regex(/^\d{8}$/, 'Informe o código de 8 números.'),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }
    try {
      await verificationService.matches({
        email: parsed.data.email,
        phone: parsed.data.phone,
        code: parsed.data.code,
        purpose: 'REGISTER',
      });
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Código incorreto.' },
      });
    }
  }

  async checkDocument(request: FastifyRequest, reply: FastifyReply) {
    const schema = z.object({
      documentType: z.enum(['CPF', 'CNPJ']),
      document: z.string().min(11, 'Informe o documento.'),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }
    try {
      await authService.assertDocument(parsed.data.documentType, parsed.data.document);
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: { code: err.code || 'INVALID_DOCUMENT', message: err.message || 'Documento inválido.' },
      });
    }
  }

  async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    const schema = z.object({ email: z.string().email('E-mail em formato inválido') });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }
    try {
      await authService.requestPasswordReset(parsed.data.email);
      return reply.send({ success: true, message: 'Código enviado para o WhatsApp confirmado desta conta.' });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Não foi possível enviar o código.' },
      });
    }
  }

  async sendOwnWhatsappCode(request: FastifyRequest, reply: FastifyReply) {
    const schema = z.object({ phone: z.string().min(10, 'Informe o WhatsApp com DDD.') });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }
    try {
      const data = await authService.sendWhatsappCode(request.user.sub, parsed.data.phone);
      return reply.send({ success: true, data });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Não foi possível enviar o código.' },
      });
    }
  }

  async confirmOwnWhatsappCode(request: FastifyRequest, reply: FastifyReply) {
    const schema = z.object({
      phone: z.string().min(10, 'Informe o WhatsApp com DDD.'),
      code: z.string().regex(/^\d{8}$/, 'Informe o código de 8 números.'),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }
    try {
      await authService.confirmOwnWhatsappCode(request.user.sub, parsed.data.phone, parsed.data.code);
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Código incorreto.' },
      });
    }
  }

  async completeProfile(request: FastifyRequest, reply: FastifyReply) {
    const schema = z.object({
      newPassword: z.string().min(8, 'A nova senha deve ter no mínimo 8 caracteres'),
      phone: z.string().min(10, 'Informe o WhatsApp com DDD.'),
      code: z.string().regex(/^\d{8}$/, 'Informe o código de 8 números.'),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }
    try {
      const user = await authService.completeProfile(
        request.user.sub,
        parsed.data.newPassword,
        parsed.data.phone,
        parsed.data.code
      );
      return reply.send({ success: true, data: { user } });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Não foi possível concluir o cadastro.' },
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
