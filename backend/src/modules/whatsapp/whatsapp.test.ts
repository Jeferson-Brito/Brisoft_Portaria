import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { FastifyInstance } from 'fastify';

describe('Módulo de WhatsApp & Baileys - FASE 5', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let conciergeToken: string;
  let clientId: string;
  let destinationId: string;
  let visitorId: string;
  let clientPhone: string;
  let testRequestId: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // 1. Obtém token de Admin
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@example.com', password: 'admin123456' },
    });
    adminToken = JSON.parse(adminLogin.payload).data.token;

    // 2. Obtém token de Porteiro
    const conciergeLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'porteiro@example.com', password: 'porteiro123456' },
    });
    conciergeToken = JSON.parse(conciergeLogin.payload).data.token;

    // 3. Localiza cliente para teste (Carlos Souza - Apto 8)
    const clientRes = await app.inject({
      method: 'GET',
      url: '/api/v1/clients/search?q=Carlos',
      headers: { Authorization: `Bearer ${conciergeToken}` },
    });
    const client = JSON.parse(clientRes.payload).data.clients[0];
    clientId = client.id;
    clientPhone = client.whatsappNumber; // 5511999990008
    destinationId = client.destinations[0].destination.id;

    // 4. Cadastra visitante
    const visitorRes = await app.inject({
      method: 'POST',
      url: '/api/v1/visitors',
      headers: { Authorization: `Bearer ${conciergeToken}` },
      payload: {
        name: 'Carlos Eduardo Técnico',
        company: 'ABC Manutenções',
      },
    });
    visitorId = JSON.parse(visitorRes.payload).data.visitor.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('Porteiro não deve ter permissão para conectar WhatsApp (RBAC: 403 Forbidden)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/whatsapp/connect',
      headers: { Authorization: `Bearer ${conciergeToken}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('Administrador: deve consultar status da conexão WhatsApp', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/whatsapp/status',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.data.status).toBeDefined();
  });

  it('Criação de Visita: deve registrar solicitação PENDING e disparar notificação WhatsApp', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/visit-requests',
      headers: { Authorization: `Bearer ${conciergeToken}` },
      payload: {
        clientId,
        destinationId,
        visitorId,
        visitorType: 'Prestador de serviço',
        visitReason: 'Manutenção de Ar Condicionado',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.data.visitRequest.status).toBe('PENDING');

    testRequestId = body.data.visitRequest.id;
  });

  it('Resposta Morador "1" (Autorizar): deve identificar solicitação e transitar para AUTHORIZED', async () => {
    // Morador responde "1" no WhatsApp
    const incomingRes = await app.inject({
      method: 'POST',
      url: '/api/v1/whatsapp/simulate-incoming',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        fromPhone: clientPhone,
        text: '1',
      },
    });

    expect(incomingRes.statusCode).toBe(200);

    // Consulta solicitação para validar a mudança de estado
    const verifyRes = await app.inject({
      method: 'GET',
      url: `/api/v1/visit-requests/${testRequestId}`,
      headers: { Authorization: `Bearer ${conciergeToken}` },
    });

    const verifyBody = JSON.parse(verifyRes.payload);
    expect(verifyBody.data.visitRequest.status).toBe('AUTHORIZED');

    // Valida que o evento foi registrado na timeline com actor WHATSAPP_CLIENT
    const timeline = verifyBody.data.visitRequest.events;
    const authEvent = timeline.find((e: any) => e.eventType === 'AUTHORIZED');
    expect(authEvent).toBeDefined();
    expect(authEvent.actorType).toBe('WHATSAPP_CLIENT');
  });

  it('Idempotência: mensagens duplicadas posteriores não devem alterar uma decisão já tomada', async () => {
    // Morador manda "2" depois de já ter autorizado
    const incomingRes = await app.inject({
      method: 'POST',
      url: '/api/v1/whatsapp/simulate-incoming',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        fromPhone: clientPhone,
        text: '2',
      },
    });

    expect(incomingRes.statusCode).toBe(200);

    // O status permanece AUTHORIZED
    const verifyRes = await app.inject({
      method: 'GET',
      url: `/api/v1/visit-requests/${testRequestId}`,
      headers: { Authorization: `Bearer ${conciergeToken}` },
    });

    const verifyBody = JSON.parse(verifyRes.payload);
    expect(verifyBody.data.visitRequest.status).toBe('AUTHORIZED');
  });

  it('Resposta Morador "2" (Recusar): deve transitar solicitação pendente para DENIED', async () => {
    // 1. Cria nova solicitação pendente
    const newReqRes = await app.inject({
      method: 'POST',
      url: '/api/v1/visit-requests',
      headers: { Authorization: `Bearer ${conciergeToken}` },
      payload: {
        clientId,
        destinationId,
        visitorId,
        visitorType: 'Entregador',
        visitReason: 'Entrega de Flores',
      },
    });
    const deniedReqId = JSON.parse(newReqRes.payload).data.visitRequest.id;

    // 2. Morador responde "2" (Recusar)
    await app.inject({
      method: 'POST',
      url: '/api/v1/whatsapp/simulate-incoming',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        fromPhone: clientPhone,
        text: '2',
      },
    });

    // 3. Valida transição para DENIED
    const checkRes = await app.inject({
      method: 'GET',
      url: `/api/v1/visit-requests/${deniedReqId}`,
      headers: { Authorization: `Bearer ${conciergeToken}` },
    });

    expect(JSON.parse(checkRes.payload).data.visitRequest.status).toBe('DENIED');
  });

  it('Administrador: deve listar e atualizar templates de mensagens WhatsApp', async () => {
    // 1. Lista templates
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/whatsapp/templates',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(Array.isArray(JSON.parse(listRes.payload).data.templates)).toBe(true);

    // 2. Atualiza template
    const updateRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/whatsapp/templates',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        type: 'APPROVAL_REQUEST',
        content: 'Olá {{cliente}}! Visitante {{visitante}} aguarda na portaria. 1 para liberar, 2 para negar.',
      },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(JSON.parse(updateRes.payload).data.template.content).toContain('Visitante {{visitante}} aguarda');
  });
});
