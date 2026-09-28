import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  proto,
  Browsers,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import {
  IWhatsAppProvider,
  WhatsAppStatusInfo,
  ApprovalRequestMessageData,
  ReminderMessageData,
  IncomingMessageEvent,
} from '../interfaces/whatsapp-provider.interface.js';
import {
  parseMessageTemplate,
  DEFAULT_APPROVAL_TEMPLATE,
  DEFAULT_REMINDER_TEMPLATE,
} from '../templates/template.parser.js';
import { env } from '../../../config/env.js';
import { prisma } from '../../../lib/prisma.js';

class MemoryCache {
  private cache = new Map<string, any>();
  get(key: string) { return this.cache.get(key); }
  set(key: string, val: any) { this.cache.set(key, val); return true; }
  del(key: string) { return this.cache.delete(key); }
  flushAll() { this.cache.clear(); }
}

export class BaileysProvider implements IWhatsAppProvider {
  private sock: any = null;
  private statusInfo: WhatsAppStatusInfo = {
    status: 'DISCONNECTED',
  };
  private messageListeners: Array<(msg: IncomingMessageEvent) => Promise<void>> = [];
  private baseSessionDir: string;
  private saveTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private messageStore = new Map<string, proto.IMessage>();
  private msgRetryCounterCache = new MemoryCache();

  private saveMessageToStore(id: string, message: proto.IMessage) {
    if (!id || !message) return;
    this.messageStore.set(id, message);
    if (this.messageStore.size > 1000) {
      const firstKey = this.messageStore.keys().next().value;
      if (firstKey) this.messageStore.delete(firstKey);
    }
  }

  constructor(sessionDir?: string) {
    this.baseSessionDir = sessionDir || env.WHATSAPP_SESSION_PATH;
    if (!fs.existsSync(this.baseSessionDir)) {
      fs.mkdirSync(this.baseSessionDir, { recursive: true });
    }
  }

  private debounceSaveToDb(organizationId: string, orgSessionPath: string) {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveSessionToDb(organizationId, orgSessionPath);
    }, 2000);
  }

  public async saveSessionToDb(organizationId: string, orgSessionPath: string) {
    if (!fs.existsSync(orgSessionPath)) return;
    try {
      const files = fs.readdirSync(orgSessionPath);
      const sessionMap: Record<string, string> = {};
      for (const f of files) {
        const fullPath = path.join(orgSessionPath, f);
        if (fs.statSync(fullPath).isFile()) {
          sessionMap[f] = fs.readFileSync(fullPath, 'utf8');
        }
      }
      const dataStr = JSON.stringify(sessionMap);
      await prisma.systemSetting.upsert({
        where: {
          organizationId_key: {
            organizationId,
            key: 'whatsapp_session',
          },
        },
        create: {
          organizationId,
          key: 'whatsapp_session',
          value: dataStr,
        },
        update: {
          value: dataStr,
        },
      });
      console.log(`💾 [WhatsApp] Sessão da organização ${organizationId} persistida com sucesso no banco de dados!`);
    } catch (err: any) {
      console.warn(`Aviso ao persistir sessão no banco para ${organizationId}:`, err?.message || err);
    }
  }

  public async restoreSessionFromDb(organizationId: string, orgSessionPath: string): Promise<boolean> {
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: {
          organizationId_key: {
            organizationId,
            key: 'whatsapp_session',
          },
        },
      });
      if (!setting || !setting.value) return false;

      if (!fs.existsSync(orgSessionPath)) {
        fs.mkdirSync(orgSessionPath, { recursive: true });
      }

      const sessionMap: Record<string, string> = JSON.parse(setting.value);
      for (const [filename, content] of Object.entries(sessionMap)) {
        const fullPath = path.join(orgSessionPath, filename);
        fs.writeFileSync(fullPath, content, 'utf8');
      }
      console.log(`📥 [WhatsApp] Sessão da organização ${organizationId} restaurada com sucesso do banco de dados (${Object.keys(sessionMap).length} arquivos)!`);
      return true;
    } catch (err: any) {
      console.warn(`Aviso ao restaurar sessão do banco para ${organizationId}:`, err?.message || err);
      return false;
    }
  }

  async connect(organizationId: string): Promise<void> {
    if (this.isConnecting) return;
    this.isConnecting = true;

    // Se já havia um socket ativo, desconecta-o suavemente antes de recriar
    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners('connection.update');
        this.sock.ev.removeAllListeners('creds.update');
        this.sock.ev.removeAllListeners('messages.upsert');
        this.sock.end(undefined);
      } catch (e) {}
      this.sock = null;
    }

    const orgSessionPath = path.join(this.baseSessionDir, `org_${organizationId}`);
    if (!fs.existsSync(orgSessionPath)) {
      fs.mkdirSync(orgSessionPath, { recursive: true });
    }

    // 1. Tenta restaurar do banco de dados (Supabase) caso os arquivos não existam no disco (ex: novo deploy no Render)
    const credsPath = path.join(orgSessionPath, 'creds.json');
    if (!fs.existsSync(credsPath)) {
      await this.restoreSessionFromDb(organizationId, orgSessionPath);
    }

    this.statusInfo.status = 'CONNECTING';

    const { state, saveCreds } = await useMultiFileAuthState(orgSessionPath);
    const { version } = await fetchLatestBaileysVersion();

    // Hook para salvar no banco sempre que qualquer chave (sessão, pre-key) for criada/atualizada
    const originalKeysSet = state.keys.set;
    state.keys.set = async (data: any) => {
      await originalKeysSet(data);
      this.debounceSaveToDb(organizationId, orgSessionPath);
    };

    const logger = pino({ level: 'silent' });

    this.sock = makeWASocket({
      version,
      logger,
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      msgRetryCounterCache: this.msgRetryCounterCache,
      getMessage: async (key: proto.IMessageKey) => {
        if (key.id && this.messageStore.has(key.id)) {
          return this.messageStore.get(key.id);
        }
        return undefined;
      },
    });

    this.isConnecting = false;

    this.sock.ev.on('creds.update', async () => {
      await saveCreds();
      this.debounceSaveToDb(organizationId, orgSessionPath);
    });

    this.sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        // Converte o QR Code raw em imagem Base64 para exibir no app do Admin
        try {
          const qrBase64 = await QRCode.toDataURL(qr);
          this.statusInfo = {
            status: 'QR_READY',
            qrCode: qrBase64,
          };
        } catch (e) {
          console.warn('Erro ao gerar QR Code Base64:', e);
        }
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        this.statusInfo = {
          status: 'DISCONNECTED',
        };

        if (shouldReconnect && env.WHATSAPP_AUTO_RECONNECT) {
          console.log('🔄 Reconectando Baileys automaticamente...');
          setTimeout(() => this.connect(organizationId), 3000);
        }
      } else if (connection === 'open') {
        const userJid = this.sock?.user?.id || '';
        const phone = userJid.split(':')[0] || userJid.split('@')[0];

        this.statusInfo = {
          status: 'CONNECTED',
          phoneConnected: phone,
          lastConnectedAt: new Date(),
        };

        console.log(`✅ WhatsApp Baileys conectado com sucesso para o número: ${phone}`);
      }
    });

    // Escuta mensagens recebidas (respostas dos moradores)
    this.sock.ev.on('messages.upsert', async ({ messages }: { messages: proto.IWebMessageInfo[] }) => {
      for (const msg of messages) {
        if (msg.key?.id && msg.message) {
          this.saveMessageToStore(msg.key.id, msg.message);
        }
        if (!msg.message || msg.key.fromMe) continue;

        const remoteJid = msg.key.remoteJid || '';
        if (remoteJid.endsWith('@g.us')) continue; // Ignora grupos de WhatsApp

        const fromPhone = remoteJid.replace(/[^0-9]/g, '');

        let message = msg.message;
        // Desempacota mensagens encapsuladas (ephemeralMessage, viewOnce, editedMessage, documentWithCaption)
        while (
          message.ephemeralMessage?.message ||
          message.viewOnceMessage?.message ||
          message.viewOnceMessageV2?.message ||
          message.documentWithCaptionMessage?.message ||
          (message as any).editedMessage?.message?.protocolMessage?.editedMessage
        ) {
          message =
            message.ephemeralMessage?.message ||
            message.viewOnceMessage?.message ||
            message.viewOnceMessageV2?.message ||
            message.documentWithCaptionMessage?.message ||
            (message as any).editedMessage?.message?.protocolMessage?.editedMessage;
        }

        const text = (
          message.conversation ||
          message.extendedTextMessage?.text ||
          message.buttonsResponseMessage?.selectedButtonId ||
          message.buttonsResponseMessage?.selectedDisplayText ||
          message.templateButtonReplyMessage?.selectedId ||
          message.templateButtonReplyMessage?.selectedDisplayText ||
          message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
          message.listResponseMessage?.singleSelectReply?.selectedRowId ||
          message.reactionMessage?.text ||
          ''
        ).trim();

        // Extrai mensagem citada (se respondeu citando)
        const context = message.extendedTextMessage?.contextInfo;
        const quotedMsg = context?.quotedMessage;
        let quotedText = '';
        if (quotedMsg) {
          quotedText = (
            quotedMsg.conversation ||
            quotedMsg.extendedTextMessage?.text ||
            ''
          ).trim();
        }

        // Tenta achar código na citação (ex: #VIS-12345 ou 123456)
        let quotedCode: string | undefined;
        if (quotedText) {
          const match = quotedText.match(/#?([A-Z0-9]{4,8})/);
          if (match) quotedCode = match[1];
        }

        console.log(`📩 [Baileys] Mensagem recebida de ${remoteJid} (${fromPhone}): "${text}" (pushName: ${msg.pushName || 'N/A'})`);

        if (text && text.trim().length > 0) {
          const event: IncomingMessageEvent = {
            fromPhone,
            fromJid: remoteJid,
            text: text.trim(),
            pushName: msg.pushName || undefined,
            quotedCode,
            quotedText: quotedText || undefined,
            timestamp: new Date((msg.messageTimestamp as number) * 1000 || Date.now()),
            rawMessage: msg,
          };

          for (const listener of this.messageListeners) {
            try {
              await listener(event);
            } catch (err) {
              console.error('Erro ao processar mensagem do WhatsApp:', err);
            }
          }
        }
      }
    });
  }

  async disconnect(organizationId: string): Promise<void> {
    if (this.sock) {
      await this.sock.logout();
      this.sock = null;
    }
    this.statusInfo = { status: 'DISCONNECTED' };

    // Limpa credenciais locais
    const orgSessionPath = path.join(this.baseSessionDir, `org_${organizationId}`);
    if (fs.existsSync(orgSessionPath)) {
      fs.rmSync(orgSessionPath, { recursive: true, force: true });
    }

    // Limpa credenciais persistidas no banco
    try {
      await prisma.systemSetting.deleteMany({
        where: { organizationId, key: 'whatsapp_session' },
      });
    } catch (e) {}
  }

  async getStatus(_organizationId: string): Promise<WhatsAppStatusInfo> {
    return this.statusInfo;
  }

  private async resolveJid(phone: string): Promise<string> {
    const clean = phone.replace(/\D/g, '');

    if (this.sock) {
      try {
        // 1. Para números brasileiros com 13 dígitos (55 + DDD + 9 dígitos):
        // No WhatsApp, contas de quase todos os DDDs fora de SP (DDD > 28) são registradas internamente sem o 9º dígito (12 dígitos).
        // Se enviarmos para o JID de 13 dígitos, o WhatsApp entrega mas o celular não consegue descriptografar ("Aguardando mensagem").
        // Portanto, para DDDs > 28, verificamos primeiro a existência do JID canônico sem o 9º dígito!
        if (clean.startsWith('55') && clean.length === 13 && clean[4] === '9') {
          const ddd = parseInt(clean.slice(2, 4), 10);
          const withoutNine = `${clean.slice(0, 4)}${clean.slice(5)}`;

          if (ddd > 28) {
            const [resWithout] = (await this.sock.onWhatsApp(withoutNine)) || [];
            if (resWithout && resWithout.exists) {
              console.log(`📱 [Baileys] JID canônico sem 9º dígito resolvido (${withoutNine}): ${resWithout.jid}`);
              return resWithout.jid;
            }
          }
        }

        // 2. Tenta verificar o número original informado
        const [direct] = (await this.sock.onWhatsApp(clean)) || [];
        if (direct && direct.exists) {
          console.log(`📱 [Baileys] JID verificado para ${clean}: ${direct.jid}`);
          return direct.jid;
        }

        // 3. Fallback se não resolveu direto: tenta sem o 9º dígito
        if (clean.startsWith('55') && clean.length === 13 && clean[4] === '9') {
          const withoutNine = `${clean.slice(0, 4)}${clean.slice(5)}`;
          const [resWithout] = (await this.sock.onWhatsApp(withoutNine)) || [];
          if (resWithout && resWithout.exists) {
            console.log(`📱 [Baileys] JID resolvido sem 9º dígito (${withoutNine}): ${resWithout.jid}`);
            return resWithout.jid;
          }
        }

        // 4. Se foi informado com 12 dígitos (sem o 9º dígito), tenta com o 9º dígito
        if (clean.startsWith('55') && clean.length === 12) {
          const withNine = `${clean.slice(0, 4)}9${clean.slice(4)}`;
          const [resWith] = (await this.sock.onWhatsApp(withNine)) || [];
          if (resWith && resWith.exists) {
            console.log(`📱 [Baileys] JID resolvido com 9º dígito (${withNine}): ${resWith.jid}`);
            return resWith.jid;
          }
        }
      } catch (err: any) {
        console.warn('⚠️ [Baileys] Erro ao consultar onWhatsApp:', err?.message || err);
      }
    }

    // Fallback para números brasileiros fora da área de SP/RJ (DDD > 28)
    if (clean.startsWith('55') && clean.length === 13 && clean[4] === '9') {
      const ddd = parseInt(clean.slice(2, 4), 10);
      if (ddd > 28) {
        const withoutNine = `${clean.slice(0, 4)}${clean.slice(5)}@s.whatsapp.net`;
        console.log(`📱 [Baileys] Fallback JID sem 9º dígito para DDD ${ddd}: ${withoutNine}`);
        return withoutNine;
      }
    }

    return `${clean}@s.whatsapp.net`;
  }

  async sendApprovalRequest(data: ApprovalRequestMessageData): Promise<{ messageId: string }> {
    if (this.statusInfo.status !== 'CONNECTED' || !this.sock) {
      throw new Error('WhatsApp não está conectado no momento.');
    }

    const jid = await this.resolveJid(data.clientPhone);

    const text = parseMessageTemplate(data.customTemplate || DEFAULT_APPROVAL_TEMPLATE, {
      cliente: data.clientName,
      visitante: data.visitorName,
      empresa: data.visitorCompany,
      tipo: data.visitorType,
      motivo: data.visitReason,
      horario: data.arrivalFormattedTime,
      veiculo: data.vehicleModel,
      placa: data.vehiclePlate,
      codigo: data.requestCode,
    });

    console.log(`🚀 [Baileys] Enviando mensagem de autorização para ${data.clientName} (JID: ${jid})...`);
    const sent = await this.sock.sendMessage(jid, { text });
    if (sent?.key?.id && sent.message) {
      this.saveMessageToStore(sent.key.id, sent.message);
    }
    console.log(`✅ [Baileys] Mensagem enviada com sucesso! ID: ${sent?.key?.id}`);
    return { messageId: sent.key.id || '' };
  }

  async sendReminder(data: ReminderMessageData): Promise<{ messageId: string }> {
    if (this.statusInfo.status !== 'CONNECTED' || !this.sock) {
      throw new Error('WhatsApp não está conectado no momento.');
    }

    const jid = await this.resolveJid(data.clientPhone);

    const text = parseMessageTemplate(data.customTemplate || DEFAULT_REMINDER_TEMPLATE, {
      cliente: data.clientName,
      visitante: data.visitorName,
      motivo: 'Lembrete de liberação',
      horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      codigo: data.requestCode,
    });

    console.log(`🚀 [Baileys] Enviando lembrete para ${data.clientName} (JID: ${jid})...`);
    const sent = await this.sock.sendMessage(jid, { text });
    if (sent?.key?.id && sent.message) {
      this.saveMessageToStore(sent.key.id, sent.message);
    }
    console.log(`✅ [Baileys] Lembrete enviado com sucesso! ID: ${sent?.key?.id}`);
    return { messageId: sent.key.id || '' };
  }

  async sendMessage(toPhone: string, text: string): Promise<{ messageId: string }> {
    if (this.statusInfo.status !== 'CONNECTED' || !this.sock) {
      throw new Error('WhatsApp não está conectado no momento.');
    }

    const jid = toPhone.includes('@') ? toPhone : await this.resolveJid(toPhone);
    console.log(`🚀 [Baileys] Enviando mensagem de texto para JID: ${jid}...`);
    const sent = await this.sock.sendMessage(jid, { text });
    if (sent?.key?.id && sent.message) {
      this.saveMessageToStore(sent.key.id, sent.message);
    }
    console.log(`✅ [Baileys] Mensagem enviada com sucesso! ID: ${sent?.key?.id}`);
    return { messageId: sent?.key.id || `msg_${Date.now()}` };
  }

  async sendImageMessage(toPhone: string, imageBase64OrUrl: string, caption?: string): Promise<{ messageId: string }> {
    if (this.statusInfo.status !== 'CONNECTED' || !this.sock) {
      throw new Error('WhatsApp não está conectado no momento.');
    }

    const jid = toPhone.includes('@') ? toPhone : await this.resolveJid(toPhone);
    console.log(`🚀 [Baileys] Enviando imagem para JID: ${jid}...`);

    let imageContent: any;
    if (imageBase64OrUrl.startsWith('data:image')) {
      const base64Data = imageBase64OrUrl.split(',')[1];
      imageContent = Buffer.from(base64Data, 'base64');
    } else if (imageBase64OrUrl.startsWith('http://') || imageBase64OrUrl.startsWith('https://')) {
      imageContent = { url: imageBase64OrUrl };
    } else {
      imageContent = Buffer.from(imageBase64OrUrl, 'base64');
    }

    const sent = await this.sock.sendMessage(jid, {
      image: imageContent,
      caption: caption || '',
    });
    if (sent?.key?.id && sent.message) {
      this.saveMessageToStore(sent.key.id, sent.message);
    }
    console.log(`✅ [Baileys] Imagem enviada com sucesso! ID: ${sent?.key?.id}`);
    return { messageId: sent?.key.id || `img_${Date.now()}` };
  }

  onMessageReceived(callback: (msg: IncomingMessageEvent) => Promise<void>): void {
    this.messageListeners.push(callback);
  }
}
