import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  Clock,
  Send,
  Building,
  User,
  Car,
  CircleCheck,
  CircleX,
  AlertTriangle,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { api } from '../../config/api';
import { useRealtime } from '../../contexts/RealtimeContext';
import { useForegroundRefresh } from '../../hooks/useForegroundRefresh';
import { readScreenCache, writeScreenCache } from '../../utils/screenCache';
import { AppHeader } from '../../components/AppHeader';
import { ScrollToTopButton } from '../../components/ScrollToTopButton';
import { ReleaseCancelled, releaseWithRestrictionCheck } from '../../utils/release';

export interface PendingRequestItem {
  id: string;
  code: string;
  status: string;
  visitorType: string;
  visitReason: string;
  waitingTimeSeconds: number;
  waitingTimeFormatted: string;
  remindersSentCount: number;
  createdAt: string;
  client: {
    id: string;
    name: string;
    whatsappNumber: string;
  };
  destination: {
    id: string;
    name: string;
    block?: string;
  };
  visitor: {
    id: string;
    name: string;
    company?: string;
  };
  vehicle?: {
    model: string;
    color?: string;
    licensePlate?: string;
  };
  conciergeUser: {
    name: string;
  };
}

export const OpenRequestsScreen: React.FC<{
  hideHeader?: boolean;
  headerRightAction?: React.ReactNode;
}> = ({ hideHeader = false, headerRightAction }) => {
  const cached = readScreenCache<PendingRequestItem[]>('pending');
  const [requests, setRequests] = useState<PendingRequestItem[]>(cached || []);
  const listRef = useRef<FlatList>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isLoading, setIsLoading] = useState(!cached);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { addListener, isConnected } = useRealtime();

  const fetchPendingRequests = async () => {
    try {
      const response = await api.get('/visit-requests/pending');
      const list = response.data.data.requests || [];
      writeScreenCache('pending', list);
      setRequests(list);
    } catch (err) {
      console.warn('Erro ao carregar solicitações em aberto:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPendingRequests();

    // Sincronização instantânea via WebSocket (Fase 6)
    const unsubCreated = addListener('visit_request:created', () => {
      fetchPendingRequests();
    });

    const unsubUpdated = addListener('visit_request:updated', (updated) => {
      if (updated.status !== 'PENDING') {
        setRequests((curr) => curr.filter((r) => r.id !== updated.id && r.id !== updated.requestId));
      }
      fetchPendingRequests();
    });

    return () => {
      unsubCreated();
      unsubUpdated();
    };
  }, [addListener]);

  useForegroundRefresh(fetchPendingRequests, 120000);

  const handleRemind = async (item: PendingRequestItem) => {
    if (item.remindersSentCount >= 3) {
      Alert.alert('Limite Atingido', 'O limite de 3 lembretes já foi atingido para esta solicitação.');
      return;
    }

    try {
      await api.post(`/visit-requests/${item.id}/remind`);
      Alert.alert(
        'Lembrete Reenviado! ⏳',
        `Mensagem de reforço despachada para o WhatsApp de ${item.client.name}.`
      );
      fetchPendingRequests();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error?.message || 'Falha ao reenviar lembrete.');
    }
  };

  const handleCancel = (item: PendingRequestItem) => {
    Alert.alert(
      'Cancelar Solicitação',
      `Deseja realmente cancelar a visita de ${item.visitor.name}?`,
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, Cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/visit-requests/${item.id}/cancel`, {
                reason: 'Cancelado pelo porteiro',
              });
              fetchPendingRequests();
            } catch (err: any) {
              Alert.alert('Erro', 'Não foi possível cancelar a solicitação.');
            }
          },
        },
      ]
    );
  };

  const handleManualAuthorize = (item: PendingRequestItem) => {
    Alert.alert(
      'Autorização Manual',
      `Confirmar liberação de entrada para ${item.visitor.name} por contato telefônico ou contingência?`,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Confirmar Liberação',
          onPress: async () => {
            try {
              await releaseWithRestrictionCheck(`/visit-requests/${item.id}/authorize-manual`, {
                reason: 'Contato telefônico com o morador',
              });
              Alert.alert(
                'Visita Autorizada! 🟢',
                `A visita de ${item.visitor.name} foi autorizada com sucesso.\n\nDeseja registrar a entrada física agora?`,
                [
                  {
                    text: 'Apenas Autorizar',
                    style: 'cancel',
                    onPress: () => fetchPendingRequests(),
                  },
                  {
                    text: 'Registrar Entrada Agora',
                    onPress: async () => {
                      try {
                        await releaseWithRestrictionCheck(`/visit-requests/${item.id}/entry`, {
                          reason: 'Entrada física registrada imediatamente após autorização manual',
                        });
                        Alert.alert('Entrada Concluída! 🟢', `Visitante ${item.visitor.name} está presente no local.`);
                        fetchPendingRequests();
                      } catch (entryErr: any) {
                        if (entryErr instanceof ReleaseCancelled) {
                          fetchPendingRequests();
                          return;
                        }
                        Alert.alert(
                          'Aviso',
                          'Visita autorizada, mas falha ao registrar entrada: ' +
                            (entryErr.response?.data?.error?.message || entryErr.message)
                        );
                        fetchPendingRequests();
                      }
                    },
                  },
                ]
              );
            } catch (err: any) {
              if (err instanceof ReleaseCancelled) return;
              Alert.alert('Erro', err.response?.data?.error?.message || 'Não foi possível autorizar.');
            }
          },
        },
      ]
    );
  };

  const handleRegisterEntry = (item: PendingRequestItem) => {
    Alert.alert(
      'Registrar Entrada',
      `Confirmar que o visitante ${item.visitor.name} passou pela portaria e entrou no local?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar Entrada',
          onPress: async () => {
            try {
              await releaseWithRestrictionCheck(`/visit-requests/${item.id}/entry`, {
                reason: 'Entrada física registrada na portaria',
              });
              Alert.alert('Entrada Registrada! 🟢', `Visitante ${item.visitor.name} está presente no local.`);
              fetchPendingRequests();
            } catch (err: any) {
              if (err instanceof ReleaseCancelled) return;
              Alert.alert('Erro', err.response?.data?.error?.message || 'Falha ao registrar entrada.');
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        {!hideHeader && (
          <AppHeader
            title="Aguardando Autorização"
            subtitle="Solicitações pendentes de liberação no WhatsApp"
            rightAction={headerRightAction}
          />
        )}
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando solicitações em aberto...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!hideHeader && (
        <AppHeader
          title="Aguardando Autorização"
          subtitle="Solicitações pendentes de liberação no WhatsApp"
          badge={requests.length}
          rightAction={headerRightAction}
        />
      )}
      <FlatList
        ref={listRef}
        data={requests}
        keyExtractor={(item) => item.id}
        scrollEnabled={!hideHeader}
        scrollEventThrottle={16}
        onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 150)}
        refreshControl={
          !hideHeader ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                fetchPendingRequests();
              }}
              tintColor={colors.primaryLight}
            />
          ) : undefined
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <CircleCheck size={48} color={colors.statusAuthorized} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>Tudo em dia!</Text>
            <Text style={styles.emptySubtitle}>
              Não há nenhuma solicitação aguardando autorização no momento.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            {/* Card Header: Código + Timer de Espera */}
            <View style={styles.cardHeader}>
              <View style={styles.codeBadge}>
                <Text style={styles.codeText}>{item.code}</Text>
              </View>

              <View style={styles.timerBadge}>
                <Clock size={14} color={colors.statusPending} style={{ marginRight: 4 }} />
                <Text style={styles.timerText}>Aguardando há {item.waitingTimeFormatted}</Text>
              </View>
            </View>

            {/* Unidade & Morador */}
            <View style={styles.destinationRow}>
              <Building size={16} color={colors.primaryLight} style={{ marginRight: 6 }} />
              <Text style={styles.destinationName}>{item.destination.name}</Text>
              <Text style={styles.clientName}> — {item.client.name}</Text>
            </View>

            {/* Visitante */}
            <View style={styles.detailRow}>
              <User size={15} color={colors.textSecondary} style={{ marginRight: 6 }} />
              <Text style={styles.visitorName}>{item.visitor.name}</Text>
              {item.visitor.company ? (
                <Text style={styles.companyName}> ({item.visitor.company})</Text>
              ) : null}
            </View>

            {/* Veículo (se houver) */}
            {item.vehicle ? (
              <View style={styles.detailRow}>
                <Car size={15} color={colors.textSecondary} style={{ marginRight: 6 }} />
                <Text style={styles.vehicleText}>
                  {item.vehicle.model} • Placa: {item.vehicle.licensePlate || 'N/A'}
                </Text>
              </View>
            ) : null}

            {/* Porteiro Responsável */}
            <Text style={styles.conciergeFooter}>Porteiro: {item.conciergeUser.name}</Text>

            {/* Barra de Ações Rápidas */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[
                  styles.remindButton,
                  item.remindersSentCount >= 3 && styles.btnDisabled,
                ]}
                onPress={() => handleRemind(item)}
                activeOpacity={0.8}
              >
                <Send size={15} color={colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.remindButtonText}>
                  Reenviar ({item.remindersSentCount}/3)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.authorizeButton}
                onPress={() => handleManualAuthorize(item)}
                activeOpacity={0.8}
              >
                <CircleCheck size={15} color={colors.white} style={{ marginRight: 4 }} />
                <Text style={styles.authorizeButtonText}>Liberar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => handleCancel(item)}
                activeOpacity={0.8}
              >
                <CircleX size={15} color={colors.statusDenied} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
      <ScrollToTopButton
        visible={showScrollTop}
        onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
        bottom={115}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.statusPending, // Indicador 🟡
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  codeBadge: {
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  codeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.statusPendingBg,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.statusPending,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  destinationName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryLight,
  },
  clientName: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  visitorName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  companyName: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  vehicleText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  conciergeFooter: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  remindButton: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remindButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  authorizeButton: {
    flex: 1.5,
    backgroundColor: colors.statusAuthorized,
    borderRadius: 8,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorizeButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.statusDeniedBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
