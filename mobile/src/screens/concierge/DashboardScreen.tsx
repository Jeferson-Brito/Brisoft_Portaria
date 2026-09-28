import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import {
  Clock,
  CircleCheck,
  CircleX,
  Users,
  LogOut,
  Plus,
  Home,
  Settings,
  User,
  ChevronRight,
  ShieldCheck,
  CalendarCheck,
  BarChart3,
  MessageSquare,
  Package,
  Bell,
  Building2,
  UserCheck,
  LogIn,
  Car,
  Building,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../config/api';
import { NewRequestModal } from './NewRequestModal';
import { OpenRequestsScreen } from './OpenRequestsScreen';
import { PreAuthorizationsScreen } from './PreAuthorizationsScreen';
import { PresentVisitorsScreen } from './PresentVisitorsScreen';
import { AuthorizedRequestsScreen } from './AuthorizedRequestsScreen';
import { NotificationsModal } from './NotificationsModal';
import { PackagesScreen } from '../packages/PackagesScreen';
import { WhatsAppConfigScreen } from '../admin/WhatsAppConfigScreen';
import { UsersManagementScreen } from '../admin/UsersManagementScreen';
import { ClientsManagementScreen } from '../admin/ClientsManagementScreen';
import { OrganizationProfileScreen } from '../admin/OrganizationProfileScreen';
import { ReportsScreen } from '../reports/ReportsScreen';
import { ProfileScreen } from '../profile/ProfileScreen';
import { SettingsScreen } from '../settings/SettingsScreen';
import { SubscriptionScreen } from '../auth/SubscriptionScreen';
import { CustomConfirmModal } from '../../components/CustomConfirmModal';
import { AppHeader } from '../../components/AppHeader';
import { useRealtime, RealtimeAlert } from '../../contexts/RealtimeContext';

export const DashboardScreen: React.FC = () => {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'pending'
    | 'authorized'
    | 'present'
    | 'packages'
    | 'reports'
    | 'whatsapp'
    | 'settings'
    | 'users_mgmt'
    | 'clients_mgmt'
    | 'preauthorizations'
    | 'org_profile'
    | 'profile'
    | 'subscription'
  >('dashboard');
  const [requestFilter, setRequestFilter] = useState<'ALL' | 'PENDING' | 'AUTHORIZED' | 'ENTERED'>('ALL');
  const [confirmEntryModal, setConfirmEntryModal] = useState<{
    visible: boolean;
    requestId: string;
    visitorName: string;
  }>({ visible: false, requestId: '', visitorName: '' });
  const [detailModal, setDetailModal] = useState<{ visible: boolean; request: any | null }>(
    { visible: false, request: null }
  );
  const [orgProfile, setOrgProfile] = useState<{
    companyName?: string;
    unitLabel?: string;
    clientLabel?: string;
    type?: string;
  }>({});
  const [packagesCount, setPackagesCount] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<RealtimeAlert[]>([]);
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [entryProcessingId, setEntryProcessingId] = useState<string | null>(null);

  const [summary, setSummary] = useState({
    pendingCount: 0,
    authorizedCount: 0,
    presentCount: 0,
    deniedTodayCount: 0,
  });

  const { addListener } = useRealtime();

  const fetchSummaryAndRequests = useCallback(async () => {
    try {
      setIsLoadingRequests(true);
      const [summaryRes, pkgsRes, historyRes] = await Promise.allSettled([
        api.get('/visit-requests/summary'),
        api.get('/packages/pending'),
        api.get('/visit-requests/history?limit=30'),
      ]);

      if (summaryRes.status === 'fulfilled' && summaryRes.value.data?.data) {
        setSummary(summaryRes.value.data.data);
      }
      if (pkgsRes.status === 'fulfilled' && pkgsRes.value.data?.data) {
        setPackagesCount(pkgsRes.value.data.data.length || 0);
      }
      if (historyRes.status === 'fulfilled' && historyRes.value.data?.data?.requests) {
        const list = historyRes.value.data.data.requests;
        // Ordena: PENDING sempre no topo, depois AUTHORIZED, depois os demais
        const sorted = [...list].sort((a: any, b: any) => {
          if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
          if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
          if (a.status === 'AUTHORIZED' && b.status !== 'AUTHORIZED') return -1;
          if (a.status !== 'AUTHORIZED' && b.status === 'AUTHORIZED') return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        setRecentRequests(sorted);
      }
    } catch (err) {
      console.warn('Erro ao atualizar dashboard:', err);
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  const fetchOrgProfile = useCallback(async () => {
    try {
      const res = await api.get('/organizations/current');
      if (res.data?.success && res.data?.data?.profile) {
        setOrgProfile(res.data.data.profile);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchSummaryAndRequests();
    fetchOrgProfile();

    const unsubCreated = addListener('visit_request:created', fetchSummaryAndRequests);
    const unsubUpdated = addListener('visit_request:updated', fetchSummaryAndRequests);
    const unsubPkgCreated = addListener('package:created', fetchSummaryAndRequests);
    const unsubPkgPicked = addListener('package:picked_up', fetchSummaryAndRequests);
    const unsubAlert = addListener('notification:alert', (alert: RealtimeAlert) => {
      setNotifications((prev) => [alert, ...prev]);
      fetchSummaryAndRequests();
    });

    const interval = setInterval(fetchSummaryAndRequests, 15000);

    return () => {
      unsubCreated();
      unsubUpdated();
      unsubPkgCreated();
      unsubPkgPicked();
      unsubAlert();
      clearInterval(interval);
    };
  }, [addListener, fetchSummaryAndRequests, fetchOrgProfile]);

  const handleRegisterEntry = (requestId: string, visitorName: string) => {
    setConfirmEntryModal({
      visible: true,
      requestId,
      visitorName,
    });
  };

  const executeRegisterEntry = async () => {
    if (!confirmEntryModal.requestId) return;
    try {
      setEntryProcessingId(confirmEntryModal.requestId);
      await api.post(`/visit-requests/${confirmEntryModal.requestId}/entry`, {
        reason: 'Entrada física registrada na portaria pelo dashboard',
      });
      setConfirmEntryModal({ visible: false, requestId: '', visitorName: '' });
      fetchSummaryAndRequests();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Falha ao registrar entrada.');
    } finally {
      setEntryProcessingId(null);
    }
  };

  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0) + 14;
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 12);

  const renderContent = () => {
    if (activeTab === 'profile') {
      return (
        <ProfileScreen
          onBack={() => setActiveTab(user?.role === 'CONCIERGE' ? 'dashboard' : 'settings')}
        />
      );
    }
    if (activeTab === 'pending') return <OpenRequestsScreen />;
    if (activeTab === 'authorized') return <AuthorizedRequestsScreen />;
    if (activeTab === 'present') return <PresentVisitorsScreen />;
    if (activeTab === 'packages') return <PackagesScreen onBack={() => setActiveTab('dashboard')} />;
    if (activeTab === 'preauthorizations') return <PreAuthorizationsScreen onBack={() => setActiveTab('dashboard')} />;
    if (activeTab === 'whatsapp') return <WhatsAppConfigScreen onBack={() => setActiveTab('settings')} />;
    if (activeTab === 'users_mgmt') return <UsersManagementScreen onBack={() => setActiveTab('settings')} />;
    if (activeTab === 'clients_mgmt') return <ClientsManagementScreen onBack={() => setActiveTab('settings')} />;
    if (activeTab === 'reports') return <ReportsScreen />;
    if (activeTab === 'org_profile') {
      return (
        <OrganizationProfileScreen
          onBack={() => setActiveTab('settings')}
          onSaved={() => {
            fetchOrgProfile();
            fetchSummaryAndRequests();
          }}
        />
      );
    }

    if (activeTab === 'subscription') {
      return (
        <SubscriptionScreen
          onBack={() => setActiveTab('settings')}
        />
      );
    }

    if (activeTab === 'settings') {
      return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
          <AppHeader
            title="Configurações & Gestão"
            subtitle="Operadores, moradores, WhatsApp e empresa"
            onBack={() => setActiveTab('dashboard')}
          />
          <SettingsScreen
            onNavigate={(screen) => setActiveTab(screen)}
            orgProfile={orgProfile}
            bottomInset={bottomInset}
          />
        </View>
      );
    }

    // Filtragem das solicitações (Item 1)
    const filteredRequests = recentRequests.filter((req) => {
      if (requestFilter === 'ALL') return true;
      if (requestFilter === 'PENDING') return req.status === 'PENDING';
      if (requestFilter === 'AUTHORIZED') return req.status === 'AUTHORIZED';
      if (requestFilter === 'ENTERED') return req.status === 'ENTERED';
      return true;
    });

    // Dashboard Tab Principal com Cabeçalho FIXO no Topo (Item 5)
    return (
      <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
        {/* Cabeçalho FIXO no Topo - Não scrola junto com a tela */}
        <View style={[styles.header, { paddingTop: topInset }]}>
          <View style={styles.headerTopRow}>
            {/* Avatar + Saudação (Clicar vai para Meu Perfil) */}
            <TouchableOpacity
              style={styles.userProfileRow}
              onPress={() => setActiveTab('profile')}
              activeOpacity={0.8}
            >
              <View style={styles.avatarCircle}>
                <User size={24} color={colors.white} />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.greetingTitle}>
                  Olá, {user?.name ? user.name.split(' ')[0] : 'Porteiro'}
                </Text>
                <Text style={styles.greetingSubtitle}>
                  {orgProfile.companyName || 'Portaria Principal'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Ações da Direita: Notificações (Sino) & Configurações (Engrenagem) */}
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => setIsNotificationsModalOpen(true)}
                activeOpacity={0.75}
              >
                <Bell size={22} color={colors.white} />
                {(notifications.length > 0 || summary.pendingCount > 0) && (
                  <View style={styles.notificationDot} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.headerIconButton, { marginLeft: 10 }]}
                onPress={() => setActiveTab('settings')}
                activeOpacity={0.75}
              >
                <Settings size={22} color={colors.white} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Conteúdo Rolável Abaixo do Cabeçalho Fixo */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset + 80 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.bodyContainer}>
            {/* Ação Principal Hero: Nova Solicitação em Grande Destaque */}
            <TouchableOpacity
              style={styles.heroNewVisitBtn}
              onPress={() => setIsModalOpen(true)}
              activeOpacity={0.88}
            >
              <View style={styles.heroNewVisitIconCircle}>
                <Plus size={32} color="#FFFFFF" strokeWidth={3} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.heroNewVisitTitle}>Nova Solicitação</Text>
              </View>
              <ChevronRight size={24} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Cards Lado a Lado: Agendados & Encomendas */}
            <View style={styles.secondaryCardsRow}>
              {/* Card Agendados */}
              <TouchableOpacity
                style={styles.secondaryCard}
                onPress={() => setActiveTab('preauthorizations')}
                activeOpacity={0.85}
              >
                <View style={[styles.secondaryIconCircle, { backgroundColor: '#FEF3C7' }]}>
                  <CalendarCheck size={24} color="#D97706" />
                </View>
                <Text style={styles.secondaryCardTitle}>Agendados</Text>
                <Text style={styles.secondaryCardSubtitle}>Pré-autorizações</Text>
              </TouchableOpacity>

              {/* Card Encomendas */}
              <TouchableOpacity
                style={styles.secondaryCard}
                onPress={() => setActiveTab('packages')}
                activeOpacity={0.85}
              >
                <View style={[styles.secondaryIconCircle, { backgroundColor: '#EDE9FE' }]}>
                  <Package size={24} color="#7C3AED" />
                  {packagesCount > 0 && (
                    <View style={styles.secondaryBadge}>
                      <Text style={styles.secondaryBadgeText}>{packagesCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.secondaryCardTitle}>Encomendas</Text>
                <Text style={styles.secondaryCardSubtitle}>Recebimentos</Text>
              </TouchableOpacity>
            </View>

            {/* Seção: Solicitações de Acesso com Filtro (Item 1) */}
            <View style={styles.listSectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Solicitações de Acesso</Text>
                <Text style={styles.sectionCountText}>
                  {filteredRequests.length} registro(s)
                </Text>
              </View>

              {/* Barra de Filtros: Todos, Aguardando, Autorizados, No Local (Item 1) */}
              <View style={styles.filterPillsRow}>
                {[
                  { key: 'ALL', label: 'Todos', count: recentRequests.length },
                  { key: 'PENDING', label: 'Aguardando', count: summary.pendingCount },
                  { key: 'AUTHORIZED', label: 'Autorizados', count: summary.authorizedCount },
                  { key: 'ENTERED', label: 'No Local', count: summary.presentCount },
                ].map((pill) => {
                  const isSelected = requestFilter === pill.key;
                  return (
                    <TouchableOpacity
                      key={pill.key}
                      style={[styles.filterChip, isSelected && styles.filterChipActive]}
                      onPress={() => setRequestFilter(pill.key as any)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          isSelected && styles.filterChipTextActive,
                        ]}
                      >
                        {pill.label}
                      </Text>
                      {pill.count > 0 && (
                        <View
                          style={[
                            styles.filterChipBadge,
                            isSelected && styles.filterChipBadgeActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.filterChipBadgeText,
                              isSelected && styles.filterChipBadgeTextActive,
                            ]}
                          >
                            {pill.count}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {isLoadingRequests && recentRequests.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={styles.loadingRequestsText}>Atualizando solicitações...</Text>
                </View>
              ) : filteredRequests.length === 0 ? (
                <View style={styles.emptyRequestsCard}>
                  <Clock size={32} color="#94A3B8" style={{ marginBottom: 6 }} />
                  <Text style={styles.emptyRequestsTitle}>Nenhuma solicitação encontrada</Text>
                  <Text style={styles.emptyRequestsSubtitle}>
                    {requestFilter === 'ALL'
                      ? 'Toque em "+ Nova Visita" para registrar uma nova entrada.'
                      : 'Nenhuma solicitação neste status no momento.'}
                  </Text>
                </View>
              ) : (
                /* Cards Modernos e Profissionais de Solicitações */
                filteredRequests.map((req) => {
                  const isPending = req.status === 'PENDING';
                  const isAuthorized = req.status === 'AUTHORIZED';
                  const isEntered = req.status === 'ENTERED';
                  const isDenied = req.status === 'DENIED';

                  const timeFormatted = new Date(req.createdAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  const visitorName = req.visitor?.name || 'Visitante';
                  const clientName = req.client?.name || req.client?.ownerName || 'Morador';
                  const destName = req.destination?.name
                    ? `${req.destination.name}${req.destination.block ? ` - ${req.destination.block}` : ''}`
                    : '';
                  const reason = req.visitReason || req.visitorType || 'Visita';

                  return (
                    <TouchableOpacity
                      key={req.id}
                      style={[
                        styles.accessCard,
                        isPending && styles.accessCardPending,
                        isAuthorized && styles.accessCardAuthorized,
                        isEntered && styles.accessCardEntered,
                        isDenied && styles.accessCardDenied,
                      ]}
                      onPress={() => setDetailModal({ visible: true, request: req })}
                      activeOpacity={0.85}
                    >
                      {/* Lado Esquerdo: Ícone / Avatar de Status */}
                      <View
                        style={[
                          styles.accessCardIconBox,
                          isPending && styles.accessCardIconBoxPending,
                          isAuthorized && styles.accessCardIconBoxAuthorized,
                          isEntered && styles.accessCardIconBoxEntered,
                          isDenied && styles.accessCardIconBoxDenied,
                        ]}
                      >
                        {isAuthorized ? (
                          <CircleCheck size={22} color="#16A34A" />
                        ) : isPending ? (
                          <Clock size={22} color="#D97706" />
                        ) : isEntered ? (
                          <LogIn size={22} color="#2563EB" />
                        ) : (
                          <CircleX size={22} color="#DC2626" />
                        )}
                      </View>

                      {/* Conteúdo Central */}
                      <View style={styles.accessCardContent}>
                        {/* Linha 1: Nome do Visitante + Badge */}
                        <View style={styles.accessCardTopRow}>
                          <Text style={styles.accessVisitorName} numberOfLines={1}>
                            {visitorName}
                          </Text>

                          <View
                            style={[
                              styles.accessBadge,
                              isPending && styles.accessBadgePending,
                              isAuthorized && styles.accessBadgeAuthorized,
                              isEntered && styles.accessBadgeEntered,
                              isDenied && styles.accessBadgeDenied,
                            ]}
                          >
                            <Text
                              style={[
                                styles.accessBadgeText,
                                isPending && styles.accessBadgeTextPending,
                                isAuthorized && styles.accessBadgeTextAuthorized,
                                isEntered && styles.accessBadgeTextEntered,
                                isDenied && styles.accessBadgeTextDenied,
                              ]}
                            >
                              {isPending
                                ? 'Aguardando'
                                : isAuthorized
                                ? 'Autorizado'
                                : isEntered
                                ? 'No Local'
                                : 'Recusado'}
                            </Text>
                          </View>
                        </View>

                        {/* Linha 2: Morador & Unidade */}
                        <View style={styles.accessCardMiddleRow}>
                          <View style={styles.accessClientTag}>
                            <User size={12} color="#64748B" style={{ marginRight: 4 }} />
                            <Text style={styles.accessClientText} numberOfLines={1}>
                              Resp.: <Text style={styles.accessClientHighlight}>{clientName}</Text>
                            </Text>
                          </View>

                          {destName ? (
                            <View style={styles.accessDestTag}>
                              <Building2 size={12} color="#475569" style={{ marginRight: 4 }} />
                              <Text style={styles.accessDestText} numberOfLines={1}>{destName}</Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Linha 3: Motivo / Tag + Horário */}
                        <View style={styles.accessCardBottomRow}>
                          <View style={styles.accessReasonBadge}>
                            <Text style={styles.accessReasonText}>{reason}</Text>
                          </View>

                          <View style={styles.accessTimeBox}>
                            <Clock size={11} color="#94A3B8" style={{ marginRight: 3 }} />
                            <Text style={styles.accessTimeText}>{timeFormatted}</Text>
                          </View>
                        </View>
                      </View>

                      {/* Botão de Ação Rápida para Liberados */}
                      {isAuthorized && (
                        <TouchableOpacity
                          style={styles.compactEntryBtn}
                          onPress={() => handleRegisterEntry(req.id, req.visitor?.name)}
                          disabled={entryProcessingId === req.id}
                          activeOpacity={0.85}
                        >
                          {entryProcessingId === req.id ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <LogIn size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                              <Text style={styles.compactEntryBtnText}>ENTRAR</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  };

  const isConcierge = user?.role === 'CONCIERGE';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F203D" />

      <View style={styles.container}>
        {renderContent()}

        {/* Barra de Navegação Inferior: Esconde Relatórios para CONCIERGE (Item 3) */}
        <View style={[styles.bottomTabBar, { paddingBottom: bottomInset }]}>
          {/* 1. Início */}
          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => setActiveTab('dashboard')}
            activeOpacity={0.8}
          >
            <Home
              size={22}
              color={activeTab === 'dashboard' ? '#2563EB' : '#94A3B8'}
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'dashboard' && styles.tabLabelActive,
              ]}
            >
              Início
            </Text>
            {activeTab === 'dashboard' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>

          {/* 2. Aguardando */}
          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => setActiveTab('pending')}
            activeOpacity={0.8}
          >
            <View>
              <Clock
                size={22}
                color={activeTab === 'pending' ? '#2563EB' : '#94A3B8'}
              />
              {summary.pendingCount > 0 && (
                <View style={styles.tabBadgeDot}>
                  <Text style={styles.tabBadgeText}>{summary.pendingCount}</Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'pending' && styles.tabLabelActive,
              ]}
            >
              Aguardando
            </Text>
            {activeTab === 'pending' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>

          {/* 3. Autorizados */}
          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => setActiveTab('authorized')}
            activeOpacity={0.8}
          >
            <View>
              <ShieldCheck
                size={22}
                color={activeTab === 'authorized' ? '#16A34A' : '#94A3B8'}
              />
              {summary.authorizedCount > 0 && (
                <View style={[styles.tabBadgeDot, { backgroundColor: '#16A34A' }]}>
                  <Text style={styles.tabBadgeText}>{summary.authorizedCount}</Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'authorized' && { color: '#16A34A', fontWeight: '700' },
              ]}
            >
              Autorizados
            </Text>
            {activeTab === 'authorized' && (
              <View style={[styles.activeTabIndicator, { backgroundColor: '#16A34A' }]} />
            )}
          </TouchableOpacity>

          {/* 4. Presentes (para Portaria) ou Relatórios (para Admin/Supervisor) */}
          {isConcierge ? (
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => setActiveTab('present')}
              activeOpacity={0.8}
            >
              <View>
                <Users
                  size={22}
                  color={activeTab === 'present' ? '#2563EB' : '#94A3B8'}
                />
                {summary.presentCount > 0 && (
                  <View style={styles.tabBadgeDot}>
                    <Text style={styles.tabBadgeText}>{summary.presentCount}</Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === 'present' && styles.tabLabelActive,
                ]}
              >
                Presentes
              </Text>
              {activeTab === 'present' && <View style={styles.activeTabIndicator} />}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => setActiveTab('reports')}
              activeOpacity={0.8}
            >
              <BarChart3
                size={22}
                color={activeTab === 'reports' ? '#2563EB' : '#94A3B8'}
              />
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === 'reports' && styles.tabLabelActive,
                ]}
              >
                Relatórios
              </Text>
              {activeTab === 'reports' && <View style={styles.activeTabIndicator} />}
            </TouchableOpacity>
          )}

          {/* 5. Ajustes / Configurações (Sempre visível para todos os perfis) */}
          {(() => {
            const isSettingsTabActive = [
              'settings',
              'whatsapp',
              'users_mgmt',
              'clients_mgmt',
              'org_profile',
              'profile',
              'subscription',
            ].includes(activeTab);

            return (
              <TouchableOpacity
                style={styles.tabItem}
                onPress={() => setActiveTab('settings')}
                activeOpacity={0.8}
              >
                <Settings
                  size={22}
                  color={isSettingsTabActive ? '#2563EB' : '#94A3B8'}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    isSettingsTabActive && styles.tabLabelActive,
                  ]}
                >
                  Ajustes
                </Text>
                {isSettingsTabActive && <View style={styles.activeTabIndicator} />}
              </TouchableOpacity>
            );
          })()}
        </View>

        {/* Modal Nova Solicitação */}
        <NewRequestModal
          visible={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            fetchSummaryAndRequests();
            setActiveTab('pending');
          }}
        />

        {/* Modal Notificações do Header */}
        <NotificationsModal
          visible={isNotificationsModalOpen}
          onClose={() => setIsNotificationsModalOpen(false)}
          notifications={notifications}
          onClear={() => setNotifications([])}
          onSelectNotification={(alert) => {
            if (alert.type === 'AUTHORIZED') {
              setActiveTab('authorized');
            } else if (alert.type === 'DENIED') {
              if (!isConcierge) setActiveTab('reports');
              else setActiveTab('dashboard');
            } else {
              setActiveTab('pending');
            }
          }}
        />

        {/* Custom Confirmation Modal para Entrada */}
        <CustomConfirmModal
          visible={confirmEntryModal.visible}
          type="success"
          title="Confirmar Entrada"
          message={`Confirmar que ${confirmEntryModal.visitorName} entrou no local agora?`}
          confirmText="Confirmar Entrada"
          cancelText="Voltar"
          isLoading={!!entryProcessingId}
          onConfirm={executeRegisterEntry}
          onCancel={() => setConfirmEntryModal({ visible: false, requestId: '', visitorName: '' })}
        />

        {/* Modal Detalhes da Solicitação */}
        <Modal
          visible={detailModal.visible}
          transparent
          animationType="slide"
          onRequestClose={() => setDetailModal({ visible: false, request: null })}
        >
          <View style={styles.detailOverlay}>
            <View style={styles.detailSheet}>
              {/* Handle */}
              <View style={styles.detailHandle} />

              {detailModal.request && (() => {
                const req = detailModal.request;
                const isPending = req.status === 'PENDING';
                const isAuthorized = req.status === 'AUTHORIZED';
                const isEntered = req.status === 'ENTERED';
                const statusLabel = isPending ? 'Aguardando' : isAuthorized ? 'Autorizado' : isEntered ? 'No Local' : 'Recusado';
                const statusColor = isPending ? '#D97706' : isAuthorized ? '#16A34A' : isEntered ? '#2563EB' : '#DC2626';
                const statusBg = isPending ? '#FEF3C7' : isAuthorized ? '#DCFCE7' : isEntered ? '#DBEAFE' : '#FEE2E2';
                const createdDate = new Date(req.createdAt);
                const dateStr = createdDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const timeStr = createdDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const clientName = req.client?.name || req.client?.ownerName || req.destination?.name || req.destination?.ownerName || '—';
                return (
                  <>
                    <View style={styles.detailHeaderRow}>
                      <Text style={styles.detailTitle}>Detalhes da Solicitação</Text>
                      <TouchableOpacity
                        onPress={() => setDetailModal({ visible: false, request: null })}
                        style={styles.detailCloseBtn}
                      >
                        <CircleX size={24} color="#64748B" />
                      </TouchableOpacity>
                    </View>

                    <View style={[styles.detailStatusBadge, { backgroundColor: statusBg }]}>
                      <Text style={[styles.detailStatusText, { color: statusColor }]}>{statusLabel.toUpperCase()}</Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Visitante</Text>
                      <Text style={styles.detailValue}>{req.visitor?.name || '—'}</Text>
                    </View>
                    {req.visitor?.document && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Documento</Text>
                        <Text style={styles.detailValue}>{req.visitor.document}</Text>
                      </View>
                    )}
                    {req.visitor?.phone && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Telefone</Text>
                        <Text style={styles.detailValue}>{req.visitor.phone}</Text>
                      </View>
                    )}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Responsável</Text>
                      <Text style={styles.detailValue}>{clientName}</Text>
                    </View>
                    {(req.destination?.unit || req.client?.unit) && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Unidade / Sala</Text>
                        <Text style={styles.detailValue}>{req.destination?.unit || req.client?.unit}</Text>
                      </View>
                    )}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Data/Hora</Text>
                      <Text style={styles.detailValue}>{dateStr} às {timeStr}</Text>
                    </View>
                    {req.purpose && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Motivo</Text>
                        <Text style={styles.detailValue}>{req.purpose}</Text>
                      </View>
                    )}
                    {req.notes && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Observações</Text>
                        <Text style={styles.detailValue}>{req.notes}</Text>
                      </View>
                    )}

                    {isAuthorized && (
                      <TouchableOpacity
                        style={styles.detailEntryBtn}
                        onPress={() => {
                          setDetailModal({ visible: false, request: null });
                          handleRegisterEntry(req.id, req.visitor?.name);
                        }}
                        activeOpacity={0.85}
                      >
                        <LogIn size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.detailEntryBtnText}>Registrar Entrada</Text>
                      </TouchableOpacity>
                    )}
                  </>
                );
              })()}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F203D',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Cabeçalho Principal
  header: {
    backgroundColor: '#0F203D',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 14 : 10,
    paddingBottom: 22,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  greetingSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },

  // Corpo da Página
  bodyContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Botão de Grande Destaque Hero: Nova Visita (Item 2)
  heroNewVisitBtn: {
    backgroundColor: '#1E3A8A', // Azul Real Noturno Profundo
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#3B82F6', // Borda iluminada
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  heroNewVisitIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  heroNewVisitBadge: {
    backgroundColor: '#F59E0B', // Âmbar Dourado Vibrante
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  heroNewVisitBadgeText: {
    color: '#0F172A',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  heroNewVisitTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  heroNewVisitSubtitle: {
    fontSize: 12,
    color: '#BFDBFE',
    marginTop: 2,
  },

  // Cards Lado a Lado: Agendados & Encomendas
  secondaryCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  secondaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secondaryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    position: 'relative',
  },
  secondaryBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.white,
  },
  secondaryBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  secondaryCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  secondaryCardSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },

  // Seção da Lista de Solicitações com Filtro (Item 1)
  listSectionContainer: {
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },

  // Barra de Filtros (Item 1)
  filterPillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: '#0F203D',
    borderColor: '#0F203D',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterChipBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 5,
  },
  filterChipBadgeActive: {
    backgroundColor: '#2563EB',
  },
  filterChipBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  filterChipBadgeTextActive: {
    color: '#FFFFFF',
  },

  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRequestsText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
  },
  emptyRequestsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyRequestsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 3,
  },
  emptyRequestsSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },

  // Cards de Solicitação de Acesso (Modernos & Profissionais)
  accessCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    borderLeftColor: '#94A3B8',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  accessCardPending: {
    borderLeftColor: '#F59E0B',
  },
  accessCardAuthorized: {
    borderLeftColor: '#10B981',
  },
  accessCardEntered: {
    borderLeftColor: '#3B82F6',
  },
  accessCardDenied: {
    borderLeftColor: '#EF4444',
  },
  accessCardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: '#F8FAFC',
  },
  accessCardIconBoxPending: {
    backgroundColor: '#FEF3C7',
  },
  accessCardIconBoxAuthorized: {
    backgroundColor: '#DCFCE7',
  },
  accessCardIconBoxEntered: {
    backgroundColor: '#DBEAFE',
  },
  accessCardIconBoxDenied: {
    backgroundColor: '#FEE2E2',
  },
  accessCardContent: {
    flex: 1,
  },
  accessCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  accessVisitorName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
  },
  accessBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  accessBadgeAuthorized: {
    backgroundColor: '#DCFCE7',
  },
  accessBadgeEntered: {
    backgroundColor: '#DBEAFE',
  },
  accessBadgeDenied: {
    backgroundColor: '#FEE2E2',
  },
  accessBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  accessBadgeTextPending: {
    color: '#B45309',
  },
  accessBadgeTextAuthorized: {
    color: '#15803D',
  },
  accessBadgeTextEntered: {
    color: '#1D4ED8',
  },
  accessBadgeTextDenied: {
    color: '#B91C1C',
  },
  accessCardMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  accessDestTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  accessDestText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  accessClientTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accessClientText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  accessClientHighlight: {
    fontWeight: '700',
    color: '#1E293B',
  },
  accessCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  accessReasonBadge: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  accessReasonText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  accessTimeBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accessTimeText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  compactEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  compactEntryBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  // Barra de Navegação Inferior
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    flexDirection: 'row',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 4,
  },
  tabLabelActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  activeTabIndicator: {
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#2563EB',
    marginTop: 4,
  },
  tabBadgeDot: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 4,
    height: 16,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.white,
  },
  tabBadgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '800',
  },

  // Hub Administrativo
  settingsHeader: {
    marginBottom: 16,
  },
  settingsSectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  settingsSectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  menuIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  menuCardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  settingsLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 18,
  },
  settingsLogoutBtnText: {
    color: colors.statusDenied,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  // Modal de Detalhes da Solicitacao
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  detailSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 32,
  },
  detailHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  detailCloseBtn: {
    padding: 4,
  },
  detailStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 14,
  },
  detailStatusText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    flex: 1,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    flex: 2,
    textAlign: 'right',
  },
  detailEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 18,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  detailEntryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

});
