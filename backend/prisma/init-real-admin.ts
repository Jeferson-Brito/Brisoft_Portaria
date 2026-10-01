import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🛡️ Inicializando banco de dados com estrutura de produção real...');

  const orgName = process.env.INITIAL_ORG_NAME || 'Brisoft Portaria';
  const orgSlug = process.env.INITIAL_ORG_SLUG || 'brisoft-portaria';
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
  const adminPasswordRaw = process.env.INITIAL_ADMIN_PASSWORD;
  const conciergeEmail = process.env.INITIAL_CONCIERGE_EMAIL;
  const conciergePasswordRaw = process.env.INITIAL_CONCIERGE_PASSWORD;

  if (!adminEmail || !adminPasswordRaw || adminPasswordRaw.length < 8 || !conciergeEmail || !conciergePasswordRaw || conciergePasswordRaw.length < 8) {
    throw new Error('Defina INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD, INITIAL_CONCIERGE_EMAIL e INITIAL_CONCIERGE_PASSWORD (mínimo 8 caracteres).');
  }

  // 1. Organização Oficial
  const org = await prisma.organization.upsert({
    where: { slug: orgSlug },
    update: { name: orgName },
    create: {
      name: orgName,
      slug: orgSlug,
      document: process.env.INITIAL_ORG_DOCUMENT || '00.000.000/0001-00',
      settings: JSON.stringify({
        maxReminders: 3,
        reminderIntervalMinutes: 3,
        requestTimeoutMinutes: 15,
      }),
    },
  });

  console.log(`✅ Organização Oficial: ${org.name} (${org.id})`);

  // 2. Templates Oficiais de Mensagem WhatsApp
  await prisma.messageTemplate.upsert({
    where: {
      organizationId_type: {
        organizationId: org.id,
        type: 'APPROVAL_REQUEST',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      type: 'APPROVAL_REQUEST',
      title: 'Solicitação de Autorização de Entrada',
      content:
        'Olá, *{{cliente}}*!\n\nHá uma pessoa aguardando sua autorização na portaria.\n\n👤 *Visitante:* {{visitante}}\n🏢 *Empresa:* {{empresa}}\n📋 *Motivo:* {{motivo}}\n⏰ *Horário:* {{horario}}\n🚗 *Veículo:* {{veiculo}}\n\nPara responder, envie:\n*1* para *AUTORIZAR*\n*2* para *RECUSAR*',
    },
  });

  await prisma.messageTemplate.upsert({
    where: {
      organizationId_type: {
        organizationId: org.id,
        type: 'REMINDER',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      type: 'REMINDER',
      title: 'Lembrete de Liberação de Portaria',
      content:
        '⏳ Olá, *{{cliente}}*!\nO visitante *{{visitante}}* ainda aguarda sua confirmação na portaria.\n\nPor favor, responda com:\n*1* para *AUTORIZAR*\n*2* para *RECUSAR*',
    },
  });

  console.log('✅ Templates oficiais de WhatsApp configurados.');

  // 3. Usuário Administrador Real
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  const adminPasswordHash = existingAdmin && process.env.INITIAL_RESET_PASSWORD !== 'true'
    ? existingAdmin.passwordHash
    : await bcrypt.hash(adminPasswordRaw, 12);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: 'ADMIN',
      ...(process.env.INITIAL_RESET_PASSWORD === 'true' || !existingAdmin ? { passwordHash: adminPasswordHash } : {}),
    },
    create: {
      organizationId: org.id,
      name: 'Administrador Combate',
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
  });

  // 4. Usuário Porteiro Operacional Real
  const existingConcierge = await prisma.user.findUnique({ where: { email: conciergeEmail } });
  const conciergePasswordHash = existingConcierge && process.env.INITIAL_RESET_PASSWORD !== 'true'
    ? existingConcierge.passwordHash
    : await bcrypt.hash(conciergePasswordRaw, 12);
  const concierge = await prisma.user.upsert({
    where: { email: conciergeEmail },
    update: {
      role: 'CONCIERGE',
      ...(process.env.INITIAL_RESET_PASSWORD === 'true' || !existingConcierge ? { passwordHash: conciergePasswordHash } : {}),
    },
    create: {
      organizationId: org.id,
      name: 'Portaria Principal',
      email: conciergeEmail,
      passwordHash: conciergePasswordHash,
      role: 'CONCIERGE',
    },
  });

  console.log('\n======================================================');
  console.log('🎉 BANCO DE DADOS INICIALIZADO COM SUCESSO (SEM MOCKS)');
  console.log('======================================================');
  console.log(`🏢 Organização: ${org.name}`);
  console.log(`👤 Admin: ${admin.email}`);
  console.log(`🚪 Portaria: ${concierge.email}`);
  console.log('As senhas não são exibidas. Para redefini-las, rode de novo com INITIAL_RESET_PASSWORD=true.');
  console.log('📦 Encomendas, Visitantes e Destinos iniciam limpos para uso real.');
  console.log('======================================================\n');
}

main()
  .catch((err) => {
    console.error('❌ Falha ao inicializar banco de produção:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
