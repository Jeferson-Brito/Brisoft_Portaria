import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BarChart3,
  Clock,
  CircleCheck,
  CircleX,
  Users,
  ShieldCheck,
  TrendingUp,
  Building,
  Calendar,
  AlertCircle,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { api } from '../../config/api';
import { ScrollToTopButton } from '../../components/ScrollToTopButton';

export const ReportsScreen: React.FC = () => {
  const scrollRef = useRef<ScrollView>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [days, setDays] = useState<number>(7);
  const [activeSubTab, setActiveSubTab] = useState<'metrics' | 'audit'>('metrics');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [metricsRes, auditRes] = await Promise.all([
        api.get(`/reports/metrics?days=${days}`),
        api.get('/audit/timeline?limit=30'),
      ]);
      setMetrics(metricsRes.data.data);
      setAuditLogs(auditRes.data.data || []);
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

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0) + 14;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPadding }]}>
        <View style={styles.headerTitleRow}>
          <BarChart3 size={24} color={colors.white} />
          <Text style={styles.headerTitle}>Relatórios & Métricas</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Performance da portaria e auditoria em tempo real
        </Text>

        {/* Abas Superiores (Métricas vs Auditoria) */}
        <View style={styles.subTabContainer}>
          <TouchableOpacity
            style={[styles.subTab, activeSubTab === 'metrics' && styles.subTabActive]}
            onPress={() => setActiveSubTab('metrics')}
          >
            <Text style={[styles.subTabText, activeSubTab === 'metrics' && styles.subTabTextActive]}>
              Desempenho
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.subTab, activeSubTab === 'audit' && styles.subTabActive]}
            onPress={() => setActiveSubTab('audit')}
          >
            <Text style={[styles.subTabText, activeSubTab === 'audit' && styles.subTabTextActive]}>
              Auditoria
            </Text>
          </TouchableOpacity>
        </View>
      </View>

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
            {/* Filtro de Período (Pills Nubank) */}
            <View style={styles.periodFilterContainer}>
              <TouchableOpacity
                style={[styles.periodChip, days === 1 && styles.periodChipActive]}
                onPress={() => setDays(1)}
              >
                <Text style={[styles.periodChipText, days === 1 && styles.periodChipTextActive]}>Hoje</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodChip, days === 7 && styles.periodChipActive]}
                onPress={() => setDays(7)}
              >
                <Text style={[styles.periodChipText, days === 7 && styles.periodChipTextActive]}>7 dias</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodChip, days === 30 && styles.periodChipActive]}
                onPress={() => setDays(30)}
              >
                <Text style={[styles.periodChipText, days === 30 && styles.periodChipTextActive]}>30 dias</Text>
              </TouchableOpacity>
            </View>

            {/* Destaque 1: Tempo Médio de Resposta */}
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

            {/* Destaque 2: Taxa de Aprovação & Permanência */}
            <View style={styles.kpiRow}>
              <View style={styles.halfCard}>
                <View style={[styles.iconCircle, { backgroundColor: '#D1FAE5' }]}>
                  <CircleCheck size={18} color="#10B981" />
                </View>
                <Text style={styles.halfCardValue}>{metrics?.summary?.approvalRate ?? 100}%</Text>
                <Text style={styles.halfCardLabel}>Taxa de Aprovação</Text>
                <Text style={styles.halfCardHint}>{metrics?.summary?.denied ?? 0} recusas</Text>
              </View>

              <View style={styles.halfCard}>
                <View style={[styles.iconCircle, { backgroundColor: '#F4EBFB' }]}>
                  <Users size={18} color={colors.primary} />
                </View>
                <Text style={styles.halfCardValue}>
                  {metrics?.performance?.averageStayFormatted || '0 min'}
                </Text>
                <Text style={styles.halfCardLabel}>Média no Local</Text>
                <Text style={styles.halfCardHint}>{metrics?.summary?.presentNow ?? 0} no condomínio</Text>
              </View>
            </View>

            {/* Resumo Consolidado de Volumes */}
            <Text style={styles.sectionTitle}>Volume de Visitas ({days} dias)</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNum}>{metrics?.summary?.total ?? 0}</Text>
                <Text style={styles.summaryTxt}>Total Solicitado</Text>
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

            {/* Unidades Mais Visitadas */}
            {metrics?.topDestinations && metrics.topDestinations.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Unidades Mais Visitadas</Text>
                <View style={styles.destListCard}>
                  {metrics.topDestinations.map((dest: any, idx: number) => (
                    <View key={idx} style={styles.destItem}>
                      <View style={styles.destRankBadge}>
                        <Text style={styles.destRankText}>#{idx + 1}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.destName}>{dest.name}</Text>
                      </View>
                      <Text style={styles.destCount}>{dest.count} visitas</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        ) : (
          /* Trilha de Auditoria Imutável (Seção 71) */
          <>
            <View style={styles.auditHeaderCard}>
              <ShieldCheck size={24} color={colors.primary} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.auditHeaderTitle}>Trilha de Auditoria Imutável</Text>
                <Text style={styles.auditHeaderSub}>
                  Registro criptografado de cada autorização e movimentação na portaria.
                </Text>
              </View>
            </View>

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
                const isExit = log.eventType === 'EXIT_RECORDED';

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
        bottom={85}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F1F5',
  },
  header: {
    backgroundColor: '#0F203D',
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
    marginBottom: 16,
  },
  subTabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 3,
  },
  subTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  subTabActive: {
    backgroundColor: colors.white,
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.white,
  },
  subTabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
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
  periodFilterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  periodChip: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E4E9',
  },
  periodChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  periodChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  periodChipTextActive: {
    color: colors.white,
  },
  heroCard: {
    backgroundColor: colors.white,
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
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  halfCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  halfCardValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  halfCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  halfCardHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
    marginTop: 4,
  },
  summaryCard: {
    backgroundColor: colors.white,
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
    backgroundColor: colors.white,
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
  destListCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 12,
    marginBottom: 20,
  },
  destItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F1F4',
  },
  destRankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F4EBFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  destRankText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  destName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  destCount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  auditHeaderCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  auditHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  auditHeaderSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  timelineCard: {
    backgroundColor: colors.white,
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
});
