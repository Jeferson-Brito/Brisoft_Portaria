import { FastifyRequest, FastifyReply } from 'fastify';
import { packagesService } from './packages.service.js';

export class PackagesController {
  async create(req: FastifyRequest, reply: FastifyReply) {
    const conciergeUserId = (req as any).user?.sub || (req as any).user?.id;
    const organizationId = (req as any).user?.organizationId;
    const body = req.body as any;

    if (!body.destinationId) {
      return reply.status(400).send({ success: false, message: 'destinationId é obrigatório.' });
    }

    if (!body.photoUrl) {
      return reply.status(400).send({ success: false, message: 'A foto da encomenda é obrigatória para comprovar o recebimento.' });
    }

    try {
      const pkg = await packagesService.create({
        ...body,
        conciergeUserId,
        organizationId,
      });

      return reply.status(201).send({ success: true, data: pkg });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
  }

  async listPending(req: FastifyRequest, reply: FastifyReply) {
    const { organizationId } = (req as any).user;
    const packages = await packagesService.listPending(organizationId);
    return reply.send({ success: true, count: packages.length, data: packages });
  }

  async listHistory(req: FastifyRequest, reply: FastifyReply) {
    const { organizationId } = (req as any).user;
    const { limit } = req.query as { limit?: string };
    const packages = await packagesService.listHistory(organizationId, limit ? parseInt(limit, 10) : 50);
    return reply.send({ success: true, count: packages.length, data: packages });
  }

  async pickup(req: FastifyRequest, reply: FastifyReply) {
    const conciergeUserId = (req as any).user?.sub || (req as any).user?.id;
    const organizationId = (req as any).user?.organizationId;
    const { id } = req.params as { id: string };
    const { pickupCode, pickedUpBy, directPickup } = (req.body as any) || {};
    const role = (req as any).user?.role as string;
    const allowDirect = directPickup === true;

    if (!pickupCode && !allowDirect) {
      return reply.status(400).send({ success: false, message: 'Informe o código de retirada ou confirme a liberação direta.' });
    }

    if (allowDirect && !['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'].includes(role)) {
      return reply.status(403).send({
        success: false,
        message: 'Apenas administrador ou supervisor pode liberar a encomenda sem o código.',
      });
    }

    try {
      const updated = await packagesService.pickup(id, organizationId, conciergeUserId, pickupCode, pickedUpBy, allowDirect);
      return reply.send({ success: true, data: updated, message: 'Encomenda entregue com sucesso!' });
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
  }

  async resendCode(req: FastifyRequest, reply: FastifyReply) {
    const { organizationId } = (req as any).user;
    const { id } = req.params as { id: string };

    try {
      const res = await packagesService.resendCode(id, organizationId);
      return reply.send(res);
    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message });
    }
  }
}

export const packagesController = new PackagesController();
