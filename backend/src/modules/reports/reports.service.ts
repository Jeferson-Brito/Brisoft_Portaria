import { prisma } from '../../lib/prisma.js';

export interface ReportFilterParams {
  startDate?: string;
  endDate?: string;
  status?: string;
  visitorType?: string;
  destinationId?: string;
}

export class ReportsService {
  async getVisitsReport(organizationId: string, filters: ReportFilterParams) {
    const where: any = { organizationId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.visitorType) {
      where.visitorType = filters.visitorType;
    }

    if (filters.destinationId) {
      where.destinationId = filters.destinationId;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const visits = await prisma.visitRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        visitor: {
          select: {
            id: true,
            name: true,
            documentType: true,
            documentNumber: true,
            company: true,
            phone: true,
            photoUrl: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            whatsappNumber: true,
          },
        },
        destination: {
          select: {
            id: true,
            name: true,
            block: true,
            code: true,
          },
        },
        vehicle: true,
        conciergeUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return visits.map((v) => {
      let responseTimeSeconds: number | null = null;
      if (v.answeredAt) {
        responseTimeSeconds = Math.max(0, Math.floor((new Date(v.answeredAt).getTime() - new Date(v.createdAt).getTime()) / 1000));
      }

      let stayDurationMinutes: number | null = null;
      if (v.entryAt && v.exitAt) {
        stayDurationMinutes = Math.max(0, Math.floor((new Date(v.exitAt).getTime() - new Date(v.entryAt).getTime()) / (1000 * 60)));
      } else if (v.entryAt && !v.exitAt) {
        stayDurationMinutes = Math.max(0, Math.floor((Date.now() - new Date(v.entryAt).getTime()) / (1000 * 60)));
      }

      return {
        ...v,
        metrics: {
          responseTimeSeconds,
          stayDurationMinutes,
        },
      };
    });
  }

  async getMetrics(organizationId: string, days = 7, startDateStr?: string, endDateStr?: string) {
    let startDate: Date;
    let endDate = new Date();
    
    if (startDateStr) {
      startDate = new Date(startDateStr);
      if (endDateStr) {
        endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59, 999);
      }
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
    }

    const visits = await prisma.visitRequest.findMany({
      where: {
        organizationId,
        createdAt: { gte: startDate, lte: endDate },
      },
      include: {
        destination: { select: { name: true, block: true } },
      },
    });

    const total = visits.length;
    let pending = 0;
    let authorized = 0;
    let denied = 0;
    let expired = 0;
    let cancelled = 0;
    let entered = 0;
    let exited = 0;

    let totalResponseTimeSeconds = 0;
    let answeredCount = 0;

    let totalStayMinutes = 0;
    let completedStaysCount = 0;

    const hourlyCounts: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourlyCounts[h] = 0;

    const visitorTypeCounts: Record<string, number> = {};
    const destinationCounts: Record<string, { count: number; name: string }> = {};

    visits.forEach((v) => {
      // Status counts
      if (v.status === 'PENDING') pending++;
      else if (v.status === 'AUTHORIZED') authorized++;
      else if (v.status === 'DENIED') denied++;
      else if (v.status === 'EXPIRED') expired++;
      else if (v.status === 'CANCELLED') cancelled++;
      else if (v.status === 'ENTERED') entered++;
      else if (v.status === 'EXITED') exited++;

      // Response times
      if (v.answeredAt) {
        const diff = Math.max(0, (new Date(v.answeredAt).getTime() - new Date(v.createdAt).getTime()) / 1000);
        totalResponseTimeSeconds += diff;
        answeredCount++;
      }

      // Stay duration
      if (v.entryAt && v.exitAt) {
        const stay = Math.max(0, (new Date(v.exitAt).getTime() - new Date(v.entryAt).getTime()) / (1000 * 60));
        totalStayMinutes += stay;
        completedStaysCount++;
      }

      // Hourly distribution
      const hour = new Date(v.createdAt).getHours();
      hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;

      // Visitor Type breakdown
      const type = v.visitorType || 'Outro';
      visitorTypeCounts[type] = (visitorTypeCounts[type] || 0) + 1;

      // Top destinations
      const destKey = v.destinationId;
      const destName = v.destination ? `${v.destination.name}${v.destination.block ? ' - ' + v.destination.block : ''}` : 'Desconhecido';
      if (!destinationCounts[destKey]) {
        destinationCounts[destKey] = { count: 0, name: destName };
      }
      destinationCounts[destKey].count++;
    });

    const totalDecided = authorized + entered + exited + denied;
    const approvalRate = totalDecided > 0
      ? Math.round(((authorized + entered + exited) / totalDecided) * 100)
      : 100;

    const averageResponseTimeSeconds = answeredCount > 0
      ? Math.round(totalResponseTimeSeconds / answeredCount)
      : 0;

    const averageStayMinutes = completedStaysCount > 0
      ? Math.round(totalStayMinutes / completedStaysCount)
      : 0;

    // Period of day breakdown
    const periodBreakdown = {
      morning: 0,   // 06h - 11h59
      afternoon: 0, // 12h - 17h59
      night: 0,     // 18h - 23h59
      dawn: 0,      // 00h - 05h59
    };

    Object.entries(hourlyCounts).forEach(([hStr, count]) => {
      const h = parseInt(hStr, 10);
      if (h >= 6 && h < 12) periodBreakdown.morning += count;
      else if (h >= 12 && h < 18) periodBreakdown.afternoon += count;
      else if (h >= 18 && h <= 23) periodBreakdown.night += count;
      else periodBreakdown.dawn += count;
    });

    const topDestinations = Object.values(destinationCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      periodDays: days,
      since: startDate.toISOString(),
      summary: {
        total,
        pending,
        authorized: authorized + entered + exited,
        denied,
        expired,
        cancelled,
        presentNow: entered,
        completedExited: exited,
        approvalRate,
      },
      performance: {
        averageResponseTimeSeconds,
        averageResponseTimeFormatted: averageResponseTimeSeconds >= 60
          ? `${(averageResponseTimeSeconds / 60).toFixed(1)} min`
          : `${averageResponseTimeSeconds} s`,
        averageStayMinutes,
        averageStayFormatted: averageStayMinutes >= 60
          ? `${(averageStayMinutes / 60).toFixed(1)} h`
          : `${averageStayMinutes} min`,
      },
      periodBreakdown,
      visitorTypeBreakdown: visitorTypeCounts,
      topDestinations,
    };
  }
}

export const reportsService = new ReportsService();
