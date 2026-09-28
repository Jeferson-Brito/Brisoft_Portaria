import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native';
import {
  ShieldCheck,
  Building,
  User,
  Car,
  Clock,
  Search,
  LogIn,
  CheckCircle,
  Calendar,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { api } from '../../config/api';
import { useRealtime } from '../../contexts/RealtimeContext';
import { AppHeader } from '../../components/AppHeader';
import { ScrollToTopButton } from '../../components/ScrollToTopButton';

interface AuthorizedItem {
  id: string;
  code: string;
  status: string;
  visitorType: string;
  visitReason: string;
  createdAt: string;
  answeredAt?: string;
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
    documentNumber?: string;
  };
  vehicle?: {
    model: string;
    color?: string;
    licensePlate?: string;
  };
}

export const AuthorizedRequestsScreen: React.FC = () => {
  const [items, setItems] = useState<AuthorizedItem[]>([]);
  const listRef = useRef<FlatList>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { addListener } = useRealtime();

  const fetchAuthorized = useCallback(async () => {
    try {
      const res = await api.get('/visit-requests/history', {
        params: {
          status: 'AUTHORIZED',
          limit: 50,
          search: search.trim() || undefined,
        },
      });

      if (res.data?.success && res.data?.data?.requests) {
        setItems(res.data.data.requests);
      }
    } catch (err: any) {
      console.warn('Erro ao buscar autorizados:', err?.message || err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    fetchAuthorized();

    const unsubUpdated = addListener('visit_request:updated', fetchAuthorized);
    const unsubCreated = addListener('visit_request:created', fetchAuthorized);

    return () => {
      unsubUpdated();
      unsubCreated();
    };
  }, [fetchAuthorized, addListener]);

  const handleRegisterEntry = (item: AuthorizedItem) => {
    Alert.alert(
      'Registrar Entrada',
      `Confirmar a entrada de ${item.visitor.name} para ${item.destination.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar Entrada',
          onPress: async () => {
            try {
              setProcessingId(item.id);
              await api.post(`/visit-requests/${item.id}/entry`, {
                reason: 'Entrada física liberada na portaria',
              });
              Alert.alert('Sucesso', `Entrada de ${item.visitor.name} registrada com sucesso!`);
              fetchAuthorized();
            } catch (err: any) {
              Alert.alert('Erro', err.response?.data?.message || 'Falha ao registrar entrada.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: AuthorizedItem }) => {
    const isProcessing = processingId === item.id;
    const formattedTime = new Date(item.answeredAt || item.createdAt).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={styles.card}>
        {/* Header do Card */}
        <View style={styles.cardHeader}>
          <View style={styles.badgeAuth}>
            <ShieldCheck size={14} color="#16A34A" style={{ marginRight: 4 }} />
            <Text style={styles.badgeAuthText}>AUTORIZADO</Text>
          </View>
          <Text style={styles.codeText}>{item.code}</Text>
        </View>

        {/* Nome do Visitante */}
        <Text style={styles.visitorName}>{item.visitor.name}</Text>

        {item.visitor.company && (
          <Text style={styles.companyText}>Empresa: {item.visitor.company}</Text>
        )}

        {/* Destino e Morador */}
        <View style={styles.destRow}>
          <Building size={16} color="#2563EB" style={{ marginRight: 6 }} />
          <Text style={styles.destText}>
            {item.destination.name} {item.destination.block ? `(${item.destination.block})` : ''}
          </Text>
          <Text style={styles.clientText}> • Morador: {item.client.name}</Text>
        </View>

        {/* Veículo (se houver) */}
        {item.vehicle?.model && (
          <View style={styles.metaRow}>
            <Car size={14} color="#64748B" style={{ marginRight: 6 }} />
            <Text style={styles.metaText}>
              {item.vehicle.model} {item.vehicle.licensePlate ? `• Placa ${item.vehicle.licensePlate}` : ''}
            </Text>
          </View>
        )}

        {/* Horário */}
        <View style={styles.metaRow}>
          <Clock size={14} color="#64748B" style={{ marginRight: 6 }} />
          <Text style={styles.metaText}>Autorizado às {formattedTime}</Text>
        </View>

        {/* Botão Registrar Entrada */}
        <TouchableOpacity
          style={styles.entryBtn}
          onPress={() => handleRegisterEntry(item)}
          disabled={isProcessing}
          activeOpacity={0.85}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <LogIn size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.entryBtnText}>REGISTRAR ENTRADA</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Visitas Autorizadas"
        subtitle="Liberados pelo morador aguardando entrada física"
        badge={items.length}
      />

      {/* Top Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={18} color="#94A3B8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por visitante, unidade..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={fetchAuthorized}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Lista */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#16A34A" />
          <Text style={styles.loadingText}>Carregando visitas autorizadas...</Text>
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
                fetchAuthorized();
              }}
              colors={['#16A34A']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <ShieldCheck size={48} color="#94A3B8" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>Nenhuma visita autorizada aguardando entrada</Text>
              <Text style={styles.emptySubtitle}>
                Assim que um morador responder "1" no WhatsApp, a visita autorizada aparecerá aqui para você registrar a entrada.
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
    backgroundColor: '#F8FAFC',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    borderLeftColor: '#16A34A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeAuth: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeAuthText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16A34A',
  },
  codeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  visitorName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  companyText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
  },
  destRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    marginTop: 4,
  },
  destText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  clientText: {
    fontSize: 13,
    color: '#64748B',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#64748B',
  },
  entryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 14,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  entryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
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
    color: '#334155',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});
