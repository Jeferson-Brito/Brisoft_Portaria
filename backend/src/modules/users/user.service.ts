import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { Role } from '../../middlewares/rbac.middleware.js';

export interface CreateUserParams {
  organizationId: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  phone?: string;
  creatorRole: Role;
}

export interface ListUsersParams {
  organizationId: string;
  role?: string;
  search?: string;
}

export class UserService {
  async create({ organizationId, name, email, password, role, phone, creatorRole }: CreateUserParams) {
    // Validação de hierarquia RBAC
    if (creatorRole === 'CONCIERGE') {
      throw new AppError('Porteiros não têm permissão para criar usuários.', 403, 'FORBIDDEN');
    }

    if (creatorRole === 'SUPERVISOR' && role !== 'CONCIERGE') {
      throw new AppError('Supervisores só possuem permissão para cadastrar porteiros.', 403, 'FORBIDDEN');
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        deletedAt: null,
      },
    });

    if (existingUser) {
      throw new AppError('Este e-mail já está sendo utilizado por outro usuário.', 409, 'EMAIL_IN_USE');
    }

    if (creatorRole !== 'SUPER_ADMIN') {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { settings: true },
      });
      let maxUsers = 15;
      try {
        const settings = org?.settings ? JSON.parse(org.settings) : {};
        if (typeof settings.maxUsers === 'number' && settings.maxUsers > 0) {
          maxUsers = settings.maxUsers;
        }
      } catch {}

      const activeUsers = await prisma.user.count({
        where: { organizationId, deletedAt: null, isActive: true },
      });
      if (activeUsers >= maxUsers) {
        throw new AppError(
          `O plano desta empresa permite até ${maxUsers} usuários ativos.`,
          403,
          'PLAN_LIMIT'
        );
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        organizationId,
        name,
        email: email.trim().toLowerCase(),
        passwordHash,
        role,
        phone,
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    });

    return user;
  }

  async list({ organizationId, role, search }: ListUsersParams) {
    const users = await prisma.user.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(role ? { role } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { email: { contains: search } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    return users;
  }

  async toggleActive(userId: string, organizationId: string, actorRole: Role) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || (actorRole !== 'SUPER_ADMIN' && user.organizationId !== organizationId) || user.deletedAt) {
      throw new AppError('Usuário não encontrado.', 404, 'USER_NOT_FOUND');
    }

    if (actorRole === 'SUPERVISOR' && user.role !== 'CONCIERGE') {
      throw new AppError('Supervisores só podem alterar o status de porteiros.', 403, 'FORBIDDEN');
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
      select: { id: true, name: true, isActive: true },
    });

    return updated;
  }

  async delete(userId: string, organizationId: string, actorRole: Role) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || (actorRole !== 'SUPER_ADMIN' && user.organizationId !== organizationId) || user.deletedAt) {
      throw new AppError('Usuário não encontrado.', 404, 'USER_NOT_FOUND');
    }

    if (actorRole === 'SUPERVISOR' && user.role !== 'CONCIERGE') {
      throw new AppError('Supervisores só podem excluir porteiros.', 403, 'FORBIDDEN');
    }

    // Soft delete para compliance e auditoria
    await prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return { success: true };
  }

  async updateUser(
    userId: string,
    organizationId: string,
    actorRole: Role,
    data: { name?: string; email?: string; role?: Role; phone?: string | null; newPassword?: string }
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || (actorRole !== 'SUPER_ADMIN' && user.organizationId !== organizationId) || user.deletedAt) {
      throw new AppError('Usuário não encontrado.', 404, 'USER_NOT_FOUND');
    }

    if (actorRole === 'SUPERVISOR' && user.role !== 'CONCIERGE') {
      throw new AppError('Supervisores só possuem permissão para editar porteiros.', 403, 'FORBIDDEN');
    }

    if (actorRole === 'SUPERVISOR' && data.role && data.role !== 'CONCIERGE') {
      throw new AppError('Supervisores não podem alterar o perfil do porteiro.', 403, 'FORBIDDEN');
    }

    const updateData: any = {};
    if (data.name?.trim()) updateData.name = data.name.trim();

    if (data.email?.trim()) {
      const normalizedEmail = data.email.trim().toLowerCase();
      if (normalizedEmail !== user.email) {
        const existing = await prisma.user.findFirst({
          where: { email: normalizedEmail, deletedAt: null, id: { not: userId } },
        });
        if (existing) {
          throw new AppError('Este e-mail já está sendo utilizado por outro usuário.', 409, 'EMAIL_IN_USE');
        }
        updateData.email = normalizedEmail;
      }
    }

    if (data.role) {
      if (actorRole !== 'SUPER_ADMIN' && data.role === 'SUPER_ADMIN') {
        throw new AppError('Apenas o Superadministrador pode conceder este nível de acesso.', 403, 'FORBIDDEN');
      }
      updateData.role = data.role;
    }

    if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null;

    if (data.newPassword) {
      if (data.newPassword.length < 6) {
        throw new AppError('A nova senha deve ter no mínimo 6 caracteres.', 400, 'INVALID_PASSWORD');
      }
      updateData.passwordHash = await bcrypt.hash(data.newPassword, 12);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, phone: true, isActive: true },
    });

    return updated;
  }

  async updateProfile(userId: string, data: { name?: string; phone?: string; currentPassword?: string; newPassword?: string }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deletedAt) {
      throw new AppError('Usuário não encontrado.', 404, 'USER_NOT_FOUND');
    }

    const updateData: any = {};
    if (data.name?.trim()) {
      updateData.name = data.name.trim();
    }
    if (data.phone !== undefined) {
      updateData.phone = data.phone?.trim() || null;
    }

    if (data.newPassword) {
      if (!data.currentPassword) {
        throw new AppError('Informe a senha atual para definir uma nova senha.', 400, 'INVALID_CREDENTIALS');
      }
      if (data.newPassword.length < 6) {
        throw new AppError('A nova senha deve ter no mínimo 6 caracteres.', 400, 'INVALID_PASSWORD');
      }
      const isMatch = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!isMatch) {
        throw new AppError('Senha atual incorreta.', 400, 'INVALID_CREDENTIALS');
      }
      updateData.passwordHash = await bcrypt.hash(data.newPassword, 12);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        organizationId: true,
        name: true,
        email: true,
        role: true,
        phone: true,
      },
    });

    return updated;
  }
}

