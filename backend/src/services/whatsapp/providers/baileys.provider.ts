import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  proto,
  Browsers,
  makeCacheableSignalKeyStore,
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
import { getStorageService } from '../../storage/storage.service.js';

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
  private orgSessionPath: string = '';
  private saveTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private messageStore = new Map<string, proto.IMessage>();
  private jidCache = new Map<string, string>();
  private msgRetryCounterCache = new MemoryCache();
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  private getStoreFilePath(): string {
    return this.orgSessionPath
      ? path.join(this.orgSessionPath, 'messages_cache.json')
      : path.join(this.baseSessionDir, 'messages_cache.json');
  }

  private loadMessageStoreFromDisk() {
    try {
      const filePath = this.getStoreFilePath();
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw, (key, value) => {
          if (value && typeof value === 'object' && value.type === 'Buffer' && Array.isArray(value.data)) {
            return Buffer.from(value.data);
          }
          return value;
        });
        for (const [id, msg] of Object.entries(parsed)) {
          this.messageStore.set(id, msg as proto.IMessage);
        }
        console.log(`📦 [Baileys] ${this.messageStore.size} mensagens carregadas do cache em disco.`);
      }
    } catch (err) {
      console.warn('Aviso ao carregar cache de mensagens do disco:', err);
    }
  }

  private persistMessageStoreToDisk() {
    try {
      const filePath = this.getStoreFilePath();
      const obj: Record<string, proto.IMessage> = {};
      // Mantém as últimas 500 mensagens persistidas para responder a retries do celular
      const entries = Array.from(this.messageStore.entries()).slice(-500);
      for (const [id, msg] of entries) {
        obj[id] = msg;
      }
      fs.writeFileSync(filePath, JSON.stringify(obj), 'utf8');
    } catch (err) {
      console.warn('Aviso ao persistir cache de mensagens no disco:', err);
    }
  }

  private saveMessageToStore(id: string, message: proto.IMessage) {
    if (!id || !message) return;
    this.messageStore.set(id, message);
    if (this.messageStore.size > 1000) {
      const firstKey = this.messageStore.keys().next().value;
      if (firstKey) this.messageStore.delete(firstKey);
    }
    this.persistMessageStoreToDisk();
  }

  constructor(sessionDir?: string) {
    this.baseSessionDir = sessionDir || env.WHATSAPP_SESSION_PATH;
    if (!fs.existsSync(this.baseSessionDir)) {
      fs.mkdirSync(this.baseSessionDir, { recursive: true });
    }
    this.loadMessageStoreFromDisk();
  }

  public registerJidMapping(phoneOrClean: string, targetJid: string) {
    if (!phoneOrClean || !targetJid) return;
    const clean = phoneOrClean.replace(/\D/g, '');
    this.jidCache.set(clean, targetJid);
    if (clean.startsWith('55') && clean.length === 13 && clean[4] === '9') {
      this.jidCache.set(`${clean.slice(0, 4)}${clean.slice(5)}`, targetJid);
    }
    if (clean.startsWith('55') && clean.length === 12) {
      this.jidCache.set(`${clean.slice(0, 4)}9${clean.slice(4)}`, targetJid);
    }
    console.log(`📱 [Baileys] JID mapping registrado: ${phoneOrClean} -> ${targetJid}`);
  }

  private debounceSaveToDb(organizationId: string, orgSessionPath: string) {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveSessionToDb(organizationId, orgSessionPath);
    }, 8000);
  }

  public async saveSessionToDb(organizationId: string, orgSessionPath: string) {
    if (!fs.existsSync(orgSessionPath)) return;
    try {
      const files = fs.readdirSync(orgSessionPath);
      const selected = files.length > 120
        ? files.filter((file) => file === 'creds.json' || file.startsWith('session-') || file.startsWith('pre-key-'))
        : files;
      const sessionMap: Record<string, string> = {};
      for (const f of selected) {
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

      // Persiste as últimas 200 mensagens para responder a retries de descriptografia
      if (this.messageStore.size > 0) {
        const obj: Record<string, any> = {};
        const entries = Array.from(this.messageStore.entries()).slice(-200);
        for (const [id, msg] of entries) {
          obj[id] = msg;
        }
        await prisma.systemSetting.upsert({
          where: {
            organizationId_key: {
              organizationId,
              key: 'whatsapp_messages_cache',
            },
          },
          create: {
            organizationId,
            key: 'whatsapp_messages_cache',
            value: JSON.stringify(obj),
          },
          update: {
            value: JSON.stringify(obj),
          },
        });
      }

      console.log(`💾 [WhatsApp] Sessão da organização ${organizationId} persistida com sucesso (${Object.keys(sessionMap).length} arquivos)!`);
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

      // Restaura mensagens recentes para atender retries do WhatsApp
      try {
        const msgSetting = await prisma.systemSetting.findUnique({
          where: {
            organizationId_key: {
              organizationId,
              key: 'whatsapp_messages_cache',
            },
          },
        });
        if (msgSetting && msgSetting.value) {
          const parsed = JSON.parse(msgSetting.value, (key, value) => {
            if (value && typeof value === 'object' && value.type === 'Buffer' && Array.isArray(value.data)) {
              return Buffer.from(value.data);
            }
            return value;
          });
          for (const [id, msg] of Object.entries(parsed)) {
            this.messageStore.set(id, msg as proto.IMessage);
          }
          console.log(`📦 [Baileys] ${this.messageStore.size} mensagens de retry restauradas do banco.`);
        }
      } catch (e) {}

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
    this.orgSessionPath = orgSessionPath;
    if (!fs.existsSync(orgSessionPath)) {
      fs.mkdirSync(orgSessionPath, { recursive: true });
    }

    // 1. Tenta restaurar do banco de dados (Supabase) caso os arquivos não existam no disco (ex: novo deploy no Render)
    const credsPath = path.join(orgSessionPath, 'creds.json');
    if (!fs.existsSync(credsPath)) {
      await this.restoreSessionFromDb(organizationId, orgSessionPath);
    }

    this.loadMessageStoreFromDisk();

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
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      markOnlineOnConnect: false,
      shouldIgnoreJid: (jid) =>
        !!jid &&
        (jid.includes('@newsletter') ||
          jid.includes('status@broadcast') ||
          jid.endsWith('@g.us') ||
          jid.endsWith('@broadcast')),
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
        const errorMessage = (lastDisconnect?.error as any)?.message || '';
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515;
        const isReplaced = statusCode === DisconnectReason.connectionReplaced || statusCode === 440 || errorMessage.toLowerCase().includes('conflict');

        console.warn(`⚠️ [Baileys] Conexão fechada. Status: ${statusCode}, Erro: ${errorMessage}`);

        this.statusInfo = { status: 'DISCONNECTED' };

        // 1. Se outra instância conectou (Status 440 Conflict / Stream Errored), NÃO reconecta para não derrubar a outra instância em loop!
        if (isReplaced) {
          console.warn('⚠️ [Baileys] Conexão substituída por outra instância ativa (Status 440: Conflict). Interrompendo reconexão para evitar loop.');
          return;
        }

        // 2. Se a sessão foi desconectada pelo usuário no celular (Logged Out), limpa as credenciais
        if (isLoggedOut) {
          console.warn(`[Baileys] Sessão desconectada/expirada pelo WhatsApp (Logged Out). Limpando credenciais.`);
          this.disconnect(organizationId);
          return;
        }

        if (env.WHATSAPP_AUTO_RECONNECT) {
          // Se for reinício exigido pelo Baileys (515), reconecta imediatamente sem penalizar backoff
          if (isRestartRequired) {
            console.log('🔄 [Baileys] Reinício solicitado pelo protocolo (515). Reconectando em 1s...');
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => this.connect(organizationId), 1000);
            return;
          }

          // Backoff exponencial: 3s, 6s, 12s, 24s, ... até no máximo 5 minutos
          const isBadMac = errorMessage.toLowerCase().includes('bad mac');
          const MAX_ATTEMPTS = 10;
          const BASE_DELAY_MS = isBadMac ? 15000 : 3000;
          const delay = Math.min(BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts), 300000);
          this.reconnectAttempts++;

          if (this.reconnectAttempts <= MAX_ATTEMPTS) {
            console.log(`🔄 Reconectando Baileys (tentativa ${this.reconnectAttempts}/${MAX_ATTEMPTS}) em ${Math.round(delay / 1000)}s...`);
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => this.connect(organizationId), delay);
          } else {
            console.error(`❌ [Baileys] Máximo de tentativas de reconexão atingido (${MAX_ATTEMPTS}). Aguardando intervenção manual.`);
            this.statusInfo = { status: 'DISCONNECTED' };
          }
        }
      } else if (connection === 'open') {
        const userJid = this.sock?.user?.id || '';
        const phone = userJid.split(':')[0] || userJid.split('@')[0];

        // Conexão bem-sucedida: zera o contador de tentativas de reconexão
        this.reconnectAttempts = 0;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

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
        if (
          remoteJid.endsWith('@g.us') ||
          remoteJid.includes('@newsletter') ||
          remoteJid.includes('status@broadcast') ||
          remoteJid.endsWith('@broadcast')
        ) {
          continue;
        }

        const fromPhone = remoteJid.replace(/[^0-9]/g, '');
        if (fromPhone) {
          this.jidCache.set(fromPhone, remoteJid);
          if (fromPhone.startsWith('55') && fromPhone.length === 12) {
            this.jidCache.set(`${fromPhone.slice(0, 4)}9${fromPhone.slice(4)}`, remoteJid);
          }
          if (fromPhone.startsWith('55') && fromPhone.length === 13 && fromPhone[4] === '9') {
            this.jidCache.set(`${fromPhone.slice(0, 4)}${fromPhone.slice(5)}`, remoteJid);
          }
        }

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
    if (phone.includes('@')) {
      return phone;
    }

    const clean = phone.replace(/\D/g, '');

    // Se já temos o JID ativo do contato através de uma interação recente, usa diretamente!
    if (this.jidCache.has(clean)) {
      const cached = this.jidCache.get(clean)!;
      console.log(`📱 [Baileys] JID recuperado do cache de interação recente para ${clean}: ${cached}`);
      return cached;
    }

    // Se o cliente tem um WhatsApp LID mapeado no banco, usa diretamente o @lid
    try {
      const clientWithLid = await prisma.client.findFirst({
        where: {
          whatsappNumber: { contains: clean.slice(-8) },
          notes: { contains: '[LID:' },
          deletedAt: null,
        },
        select: { notes: true, whatsappNumber: true },
      });
      if (clientWithLid?.notes) {
        const match = clientWithLid.notes.match(/\[LID:([0-9]+)\]/);
        if (match && match[1]) {
          const lidJid = `${match[1]}@lid`;
          this.registerJidMapping(clean, lidJid);
          this.registerJidMapping(clientWithLid.whatsappNumber, lidJid);
          console.log(`📱 [Baileys] JID recuperado de LID persistido para ${clean}: ${lidJid}`);
          return lidJid;
        }
      }
    } catch (e) {}

    if (this.sock) {
      try {
        // 1. Para números brasileiros com 13 dígitos (55 + DDD + 9 dígitos):
        // No WhatsApp, grande parte das contas brasileiras continuam registradas internamente sem o 9º dígito (12 dígitos).
        // Se enviarmos para o JID de 13 dígitos, o WhatsApp Web pode exibir, mas o celular oficial fica em "Aguardando mensagem".
        // Portanto, verificamos primeiro se a conta existe no formato canônico sem o 9º dígito!
        if (clean.startsWith('55') && clean.length === 13 && clean[4] === '9') {
          const withoutNine = `${clean.slice(0, 4)}${clean.slice(5)}`;
          const [resWithout] = (await this.sock.onWhatsApp(withoutNine)) || [];
          if (resWithout && resWithout.exists) {
            console.log(`📱 [Baileys] JID canônico sem 9º dígito resolvido (${withoutNine}): ${resWithout.jid}`);
            return resWithout.jid;
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
      observacao: data.notes,
      operador: data.conciergeName,
    });

    const textResult = await this.sendMessage(jid, text);

    if (data.photoUrl) {
      this.sendImageMessage(jid, data.photoUrl, 'Foto do visitante').catch((imgErr: any) => {
        console.warn(`⚠️ [Baileys] Falha ao enviar foto da visita (${imgErr?.message || imgErr}).`);
      });
    }

    return textResult;
  }

  async sendReminder(data: ReminderMessageData): Promise<{ messageId: string }> {
    if (this.statusInfo.status !== 'CONNECTED' || !this.sock) {
      throw new Error('WhatsApp não está conectado no momento.');
    }

    const jid = await this.resolveJid(data.clientPhone);

    const text = parseMessageTemplate(data.customTemplate || DEFAULT_REMINDER_TEMPLATE, {
      cliente: data.clientName,
      visitante: data.visitorName,
      empresa: data.visitorCompany || 'Não informada',
      tipo: data.visitorType || 'Visitante',
      motivo: data.visitReason || 'Lembrete de liberação',
      horario: new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }),
      veiculo: data.vehicleModel || 'Nenhum',
      placa: data.vehiclePlate || '',
      codigo: data.requestCode,
      observacao: data.notes || '',
      operador: data.conciergeName,
    });

    if (data.photoUrl) {
      console.log(`🚀 [Baileys] Enviando lembrete COM FOTO para ${data.clientName} (JID: ${jid})...`);
      try {
        const imgResult = await this.sendImageMessage(jid, data.photoUrl, text);
        console.log(`✅ [Baileys] Lembrete com foto enviado com sucesso! ID: ${imgResult.messageId}`);
        return imgResult;
      } catch (imgErr: any) {
        console.warn(`⚠️ [Baileys] Falha ao enviar foto no lembrete (${imgErr?.message || imgErr}). Enviando como texto...`);
      }
    }

    console.log(`🚀 [Baileys] Enviando lembrete de texto para ${data.clientName} (JID: ${jid})...`);
    return await this.sendMessage(jid, text);
  }

  public clearContactSession(phoneOrJid: string) {
    if (!this.orgSessionPath || !fs.existsSync(this.orgSessionPath)) return;
    try {
      const clean = phoneOrJid.replace(/[^0-9]/g, '');
      if (clean.length < 8) return;
      const files = fs.readdirSync(this.orgSessionPath);
      for (const f of files) {
        if (f.startsWith(`session-${clean}`) || (f.startsWith('session-') && f.includes(clean))) {
          try {
            fs.unlinkSync(path.join(this.orgSessionPath, f));
            console.log(`🧹 [Baileys] Sessão fechada/antiga de contato removida: ${f}`);
          } catch (e) {}
        }
      }
    } catch (err) {}
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
    let mimeType = 'image/jpeg';

    if (imageBase64OrUrl.startsWith('data:image')) {
      const parts = imageBase64OrUrl.split(',');
      const match = parts[0].match(/:(.*?);/);
      if (match) mimeType = match[1];
      imageContent = Buffer.from(parts[1], 'base64');
    } else if (imageBase64OrUrl.startsWith('http://') || imageBase64OrUrl.startsWith('https://')) {
      imageContent = { url: imageBase64OrUrl };
    } else {
      // Tenta recuperar do storage service (Supabase Database Storage ou Bucket)
      try {
        const storageService = getStorageService();
        const stored = await storageService.getFile(imageBase64OrUrl);
        if (stored && stored.buffer && stored.buffer.length > 0) {
          imageContent = stored.buffer;
          if (stored.mimeType) mimeType = stored.mimeType;
          console.log(`📷 [Baileys] Foto recuperada do storage com sucesso (${stored.buffer.length} bytes, mimetype: ${mimeType})`);
        }
      } catch (err: any) {
        console.warn(`⚠️ [Baileys] Erro ao buscar foto no storage (${imageBase64OrUrl}):`, err?.message || err);
      }

      if (!imageContent) {
        // Se for string base64 pura (comprimento longo)
        if (imageBase64OrUrl.length > 100) {
          imageContent = Buffer.from(imageBase64OrUrl, 'base64');
        } else {
          throw new Error(`Imagem não encontrada ou inválida no storage: ${imageBase64OrUrl}`);
        }
      }
    }

    if (imageContent instanceof Buffer) {
      try {
        const sharpModule = await import('sharp');
        const sharp = sharpModule.default || sharpModule;
        // Otimiza a foto para Web (reduz de ~500KB para ~70KB para tráfego instantâneo)
        const optimized = await sharp(imageContent)
          .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 75, progressive: true })
          .toBuffer();
        imageContent = optimized;
        mimeType = 'image/jpeg';
        console.log(`⚡ [Baileys] Foto otimizada com sharp (${optimized.length} bytes)`);
      } catch (sharpErr: any) {
        console.warn('⚠️ [Baileys] Erro ao otimizar imagem com sharp:', sharpErr?.message || sharpErr);
      }
    }

    const sent = await this.sock.sendMessage(jid, {
      image: imageContent,
      mimetype: mimeType,
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
