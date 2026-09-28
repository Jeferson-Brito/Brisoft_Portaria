import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Vibration, Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { getSocketUrl } from '../config/api';
import {
  registerForPushNotificationsAsync,
  triggerLocalAlertNotification,
} from '../services/notifications.service';

export interface RealtimeAlert {
  title: string;
  message: string;
  type: 'AUTHORIZED' | 'DENIED' | 'INFO' | 'WARNING';
  visitRequestId?: string;
  visitorName?: string;
  clientName?: string;
  destinationName?: string;
  timestamp: string;
}

export interface VisitRequestLiveEvent {
  id: string;
  code: string;
  status: string;
  visitorName?: string;
  clientName?: string;
  destinationName?: string;
  answeredAt?: string;
  emittedAt?: string;
}

interface RealtimeContextData {
  isConnected: boolean;
  activeAlert: RealtimeAlert | null;
  dismissAlert: () => void;
  lastEvent: { type: string; data: any } | null;
  addListener: (event: string, callback: (data: any) => void) => () => void;
}

const RealtimeContext = createContext<RealtimeContextData>({} as RealtimeContextData);

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [activeAlert, setActiveAlert] = useState<RealtimeAlert | null>(null);
  const [lastEvent, setLastEvent] = useState<{ type: string; data: any } | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  // Registrar callback para eventos em tempo real
  const addListener = useCallback((event: string, callback: (data: any) => void) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(callback);

    // Retorna função de unsubscribe
    return () => {
      listenersRef.current.get(event)?.delete(callback);
    };
  }, []);

  // Disparar callbacks registrados
  const notifyListeners = useCallback((event: string, data: any) => {
    const callbacks = listenersRef.current.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.warn(`Erro no callback do evento ${event}:`, e);
        }
      });
    }
  }, []);

  const dismissAlert = useCallback(() => {
    setActiveAlert(null);
  }, []);

  useEffect(() => {
    if (!user?.organizationId) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const socketUrl = getSocketUrl();
    console.log(`🔌 Conectando ao WebSocket em: ${socketUrl} (Org: ${user.organizationId})`);

    const socket = io(socketUrl, {
      query: {
        organizationId: user.organizationId,
        userId: user.id,
      },
      transports: ['polling', 'websocket'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2500,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ WebSocket conectado com sucesso! ID:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('⚠️ WebSocket desconectado:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      // Usar console.log em vez de console.warn para evitar LogBox amarelo no Expo Go durante reconexão
      console.log('🔄 [WebSocket] Reconectando...', err.message);
      setIsConnected(false);
    });

    // Evento: Nova solicitação criada
    socket.on('visit_request:created', (data: any) => {
      setLastEvent({ type: 'visit_request:created', data });
      notifyListeners('visit_request:created', data);
    });

    // Evento: Solicitação atualizada (Autorizada, Recusada, etc)
    socket.on('visit_request:updated', (data: VisitRequestLiveEvent) => {
      setLastEvent({ type: 'visit_request:updated', data });
      notifyListeners('visit_request:updated', data);
    });

    // Registra token para notificações push no aparelho
    registerForPushNotificationsAsync();

    // Evento: Alerta sonoro/visual para os porteiros
    socket.on('notification:alert', (alert: RealtimeAlert) => {
      setActiveAlert(alert);
      setLastEvent({ type: 'notification:alert', data: alert });
      notifyListeners('notification:alert', alert);

      // Dispara notificação nativa no sistema operacional (Android / iOS)
      triggerLocalAlertNotification(
        alert.title,
        alert.message,
        alert.type === 'AUTHORIZED'
      );

      // Vibração no celular do porteiro
      if (Platform.OS !== 'web') {
        if (alert.type === 'AUTHORIZED') {
          Vibration.vibrate([0, 250, 150, 250]);
        } else if (alert.type === 'DENIED') {
          Vibration.vibrate([0, 500, 200, 500]);
        }
      }

      // Auto-dispensar alerta após 12 segundos se não for clicado
      setTimeout(() => {
        setActiveAlert((current) => (current?.timestamp === alert.timestamp ? null : current));
      }, 12000);
    });

    // Evento: Status do WhatsApp alterado
    socket.on('whatsapp:status', (status: any) => {
      setLastEvent({ type: 'whatsapp:status', data: status });
      notifyListeners('whatsapp:status', status);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.organizationId, user?.id, notifyListeners]);

  return (
    <RealtimeContext.Provider
      value={{
        isConnected,
        activeAlert,
        dismissAlert,
        lastEvent,
        addListener,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime deve ser utilizado dentro de um RealtimeProvider');
  }
  return context;
};
