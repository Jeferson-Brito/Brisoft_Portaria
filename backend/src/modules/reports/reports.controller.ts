import { FastifyRequest, FastifyReply } from 'fastify';
import { reportsService } from './reports.service.js';

export class ReportsController {
  async getVisits(req: FastifyRequest, reply: FastifyReply) {
    const { organizationId } = (req as any).user;
    const filters = req.query as {
      startDate?: string;
      endDate?: string;
      status?: string;
      visitorType?: string;
      destinationId?: string;
    };

    const data = await reportsService.getVisitsReport(organizationId, filters);
    return reply.send({ success: true, count: data.length, data });
  }

  async getMetrics(req: FastifyRequest, reply: FastifyReply) {
    const { organizationId } = (req as any).user;
    const { days, startDate, endDate } = req.query as { days?: string, startDate?: string, endDate?: string };

    const daysNum = days ? parseInt(days, 10) : 7;
    const data = await reportsService.getMetrics(organizationId, daysNum, startDate, endDate);
    return reply.send({ success: true, data });
  }
}

export const reportsController = new ReportsController();
