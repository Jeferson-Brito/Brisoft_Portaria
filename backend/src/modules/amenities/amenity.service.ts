import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../core/errors/app-error.js';

function parseDay(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) throw new AppError('Informe a data da reserva.', 400, 'INVALID_DATE');
  return new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00.000-03:00`);
}

function dayKey(value: Date) {
  return value.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function overlaps(startA: string, endA: string, startB: string, endB: string) {
  return startA < endB && startB < endA;
}

export class AmenityService {
  async list(organizationId: string) {
    return prisma.amenity.findMany({
      where: { organizationId, active: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(organizationId: string, input: { name: string; kind?: string }) {
    const name = input.name.trim();
    if (name.length < 2) throw new AppError('Informe o nome da área.', 400, 'NAME_REQUIRED');
    return prisma.amenity.create({
      data: { organizationId, name, kind: input.kind || 'LAZER', active: true },
    });
  }

  async setActive(id: string, organizationId: string, active: boolean) {
    const item = await prisma.amenity.findFirst({ where: { id, organizationId } });
    if (!item) throw new AppError('Área não encontrada.', 404, 'AMENITY_NOT_FOUND');
    return prisma.amenity.update({ where: { id }, data: { active } });
  }

  async month(organizationId: string, month: string, clientId?: string) {
    const match = month.match(/^(\d{4})-(\d{2})$/);
    if (!match) throw new AppError('Informe o mês no formato AAAA-MM.', 400, 'INVALID_MONTH');
    const start = new Date(`${match[1]}-${match[2]}-01T00:00:00.000-03:00`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const bookings = await prisma.amenityBooking.findMany({
      where: {
        organizationId,
        status: 'SCHEDULED',
        date: { gte: start, lt: end },
      },
      include: {
        amenity: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
    });
    return bookings.map((booking) => {
      const mine = clientId ? booking.clientId === clientId : true;
      return {
        id: booking.id,
        amenityId: booking.amenityId,
        amenityName: booking.amenity.name,
        date: dayKey(booking.date),
        startTime: booking.startTime,
        endTime: booking.endTime,
        mine,
        status: mine ? booking.status : 'OCCUPIED',
        clientName: mine ? booking.client.name : null,
        notes: mine ? booking.notes : null,
      };
    });
  }

  async book(params: {
    organizationId: string;
    clientId: string;
    amenityId: string;
    date: string;
    startTime: string;
    endTime: string;
    notes?: string;
  }) {
    const amenity = await prisma.amenity.findFirst({
      where: { id: params.amenityId, organizationId: params.organizationId, active: true },
    });
    if (!amenity) throw new AppError('Área não encontrada.', 404, 'AMENITY_NOT_FOUND');
    if (!/^\d{2}:\d{2}$/.test(params.startTime) || !/^\d{2}:\d{2}$/.test(params.endTime) || params.endTime <= params.startTime) {
      throw new AppError('O horário final precisa ser depois do início.', 400, 'INVALID_TIME');
    }
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    if (params.date < today) throw new AppError('Não é possível reservar uma data que já passou.', 400, 'PAST_DATE');
    const date = parseDay(params.date);
    const sameDay = await prisma.amenityBooking.findMany({
      where: { organizationId: params.organizationId, amenityId: amenity.id, status: 'SCHEDULED', date },
    });
    if (sameDay.some((item) => overlaps(params.startTime, params.endTime, item.startTime, item.endTime))) {
      throw new AppError('Esse horário já está ocupado.', 409, 'SLOT_TAKEN');
    }
    return prisma.amenityBooking.create({
      data: {
        organizationId: params.organizationId,
        amenityId: amenity.id,
        clientId: params.clientId,
        date,
        startTime: params.startTime,
        endTime: params.endTime,
        notes: params.notes?.trim() || null,
        status: 'SCHEDULED',
      },
    });
  }

  async cancel(id: string, organizationId: string, clientId?: string) {
    const booking = await prisma.amenityBooking.findFirst({ where: { id, organizationId } });
    if (!booking) throw new AppError('Reserva não encontrada.', 404, 'BOOKING_NOT_FOUND');
    if (clientId && booking.clientId !== clientId) {
      throw new AppError('Você só pode cancelar a sua reserva.', 403, 'FORBIDDEN');
    }
    return prisma.amenityBooking.update({ where: { id }, data: { status: 'CANCELLED' } });
  }
}

export const amenityService = new AmenityService();
