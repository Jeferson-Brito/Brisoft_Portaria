import { prisma } from '../../lib/prisma.js';
import { realtimeService } from '../../services/realtime/realtime.service.js';
import { whatsappService } from '../../services/whatsapp/whatsapp.service.js';
import { getStorageService, compressPhoto } from '../../services/storage/storage.service.js';

export interface CreatePackageDTO {
  destinationId: string;
  clientId?: string;
  trackingCode?: string;
  carrier?: string;
  recipientName?: string;
  sender?: string;
  photoUrl?: string;
  notes?: string;
  conciergeUserId: string;
  organizationId: string;
}

export class PackagesService {
  // Gera código sequencial amigável: ENC-2026-000001
  private async generatePackageCode(organizationId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.package.count({
      where: {
        organizationId,
        createdAt: {
          gte: new Date(`${year}-01-01T00:00:00.000Z`),
        },
      },
    });

    const sequential = String(count + 1).padStart(6, '0');
    return `ENC-${year}-${sequential}`;
  }

  // Gera código numérico de 4 dígitos para retirada segura
  private generatePickupCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  async create(data: CreatePackageDTO) {
    // 1. Valida destino existente
    const destination = await prisma.destination.findUnique({
      where: { id: data.destinationId },
      include: {
        clients: {
          include: { client: true },
          where: { isPrimary: true },
        },
      },
    });

    if (!destination) {
      throw new Error('Destino / Unidade não encontrado.');
    }

    // 2. Se cliente não foi passado, tenta vincular ao morador principal da unidade
    let clientId = data.clientId;
    let client = null;

    if (clientId) {
      client = await prisma.client.findUnique({ where: { id: clientId } });
    } else if (destination.clients.length > 0) {
      client = destination.clients[0].client;
      clientId = client.id;
    }

    const code = await this.generatePackageCode(data.organizationId);
    const pickupCode = this.generatePickupCode();

    // Processa upload para Supabase Storage se a foto da encomenda foi enviada em Base64
    let finalPhotoUrl = data.photoUrl || null;
    if (data.photoUrl && (data.photoUrl.startsWith('data:image') || data.photoUrl.length > 500)) {
      try {
        const storageService = getStorageService();
        const cleanBase64 = data.photoUrl.replace(/^data:image\/\w+;base64,/, '');
        const raw = Buffer.from(cleanBase64, 'base64');
        const buffer = await compressPhoto(raw);
        finalPhotoUrl = await storageService.upload('package_photo.jpg', buffer, 'image/jpeg');
      } catch (e) {
        console.warn('Erro ao salvar foto da encomenda no Supabase Storage:', e);
      }
    }

    // 3. Salva no banco de dados
    const pkg = await prisma.package.create({
      data: {
        organizationId: data.organizationId,
        destinationId: data.destinationId,
        clientId,
        code,
        trackingCode: data.trackingCode,
        carrier: data.carrier || 'Encomenda',
        recipientName: data.recipientName || client?.name || destination.name,
        sender: data.sender,
        photoUrl: finalPhotoUrl,
        notes: data.notes,
        pickupCode,
        status: 'RECEIVED',
        conciergeReceivedUserId: data.conciergeUserId,
      },
      include: {
        destination: { select: { id: true, name: true, block: true } },
        client: { select: { id: true, name: true, whatsappNumber: true } },
      },
    });

    // 4. Emite evento em tempo real via WebSocket
    realtimeService.emitToOrganization(data.organizationId, 'package:created', {
      package: pkg,
    });

    // 5. Notifica o Morador/Responsável pelo WhatsApp automaticamente com foto
    if (client?.whatsappNumber) {
      const destText = `${destination.name}${destination.block ? ' - ' + destination.block : ''}`;
      const dateFormatted = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeFormatted = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false });
      const msg = `📦 *NOVA ENCOMENDA RECEBIDA NA PORTARIA*\n\nOlá, *${client.name}*!\nUma encomenda acabou de ser recebida na guarita para *${destText}*.\n\n• 📅 *Data e Horário:* ${dateFormatted} às ${timeFormatted}\n• 🚚 *Transportadora / Remetente:* ${pkg.carrier || 'Entrega'}${pkg.sender ? ' (' + pkg.sender + ')' : ''}\n• 🔖 *Código da Entrega:* ${pkg.code}\n• 📦 *Rastreio:* ${pkg.trackingCode || 'Sem rastreio'}\n• 🔑 *CÓDIGO DE RETIRADA:* *${pkg.pickupCode}*\n\n📸 *Comprovante fotográfico:* Segue a foto da encomenda anexada para comprovar o recebimento.\n\nPor favor, informe este código de 4 dígitos ao porteiro ao retirar seu pacote.`;

      if (pkg.photoUrl) {
        whatsappService.sendImageMessage(data.organizationId, client.whatsappNumber, pkg.photoUrl, msg).catch((err) => {
          console.warn('Erro ao disparar WhatsApp com foto de encomenda, tentando texto:', err.message);
          whatsappService.sendMessage(data.organizationId, client.whatsappNumber, msg).catch((err2) => {
            console.warn('Erro ao disparar WhatsApp de encomenda (fallback texto):', err2.message);
          });
        });
      } else {
        whatsappService.sendMessage(data.organizationId, client.whatsappNumber, msg).catch((err) => {
          console.warn('Erro ao disparar WhatsApp de encomenda:', err.message);
        });
      }
    }

    return pkg;
  }

  async listPending(organizationId: string) {
    const packages = await prisma.package.findMany({
      where: {
        organizationId,
        status: 'RECEIVED',
      },
      orderBy: { receivedAt: 'desc' },
      include: {
        destination: { select: { id: true, name: true, block: true } },
        client: { select: { id: true, name: true, whatsappNumber: true } },
      },
    });

    return packages;
  }

  async listHistory(organizationId: string, limit = 50) {
    const packages = await prisma.package.findMany({
      where: {
        organizationId,
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        destination: { select: { id: true, name: true, block: true } },
        client: { select: { id: true, name: true, whatsappNumber: true } },
      },
    });

    return packages;
  }

  async pickup(
    packageId: string,
    organizationId: string,
    conciergeUserId: string,
    pickupCode?: string,
    pickedUpBy?: string,
    directPickup?: boolean
  ) {
    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
      include: {
        destination: true,
        client: true,
      },
    });

    if (!pkg || pkg.organizationId !== organizationId) {
      throw new Error('Encomenda não encontrada.');
    }

    if (pkg.status !== 'RECEIVED') {
      throw new Error(`Esta encomenda já está com status ${pkg.status}.`);
    }

    // Se não for liberação direta pelo porteiro, valida código de 4 dígitos
    if (!directPickup && pickupCode) {
      if (pkg.pickupCode !== pickupCode.trim()) {
        throw new Error('Código de retirada incorreto! Solicite o código de 4 dígitos que o cliente recebeu no WhatsApp.');
      }
    }

    const updated = await prisma.package.update({
      where: { id: packageId },
      data: {
        status: 'PICKED_UP',
        pickedUpAt: new Date(),
        pickedUpBy: pickedUpBy || pkg.client?.name || pkg.recipientName || 'Cliente/Morador',
        conciergeDeliveredUserId: conciergeUserId,
      },
      include: {
        destination: true,
        client: true,
      },
    });

    // Emite evento em tempo real
    realtimeService.emitToOrganization(organizationId, 'package:picked_up', {
      package: updated,
    });

    // Notificação de confirmação no WhatsApp
    if (pkg.client?.whatsappNumber) {
      const timeFormatted = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false });
      const msg = `✅ *ENCOMENDA RETIRADA*\n\nA encomenda *${pkg.code}* (${pkg.carrier || 'Pacote'}) foi retirada com sucesso na portaria por *${updated.pickedUpBy}* às ${timeFormatted}.`;
      whatsappService.sendMessage(organizationId, pkg.client.whatsappNumber, msg).catch(() => {});
    }

    return updated;
  }

  async resendCode(packageId: string, organizationId: string) {
    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
      include: {
        destination: true,
        client: true,
      },
    });

    if (!pkg || pkg.organizationId !== organizationId) {
      throw new Error('Encomenda não encontrada.');
    }

    if (!pkg.client?.whatsappNumber) {
      throw new Error('Morador desta unidade não possui WhatsApp cadastrado.');
    }

    const destText = `${pkg.destination.name}${pkg.destination.block ? ' - ' + pkg.destination.block : ''}`;
    const msg = `🔔 *LEMBRETE DE ENCOMENDA NA PORTARIA*\n\nOlá, *${pkg.client.name}*!\nSua encomenda *${pkg.code}* (${pkg.carrier || 'Pacote'}) segue aguardando retirada na portaria de *${destText}*.\n\n• 🔑 *CÓDIGO DE RETIRADA:* *${pkg.pickupCode}*`;

    if (pkg.photoUrl) {
      await whatsappService.sendImageMessage(organizationId, pkg.client.whatsappNumber, pkg.photoUrl, msg);
    } else {
      await whatsappService.sendMessage(organizationId, pkg.client.whatsappNumber, msg);
    }
    return { success: true, message: 'Código reenviado com sucesso.' };
  }
}

export const packagesService = new PackagesService();
