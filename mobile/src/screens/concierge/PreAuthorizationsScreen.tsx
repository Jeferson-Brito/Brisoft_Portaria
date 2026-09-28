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
  CirclePlus,
  Clock,
  Building,
  User,
  CircleCheck,
  Calendar,
  Briefcase,
  ShieldCheck,
  UserCheck,
  ArrowLeft,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { api } from '../../config/api';
import { useRealtime } from '../../contexts/RealtimeContext';
import { NewPreAuthorizationModal } from './NewPreAuthorizationModal';
import { AppHeader } from '../../components/AppHeader';
import { ScrollToTopButton } from '../../components/ScrollToTopButton';

interface PreAuthorizationsScreenProps {
  onBack?: () => void;
}

interface PreAuthItem {
  id: string;
  visitorName: string;
  visitorDocument?: string;
  company?: string;
  phone?: string;
  visitorType: string;
  startDate: string;
  endDate: string;
  expectedTimeStart?: string;
  expectedTimeEnd?: string;
  notes?: string;
  isUsed: boolean;
  client: {
    name: string;
    whatsappNumber: string;
  };
  destination: {
    name: string;
    block?: string;
    unitNumber?: string;
  };
}

export const PreAuthorizationsScreen: React.FC<PreAuthorizationsScreenProps> = ({ onBack }) => {
  const [items, setItems] = useState<PreAuthItem[]>([]);
  const listRef = useRef<FlatList>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const { addListener } = useRealtime();

  const fetchPreAuthorizations = useCallback(async () => {
    try {
      const url = search.trim()
        ? `/pre-authorizations/today?q=${encodeURIComponent(search.trim())}`
        : '/pre-authorizations/today';
      const res = await api.get(url);
      if (res.data.success) {
        setItems(res.data.data.items || []);
      }
    } catch (err: any) {
      console.warn('Erro ao buscar pré-autorizações:', err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    fetchPreAuthorizations();

    // Sincronização em tempo real (Fase 6 & 7)
    const unsub = addListener('visit_request:created', () => {
      fetchPreAuthorizations();
    });

    return () => {
      unsub();
    };
  }, [fetchPreAuthorizations, addListener]);

  const handleSearchSubmit = () => {
    setIsLoading(true);
    fetchPreAuthorizations();
  };

  const handleCheckIn = (item: PreAuthItem) => {
    Alert.alert(
      'Liberar Entrada Pré-Autorizada',
      `Confirma a entrada do visitante ${item.visitorName} para ${item.destination.name}?\n\nAutorizado previamente por: ${item.client.name}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Liberar Entrada Agora',
          onPress: async () => {
            try {
              setCheckingInId(item.id);
              const res = await api.post(`/pre-authorizations/${item.id}/checkin`, {
                notes: 'Entrada liberada na portaria com base em pré-autorização',
              });

              if (res.data.success) {
                Alert.alert(
                  'Entrada Liberada! 🟢',
                  `Acesso de ${item.visitorName} registrado com status AUTORIZADO com sucesso!`
                );
                fetchPreAuthorizations();
              }
            } catch (err: any) {
              Alert.alert('Erro', err.response?.data?.error?.message || 'Falha ao liberar entrada.');
            } finally {
              setCheckingInId(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: PreAuthItem }) => {
    const isProcessing = checkingInId === item.id;

    return (
      <View style={styles.card}>
        {/* Header do Card */}
        <View style={styles.cardHeader}>
          <View style={styles.badgePreAuth}>
            <ShieldCheck size={14} color={colors.statusPending} style={{ marginRight: 4 }} />
            <Text style={styles.badgePreAuthText}>PRÉ-AUTORIZADO</Text>
          </View>

          <Text style={styles.visitorTypeBadge}>{item.visitorType}</Text>
        </View>

        {/* Nome do Visitante */}
        <Text style={styles.visitorName}>{item.visitorName}</Text>

        {/* Empresa ou Documento */}
        {(item.company || item.visitorDocument) && (
          <View style={styles.metaRow}>
            {item.company && (
              <View style={styles.metaItem}>
                <Briefcase size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
                <Text style={styles.metaText}>{item.company}</Text>
              </View>
            )}
            {item.visitorDocument && (
              <View style={styles.metaItem}>
                <User size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
                <Text style={styles.metaText}>Doc: {item.visitorDocument}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.divider} />

        {/* Destino e Morador */}
        <View style={styles.destinationRow}>
          <Building size={16} color={colors.primaryLight} style={{ marginRight: 6 }} />
          <Text style={styles.destinationName}>{item.destination.name}</Text>
          <Text style={styles.clientName}> • Morador: {item.client.name}</Text>
        </View>

        {/* Horário Previsto */}
        {(item.expectedTimeStart || item.expectedTimeEnd) && (
          <View style={styles.timeRow}>
            <Clock size={14} color={colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={styles.timeText}>
              Horário previsto: {item.expectedTimeStart || '--:--'} às {item.expectedTimeEnd || '--:--'}
            </Text>
          </View>
        )}

        {/* Observações */}
        {item.notes && (
          <Text style={styles.notesText}>Obs: "{item.notes}"</Text>
        )}

        {/* Botão de Liberação Instantânea */}
        <TouchableOpacity
          style={styles.checkInButton}
          onPress={() => handleCheckIn(item)}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <CircleCheck size={18} color={colors.white} style={{ marginRight: 8 }} />
              <Text style={styles.checkInButtonText}>LIBERAR ENTRADA IMEDIATA</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Agendamentos"
        onBack={onBack}
        badge={items.length}
      />

      {/* Barra de Busca */}
      <View style={styles.topActionsRow}>
        <View style={styles.searchBar}>
          <Search size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por visitante, empresa..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Botão + Novo Agendamento (Logo abaixo da busca, largo e grande no padrão das demais telas) */}
      <View style={styles.topBtnRow}>
        <TouchableOpacity
          style={styles.newAppointmentBtn}
          onPress={() => setIsModalOpen(true)}
          activeOpacity={0.85}
        >
          <CirclePlus size={20} color={colors.white} style={{ marginRight: 8 }} />
          <Text style={styles.newAppointmentBtnText}>Novo Agendamento</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de Pré-Autorizações */}
      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primaryLight} />
            <Text style={styles.loadingText}>Carregando agendamentos de hoje...</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={items}
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
                  fetchPreAuthorizations();
                }}
                tintColor={colors.primaryLight}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <UserCheck size={48} color={colors.textSecondary} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyTitle}>Nenhum agendamento ativo hoje</Text>
                <Text style={styles.emptySubtitle}>
                  Quando os moradores comunicarem visitas antecipadas, elas aparecerão aqui para liberação rápida.
                </Text>
              </View>
            }
          />
        )}
        <ScrollToTopButton
          visible={showScrollTop}
          onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
          bottom={24}
        />
      </View>

      {/* Modal de Nova Pré-Autorização */}
      <NewPreAuthorizationModal
        visible={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => fetchPreAuthorizations()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topActionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: colors.surface,
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
  topBtnRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  newAppointmentBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  newAppointmentBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
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
    marginBottom: 8,
  },
  badgePreAuth: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgePreAuthText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.statusPending,
    letterSpacing: 0.5,
  },
  visitorTypeBadge: {
    fontSize: 11,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
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
    gap: 12,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
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
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  timeText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  notesText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  checkInButton: {
    backgroundColor: colors.statusAuthorized,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  checkInButtonText: {
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
