import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Image,
  Modal,
  ScrollView,
} from 'react-native';
import {
  History,
  Search,
  Building,
  User,
  Car,
  Clock,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Users,
  LogOut,
  FileText,
  X,
  Phone,
  Calendar,
  AlertCircle,
  Tag,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { api } from '../../config/api';
import { useRealtime } from '../../contexts/RealtimeContext';
import { AppHeader } from '../../components/AppHeader';
import { ScrollToTopButton } from '../../components/ScrollToTopButton';
import { getPhotoSource } from '../../utils/photo';

export interface HistoryVisitorItem {
  id: string;
  code: string;
  status: 'PENDING' | 'AUTHORIZED' | 'DENIED' | 'ENTERED' | 'EXITED' | 'CANCELLED' | 'EXPIRED';
  visitorType: string;
  visitReason: string;
  notes?: string;
  createdAt: string;
  answeredAt?: string;
  entryAt?: string;
  exitAt?: string;
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
    documentType?: string;
    documentNumber?: string;
    phone?: string;
    photoUrl?: string;
  };
  vehicle?: {
    model: string;
    color?: string;
    licensePlate?: string;
  };
  conciergeUser?: {
    id: string;
    name: string;
  };
}

const STATUS_FILTERS = [
  { key: 'ALL', label: 'Todos' },
  { key: 'PENDING', label: 'Aguardando' },
  { key: 'AUTHORIZED', label: 'Autorizados' },
  { key: 'ENTERED', label: 'No Local' },
  { key: 'EXITED', label: 'Finalizados' },
  { key: 'DENIED', label: 'Recusados' },
  { key: 'CANCELLED', label: 'Cancelados' },
];

export const VisitorHistoryScreen: React.FC = () => {
  const [items, setItems] = useState<HistoryVisitorItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<HistoryVisitorItem | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const listRef = useRef<FlatList>(null);
  const { addListener } = useRealtime();

  const fetchHistory = useCallback(async () => {
    try {
      const params: any = {
        limit: 100,
      };
      if (selectedStatus !== 'ALL') {
        params.status = selectedStatus;
      }
      if (search.trim()) {
        params.search = search.trim();
      }

      const res = await api.get('/visit-requests/history', { params });
      if (res.data?.success && res.data?.data) {
        setItems(res.data.data.requests || []);
        setTotalCount(res.data.data.meta?.total || (res.data.data.requests || []).length);
      }
    } catch (err: any) {
      console.warn('Erro ao carregar histórico de solicitações:', err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedStatus, search]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Atualização em tempo real de novas solicitações ou mudanças de status
  useEffect(() => {
    const unsubCreated = addListener('visit-request:created', () => fetchHistory());
    const unsubUpdated = addListener('visit-request:updated', () => fetchHistory());

    return () => {
      unsubCreated();
      unsubUpdated();
    };
  }, [addListener, fetchHistory]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return {
          bg: '#FEF3C7',
          color: '#D97706',
          label: 'Aguardando',
          icon: <Clock size={12} color="#D97706" style={{ marginRight: 4 }} />,
        };
      case 'AUTHORIZED':
        return {
          bg: '#D1FAE5',
          color: '#059669',
          label: 'Autorizado',
          icon: <ShieldCheck size={12} color="#059669" style={{ marginRight: 4 }} />,
        };
      case 'ENTERED':
        return {
          bg: '#DBEAFE',
          color: '#2563EB',
          label: 'No Local',
          icon: <Users size={12} color="#2563EB" style={{ marginRight: 4 }} />,
        };
      case 'EXITED':
        return {
          bg: '#F1F5F9',
          color: '#475569',
          label: 'Finalizado',
          icon: <CheckCircle size={12} color="#475569" style={{ marginRight: 4 }} />,
        };
      case 'DENIED':
        return {
          bg: '#FFE4E6',
          color: '#E11D48',
          label: 'Recusado',
          icon: <XCircle size={12} color="#E11D48" style={{ marginRight: 4 }} />,
        };
      case 'CANCELLED':
        return {
          bg: '#F3F4F6',
          color: '#6B7280',
          label: 'Cancelado',
          icon: <AlertCircle size={12} color="#6B7280" style={{ marginRight: 4 }} />,
        };
      case 'EXPIRED':
        return {
          bg: '#F3F4F6',
          color: '#9CA3AF',
          label: 'Expirado',
          icon: <Clock size={12} color="#9CA3AF" style={{ marginRight: 4 }} />,
        };
      default:
        return {
          bg: '#F1F5F9',
          color: '#64748B',
          label: status,
          icon: null,
        };
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '--:--';
    const date = new Date(dateStr);
    return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const renderItem = ({ item }: { item: HistoryVisitorItem }) => {
    const statusCfg = getStatusBadge(item.status);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.88}
        onPress={() => setSelectedDetail(item)}
      >
        {/* Topo do Card: Código e Status Badge */}
        <View style={styles.cardHeader}>
          <View style={styles.codeRow}>
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>{item.code}</Text>
            </View>
            <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
            {statusCfg.icon}
            <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>
              {statusCfg.label}
            </Text>
          </View>
        </View>

        {/* Informações Centrais: Foto e Dados do Visitante */}
        <View style={styles.cardBody}>
          {getPhotoSource(item.visitor.photoUrl) ? (
            <Image source={getPhotoSource(item.visitor.photoUrl)!} style={styles.visitorAvatar} />
          ) : (
            <View style={styles.visitorAvatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {item.visitor.name ? item.visitor.name[0].toUpperCase() : 'V'}
              </Text>
            </View>
          )}

          <View style={styles.visitorInfo}>
            <Text style={styles.visitorName} numberOfLines={1}>
              {item.visitor.name}
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{item.visitorType}</Text>
              </View>
              {item.visitor.company ? (
                <Text style={styles.companyText} numberOfLines={1}>
                  • {item.visitor.company}
                </Text>
              ) : null}
            </View>

            <View style={styles.destinationRow}>
              <Building size={14} color="#059669" style={{ marginRight: 4 }} />
              <Text style={styles.destinationText} numberOfLines={1}>
                {item.destination.name}
                {item.destination.block ? ` - ${item.destination.block}` : ''}
              </Text>
              <Text style={styles.clientText} numberOfLines={1}>
                {' '}({item.client.name})
              </Text>
            </View>
          </View>
        </View>

        {/* Rodapé do Card: Veículo, Obs e Porteiro */}
        <View style={styles.cardFooter}>
          {item.vehicle?.model ? (
            <View style={styles.tagItem}>
              <Car size={13} color="#64748B" style={{ marginRight: 4 }} />
              <Text style={styles.tagText}>
                {item.vehicle.model}
                {item.vehicle.licensePlate ? ` • ${item.vehicle.licensePlate}` : ''}
              </Text>
            </View>
          ) : null}

          {item.notes ? (
            <View style={[styles.tagItem, styles.tagNote]}>
              <FileText size={12} color="#0D9488" style={{ marginRight: 4 }} />
              <Text style={styles.tagNoteText} numberOfLines={1}>
                "{item.notes}"
              </Text>
            </View>
          ) : null}

          {item.conciergeUser?.name ? (
            <Text style={styles.operatorText} numberOfLines={1}>
              Portaria: {item.conciergeUser.name}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Histórico"
        subtitle="Todas as solicitações de visitantes"
        badge={totalCount}
      />

      {/* Barra de Busca */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Search size={18} color="#94A3B8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por visitante, morador, unidade, placa..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={fetchHistory}
            returnKeyType="search"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={16} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filtros de Status (Pills) */}
      <View style={styles.filterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
        >
          {STATUS_FILTERS.map((f) => {
            const isSelected = selectedStatus === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => setSelectedStatus(f.key)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Lista de Solicitações */}
      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#165337" />
            <Text style={styles.loadingText}>Carregando histórico completo...</Text>
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
                  fetchHistory();
                }}
                tintColor="#165337"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <History size={48} color="#CBD5E1" style={{ marginBottom: 12 }} />
                <Text style={styles.emptyTitle}>Nenhuma solicitação encontrada</Text>
                <Text style={styles.emptySubtitle}>
                  {search || selectedStatus !== 'ALL'
                    ? 'Nenhum resultado corresponde aos filtros aplicados.'
                    : 'Todas as solicitações de visitantes criadas na portaria aparecerão aqui para consulta.'}
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

      {/* MODAL DE DETALHES COMPLETOS DA SOLICITAÇÃO */}
      <Modal
        visible={!!selectedDetail}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedDetail(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header Modal */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Detalhes da Solicitação</Text>
                <Text style={styles.modalSubtitle}>{selectedDetail?.code}</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedDetail(null)}
              >
                <X size={20} color="#334155" />
              </TouchableOpacity>
            </View>

            {selectedDetail && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
              >
                {/* Foto Ampliada (se houver) */}
                {getPhotoSource(selectedDetail.visitor.photoUrl) ? (
                  <View style={styles.modalPhotoContainer}>
                    <Image
                      source={getPhotoSource(selectedDetail.visitor.photoUrl)!}
                      style={styles.modalPhoto}
                      resizeMode="cover"
                    />
                    <View style={styles.modalPhotoBadge}>
                      <Text style={styles.modalPhotoBadgeText}>Foto Registrada na Portaria</Text>
                    </View>
                  </View>
                ) : null}

                {/* Status Badge */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Status Atual</Text>
                  {(() => {
                    const badge = getStatusBadge(selectedDetail.status);
                    return (
                      <View style={[styles.detailStatusRow, { backgroundColor: badge.bg }]}>
                        {badge.icon}
                        <Text style={[styles.detailStatusText, { color: badge.color }]}>
                          {badge.label}
                        </Text>
                      </View>
                    );
                  })()}
                </View>

                {/* Dados do Visitante */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Visitante</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Nome:</Text>
                    <Text style={styles.detailValueBold}>{selectedDetail.visitor.name}</Text>
                  </View>
                  {selectedDetail.visitor.documentNumber ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Documento:</Text>
                      <Text style={styles.detailValue}>
                        {selectedDetail.visitor.documentType || 'DOC'}: {selectedDetail.visitor.documentNumber}
                      </Text>
                    </View>
                  ) : null}
                  {selectedDetail.visitor.phone ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Telefone:</Text>
                      <Text style={styles.detailValue}>{selectedDetail.visitor.phone}</Text>
                    </View>
                  ) : null}
                  {selectedDetail.visitor.company ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Empresa:</Text>
                      <Text style={styles.detailValue}>{selectedDetail.visitor.company}</Text>
                    </View>
                  ) : null}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Tipo:</Text>
                    <Text style={styles.detailValue}>{selectedDetail.visitorType}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Motivo:</Text>
                    <Text style={styles.detailValue}>{selectedDetail.visitReason}</Text>
                  </View>
                </View>

                {/* Destino & Morador */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Unidade / Destino</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Unidade:</Text>
                    <Text style={styles.detailValueBold}>
                      {selectedDetail.destination.name}
                      {selectedDetail.destination.block ? ` - ${selectedDetail.destination.block}` : ''}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Morador:</Text>
                    <Text style={styles.detailValue}>{selectedDetail.client.name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>WhatsApp:</Text>
                    <Text style={styles.detailValue}>{selectedDetail.client.whatsappNumber}</Text>
                  </View>
                </View>

                {/* Veículo */}
                {selectedDetail.vehicle?.model ? (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Veículo</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Modelo:</Text>
                      <Text style={styles.detailValue}>{selectedDetail.vehicle.model}</Text>
                    </View>
                    {selectedDetail.vehicle.licensePlate ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Placa:</Text>
                        <Text style={styles.detailValueBold}>{selectedDetail.vehicle.licensePlate}</Text>
                      </View>
                    ) : null}
                    {selectedDetail.vehicle.color ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Cor:</Text>
                        <Text style={styles.detailValue}>{selectedDetail.vehicle.color}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* Observações */}
                {selectedDetail.notes ? (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Observação / Informações</Text>
                    <View style={styles.notesBox}>
                      <Text style={styles.notesText}>{selectedDetail.notes}</Text>
                    </View>
                  </View>
                ) : null}

                {/* Datas e Operador */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Registro & Auditoria</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Criada em:</Text>
                    <Text style={styles.detailValue}>{formatDate(selectedDetail.createdAt)}</Text>
                  </View>
                  {selectedDetail.answeredAt ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Resposta WhatsApp:</Text>
                      <Text style={styles.detailValue}>{formatDate(selectedDetail.answeredAt)}</Text>
                    </View>
                  ) : null}
                  {selectedDetail.entryAt ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Entrada Portaria:</Text>
                      <Text style={styles.detailValue}>{formatDate(selectedDetail.entryAt)}</Text>
                    </View>
                  ) : null}
                  {selectedDetail.exitAt ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Saída Portaria:</Text>
                      <Text style={styles.detailValue}>{formatDate(selectedDetail.exitAt)}</Text>
                    </View>
                  ) : null}
                  {selectedDetail.conciergeUser?.name ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Porteiro:</Text>
                      <Text style={styles.detailValueBold}>{selectedDetail.conciergeUser.name}</Text>
                    </View>
                  ) : null}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
    padding: 0,
  },
  filterWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 10,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#165337',
    borderColor: '#165337',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 19,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  visitorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: '#E2E8F0',
  },
  visitorAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '800',
    color: '#475569',
  },
  visitorInfo: {
    flex: 1,
  },
  visitorName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  typeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginRight: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  companyText: {
    fontSize: 11,
    color: '#64748B',
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  destinationText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  clientText: {
    fontSize: 12,
    color: '#64748B',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  tagNote: {
    backgroundColor: '#F0FDFA',
  },
  tagNoteText: {
    fontSize: 11,
    color: '#0D9488',
    fontStyle: 'italic',
    maxWidth: 220,
  },
  operatorText: {
    fontSize: 10,
    color: '#94A3B8',
    marginLeft: 'auto',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPhotoContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  modalPhoto: {
    width: '100%',
    height: 200,
  },
  modalPhotoBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modalPhotoBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  modalSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  detailValue: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '500',
    maxWidth: '65%',
    textAlign: 'right',
  },
  detailValueBold: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
    maxWidth: '65%',
    textAlign: 'right',
  },
  detailStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  detailStatusText: {
    fontSize: 13,
    fontWeight: '800',
  },
  notesBox: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notesText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
});
