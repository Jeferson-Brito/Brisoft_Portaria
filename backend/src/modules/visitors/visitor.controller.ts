import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { VisitorService } from './visitor.service.js';

const vehicleSchema = z.object({
  model: z.string().min(1, 'Modelo do veículo é obrigatório'),
  color: z.string().optional(),
  licensePlate: z.string().optional(),
});

const createOrUpdateVisitorSchema = z.object({
  name: z.string().min(2, 'Nome do visitante deve ter no mínimo 2 caracteres'),
  documentType: z.enum(['CPF', 'RG', 'CNH', 'OUTRO']).optional(),
  documentNumber: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  photoUrl: z.string().optional(),
  notes: z.string().optional(),
  vehicle: vehicleSchema.optional(),
});

const uploadBase64Schema = z.object({
  base64: z.string().min(1, 'Dados da foto em base64 são obrigatórios'),
  fileName: z.string().optional().default('visitor_photo.jpg'),
  mimeType: z.string().optional().default('image/jpeg'),
});

const visitorService = new VisitorService();

export class VisitorController {
  async createOrUpdate(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = createOrUpdateVisitorSchema.safeParse(request.body);

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
      const visitor = await visitorService.createOrUpdate({
        ...parseResult.data,
        organizationId: request.user.organizationId,
      });

      return reply.status(201).send({
        success: true,
        data: { visitor },
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

  async search(request: FastifyRequest<{ Querystring: { q?: string } }>, reply: FastifyReply) {
    try {
      const query = request.query.q || '';
      const visitors = await visitorService.search(request.user.organizationId, query);

      return reply.status(200).send({
        success: true,
        data: { visitors },
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

  async getById(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const { id } = request.params;
      const visitor = await visitorService.getById(id, request.user.organizationId);

      return reply.status(200).send({
        success: true,
        data: { visitor },
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

  // Upload flexível: suporta Base64 direto do Expo ImagePicker/Camera ou Multipart
  async uploadPhoto(request: FastifyRequest, reply: FastifyReply) {
    try {
      const contentType = request.headers['content-type'] || '';
      const isMultipart = contentType.includes('multipart/form-data');

      // 1. Tenta multipart se for multipart/form-data
      if (isMultipart && typeof (request as any).file === 'function') {
        const data = await (request as any).file();
        if (data) {
          const buffer = await data.toBuffer();
          const photoUrl = await visitorService.savePhoto(data.filename, buffer, data.mimetype, request.user.organizationId);
          return reply.status(201).send({
            success: true,
            data: { photoUrl },
          });
        }
      }

      // 2. Fallback: JSON com base64
      const parseBase64 = uploadBase64Schema.safeParse(request.body);
      if (parseBase64.success) {
        const { base64, fileName, mimeType } = parseBase64.data;
        const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        const photoUrl = await visitorService.savePhoto(fileName, buffer, mimeType, request.user.organizationId);

        return reply.status(201).send({
          success: true,
          data: { photoUrl },
        });
      }

      return reply.status(400).send({
        success: false,
        error: {
          code: 'NO_PHOTO_PROVIDED',
          message: 'Envie um arquivo multipart ou uma string base64.',
        },
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: err.message || 'Falha ao processar upload da foto.',
        },
      });
    }
  }

  // Rota autenticada para servir a foto em ambiente local com proteção LGPD
  async servePhoto(request: FastifyRequest<{ Params: { fileName: string } }>, reply: FastifyReply) {
    try {
      const { fileName } = request.params;
      const fileData = await visitorService.getPhotoFile(fileName, request.user.organizationId);

      if (!fileData) {
        return reply.status(404).send({
          success: false,
          error: { code: 'PHOTO_NOT_FOUND', message: 'Foto não encontrada.' },
        });
      }

      return reply
        .header('Cache-Control', 'private, max-age=604800, immutable')
        .header('Content-Disposition', 'inline; filename="photo.jpg"')
        .type(fileData.mimeType)
        .send(fileData.buffer);
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: err.message },
      });
    }
  }
}
