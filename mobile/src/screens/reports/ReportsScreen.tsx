import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Platform,
  StatusBar,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Clock,
  CircleCheck,
  CircleX,
  Users,
  ShieldCheck,
  TrendingUp,
  Building,
  AlertCircle,
  SlidersHorizontal,
  BarChart3,
  FileText,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { api } from '../../config/api';
import { readScreenCache, writeScreenCache } from '../../utils/screenCache';
import { AppHeader } from '../../components/AppHeader';
import { ScrollToTopButton } from '../../components/ScrollToTopButton';

type SubTab = 'metrics' | 'audit';
type DaysFilter = 1 | 7 | 30;

const DAYS_LABELS: Record<DaysFilter, string> = {
  1: 'Hoje',
  7: 'Últimos 7 dias',
  30: 'Últimos 30 dias',
};

export const ReportsScreen: React.FC = () => {
  const scrollRef = useRef<ScrollView>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [days, setDays] = useState<DaysFilter | 'custom'>(7);
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('metrics');
  const cached = readScreenCache<{ metrics: any; auditLogs: any[] }>('reports:7');
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<any>(cached?.metrics || null);
  const [auditLogs, setAuditLogs] = useState<any[]>(cached?.auditLogs || []);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const loadData = async () => {
    try {
      let url = `/reports/metrics?`;
      if (days === 'custom') {
        const start = startDateStr.split('/').reverse().join('-');
        const end = endDateStr ? endDateStr.split('/').reverse().join('-') : start;
        url += `startDate=${start}&endDate=${end}`;
      } else {
        url += `days=${days}`;
      }

      const cacheKey = `reports:${days === 'custom' ? url : days}`;
      const saved = readScreenCache<{ metrics: any; auditLogs: any[] }>(cacheKey);
      if (saved) {
        setMetrics(saved.metrics);
        setAuditLogs(saved.auditLogs);
      } else {
        setLoading(true);
      }

      const [metricsRes, auditRes] = await Promise.all([
        api.get(url),
        api.get('/audit/timeline?limit=30'),
      ]);
      const fresh = { metrics: metricsRes.data.data, auditLogs: auditRes.data.data || [] };
      writeScreenCache(cacheKey, fresh);
      setMetrics(fresh.metrics);
      setAuditLogs(fresh.auditLogs);
    } catch (err) {
      console.log('Erro ao carregar relatórios:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [days]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  return (
    <View style={styles.container}>
      {/* Header padrão do sistema */}
      <AppHeader title="Relatórios" subtitle="Performance e auditoria da portaria" />

      {/* Sub-tabs: Desempenho / Auditoria — abaixo do header */}
      <View style={styles.subTabBarContainer}>
        <TouchableOpacity
          style={[styles.subTab, activeSubTab === 'metrics' && styles.subTabActive]}
          onPress={() => setActiveSubTab('metrics')}
        >
          <BarChart3 size={15} color={activeSubTab === 'metrics' ? '#165337' : '#94A3B8'} style={{ marginRight: 6 }} />
          <Text style={[styles.subTabText, activeSubTab === 'metrics' && styles.subTabTextActive]}>
            Desempenho
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTab, activeSubTab === 'audit' && styles.subTabActive]}
          onPress={() => setActiveSubTab('audit')}
        >
          <FileText size={15} color={activeSubTab === 'audit' ? '#165337' : '#94A3B8'} style={{ marginRight: 6 }} />
          <Text style={[styles.subTabText, activeSubTab === 'audit' && styles.subTabTextActive]}>
            Auditoria
          </Text>
        </TouchableOpacity>
      </View>

      {/* Botão de filtro de período */}
      {activeSubTab === 'metrics' && (
        <View style={styles.filterBarRow}>
          <Text style={styles.filterBarLabel}>
            Período: <Text style={styles.filterBarValue}>
              {days === 'custom' ? `${startDateStr} ${endDateStr ? `até ${endDateStr}` : ''}` : DAYS_LABELS[days as DaysFilter]}
            </Text>
          </Text>
          <TouchableOpacity
            style={styles.filterBtn}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.8}
          >
            <SlidersHorizontal size={15} color="#165337" style={{ marginRight: 6 }} />
            <Text style={styles.filterBtnText}>Filtrar</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 150)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Calculando métricas operacionais...</Text>
          </View>
        ) : activeSubTab === 'metrics' ? (
          <>
            {/* Destaque: Tempo Médio de Resposta */}
            <View style={styles.heroCard}>
              <View style={styles.heroCardHeader}>
                <View style={styles.iconCirclePurple}>
                  <Clock size={20} color={colors.primary} />
                </View>
                <View style={styles.badgeSuccess}>
                  <TrendingUp size={12} color="#16A34A" />
                  <Text style={styles.badgeSuccessText}>WhatsApp Direto</Text>
                </View>
              </View>
              <Text style={styles.heroCardLabel}>Tempo Médio de Resposta</Text>
              <Text style={styles.heroCardValue}>
                {metrics?.performance?.averageResponseTimeFormatted || '0 s'}
              </Text>
              <Text style={styles.heroCardDescription}>
                Tempo que o morador leva entre receber a mensagem e responder com autorização ou recusa.
              </Text>
            </View>

            {/* Resumo Consolidado de Volumes */}
            <Text style={styles.sectionTitle}>Volume de Visitas ({days} dias)</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNum}>{metrics?.summary?.total ?? 0}</Text>
                <Text style={styles.summaryTxt}>Total</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNum, { color: '#10B981' }]}>
                  {metrics?.summary?.authorized ?? 0}
                </Text>
                <Text style={styles.summaryTxt}>Autorizados</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNum, { color: '#EF4444' }]}>
                  {metrics?.summary?.denied ?? 0}
                </Text>
                <Text style={styles.summaryTxt}>Recusados</Text>
              </View>
            </View>

            {/* Distribuição por Período */}
            <Text style={styles.sectionTitle}>Horários de Maior Movimento</Text>
            <View style={styles.periodCard}>
              <View style={styles.periodRow}>
                <Text style={styles.periodName}>Manhã (06h - 12h)</Text>
                <Text style={styles.periodCount}>{metrics?.periodBreakdown?.morning ?? 0} visitas</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(
                        100,
                        ((metrics?.periodBreakdown?.morning ?? 0) /
                          Math.max(1, metrics?.summary?.total ?? 1)) *
                          100
                      )}%`,
                    },
                  ]}
                />
              </View>

              <View style={[styles.periodRow, { marginTop: 14 }]}>
                <Text style={styles.periodName}>Tarde (12h - 18h)</Text>
                <Text style={styles.periodCount}>{metrics?.periodBreakdown?.afternoon ?? 0} visitas</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(
                        100,
                        ((metrics?.periodBreakdown?.afternoon ?? 0) /
                          Math.max(1, metrics?.summary?.total ?? 1)) *
                          100
                      )}%`,
                    },
                  ]}
                />
              </View>

              <View style={[styles.periodRow, { marginTop: 14 }]}>
                <Text style={styles.periodName}>Noite (18h - 00h)</Text>
                <Text style={styles.periodCount}>{metrics?.periodBreakdown?.night ?? 0} visitas</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(
                        100,
                        ((metrics?.periodBreakdown?.night ?? 0) /
                          Math.max(1, metrics?.summary?.total ?? 1)) *
                          100
                      )}%`,
                    },
                  ]}
                />
              </View>
            </View>
          </>
        ) : (
          /* Auditoria */
          <>
            {auditLogs.length === 0 ? (
              <View style={styles.emptyContainer}>
                <AlertCircle size={36} color={colors.textMuted} />
                <Text style={styles.emptyText}>Nenhum evento registrado ainda.</Text>
              </View>
            ) : (
              auditLogs.map((log: any, idx: number) => {
                const isAuth = log.eventType === 'AUTHORIZED';
                const isDenied = log.eventType === 'DENIED';
                const isEntry = log.eventType === 'ENTRY_RECORDED';

                let badgeColor = colors.primary;
                let badgeBg = '#F4EBFB';
                if (isAuth || isEntry) {
                  badgeColor = '#10B981';
                  badgeBg = '#D1FAE5';
                } else if (isDenied) {
                  badgeColor = '#EF4444';
                  badgeBg = '#FEE2E2';
                }

                return (
                  <View key={log.id || idx} style={styles.timelineCard}>
                    <View style={[styles.timelineBadge, { backgroundColor: badgeBg }]}>
                      <Text style={[styles.timelineBadgeText, { color: badgeColor }]}>
                        {log.eventType}
                      </Text>
                    </View>
                    <Text style={styles.timelineDesc}>{log.description}</Text>

                    {log.visitRequest && (
                      <View style={styles.timelineMetaRow}>
                        <Building size={14} color={colors.textSecondary} />
                        <Text style={styles.timelineMetaText}>
                          {log.visitRequest.destination?.name} ({log.visitRequest.destination?.block || ''}) • {log.visitRequest.visitor?.name}
                        </Text>
                      </View>
                    )}

                    <View style={styles.timelineFooter}>
                      <Text style={styles.timelineActor}>
                        Por: {log.actorType === 'WHATSAPP_CLIENT' ? 'Morador (WhatsApp)' : log.actorType === 'USER' ? 'Porteiro' : 'Sistema'}
                      </Text>
                      <Text style={styles.timelineTime}>
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      <ScrollToTopButton
        visible={showScrollTop}
        onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
        bottom={115}
      />

      {/* Modal de Filtro de Período */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)}
        >
          <View style={styles.filterSheet}>
            <Text style={styles.filterSheetTitle}>Filtrar por período</Text>
            {([1, 7, 30] as DaysFilter[]).map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.filterOption, days === d && styles.filterOptionActive]}
                onPress={() => {
                  setDays(d);
                  setFilterModalVisible(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterOptionText, days === d && styles.filterOptionTextActive]}>
                  {DAYS_LABELS[d]}
                </Text>
                {days === d && <CircleCheck size={18} color="#165337" />}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.filterOption, days === 'custom' && styles.filterOptionActive]}
              onPress={() => setDays('custom')}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterOptionText, days === 'custom' && styles.filterOptionTextActive]}>
                Período Personalizado
              </Text>
              {days === 'custom' && <CircleCheck size={18} color="#165337" />}
            </TouchableOpacity>

            {days === 'custom' && (
              <View style={styles.customDateContainer}>
                <View style={styles.dateInputWrapper}>
                  <Text style={styles.dateLabel}>Data Inicial</Text>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="DD/MM/AAAA"
                    value={startDateStr}
                    onChangeText={setStartDateStr}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
                <View style={styles.dateInputWrapper}>
                  <Text style={styles.dateLabel}>Data Final</Text>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="DD/MM/AAAA"
                    value={endDateStr}
                    onChangeText={setEndDateStr}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
                <TouchableOpacity
                  style={styles.applyDateBtn}
                  onPress={() => {
                    if (startDateStr.length >= 10) {
                      setFilterModalVisible(false);
                      loadData();
                    }
                  }}
                >
                  <Text style={styles.applyDateText}>Aplicar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Sub-tabs abaixo do header
  subTabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  subTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subTabActive: {
    backgroundColor: '#EDF7ED',
    borderColor: '#165337',
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  subTabTextActive: {
    color: '#165337',
    fontWeight: '700',
  },

  // Barra de filtro de período
  filterBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterBarLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  filterBarValue: {
    color: '#165337',
    fontWeight: '700',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF7ED',
    borderWidth: 1,
    borderColor: '#165337',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#165337',
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 14,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heroCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCirclePurple: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F4EBFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  badgeSuccessText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  heroCardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  heroCardValue: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 4,
    marginBottom: 6,
  },
  heroCardDescription: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
    marginTop: 4,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryNum: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  summaryTxt: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB',
  },
  periodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
  },
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  periodName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  periodCount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F0F1F5',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  timelineBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 6,
  },
  timelineBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  timelineDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  timelineMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  timelineMetaText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  timelineFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  timelineActor: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  timelineTime: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 10,
  },

  // Modal de filtro
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  filterSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  filterSheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
    textAlign: 'center',
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
  },
  filterOptionActive: {
    backgroundColor: '#EDF7ED',
    borderColor: '#165337',
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  filterOptionTextActive: {
    color: '#165337',
    fontWeight: '700',
  },
  customDateContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
  },
  dateInputWrapper: {
    marginBottom: 10,
  },
  dateLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
    fontWeight: '600',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  applyDateBtn: {
    backgroundColor: '#165337',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  applyDateText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
