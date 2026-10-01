import fs from 'fs';
import path from 'path';
import { prisma } from '../../lib/prisma.js';
import {
  IWhatsAppProvider,
  WhatsAppStatusInfo,
  IncomingMessageEvent,
} from './interfaces/whatsapp-provider.interface.js';
import { BaileysProvider } from './providers/baileys.provider.js';
import { MockWhatsAppProvider } from './providers/mock-whatsapp.provider.js';
import { env } from '../../config/env.js';
import { formatWhatsAppNumber } from '../../utils/phone.util.js';
import { realtimeService } from '../realtime/realtime.service.js';

export class WhatsAppService {
  private static instance: WhatsAppService;
  private providers: Map<string, IWhatsAppProvider> = new Map();
  private mockProvider: MockWhatsAppProvider | null = null;
  private ioServer: any = null;

  private constructor() {
    // Singleton
  }

  public static getInstance(): WhatsAppService {
    if (!WhatsAppService.instance) {
      WhatsAppService.instance = new WhatsAppService();
    }
    return WhatsAppService.instance;
  }

  public setSocketServer(io: any) {
    this.ioServer = io;
  }

  public async autoRestoreSessions() {
    if (env.NODE_ENV === 'test') return;

    try {
      // 1. Restaura sessões salvas no Supabase PostgreSQL para o disco (fundamental para o Render pós-deploy)
      const dbSessions = await prisma.systemSetting.findMany({
        where: { key: 'whatsapp_session' },
      });

      for (const item of dbSessions) {
        const orgSessionPath = path.join(env.WHATSAPP_SESSION_PATH, `org_${item.organizationId}`);
        if (!fs.existsSync(orgSessionPath)) {
          fs.mkdirSync(orgSessionPath, { recursive: true });
        }
        try {
          const files: Record<string, string> = JSON.parse(item.value);
          for (const [file, content] of Object.entries(files)) {
            fs.writeFileSync(path.join(orgSessionPath, file), content, 'utf8');
          }
          console.log(`📥 [WhatsApp] Sessão da organização ${item.organizationId} restaurada do Supabase (${Object.keys(files).length} arquivos).`);
        } catch (e) {}
      }

      // 2. Conecta todas as organizações com credenciais prontas no disco
      const baseDir = env.WHATSAPP_SESSION_PATH;
      if (!fs.existsSync(baseDir)) return;

      const dirs = fs.readdirSync(baseDir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.startsWith('org_'));
      for (const d of dirs) {
        const orgId = d.name.replace('org_', '');
        const credsPath = path.join(baseDir, d.name, 'creds.json');
        if (!fs.existsSync(credsPath)) continue;

        const org = await prisma.organization.findUnique({
          where: { id: orgId },
          select: { id: true, isActive: true, slug: true, createdAt: true, settings: true },
        });
        if (!org?.isActive) {
          console.log(`⏸️ [WhatsApp] Organização ${orgId} inativa. Sessão não será reconectada.`);
          continue;
        }

        const { subscriptionService } = await import('../../modules/subscriptions/subscription.service.js');
        const subscription = subscriptionService.calculateSubscription(org);
        if (subscription.isBlocked) {
          console.log(`⏸️ [WhatsApp] Assinatura bloqueada da organização ${orgId}. Sessão não será reconectada.`);
          continue;
        }

        console.log(`🔄 [WhatsApp] Conectando sessão salva da organização: ${orgId}...`);
        const provider = this.getProvider(orgId);
        provider.connect(orgId).catch((err: any) => {
          console.warn(`Aviso: falha ao auto-restaurar WhatsApp para org ${orgId}:`, err?.message || err);
        });
        await new Promise((resolve) => setTimeout(resolve, 4000));
      }
    } catch (e: any) {
      console.warn('Erro ao verificar sessões para auto-restore:', e?.message || e);
    }
  }

  public getProvider(organizationId: string): IWhatsAppProvider {
    // Se estiver em ambiente de teste ou explicitamente mock
    if (env.NODE_ENV === 'test') {
      if (!this.mockProvider) {
        this.mockProvider = new MockWhatsAppProvider();
        this.setupIncomingHandler(this.mockProvider, organizationId);
      }
      return this.mockProvider;
    }

    let provider = this.providers.get(organizationId);
    if (!provider) {
      provider = new BaileysProvider();
      this.setupIncomingHandler(provider, organizationId);
      this.providers.set(organizationId, provider);
    }
    return provider;
  }

  // Escuta e processa mensagens de moradores (1=Autorizar / 2=Recusar)
  private setupIncomingHandler(provider: IWhatsAppProvider, organizationId: string) {
    provider.onMessageReceived(async (event: IncomingMessageEvent) => {
      await this.handleIncomingResponse(organizationId, event);
    });
  }

  // Processa a resposta enviada pelo morador no WhatsApp (Seção 21 da especificação)
  public async handleIncomingResponse(organizationId: string, event: IncomingMessageEvent) {
    const rawText = event.text.trim().toUpperCase();
    const cleanPhone = event.fromPhone.replace(/\D/g, '');

    // Identifica a intenção do morador
    const isAuthorize =
      rawText === '1' ||
      rawText.startsWith('1 ') ||
      rawText.startsWith('1-') ||
      rawText.startsWith('1.') ||
      rawText === 'SIM' ||
      rawText === 'AUTORIZAR' ||
      rawText === 'PODE ENTRAR' ||
      rawText === 'LIBERADO' ||
      rawText === 'LIBERAR' ||
      rawText.includes('👍') ||
      rawText.includes('✅');

    const isDeny =
      rawText === '2' ||
      rawText.startsWith('2 ') ||
      rawText.startsWith('2-') ||
      rawText.startsWith('2.') ||
      rawText === 'NAO' ||
      rawText === 'NÃO' ||
      rawText === 'RECUSAR' ||
      rawText === 'NEGAR' ||
      rawText === 'N' ||
      rawText.includes('👎') ||
      rawText.includes('❌');

    if (!isAuthorize && !isDeny) {
      console.log(`ℹ️ [WhatsAppService] Mensagem ignorada (não é autorizar 1 nem recusar 2): "${rawText}"`);
      return; // Mensagem irrelevante ou não estruturada
    }

    // 1. Tenta localizar o cliente pelo telefone OU pelo WhatsApp LID persistido.
    // O cadastro pode ter o 9 do celular e a resposta chegar sem ele, ou o contrário.
    let client = null;
    const phoneLike = cleanPhone.length >= 10 && cleanPhone.length <= 13;
    if (phoneLike) {
      const forms = new Set<string>([cleanPhone]);
      if (cleanPhone.startsWith('55') && cleanPhone.length === 13 && cleanPhone[4] === '9') {
        forms.add(`${cleanPhone.slice(0, 4)}${cleanPhone.slice(5)}`);
      }
      if (cleanPhone.startsWith('55') && cleanPhone.length === 12) {
        forms.add(`${cleanPhone.slice(0, 4)}9${cleanPhone.slice(4)}`);
      }
      try {
        forms.add(formatWhatsAppNumber(cleanPhone));
      } catch {}
      const tails = new Set<string>();
      for (const form of forms) {
        if (form.length >= 10) tails.add(form.slice(-10));
        if (form.length >= 11) tails.add(form.slice(-11));
      }
      const parts = [...tails];
      if (parts.length > 0) {
        client = await prisma.client.findFirst({
          where: {
            organizationId,
            deletedAt: null,
            OR: parts.map((tail) => ({ whatsappNumber: { contains: tail } })),
          },
        });
      }
    }
    const lidDigits = event.fromJid?.endsWith('@lid') ? event.fromJid.replace(/\D/g, '') : '';
    const markers = [lidDigits, cleanPhone].filter((value) => value.length > 8);
    if (!client && markers.length > 0) {
      client = await prisma.client.findFirst({
        where: {
          organizationId,
          deletedAt: null,
          OR: markers.map((value) => ({ notes: { contains: `[LID:${value}]` } })),
        },
      });
    }

    if (!client) {
      console.warn(`⚠️ [WhatsAppService] Telefone/LID ${cleanPhone} não pertence a um cliente desta organização. Resposta ignorada.`);
      return;
    }

    if (lidDigits && !client.notes?.includes(`[LID:${lidDigits}]`)) {
      try {
        const newNotes = client.notes ? `${client.notes} [LID:${lidDigits}]` : `[LID:${lidDigits}]`;
        await prisma.client.update({
          where: { id: client.id },
          data: { notes: newNotes },
        });
        client.notes = newNotes;
        console.log(`🔗 [WhatsAppService] LID ${lidDigits} vinculado com sucesso ao cliente ${client.name} (${client.whatsappNumber})!`);
      } catch (err: any) {
        console.warn('Aviso ao vincular LID ao cliente:', err?.message || err);
      }
    }

    // Busca a solicitação PENDING deste cliente (prioriza código citado se houver)
    let pendingRequest = null;
    if (event.quotedCode) {
      pendingRequest = await prisma.visitRequest.findFirst({
        where: {
          organizationId,
          clientId: client.id,
          code: { contains: event.quotedCode },
          status: 'PENDING',
        },
        include: {
          visitor: true,
          destination: true,
          conciergeUser: true,
        },
      });
    }

    if (!pendingRequest) {
      pendingRequest = await prisma.visitRequest.findFirst({
        where: {
          organizationId,
          clientId: client.id,
          status: 'PENDING',
        },
        include: {
          visitor: true,
          destination: true,
          conciergeUser: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!pendingRequest) {
      console.log(`ℹ️ [WhatsAppService] Cliente ${client.name} não possui solicitações pendentes no momento.`);
      try {
        const provider = this.getProvider(organizationId);
        const targetDest = client.whatsappNumber;
        await provider.sendMessage(
          targetDest,
          `Olá, *${client.name}*! No momento você não possui nenhuma solicitação pendente de autorização na portaria.`
        );
      } catch (e) {}
      return; // Nenhuma solicitação pendente para este cliente
    }

    const newStatus = isAuthorize ? 'AUTHORIZED' : 'DENIED';

    // Atualiza status no banco de dados de forma atômica
    const updated = await prisma.visitRequest.update({
      where: { id: pendingRequest.id },
      data: {
        status: newStatus,
        answeredAt: new Date(),
      },
    });

    realtimeService.notifyVisitRequestUpdated(organizationId, {
      id: pendingRequest.id,
      code: pendingRequest.code,
      status: newStatus,
      visitorName: pendingRequest.visitor.name,
      clientName: client.name,
      destinationName: pendingRequest.destination.name,
      answeredAt: updated.answeredAt,
    });

    realtimeService.notifyAlert(organizationId, {
      title: isAuthorize ? 'Entrada Autorizada!' : 'Entrada Recusada!',
      message: isAuthorize
        ? `O morador ${client.name} autorizou a entrada de ${pendingRequest.visitor.name} (${pendingRequest.destination.name}).`
        : `O morador ${client.name} RECUSOU a entrada de ${pendingRequest.visitor.name} (${pendingRequest.destination.name}).`,
      type: isAuthorize ? 'AUTHORIZED' : 'DENIED',
      visitRequestId: pendingRequest.id,
      visitorName: pendingRequest.visitor.name,
      clientName: client.name,
      destinationName: pendingRequest.destination.name,
    });

    prisma.visitEvent.create({
      data: {
        visitRequestId: pendingRequest.id,
        eventType: newStatus,
        description: isAuthorize
          ? `Entrada autorizada pelo morador ${client.name} via WhatsApp.`
          : `Entrada recusada pelo morador ${client.name} via WhatsApp.`,
        actorType: 'WHATSAPP_CLIENT',
        actorId: client.whatsappNumber,
        metadata: JSON.stringify({
          rawMessage: event.text,
          phone: event.fromPhone,
          timestamp: event.timestamp,
        }),
      },
    }).catch((err) => {
      console.warn('Erro ao gravar evento da resposta do WhatsApp:', err);
    });

    console.log(
      `🔔 Solicitação ${pendingRequest.code} atualizada para ${newStatus} pelo cliente ${client.name}`
    );

    // Envia resposta de confirmação de volta para o morador no WhatsApp
    try {
      const provider = this.getProvider(organizationId);
      const confirmationMsg = isAuthorize
        ? `✅ *Entrada Autorizada!*\n\nA liberação de *${pendingRequest.visitor.name}* foi confirmada com sucesso e a portaria já foi notificada para permitir o acesso.`
        : `❌ *Entrada Recusada!*\n\nA recusa da visita de *${pendingRequest.visitor.name}* foi registrada com sucesso e a portaria não permitirá a entrada.`;

      const targetDestination = client.whatsappNumber;
      await provider.sendMessage(targetDestination, confirmationMsg);
      console.log(`📤 [WhatsAppService] Resposta de confirmação enviada para ${client.name} (${targetDestination})`);
    } catch (confErr: any) {
      console.warn(`Aviso: falha ao enviar confirmação WhatsApp para ${client.name}:`, confErr?.message || confErr);
    }
  }

  // Disparo de solicitação no WhatsApp ao criar a visita (Seção 20)
  public async dispatchApprovalNotification(visitRequestId: string, organizationId: string) {
    const req = await prisma.visitRequest.findUnique({
      where: { id: visitRequestId },
      include: {
        client: true,
        destination: true,
        visitor: true,
        vehicle: true,
        conciergeUser: { select: { id: true, name: true } },
      },
    });

    if (!req) return;

    // Busca template configurado para a organização
    const template = await prisma.messageTemplate.findFirst({
      where: {
        organizationId,
        type: 'APPROVAL_REQUEST',
      },
    });

    const provider = this.getProvider(organizationId);

    try {
      await provider.sendApprovalRequest({
        clientName: req.client.name,
        clientPhone: req.client.whatsappNumber,
        visitorName: req.visitor.name,
        visitorCompany: req.visitor.company || undefined,
        visitorType: req.visitorType,
        visitReason: req.visitReason,
        arrivalFormattedTime: `${req.createdAt.toLocaleDateString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })} às ${req.createdAt.toLocaleTimeString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit',
        })}`,
        vehicleModel: req.vehicle?.model,
        vehiclePlate: req.vehicle?.licensePlate || undefined,
        requestCode: req.code,
        customTemplate: template?.content,
        photoUrl: req.visitor?.photoUrl || undefined,
        notes: req.notes || undefined,
        conciergeName: req.conciergeUser?.name || 'Portaria',
      });

      // Registra evento de envio
      await prisma.visitEvent.create({
        data: {
          visitRequestId: req.id,
          eventType: 'WA_SENT',
          description: `Mensagem de autorização enviada para o WhatsApp de ${req.client.name} (${req.client.whatsappNumber}).`,
          actorType: 'SYSTEM',
        },
      });
    } catch (err: any) {
      console.warn(`Aviso: falha ao despachar WhatsApp para ${req.client.name}:`, err.message);
      // Mantém a solicitação salva conforme Seção 46 (Resiliência)
    }
  }

  // Disparo de lembrete
  public async dispatchReminderNotification(visitRequestId: string, organizationId: string) {
    const req = await prisma.visitRequest.findUnique({
      where: { id: visitRequestId },
      include: {
        client: true,
        visitor: true,
        vehicle: true,
        conciergeUser: { select: { id: true, name: true } },
      },
    });

    if (!req) return;

    const template = await prisma.messageTemplate.findFirst({
      where: {
        organizationId,
        type: 'REMINDER',
      },
    });

    const provider = this.getProvider(organizationId);

    try {
      await provider.sendReminder({
        clientName: req.client.name,
        clientPhone: req.client.whatsappNumber,
        visitorName: req.visitor.name,
        visitorCompany: req.visitor.company || 'Não informada',
        visitorType: req.visitorType,
        visitReason: req.visitReason,
        vehicleModel: req.vehicle ? `${req.vehicle.model}` : 'Nenhum',
        vehiclePlate: req.vehicle?.licensePlate || undefined,
        requestCode: req.code,
        customTemplate: template?.content,
        photoUrl: req.visitor.photoUrl || undefined,
        notes: req.notes || undefined,
        conciergeName: req.conciergeUser?.name || 'Portaria',
      });
    } catch (err: any) {
      console.warn('Aviso: falha ao enviar lembrete no WhatsApp:', err.message);
    }
  }

  // Envio genérico de mensagem de texto (ex: aviso de encomendas, comunicados)
  public async sendMessage(organizationId: string, toPhone: string, text: string): Promise<{ messageId: string }> {
    const provider = this.getProvider(organizationId);
    return provider.sendMessage(toPhone, text);
  }

  // Envio de imagem com legenda (ex: foto de encomenda na portaria)
  public async liveStatuses() {
    const statuses: Record<string, { status: string; phoneConnected?: string | null }> = {};
    for (const [organizationId, provider] of this.providers) {
      try {
        const info = await provider.getStatus(organizationId);
        statuses[organizationId] = { status: info.status, phoneConnected: info.phoneConnected || null };
        if (info.status === 'CONNECTED') {
          prisma.whatsAppConnection.upsert({
            where: { organizationId },
            update: {
              status: 'CONNECTED',
              phoneConnected: info.phoneConnected || null,
              lastConnectedAt: info.lastConnectedAt || new Date(),
            },
            create: {
              organizationId,
              status: 'CONNECTED',
              phoneConnected: info.phoneConnected || null,
              lastConnectedAt: info.lastConnectedAt || new Date(),
            },
          }).catch(() => undefined);
        }
      } catch {
        /* a sessão ainda sem status não altera o painel */
      }
    }
    return statuses;
  }

  public async sendPlatformMessage(toPhone: string, text: string) {
    const admin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN', deletedAt: null, isActive: true },
      select: { organizationId: true },
    });
    if (!admin) {
      throw new Error('WhatsApp da plataforma indisponível.');
    }

    const provider = this.getProvider(admin.organizationId);
    const status = await provider.getStatus(admin.organizationId);
    if (status.status !== 'CONNECTED') {
      throw new Error('O WhatsApp da plataforma não está conectado.');
    }

    await provider.sendMessage(toPhone, text);
  }

  public async sendImageMessage(
    organizationId: string,
    toPhone: string,
    imageBase64OrUrl: string,
    caption?: string
  ): Promise<{ messageId: string }> {
    const provider = this.getProvider(organizationId);
    if (provider.sendImageMessage) {
      try {
        return await provider.sendImageMessage(toPhone, imageBase64OrUrl, caption);
      } catch (err: any) {
        console.warn(`[WhatsAppService] Falha ao enviar imagem (${err.message}). Enviando mensagem de texto como fallback...`);
      }
    }
    return provider.sendMessage(toPhone, caption || '');
  }
}

export const whatsappService = WhatsAppService.getInstance();
