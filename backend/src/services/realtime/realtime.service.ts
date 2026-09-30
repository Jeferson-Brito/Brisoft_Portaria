import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createVerifier } from 'fast-jwt';
import { env } from '../../config/env.js';

export interface RealtimeAlertPayload {
  title: string;
  message: string;
  type: 'AUTHORIZED' | 'DENIED' | 'INFO' | 'WARNING';
  visitRequestId?: string;
  visitorName?: string;
  clientName?: string;
  destinationName?: string;
  timestamp: string;
}

export class RealtimeService {
  private static instance: RealtimeService;
  private io: SocketIOServer | null = null;

  private constructor() {
    // Singleton
  }

  public static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  public init(httpServer: HTTPServer): SocketIOServer {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      pingTimeout: 30000,
      pingInterval: 25000,
    });

    const verifyToken = createVerifier({ key: env.JWT_SECRET });

    this.io.use((socket, next) => {
      try {
        const rawToken = socket.handshake.auth?.token;
        const token = typeof rawToken === 'string' ? rawToken.replace(/^Bearer\s+/i, '') : '';
        if (!token) {
          next(new Error('Token ausente'));
          return;
        }
        const payload = verifyToken(token) as { sub?: string; organizationId?: string };
        if (!payload?.organizationId) {
          next(new Error('Token sem organizacao'));
          return;
        }
        socket.data.user = payload;
        next();
      } catch {
        next(new Error('Token invalido'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      const orgId = socket.data.user?.organizationId as string;
      const userId = socket.data.user?.sub as string;

      socket.join(`org_${orgId}`);
      if (userId) {
        socket.join(`user_${userId}`);
      }
      console.log(`🔌 [Realtime] Socket ${socket.id} entrou na sala da organização: org_${orgId}`);

      socket.on('disconnect', (reason) => {
        console.log(`🔌 [Realtime] Socket ${socket.id} desconectado (${reason})`);
      });
    });

    return this.io;
  }

  public getIO(): SocketIOServer | null {
    return this.io;
  }

  // Notifica toda a portaria de uma organização sobre nova solicitação criada
  public notifyVisitRequestCreated(organizationId: string, payload: any) {
    if (!this.io) return;
    this.io.to(`org_${organizationId}`).emit('visit_request:created', {
      ...payload,
      emittedAt: new Date().toISOString(),
    });
  }

  // Notifica toda a portaria sobre atualização de status (Autorizado, Recusado, Entrou, Saiu)
  public notifyVisitRequestUpdated(organizationId: string, payload: any) {
    if (!this.io) return;
    this.io.to(`org_${organizationId}`).emit('visit_request:updated', {
      ...payload,
      emittedAt: new Date().toISOString(),
    });
  }

  private pushTokens: Map<string, Set<string>> = new Map();

  public async registerPushToken(organizationId: string, token: string) {
    if (!token) return;
    let tokens = this.pushTokens.get(organizationId);
    if (!tokens) {
      tokens = new Set();
      this.pushTokens.set(organizationId, tokens);
    }
    tokens.add(token);
    console.log(`📱 [Push] Token registrado para org ${organizationId}: ${token}`);

    // Persiste no banco de dados (PostgreSQL) para sobreviver a reinicializações e cold starts do Render
    try {
      const { prisma } = await import('../../lib/prisma.js');
      const existingSetting = await prisma.systemSetting.findUnique({
        where: {
          organizationId_key: {
            organizationId,
            key: 'push_tokens',
          },
        },
      });

      const tokenSet = new Set<string>(tokens);
      if (existingSetting?.value) {
        try {
          const savedList: string[] = JSON.parse(existingSetting.value);
          savedList.forEach((t) => tokenSet.add(t));
        } catch (e) {}
      }

      await prisma.systemSetting.upsert({
        where: {
          organizationId_key: {
            organizationId,
            key: 'push_tokens',
          },
        },
        create: {
          organizationId,
          key: 'push_tokens',
          value: JSON.stringify(Array.from(tokenSet)),
        },
        update: {
          value: JSON.stringify(Array.from(tokenSet)),
        },
      });
      console.log(`💾 [Push] ${tokenSet.size} tokens persistidos no banco de dados para a org ${organizationId}`);
    } catch (err: any) {
      console.warn('⚠️ [Push] Falha ao persistir token no banco:', err?.message || err);
    }
  }

  private async getTokensForOrg(organizationId: string): Promise<string[]> {
    let tokens = this.pushTokens.get(organizationId);
    if (!tokens || tokens.size === 0) {
      try {
        const { prisma } = await import('../../lib/prisma.js');
        const setting = await prisma.systemSetting.findUnique({
          where: {
            organizationId_key: {
              organizationId,
              key: 'push_tokens',
            },
          },
        });
        if (setting?.value) {
          const list: string[] = JSON.parse(setting.value);
          tokens = new Set(list);
          this.pushTokens.set(organizationId, tokens);
          console.log(`📥 [Push] ${list.length} tokens carregados do banco para org ${organizationId}`);
        }
      } catch (err: any) {
        console.warn('⚠️ [Push] Erro ao carregar tokens do banco:', err?.message || err);
      }
    }
    return tokens ? Array.from(tokens) : [];
  }

  // Notifica alerta sonoro/visual para os porteiros
  public async notifyAlert(organizationId: string, alert: Omit<RealtimeAlertPayload, 'timestamp'>) {
    const fullPayload: RealtimeAlertPayload = {
      ...alert,
      timestamp: new Date().toISOString(),
    };

    if (this.io) {
      this.io.to(`org_${organizationId}`).emit('notification:alert', fullPayload);
    }

    // Dispara Push Notification via Expo Push Service (para quando o app estiver fechado no APK)
    const tokenList = await this.getTokensForOrg(organizationId);
    if (tokenList.length > 0) {
      this.sendExpoPushNotifications(
        tokenList,
        alert.title,
        alert.message,
        {
          type: alert.type,
          visitRequestId: alert.visitRequestId,
        }
      );
    } else {
      console.log(`ℹ️ [Push] Nenhum dispositivo com push token cadastrado para org ${organizationId}`);
    }
  }

  private async sendExpoPushNotifications(tokens: string[], title: string, body: string, data: any) {
    try {
      const messages = tokens.map((to) => ({
        to,
        sound: 'default',
        title,
        body,
        data,
        priority: 'high',
        channelId: 'portaria-alerts',
        _displayInForeground: true,
      }));

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const resData = await response.json();
      console.log(`📲 [Push] Resposta do Expo Push para ${tokens.length} dispositivos:`, JSON.stringify(resData));
    } catch (err: any) {
      console.warn('⚠️ [Push] Erro ao despachar Expo Push Notification:', err?.message || err);
    }
  }

  // Notifica alteração no status de pareamento do WhatsApp
  public notifyWhatsAppStatus(organizationId: string, status: any) {
    if (!this.io) return;
    this.io.to(`org_${organizationId}`).emit('whatsapp:status', {
      ...status,
      emittedAt: new Date().toISOString(),
    });
  }

  // Emite evento genérico para a sala da organização
  public emitToOrganization(organizationId: string, event: string, payload: any) {
    if (!this.io) return;
    this.io.to(`org_${organizationId}`).emit(event, {
      ...payload,
      emittedAt: new Date().toISOString(),
    });
  }
}

export const realtimeService = RealtimeService.getInstance();
