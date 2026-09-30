import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import { buildApp } from '../../app.js';
import { FastifyInstance } from 'fastify';
import { realtimeService } from '../../services/realtime/realtime.service.js';
import { whatsappService } from '../../services/whatsapp/whatsapp.service.js';
import { prisma } from '../../lib/prisma.js';

describe('Módulo de Tempo Real & WebSocket - FASE 6', () => {
  let app: FastifyInstance;
  let httpServer: any;
  let clientSocket: ClientSocket;
  let serverPort: number;
  let orgId: string;
  let authToken: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    httpServer = createServer(app.server);
    const io = realtimeService.init(httpServer);
    whatsappService.setSocketServer(io);

    // Inicia na porta 0 para pegar porta livre do SO
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address();
        serverPort = typeof address === 'string' ? 0 : address?.port || 0;
        resolve();
      });
    });

    // Pega organização e faz login
    const org = await prisma.organization.findFirst();
    orgId = org?.id || '';

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'porteiro@example.com',
        password: 'porteiro123456',
      },
    });
    authToken = JSON.parse(loginRes.payload).data.token;

    // Conecta cliente Socket.IO na sala da organização
    await new Promise<void>((resolve) => {
      clientSocket = ClientIO(`http://localhost:${serverPort}`, {
        auth: { token: authToken },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
    await app.close();
  });

  it('deve conectar o cliente ao Socket.IO e entrar na sala da organização', () => {
    expect(clientSocket.connected).toBe(true);
  });

  it('deve receber evento visit_request:created ao registrar nova solicitação', async () => {
    const client = await prisma.client.findFirst({ where: { organizationId: orgId } });
    const dest = await prisma.destination.findFirst({ where: { organizationId: orgId } });
    const visitor = await prisma.visitor.findFirst({ where: { organizationId: orgId } });

    const receivedPromise = new Promise<any>((resolve) => {
      clientSocket.once('visit_request:created', (data) => {
        resolve(data);
      });
    });

    // Cria solicitação via API
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/visit-requests',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        clientId: client?.id,
        destinationId: dest?.id,
        visitorId: visitor?.id,
        visitorType: 'Prestador de Serviço',
        visitReason: 'Conserto de Ar Condicionado Realtime Test',
      },
    });

    expect(res.statusCode).toBe(201);
    const eventData = await receivedPromise;
    expect(eventData).toBeDefined();
    expect(eventData.status).toBe('PENDING');
    expect(eventData.code).toMatch(/^REQ-\d{4}-\d{6}$/);
  });

  it('deve receber evento visit_request:updated e notification:alert quando morador responder no WhatsApp', async () => {
    const client = await prisma.client.findFirst({ where: { organizationId: orgId } });

    const updatedPromise = new Promise<any>((resolve) => {
      clientSocket.once('visit_request:updated', (data) => {
        resolve(data);
      });
    });

    const alertPromise = new Promise<any>((resolve) => {
      clientSocket.once('notification:alert', (data) => {
        resolve(data);
      });
    });

    // Simula morador respondendo "1" (Autorizar)
    const simRes = await app.inject({
      method: 'POST',
      url: '/api/v1/whatsapp/simulate-incoming',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        fromPhone: client?.whatsappNumber,
        text: '1',
      },
    });

    expect(simRes.statusCode).toBe(200);

    const [updatedEvent, alertEvent] = await Promise.all([updatedPromise, alertPromise]);

    expect(updatedEvent).toBeDefined();
    expect(updatedEvent.status).toBe('AUTHORIZED');

    expect(alertEvent).toBeDefined();
    expect(alertEvent.type).toBe('AUTHORIZED');
    expect(alertEvent.title).toBe('Entrada Autorizada!');
    expect(alertEvent.message).toContain(client?.name);
  });

  it('deve receber evento notification:alert de recusa quando morador responder "2" no WhatsApp', async () => {
    const client = await prisma.client.findFirst({ where: { organizationId: orgId } });
    const dest = await prisma.destination.findFirst({ where: { organizationId: orgId } });
    const visitor = await prisma.visitor.findFirst({ where: { organizationId: orgId } });

    // Cria nova visita para poder recusar
    await app.inject({
      method: 'POST',
      url: '/api/v1/visit-requests',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        clientId: client?.id,
        destinationId: dest?.id,
        visitorId: visitor?.id,
        visitorType: 'Visitante',
        visitReason: 'Visita que será recusada',
      },
    });

    const alertPromise = new Promise<any>((resolve) => {
      clientSocket.once('notification:alert', (data) => {
        resolve(data);
      });
    });

    // Simula morador respondendo "2" (Recusar)
    const simRes = await app.inject({
      method: 'POST',
      url: '/api/v1/whatsapp/simulate-incoming',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        fromPhone: client?.whatsappNumber,
        text: '2',
      },
    });

    expect(simRes.statusCode).toBe(200);

    const alertEvent = await alertPromise;
    expect(alertEvent).toBeDefined();
    expect(alertEvent.type).toBe('DENIED');
    expect(alertEvent.title).toBe('Entrada Recusada!');
  });
});
