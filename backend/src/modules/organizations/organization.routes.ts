import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/rbac.middleware.js';
import { subscriptionGuard } from '../../middlewares/subscription.middleware.js';

function readSettings(raw?: string | null) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function publicProfile(settings: Record<string, any>, organizationName: string) {
  return {
    type: settings.type || 'RESIDENTIAL',
    companyName: settings.companyName || organizationName,
    unitLabel: settings.unitLabel || 'Apartamento / Unidade',
    clientLabel: settings.clientLabel || 'Morador',
    address: typeof settings.address === 'string' ? settings.address : '',
  };
}

export async function organizationRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  // Retorna os dados e configurações do perfil do estabelecimento atual
  app.get('/current', async (req: FastifyRequest, reply: FastifyReply) => {
    const { organizationId } = (req as any).user;

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        document: true,
        settings: true,
        createdAt: true,
      },
    });

    if (!organization) {
      return reply.status(404).send({ success: false, message: 'Organização não encontrada.' });
    }

    const settings = readSettings(organization.settings);
    const role = (req as any).user?.role as string;
    const isManager = role === 'ADMIN' || role === 'SUPER_ADMIN';
    const profile = isManager
      ? {
          type: 'RESIDENTIAL',
          companyName: organization.name,
          unitLabel: 'Apartamento / Unidade',
          clientLabel: 'Morador',
          ...settings,
        }
      : publicProfile(settings, organization.name);

    return reply.send({
      success: true,
      data: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        document: isManager ? organization.document : undefined,
        createdAt: organization.createdAt,
        ...(isManager ? { settings: organization.settings } : {}),
        profile,
      },
    });
  });

  // Atualiza o tipo de empresa / estabelecimento e os rótulos de atendimento
  app.patch('/current', { preHandler: [requireRole(['ADMIN']), subscriptionGuard] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { organizationId } = (req as any).user;
    const body = req.body as {
      name?: string;
      type?: 'RESIDENTIAL' | 'COMMERCIAL' | 'CLINIC' | 'INDUSTRIAL' | 'EDUCATIONAL' | 'OTHER';
      companyName?: string;
      unitLabel?: string;
      clientLabel?: string;
      address?: string;
    };

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      return reply.status(404).send({ success: false, message: 'Organização não encontrada.' });
    }

    let currentSettings: any = {};
    if (organization.settings) {
      try {
        currentSettings = JSON.parse(organization.settings);
      } catch (e) {}
    }

    // Default presets por nicho
    let defaultUnitLabel = body.unitLabel || currentSettings.unitLabel || 'Apartamento / Unidade';
    let defaultClientLabel = body.clientLabel || currentSettings.clientLabel || 'Morador';

    if (body.type && !body.unitLabel && !body.clientLabel) {
      switch (body.type) {
        case 'COMMERCIAL':
          defaultUnitLabel = 'Sala / Conjunto / Andar';
          defaultClientLabel = 'Colaborador / Responsável';
          break;
        case 'CLINIC':
          defaultUnitLabel = 'Consultório / Ala / Sala';
          defaultClientLabel = 'Médico / Especialista / Secretária';
          break;
        case 'INDUSTRIAL':
          defaultUnitLabel = 'Setor / Galpão / Doca';
          defaultClientLabel = 'Gestor / Responsável';
          break;
        case 'EDUCATIONAL':
          defaultUnitLabel = 'Sala / Bloco / Departamento';
          defaultClientLabel = 'Professor / Coordenação / Direção';
          break;
        case 'OTHER':
          defaultUnitLabel = 'Setor / Unidade';
          defaultClientLabel = 'Responsável';
          break;
        case 'RESIDENTIAL':
        default:
          defaultUnitLabel = 'Apartamento / Unidade';
          defaultClientLabel = 'Morador';
          break;
      }
    }

    const updatedSettings = {
      ...currentSettings,
      type: body.type || currentSettings.type || 'RESIDENTIAL',
      companyName: body.companyName || body.name || organization.name,
      unitLabel: defaultUnitLabel,
      clientLabel: defaultClientLabel,
      address: body.address !== undefined ? body.address.trim() : (currentSettings.address || ''),
    };

    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        name: body.name || organization.name,
        settings: JSON.stringify(updatedSettings),
      },
    });

    return reply.send({
      success: true,
      message: 'Perfil do estabelecimento atualizado com sucesso!',
      data: {
        ...updated,
        profile: updatedSettings,
      },
    });
  });
}
