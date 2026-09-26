/**
 * Script para criar o usuário SUPER_ADMIN no banco de dados.
 * Execute com: npx ts-node --esm prisma/init-super-admin.ts
 * 
 * ⚠️ Execute apenas UMA VEZ, antes do primeiro deploy em produção.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'superadmin@combateportaria.com.br';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@2026!';
const SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME || 'Administrador Combate Portaria';

async function main() {
  console.log('🔧 Criando usuário SUPER_ADMIN...');

  // Cria (ou usa) uma organização "system" para abrigar o super admin
  const systemOrg = await prisma.organization.upsert({
    where: { slug: 'system-combate-portaria' },
    update: {},
    create: {
      name: 'Combate Portaria [SYSTEM]',
      slug: 'system-combate-portaria',
      settings: JSON.stringify({ type: 'SYSTEM' }),
    },
  });

  // Garante subscription ativa para a org system (SUPER_ADMIN nunca é bloqueado, mas precisa existir)
  await prisma.subscription.upsert({
    where: { organizationId: systemOrg.id },
    update: {},
    create: {
      organizationId: systemOrg.id,
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
      maxUsers: 999,
    },
  });

  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: { passwordHash, role: 'SUPER_ADMIN', isActive: true },
    create: {
      organizationId: systemOrg.id,
      name: SUPER_ADMIN_NAME,
      email: SUPER_ADMIN_EMAIL,
      passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.log(`\n✅ SUPER_ADMIN criado com sucesso!`);
  console.log(`   E-mail  : ${superAdmin.email}`);
  console.log(`   Senha   : ${SUPER_ADMIN_PASSWORD}`);
  console.log(`   Role    : ${superAdmin.role}`);
  console.log(`   Org ID  : ${systemOrg.id}`);
  console.log(`\n⚠️  IMPORTANTE: Mude a senha após o primeiro login!`);
}

main()
  .catch((e) => {
    console.error('❌ Erro ao criar SUPER_ADMIN:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
