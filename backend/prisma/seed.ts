import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando Seed do Sistema de Portaria...');

  // 1. Cria a organização padrão
  const org = await prisma.organization.upsert({
    where: { slug: 'residencial-exemplo' },
    update: {},
    create: {
      name: 'Residencial Exemplo',
      slug: 'residencial-exemplo',
      document: '12.345.678/0001-90',
      settings: JSON.stringify({
        maxReminders: 3,
        reminderIntervalMinutes: 2,
        requestTimeoutMinutes: 15,
      }),
    },
  });

  console.log(`🏢 Organização criada: ${org.name} (${org.id})`);

  // 1.1 Cria assinatura ativa para a organização de exemplo
  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      plan: 'BASIC',
      status: 'ACTIVE',
      maxUsers: 10,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
    },
  });

  console.log(`✅ Assinatura ativa criada para ${org.name}`);

  // 2. Cria os templates padrão de WhatsApp para a organização
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
      title: 'Solicitação de Autorização',
      content:
        'Olá, {{cliente}}! Há um visitante aguardando sua autorização na portaria.\n\n👤 *Visitante:* {{visitante}}\n🏢 *Empresa:* {{empresa}}\n📋 *Motivo:* {{motivo}}\n⏰ *Chegada:* {{horario}}\n🚗 *Veículo:* {{veiculo}}\n\nPor favor, responda com:\n*1* para *AUTORIZAR*\n*2* para *RECUSAR*',
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
      title: 'Lembrete de Autorização',
      content:
        '⏳ Olá, {{cliente}}! O visitante *{{visitante}}* ainda aguarda sua liberação na portaria.\n\nPor favor, responda com *1* para *AUTORIZAR* ou *2* para *RECUSAR*.',
    },
  });

  // 3. Cria Usuários (Admin, Supervisor, Porteiro)
  const adminPassword = await bcrypt.hash('admin123456', 12);
  const supervisorPassword = await bcrypt.hash('supervisor123456', 12);
  const conciergePassword = await bcrypt.hash('porteiro123456', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Administrador do Sistema',
      email: 'admin@example.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
      phone: '11988887777',
    },
  });

  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor@example.com' },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Supervisor Marcos',
      email: 'supervisor@example.com',
      passwordHash: supervisorPassword,
      role: 'SUPERVISOR',
      phone: '11977776666',
    },
  });

  const concierge = await prisma.user.upsert({
    where: { email: 'porteiro@example.com' },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Porteiro José',
      email: 'porteiro@example.com',
      passwordHash: conciergePassword,
      role: 'CONCIERGE',
      phone: '11966665555',
    },
  });

  console.log(`👤 Usuários criados:
    - Admin: admin@example.com (admin123456)
    - Supervisor: supervisor@example.com (supervisor123456)
    - Porteiro: porteiro@example.com (porteiro123456)`);

  // 4. Cria Destinos (Apartamentos / Unidades)
  const dest1 = await prisma.destination.create({
    data: {
      organizationId: org.id,
      name: 'Apartamento 1',
      block: 'Torre A',
      code: 'APT-01',
      description: '1º andar - Frente',
    },
  });

  const dest2 = await prisma.destination.create({
    data: {
      organizationId: org.id,
      name: 'Apartamento 2',
      block: 'Torre A',
      code: 'APT-02',
      description: '1º andar - Fundos',
    },
  });

  const dest8 = await prisma.destination.create({
    data: {
      organizationId: org.id,
      name: 'Apartamento 8',
      block: 'Torre B',
      code: 'APT-08',
      description: '4º andar - Cobertura',
    },
  });

  console.log('📍 Destinos cadastrados: Apt 1, Apt 2, Apt 8');

  // 5. Cria Clientes (Moradores) e vincula aos Destinos
  const client1 = await prisma.client.create({
    data: {
      organizationId: org.id,
      name: 'João Silva',
      whatsappNumber: '5511999990001',
      email: 'joao.silva@example.com',
      document: '123.456.789-00',
    },
  });

  const client2 = await prisma.client.create({
    data: {
      organizationId: org.id,
      name: 'Maria Silva',
      whatsappNumber: '5511999990002',
      email: 'maria.silva@example.com',
      document: '234.567.890-11',
    },
  });

  const clientCarlos = await prisma.client.create({
    data: {
      organizationId: org.id,
      name: 'Carlos Souza',
      whatsappNumber: '5511999990008',
      email: 'carlos.souza@example.com',
      document: '345.678.901-22',
    },
  });

  // Vínculos N:N
  await prisma.clientDestination.createMany({
    data: [
      { clientId: client1.id, destinationId: dest1.id, isPrimary: true },
      { clientId: client2.id, destinationId: dest2.id, isPrimary: true },
      { clientId: clientCarlos.id, destinationId: dest8.id, isPrimary: true },
    ],
  });

  console.log('👥 Clientes cadastrados e vinculados às unidades.');

  // 6. Visitante Fictício
  const visitor = await prisma.visitor.create({
    data: {
      organizationId: org.id,
      name: 'Carlos Eduardo Santos',
      documentType: 'CPF',
      documentNumber: '456.789.012-33',
      phone: '11955554444',
      company: 'ABC Tecnologia',
    },
  });

  const vehicle = await prisma.vehicle.create({
    data: {
      visitorId: visitor.id,
      model: 'Honda Civic',
      color: 'Prata',
      licensePlate: 'ABC1D23',
    },
  });

  console.log('🚗 Visitante e veículo de demonstração cadastrados.');
  console.log('✅ Seed finalizado com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro durante execução do seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
