import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { FastifyInstance } from 'fastify';

describe('Módulo de Visitantes, Veículos & Fotos - FASE 3', () => {
  let app: FastifyInstance;
  let conciergeToken: string;
  let createdVisitorId: string;
  let uploadedPhotoPath: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // 1. Obtém token de porteiro
    const conciergeLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'porteiro@example.com', password: 'porteiro123456' },
    });
    conciergeToken = JSON.parse(conciergeLogin.payload).data.token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('Porteiro: deve realizar upload de foto do visitante (segurança e storage desacoplado)', async () => {
    // Foto simulada em Base64 (1x1 pixel JPEG transparente/simulado)
    const mockImageBase64 =
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/visitors/upload-photo',
      headers: { Authorization: `Bearer ${conciergeToken}` },
      payload: {
        base64: mockImageBase64,
        fileName: 'visitante_rosto.jpg',
        mimeType: 'image/jpeg',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.data.photoUrl).toBeDefined();

    uploadedPhotoPath = body.data.photoUrl;
  });

  it('Porteiro: deve cadastrar visitante com documento, empresa, foto e veículo', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/visitors',
      headers: { Authorization: `Bearer ${conciergeToken}` },
      payload: {
        name: 'Roberto Miranda',
        documentType: 'CPF',
        documentNumber: '321.654.987-00',
        phone: '11944443333',
        company: 'Logística Express',
        photoUrl: uploadedPhotoPath,
        notes: 'Entregador de encomendas',
        vehicle: {
          model: 'Fiat Fiorino',
          color: 'Branco',
          licensePlate: 'LOG1E23',
        },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.data.visitor.name).toBe('Roberto Miranda');
    expect(body.data.visitor.company).toBe('Logística Express');
    expect(body.data.visitor.vehicles.length).toBe(1);
    expect(body.data.visitor.vehicles[0].model).toBe('Fiat Fiorino');
    expect(body.data.visitor.vehicles[0].licensePlate).toBe('LOG1E23');
    expect(body.data.visitor.photoSignedUrl).toBeDefined();

    createdVisitorId = body.data.visitor.id;
  });

  it('deve rejeitar visitante com veículo se o modelo não for informado', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/visitors',
      headers: { Authorization: `Bearer ${conciergeToken}` },
      payload: {
        name: 'Visitante Sem Carro',
        vehicle: {
          model: '', // Inválido
        },
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(false);
  });

  it('Porteiro: deve encontrar visitante ao buscar pela placa do veículo "LOG1E23"', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/visitors/search?q=LOG1E23',
      headers: { Authorization: `Bearer ${conciergeToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.data.visitors.length).toBeGreaterThanOrEqual(1);

    const found = body.data.visitors.find((v: any) => v.name === 'Roberto Miranda');
    expect(found).toBeDefined();
    expect(found.vehicles[0].licensePlate).toBe('LOG1E23');
  });

  it('Porteiro: deve encontrar visitante ao buscar pela empresa "Logística Express"', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/visitors/search?q=Log%C3%ADstica',
      headers: { Authorization: `Bearer ${conciergeToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);

    const found = body.data.visitors.find((v: any) => v.company === 'Logística Express');
    expect(found).toBeDefined();
  });

  it('Porteiro: deve encontrar visitante ao buscar pelo CPF limpo ou formatado', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/visitors/search?q=32165498700',
      headers: { Authorization: `Bearer ${conciergeToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);

    const found = body.data.visitors.find((v: any) => v.name === 'Roberto Miranda');
    expect(found).toBeDefined();
  });

  it('deve permitir servir a foto gravada no endpoint protegido (LGPD)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/visitors/photo/${uploadedPhotoPath}`,
      headers: { Authorization: `Bearer ${conciergeToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('image/jpeg');
  });
});
