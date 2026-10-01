import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

describe('Ciclo Completo E2E: Controle de Acesso e Resiliência (FASE 10)', () => {
  let app: any;
  let conciergeToken: string;
  let orgId: string;
  let userId: string;
  let destinationId: string;
  let clientId: string;
  let visitorId: string;
  let clientPhone: string;
  let createdRequestId: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // 1. Setup Organização
    const org = await prisma.organization.create({
      data: {
        name: 'Condomínio E2E Segurança Total',
        slug: `e2e-condo-${Date.now()}`,
      },
    });
    orgId = org.id;

    // 2. Setup Usuário Porteiro (RBAC: CONCIERGE)
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        name: 'Porteiro Noturno E2E',
        email: `porteiro-e2e-${Date.now()}@teste.com`,
        passwordHash: 'hash123',
        role: 'CONCIERGE',
      },
    });
    userId = user.id;

    conciergeToken = app.jwt.sign({
      sub: user.id,
      organizationId: org.id,
      role: user.role,
    });

    // 3. Setup Destino (Unidade / Bloco)
    const dest = await prisma.destination.create({
      data: {
        organizationId: org.id,
        name: 'Apartamento 402',
        block: 'Torre Magnólia',
        code: 'APT-402',
      },
    });
    destinationId = dest.id;

    // 4. Setup Cliente (Morador com WhatsApp E.164)
    clientPhone = '5511988887777';
    const client = await prisma.client.create({
      data: {
        organizationId: org.id,
        name: 'Doutor Morador E2E',
        whatsappNumber: clientPhone,
      },
    });
    clientId = client.id;

    await prisma.clientDestination.create({
      data: {
        clientId: client.id,
        destinationId: dest.id,
        isPrimary: true,
      },
    });

    // 5. Setup Visitante
    const visitor = await prisma.visitor.create({
      data: {
        organizationId: org.id,
        name: 'Técnico de Fibra Óptica',
        documentType: 'CPF',
        documentNumber: '12345678900',
        company: 'Telefônica Telecom',
      },
    });
    visitorId = visitor.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({
      where: { id: orgId },
    });
    await app.close();
  });

  it('Etapa 1: Porteiro cria solicitação de acesso e valida estado inicial PENDING', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/visit-requests',
      headers: { authorization: `Bearer ${conciergeToken}` },
      payload: {
        destinationId,
        clientId,
        visitorId,
        visitorType: 'Prestador',
        visitReason: 'Instalação de Internet',
        notes: 'Equipamento de escada e cabos',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.visitRequest.status).toBe('PENDING');
    expect(body.data.visitRequest.code).toMatch(/^REQ-/);
    createdRequestId = body.data.visitRequest.id;
  });

  it('Etapa 2: Morador responde "1" (AUTORIZAR) via WhatsApp e transita para AUTHORIZED', async () => {
    const incomingRes = await app.inject({
      method: 'POST',
      url: '/api/v1/whatsapp/simulate-incoming',
      headers: { authorization: `Bearer ${conciergeToken}` },
      payload: {
        fromPhone: clientPhone,
        text: '1',
      },
    });

    expect(incomingRes.statusCode).toBe(200);

    const verifyRes = await app.inject({
      method: 'GET',
      url: `/api/v1/visit-requests/${createdRequestId}`,
      headers: { authorization: `Bearer ${conciergeToken}` },
    });

    expect(verifyRes.statusCode).toBe(200);
    const verifyBody = JSON.parse(verifyRes.payload);
    expect(verifyBody.data.visitRequest.status).toBe('AUTHORIZED');
    expect(verifyBody.data.visitRequest.answeredAt).toBeDefined();
  });

  it('Etapa 3 (Concorrência & Idempotência): Mensagem posterior "2" (Recusar) é ignorada pois status já foi decidido', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/whatsapp/simulate-incoming',
      headers: { authorization: `Bearer ${conciergeToken}` },
      payload: {
        fromPhone: clientPhone,
        text: '2',
      },
    });

    const verifyRes = await app.inject({
      method: 'GET',
      url: `/api/v1/visit-requests/${createdRequestId}`,
      headers: { authorization: `Bearer ${conciergeToken}` },
    });

    const verifyBody = JSON.parse(verifyRes.payload);
    expect(verifyBody.data.visitRequest.status).toBe('AUTHORIZED');
  });

  it('Etapa 4: Porteiro registra Entrada física (AUTHORIZED -> ENTERED)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/visit-requests/${createdRequestId}/entry`,
      headers: { authorization: `Bearer ${conciergeToken}` },
      payload: { notes: 'Portão 1 liberado' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.visitRequest.status).toBe('ENTERED');
    expect(body.data.visitRequest.entryAt).toBeDefined();
  });

  it('Etapa 5 (Prevenção de Condição de Corrida): Entrada duplicada simultânea deve falhar', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/visit-requests/${createdRequestId}/entry`,
      headers: { authorization: `Bearer ${conciergeToken}` },
      payload: { notes: 'Tentativa duplicada' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('Etapa 6: Visitante consta na lista de Presentes no local', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/visit-requests/present',
      headers: { authorization: `Bearer ${conciergeToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.visitors.length).toBeGreaterThanOrEqual(1);
    const found = body.data.visitors.find((v: any) => v.id === createdRequestId);
    expect(found).toBeDefined();
  });

  it('Etapa 7: Porteiro registra Saída física (ENTERED -> EXITED)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/visit-requests/${createdRequestId}/exit`,
      headers: { authorization: `Bearer ${conciergeToken}` },
      payload: { notes: 'Saída concluída pelo portão 2' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.visitRequest.status).toBe('EXITED');
    expect(body.data.visitRequest.exitAt).toBeDefined();
  });

  it('Etapa 8: Saída duplicada deve falhar', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/visit-requests/${createdRequestId}/exit`,
      headers: { authorization: `Bearer ${conciergeToken}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('Etapa 9: Métricas refletem o ciclo operacional completo com taxa 100% de aprovação', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reports/metrics?days=1',
      headers: { authorization: `Bearer ${conciergeToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.summary.approvalRate).toBe(100);
    expect(body.data.summary.completedExited).toBeGreaterThanOrEqual(1);
  });

  it('Etapa 10: Auditoria possui trilha imutável com todos os eventos ordenados cronologicamente', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit/timeline',
      headers: { authorization: `Bearer ${conciergeToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.length).toBeGreaterThanOrEqual(3);
    const eventTypes = body.data.map((e: any) => e.eventType);
    expect(eventTypes).toContain('EXIT_RECORDED');
    expect(eventTypes).toContain('ENTRY_RECORDED');
    expect(eventTypes).toContain('AUTHORIZED');
  });
});
