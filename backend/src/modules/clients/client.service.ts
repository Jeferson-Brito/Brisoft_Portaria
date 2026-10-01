import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { formatWhatsAppNumber } from '../../utils/phone.util.js';
import { retiredEmail } from '../../utils/email.js';
import { invalidateAuthCache } from '../../middlewares/auth.middleware.js';

export interface CreateClientParams {
  organizationId: string;
  name: string;
  whatsappNumber: string;
  email?: string;
  document?: string;
  company?: string;
  notes?: string;
  destinationIds?: string[]; // IDs das unidades vinculadas
}

export interface UpdateClientParams {
  name?: string;
  whatsappNumber?: string;
  email?: string;
  document?: string;
  company?: string;
  notes?: string;
  isActive?: boolean;
  destinationIds?: string[];
}

export class ClientService {
  async create({
    organizationId,
    name,
    whatsappNumber,
    email,
    document,
    company,
    notes,
    destinationIds = [],
  }: CreateClientParams) {
    if (!name || name.trim().length === 0) {
      throw new AppError('O nome do cliente é obrigatório.', 400, 'NAME_REQUIRED');
    }

    let formattedWhatsApp: string;
    try {
      formattedWhatsApp = formatWhatsAppNumber(whatsappNumber);
    } catch (err: any) {
      throw new AppError(err.message || 'Número de WhatsApp inválido.', 400, 'INVALID_WHATSAPP');
    }

    // Cria o cliente
    const client = await prisma.client.create({
      data: {
        organizationId,
        name: name.trim(),
        whatsappNumber: formattedWhatsApp,
        email: email ? email.trim().toLowerCase() : null,
        document: document ? document.trim() : null,
        company: company ? company.trim() : null,
        notes: notes ? notes.trim() : null,
      },
    });

    // Se informou destinos, vincula
    if (destinationIds.length > 0) {
      await prisma.clientDestination.createMany({
        data: destinationIds.map((destId, index) => ({
          clientId: client.id,
          destinationId: destId,
          isPrimary: index === 0,
        })),
      });
    }

    return this.getById(client.id, organizationId);
  }

  // Busca rápida otimizada para o Porteiro (Seções 8 e 43 da especificação)
  // Permite buscar por: "8", "João", "APT-01", telefone, empresa
  async search(organizationId: string, query: string) {
    if (!query || query.trim().length === 0) {
      // Se não passou query, retorna os 20 primeiros clientes mais recentes
      return prisma.client.findMany({
        where: {
          organizationId,
          deletedAt: null,
          isActive: true,
        },
        include: {
          destinations: {
            include: {
              destination: true,
            },
          },
        },
        take: 20,
        orderBy: { name: 'asc' },
      });
    }

    const trimmed = query.trim();

    const clients = await prisma.client.findMany({
      where: {
        organizationId,
        deletedAt: null,
        isActive: true,
        OR: [
          { name: { contains: trimmed } },
          { whatsappNumber: { contains: trimmed } },
          { document: { contains: trimmed } },
          { company: { contains: trimmed } },
          {
            destinations: {
              some: {
                destination: {
                  OR: [
                    { name: { contains: trimmed } },
                    { code: { contains: trimmed } },
                    { block: { contains: trimmed } },
                  ],
                },
              },
            },
          },
        ],
      },
      include: {
        destinations: {
          include: {
            destination: true,
          },
        },
      },
      take: 25,
      orderBy: { name: 'asc' },
    });

    return clients;
  }

  async list(organizationId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where: {
          organizationId,
          deletedAt: null,
        },
        include: {
          destinations: {
            include: {
              destination: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.client.count({
        where: {
          organizationId,
          deletedAt: null,
        },
      }),
    ]);

    return {
      clients,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string, organizationId: string) {
    const client = await prisma.client.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      include: {
        destinations: {
          include: {
            destination: true,
          },
        },
      },
    });

    if (!client) {
      throw new AppError('Cliente não encontrado.', 404, 'CLIENT_NOT_FOUND');
    }

    return client;
  }

  async update(id: string, organizationId: string, data: UpdateClientParams) {
    await this.getById(id, organizationId);

    let formattedWhatsApp: string | undefined = undefined;
    if (data.whatsappNumber) {
      try {
        formattedWhatsApp = formatWhatsAppNumber(data.whatsappNumber);
      } catch (err: any) {
        throw new AppError(err.message || 'Número de WhatsApp inválido.', 400, 'INVALID_WHATSAPP');
      }
    }

    const updated = await prisma.client.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(formattedWhatsApp ? { whatsappNumber: formattedWhatsApp } : {}),
        ...(data.email !== undefined ? { email: data.email ? data.email.trim().toLowerCase() : null } : {}),
        ...(data.document !== undefined ? { document: data.document ? data.document.trim() : null } : {}),
        ...(data.company !== undefined ? { company: data.company ? data.company.trim() : null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes ? data.notes.trim() : null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    // Se foram enviados novos destinos, atualiza o mapeamento
    if (data.destinationIds !== undefined) {
      await prisma.clientDestination.deleteMany({
        where: { clientId: id },
      });

      if (data.destinationIds.length > 0) {
        await prisma.clientDestination.createMany({
          data: data.destinationIds.map((destId, index) => ({
            clientId: id,
            destinationId: destId,
            isPrimary: index === 0,
          })),
        });
      }
    }

    return this.getById(id, organizationId);
  }

  async delete(id: string, organizationId: string) {
    await this.getById(id, organizationId);

    await prisma.client.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    const linkedUsers = await prisma.user.findMany({
      where: { clientId: id, deletedAt: null },
      select: { id: true, email: true },
    });
    for (const user of linkedUsers) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          deletedAt: new Date(),
          isActive: false,
          email: retiredEmail(user.email, user.id),
        },
      });
      invalidateAuthCache(user.id);
    }

    return { success: true };
  }
}
