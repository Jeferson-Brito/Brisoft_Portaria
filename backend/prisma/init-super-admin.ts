/**
 * Script para criar o usuário SUPER_ADMIN no banco de dados.
 * Execute com: npx ts-node --esm prisma/init-super-admin.ts
 * 
 * ⚠️ Execute apenas UMA VEZ, antes do primeiro deploy em produção.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;
const SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME || 'Administrador Brisoft Portaria';

async function main() {
  if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD || SUPER_ADMIN_PASSWORD.length < 8) {
    throw new Error('Defina SUPER_ADMIN_EMAIL e SUPER_ADMIN_PASSWORD (mínimo 8 caracteres) antes de executar este script.');
  }

  console.log('🔧 Criando usuário SUPER_ADMIN...');

  // Cria (ou usa) uma organização "system" para abrigar o super admin
  const systemOrg = await prisma.organization.upsert({
    where: { slug: 'system-brisoft-portaria' },
    update: {},
    create: {
      name: 'Brisoft Portaria [SYSTEM]',
      slug: 'system-brisoft-portaria',
      settings: JSON.stringify({ type: 'SYSTEM' }),
    },
  });

  const existing = await prisma.user.findUnique({ where: { email: SUPER_ADMIN_EMAIL } });
  const passwordHash = existing && process.env.SUPER_ADMIN_RESET_PASSWORD !== 'true'
    ? existing.passwordHash
    : await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {
      role: 'SUPER_ADMIN',
      isActive: true,
      ...(process.env.SUPER_ADMIN_RESET_PASSWORD === 'true' || !existing ? { passwordHash } : {}),
    },
    create: {
      organizationId: systemOrg.id,
      name: SUPER_ADMIN_NAME,
      email: SUPER_ADMIN_EMAIL,
      passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.log(`\n✅ SUPER_ADMIN pronto.`);
  console.log(`   E-mail  : ${superAdmin.email}`);
  console.log(`   Role    : ${superAdmin.role}`);
  console.log(`   Org ID  : ${systemOrg.id}`);
  console.log(`\nA senha não é exibida. Para trocá-la, rode de novo com SUPER_ADMIN_RESET_PASSWORD=true.`);
}

main()
  .catch((e) => {
    console.error('❌ Erro ao criar SUPER_ADMIN:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
