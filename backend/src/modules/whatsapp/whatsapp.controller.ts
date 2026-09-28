import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { whatsappService } from '../../services/whatsapp/whatsapp.service.js';
import { prisma } from '../../lib/prisma.js';

const simulateIncomingSchema = z.object({
  fromPhone: z.string().min(8, 'Número de telefone do morador é obrigatório'),
  text: z.string().min(1, 'Texto da resposta é obrigatório (ex: 1 para autorizar ou 2 para recusar)'),
});

const updateTemplateSchema = z.object({
  type: z.enum(['APPROVAL_REQUEST', 'REMINDER', 'CONFIRMATION']),
  title: z.string().optional(),
  content: z.string().min(10, 'O conteúdo do template é obrigatório'),
});

export class WhatsAppController {
  // Retorna status atual da conexão e QR Code se aguardando pareamento (Seção 19 e 44)
  async getStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const provider = whatsappService.getProvider(request.user.organizationId);
      const status = await provider.getStatus(request.user.organizationId);

      return reply.status(200).send({
        success: true,
        data: status,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'WHATSAPP_STATUS_ERROR', message: err.message },
      });
    }
  }

  // Iniciar conexão com WhatsApp e emitir QR Code (Seção 19)
  async connect(request: FastifyRequest, reply: FastifyReply) {
    try {
      const provider = whatsappService.getProvider(request.user.organizationId);
      await provider.connect(request.user.organizationId);
      const status = await provider.getStatus(request.user.organizationId);

      return reply.status(200).send({
        success: true,
        message: 'Conexão iniciada. Escaneie o QR Code no WhatsApp se exibido.',
        data: status,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'WHATSAPP_CONNECT_ERROR', message: err.message },
      });
    }
  }

  // Desconectar WhatsApp
  async disconnect(request: FastifyRequest, reply: FastifyReply) {
    try {
      const provider = whatsappService.getProvider(request.user.organizationId);
      await provider.disconnect(request.user.organizationId);

      return reply.status(200).send({
        success: true,
        message: 'WhatsApp desconectado com sucesso.',
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'WHATSAPP_DISCONNECT_ERROR', message: err.message },
      });
    }
  }

  // Simular mensagem recebida (essencial para testes locais de portaria)
  async simulateIncoming(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = simulateIncomingSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message },
      });
    }

    try {
      const { fromPhone, text } = parseResult.data;
      await whatsappService.handleIncomingResponse(request.user.organizationId, {
        fromPhone,
        text,
        timestamp: new Date(),
      });

      return reply.status(200).send({
        success: true,
        message: `Mensagem "${text}" processada com sucesso como se tivesse sido enviada pelo número ${fromPhone}.`,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'SIMULATION_ERROR', message: err.message },
      });
    }
  }

  // Listar templates de mensagens (Seção 45)
  async getTemplates(request: FastifyRequest, reply: FastifyReply) {
    try {
      const templates = await prisma.messageTemplate.findMany({
        where: { organizationId: request.user.organizationId },
      });

      return reply.status(200).send({
        success: true,
        data: { templates },
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'TEMPLATES_ERROR', message: err.message },
      });
    }
  }

  // Atualizar template de mensagem
  async updateTemplate(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = updateTemplateSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message },
      });
    }

    try {
      const { type, title, content } = parseResult.data;
      const template = await prisma.messageTemplate.upsert({
        where: {
          organizationId_type: {
            organizationId: request.user.organizationId,
            type,
          },
        },
        update: {
          content,
          ...(title ? { title } : {}),
        },
        create: {
          organizationId: request.user.organizationId,
          type,
          title: title || 'Template WhatsApp',
          content,
        },
      });

      return reply.status(200).send({
        success: true,
        data: { template },
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'TEMPLATE_UPDATE_ERROR', message: err.message },
      });
    }
  }

  // Enviar mensagem de teste direta
  async testSend(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { toPhone, text } = request.body as { toPhone: string; text?: string };
      if (!toPhone) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_PHONE', message: 'Telefone de destino obrigatório' },
        });
      }

      const provider = whatsappService.getProvider(request.user.organizationId);
      const message = text || '🔔 *Brisoft Portaria:* Teste de conectividade do WhatsApp realizado com sucesso!';
      const result = await provider.sendMessage(toPhone, message);

      return reply.status(200).send({
        success: true,
        message: 'Mensagem enviada com sucesso.',
        data: result,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'TEST_SEND_ERROR', message: err.message },
      });
    }
  }
}
