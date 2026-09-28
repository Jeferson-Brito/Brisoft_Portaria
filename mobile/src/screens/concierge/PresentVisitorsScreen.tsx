import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  Search,
  Users,
  Clock,
  Building,
  User,
  LogOut,
  Car,
  Briefcase,
  CircleCheck,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { api } from '../../config/api';
import { useRealtime } from '../../contexts/RealtimeContext';
import { AppHeader } from '../../components/AppHeader';
import { ScrollToTopButton } from '../../components/ScrollToTopButton';

interface PresentVisitorItem {
  id: string;
  code: string;
  status: string;
  visitorType: string;
  visitReason: string;
  notes?: string;
  entryAt: string;
  stayDurationSeconds: number;
  stayDurationFormatted: string;
  visitor: {
    name: string;
    documentNumber?: string;
    company?: string;
    phone?: string;
  };
  client: {
    name: string;
    whatsappNumber: string;
  };
  destination: {
    name: string;
    block?: string;
    unitNumber?: string;
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

export const PresentVisitorsScreen: React.FC = () => {
  const [visitors, setVisitors] = useState<PresentVisitorItem[]>([]);
  const listRef = useRef<FlatList>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [exitingId, setExitingId] = useState<string | null>(null);

  const { addListener } = useRealtime();

  const fetchPresentVisitors = useCallback(async () => {
    try {
      const url = search.trim()
        ? `/visit-requests/present?q=${encodeURIComponent(search.trim())}`
        : '/visit-requests/present';
      const res = await api.get(url);
      if (res.data.success) {
        setVisitors(res.data.data.visitors || []);
      }
    } catch (err: any) {
      console.warn('Erro ao buscar visitantes presentes:', err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    fetchPresentVisitors();

    // Sincronização em tempo real (Fase 6 & 8)
    const unsub = addListener('visit_request:updated', () => {
      fetchPresentVisitors();
    });

    // Atualiza o relógio de permanência a cada 10 segundos
    const interval = setInterval(fetchPresentVisitors, 10000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [fetchPresentVisitors, addListener]);

  const handleSearchSubmit = () => {
    setIsLoading(true);
    fetchPresentVisitors();
  };

  const handleRegisterExit = (item: PresentVisitorItem) => {
    Alert.alert(
      'Registrar Saída',
      `Confirma a saída do visitante ${item.visitor.name} (${item.destination.name})?\n\nTempo no local: ${item.stayDurationFormatted}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar Saída',
          style: 'destructive',
          onPress: async () => {
            try {
              setExitingId(item.id);
              const res = await api.post(`/visit-requests/${item.id}/exit`, {
                reason: 'Saída física registrada pela portaria',
              });

              if (res.data.success) {
                Alert.alert(
                  'Saída Registrada! 🚪',
                  `A saída de ${item.visitor.name} foi registrada com sucesso.`
                );
                // Remove da lista instantaneamente
                setVisitors((current) => current.filter((v) => v.id !== item.id));
                fetchPresentVisitors();
              }
            } catch (err: any) {
              Alert.alert('Erro', err.response?.data?.error?.message || 'Falha ao registrar saída.');
            } finally {
              setExitingId(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: PresentVisitorItem }) => {
    const isProcessing = exitingId === item.id;
    const entryTimeFormatted = new Date(item.entryAt).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={styles.card}>
        {/* Header do Card */}
        <View style={styles.cardHeader}>
          <View style={styles.badgePresent}>
            <Users size={14} color={colors.statusPresent} style={{ marginRight: 4 }} />
            <Text style={styles.badgePresentText}>PRESENTE NO LOCAL</Text>
          </View>

          <View style={styles.timerBadge}>
            <Clock size={13} color={colors.statusPresent} style={{ marginRight: 4 }} />
            <Text style={styles.timerText}>{item.stayDurationFormatted}</Text>
          </View>
        </View>

        {/* Nome do Visitante */}
        <Text style={styles.visitorName}>{item.visitor.name}</Text>

        {/* Metadados: Empresa, Doc, Tipo */}
        <View style={styles.metaRow}>
          {item.visitor.company && (
            <View style={styles.metaItem}>
              <Briefcase size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
              <Text style={styles.metaText}>{item.visitor.company}</Text>
            </View>
          )}
          {item.visitor.documentNumber && (
            <View style={styles.metaItem}>
              <User size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
              <Text style={styles.metaText}>{item.visitor.documentNumber}</Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Text style={styles.metaTextType}>{item.visitorType}</Text>
          </View>
        </View>

        {/* Veículo se houver */}
        {item.vehicle && (
          <View style={styles.vehicleRow}>
            <Car size={14} color={colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={styles.vehicleText}>
              {item.vehicle.model}
              {item.vehicle.color ? ` • ${item.vehicle.color}` : ''}
              {item.vehicle.licensePlate ? ` • Placa: ${item.vehicle.licensePlate}` : ''}
            </Text>
          </View>
        )}

        <View style={styles.divider} />

        {/* Destino e Morador */}
        <View style={styles.destinationRow}>
          <Building size={15} color={colors.primaryLight} style={{ marginRight: 6 }} />
          <Text style={styles.destinationName}>{item.destination.name}</Text>
          <Text style={styles.clientName}> • Morador: {item.client.name}</Text>
        </View>

        {/* Info de Entrada */}
        <Text style={styles.entryInfoText}>
          Entrada registrada às <Text style={{ color: colors.white, fontWeight: '700' }}>{entryTimeFormatted}</Text> por {item.conciergeUser.name}
        </Text>

        {/* Botão de Registro de Saída com 1 Toque */}
        <TouchableOpacity
          style={styles.exitButton}
          onPress={() => handleRegisterExit(item)}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <LogOut size={18} color={colors.white} style={{ marginRight: 8 }} />
              <Text style={styles.exitButtonText}>REGISTRAR SAÍDA</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Visitantes no Local"
        subtitle="Pessoas com entrada registrada atualmente presentes"
        badge={visitors.length}
      />

      {/* Barra de Busca e Contador */}
      <View style={styles.topBar}>
        <View style={styles.searchBar}>
          <Search size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por visitante, placa, unidade..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
        </View>

        <View style={styles.countBadge}>
          <Text style={styles.countText}>{visitors.length} presentes</Text>
        </View>
      </View>

      {/* Lista */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.statusPresent} />
          <Text style={styles.loadingText}>Carregando visitantes presentes...</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={visitors}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          scrollEventThrottle={16}
          onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 150)}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                fetchPresentVisitors();
              }}
              tintColor={colors.statusPresent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Users size={48} color={colors.textSecondary} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>Nenhum visitante presente no momento</Text>
              <Text style={styles.emptySubtitle}>
                Quando os visitantes tiverem a entrada registrada na portaria, eles serão listados aqui até que a saída seja efetuada.
              </Text>
            </View>
          }
        />
      )}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    padding: 0,
  },
  countBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  countText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.statusPresent,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgePresent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgePresentText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.statusPresent,
    letterSpacing: 0.5,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.statusPresent,
  },
  visitorName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  metaTextType: {
    fontSize: 11,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  vehicleText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  destinationName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  clientName: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  entryInfoText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  exitButton: {
    backgroundColor: '#DC2626', // Vermelho elegante para registrar saída
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  exitButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
