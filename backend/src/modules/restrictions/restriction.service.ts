import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../core/errors/app-error.js';

export type RestrictionMatch = {
  id: string;
  name: string;
  documentNumber: string | null;
  reason: string;
};

function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function digits(value?: string | null) {
  return (value || '').replace(/\D/g, '');
}

export class RestrictionService {
  async list(organizationId: string) {
    return prisma.accessRestriction.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(organizationId: string, input: { name: string; documentNumber?: string; reason: string }) {
    const name = input.name.trim();
    const reason = input.reason.trim();
    if (name.length < 2) {
      throw new AppError('Informe o nome da pessoa restrita.', 400, 'NAME_REQUIRED');
    }
    if (reason.length < 3) {
      throw new AppError('Informe o motivo da restrição.', 400, 'REASON_REQUIRED');
    }
    return prisma.accessRestriction.create({
      data: {
        organizationId,
        name,
        documentNumber: input.documentNumber?.trim() || null,
        reason,
        active: true,
      },
    });
  }

  async setActive(id: string, organizationId: string, active: boolean) {
    const item = await prisma.accessRestriction.findFirst({ where: { id, organizationId } });
    if (!item) {
      throw new AppError('Restrição não encontrada.', 404, 'RESTRICTION_NOT_FOUND');
    }
    return prisma.accessRestriction.update({
      where: { id },
      data: { active },
    });
  }

  async findMatches(organizationId: string, name?: string | null, documentNumber?: string | null) {
    const restrictions = await prisma.accessRestriction.findMany({
      where: { organizationId, active: true },
    });
    const targetName = fold(name || '');
    const targetDocument = digits(documentNumber);
    return restrictions.filter((item) => {
      const document = digits(item.documentNumber);
      const sameDocument = document.length >= 5 && targetDocument.length >= 5 && document === targetDocument;
      const sameName = targetName.length >= 2 && fold(item.name) === targetName;
      return sameDocument || sameName;
    }).map((item) => ({
      id: item.id,
      name: item.name,
      documentNumber: item.documentNumber,
      reason: item.reason,
    }));
  }

  async assertReleaseAllowed(params: {
    organizationId: string;
    actorUserId: string;
    name?: string | null;
    documentNumber?: string | null;
    acknowledge?: boolean;
    entity: string;
    entityId: string;
  }) {
    const matches = await this.findMatches(params.organizationId, params.name, params.documentNumber);
    if (matches.length === 0) return;

    const detail = matches
      .map((item) => `${item.name}${item.documentNumber ? ` (${item.documentNumber})` : ''}: ${item.reason}`)
      .join('\n');

    if (!params.acknowledge) {
      throw new AppError(
        `Esta pessoa está na lista de restrição. Confira antes de liberar:\n${detail}`,
        409,
        'RESTRICTION_WARNING',
      );
    }

    await prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.actorUserId,
        action: 'RESTRICTION_ACKNOWLEDGED',
        entity: params.entity,
        entityId: params.entityId,
        payload: JSON.stringify({ matches }),
      },
    });
  }
}

export const restrictionService = new RestrictionService();
