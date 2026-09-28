import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { getStorageService } from '../../services/storage/storage.service.js';

export interface VehicleData {
  model: string;
  color?: string;
  licensePlate?: string;
}

export interface CreateOrUpdateVisitorParams {
  organizationId: string;
  name: string;
  documentType?: string; // CPF, RG, CNH, OUTRO
  documentNumber?: string;
  phone?: string;
  company?: string;
  photoUrl?: string;
  notes?: string;
  vehicle?: VehicleData;
}

export class VisitorService {
  private storageService = getStorageService();

  async createOrUpdate({
    organizationId,
    name,
    documentType,
    documentNumber,
    phone,
    company,
    photoUrl,
    notes,
    vehicle,
  }: CreateOrUpdateVisitorParams) {
    if (!name || name.trim().length === 0) {
      throw new AppError('O nome do visitante é obrigatório.', 400, 'NAME_REQUIRED');
    }

    if (vehicle && (!vehicle.model || vehicle.model.trim().length === 0)) {
      throw new AppError('O modelo do veículo é obrigatório quando informado.', 400, 'VEHICLE_MODEL_REQUIRED');
    }

    const cleanDoc = documentNumber ? documentNumber.replace(/\D/g, '') : null;
    const cleanPlate = vehicle?.licensePlate ? vehicle.licensePlate.trim().toUpperCase() : null;

    // Procura visitante pré-existente pelo documento na mesma organização
    let visitor = cleanDoc
      ? await prisma.visitor.findFirst({
          where: {
            organizationId,
            documentNumber: cleanDoc,
          },
          include: { vehicles: true },
        })
      : null;

    // Processa upload para Supabase Storage se a foto foi enviada em Base64
    let finalPhotoUrl = photoUrl || null;
    if (photoUrl && (photoUrl.startsWith('data:image') || photoUrl.length > 500)) {
      try {
        const cleanBase64 = photoUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        finalPhotoUrl = await this.storageService.upload('visitor_photo.jpg', buffer, 'image/jpeg');
      } catch (e) {
        console.warn('Erro ao salvar foto do visitante no Supabase Storage:', e);
      }
    }

    if (visitor) {
      // Atualiza dados cadastrais
      visitor = await prisma.visitor.update({
        where: { id: visitor.id },
        data: {
          name: name.trim(),
          documentType: documentType || visitor.documentType,
          phone: phone ? phone.trim() : visitor.phone,
          company: company ? company.trim() : visitor.company,
          photoUrl: finalPhotoUrl || visitor.photoUrl,
          notes: notes ? notes.trim() : visitor.notes,
        },
        include: { vehicles: true },
      });
    } else {
      // Cria novo visitante
      visitor = await prisma.visitor.create({
        data: {
          organizationId,
          name: name.trim(),
          documentType: documentType || 'CPF',
          documentNumber: cleanDoc,
          phone: phone ? phone.trim() : null,
          company: company ? company.trim() : null,
          photoUrl: finalPhotoUrl,
          notes: notes ? notes.trim() : null,
        },
        include: { vehicles: true },
      });
    }

    // Se possui dados de veículo
    let registeredVehicle = null;
    if (vehicle && vehicle.model) {
      // Procura veículo existente do visitante pela placa ou modelo
      const existingVehicle = cleanPlate
        ? visitor.vehicles.find((v) => v.licensePlate === cleanPlate)
        : visitor.vehicles[0];

      if (existingVehicle) {
        registeredVehicle = await prisma.vehicle.update({
          where: { id: existingVehicle.id },
          data: {
            model: vehicle.model.trim(),
            color: vehicle.color ? vehicle.color.trim() : existingVehicle.color,
            licensePlate: cleanPlate || existingVehicle.licensePlate,
          },
        });
      } else {
        registeredVehicle = await prisma.vehicle.create({
          data: {
            visitorId: visitor.id,
            model: vehicle.model.trim(),
            color: vehicle.color ? vehicle.color.trim() : null,
            licensePlate: cleanPlate,
          },
        });
      }
    }

    return this.getById(visitor.id, organizationId);
  }

  async search(organizationId: string, query: string) {
    if (!query || query.trim().length === 0) {
      return prisma.visitor.findMany({
        where: { organizationId },
        include: { vehicles: true },
        take: 20,
        orderBy: { name: 'asc' },
      });
    }

    const trimmed = query.trim();
    const cleanQuery = trimmed.replace(/\D/g, '');

    const visitors = await prisma.visitor.findMany({
      where: {
        organizationId,
        OR: [
          { name: { contains: trimmed } },
          { company: { contains: trimmed } },
          { phone: { contains: trimmed } },
          ...(cleanQuery.length > 0 ? [{ documentNumber: { contains: cleanQuery } }] : []),
          {
            vehicles: {
              some: {
                OR: [
                  { licensePlate: { contains: trimmed.toUpperCase() } },
                  { model: { contains: trimmed } },
                ],
              },
            },
          },
        ],
      },
      include: {
        vehicles: true,
      },
      take: 20,
      orderBy: { name: 'asc' },
    });

    return visitors;
  }

  async getById(id: string, organizationId: string) {
    const visitor = await prisma.visitor.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        vehicles: true,
      },
    });

    if (!visitor) {
      throw new AppError('Visitante não encontrado.', 404, 'VISITOR_NOT_FOUND');
    }

    // Gera URL assinada temporária caso tenha foto (privacidade LGPD)
    let photoSignedUrl: string | null = null;
    if (visitor.photoUrl) {
      try {
        photoSignedUrl = await this.storageService.getSignedUrl(visitor.photoUrl);
      } catch (e) {
        console.warn('Erro ao gerar signed url da foto:', e);
      }
    }

    return {
      ...visitor,
      photoSignedUrl,
    };
  }

  async savePhoto(fileName: string, buffer: Buffer, mimeType: string) {
    return this.storageService.upload(fileName, buffer, mimeType);
  }

  async getPhotoFile(fileName: string) {
    return this.storageService.getFile(fileName);
  }
}
