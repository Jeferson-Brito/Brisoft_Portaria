import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ChevronLeft,
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
  Calendar,
  Truck,
  Barcode,
  CheckCircle,
  Filter,
  X,
  List,
  History,
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
import { VisitorHistoryScreen } from './VisitorHistoryScreen';
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
import { SuperAdminOrganizationsScreen } from '../admin/SuperAdminOrganizationsScreen';
import { CustomConfirmModal } from '../../components/CustomConfirmModal';
import { AppHeader } from '../../components/AppHeader';
import { ScrollToTopButton } from '../../components/ScrollToTopButton';
import { useRealtime, RealtimeAlert } from '../../contexts/RealtimeContext';

type DateFilterType = 'ALL' | 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS';

const dateFilterLabels: Record<DateFilterType, string> = {
  ALL: 'Todas as datas',
  TODAY: 'Hoje',
  YESTERDAY: 'Ontem',
  LAST_7_DAYS: 'Últimos 7 dias',
};

const isSameDay = (d1: Date, d2: Date) =>
  d1.getDate() === d2.getDate() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getFullYear() === d2.getFullYear();

const matchesDateFilter = (dateString: string, filter: DateFilterType) => {
  if (filter === 'ALL') return true;
  if (!dateString) return false;
  const itemDate = new Date(dateString);
  const now = new Date();
  if (filter === 'TODAY') {
    return isSameDay(itemDate, now);
  }
  if (filter === 'YESTERDAY') {
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    return isSameDay(itemDate, yesterday);
  }
  if (filter === 'LAST_7_DAYS') {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    return itemDate.getTime() >= sevenDaysAgo.getTime();
  }
  return true;
};

export const DashboardScreen: React.FC = () => {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showCompactActions, setShowCompactActions] = useState(false);

  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'pending'
    | 'authorized'
    | 'present'
    | 'history'
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
    | 'super_admin_orgs'
  >('dashboard');
  const [requestFilter, setRequestFilter] = useState<'ALL' | 'PENDING' | 'AUTHORIZED' | 'PACKAGES' | 'ENTERED'>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('ALL');
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [confirmEntryModal, setConfirmEntryModal] = useState<{
    visible: boolean;
    requestId: string;
    visitorName: string;
  }>({ visible: false, requestId: '', visitorName: '' });
  const [detailModal, setDetailModal] = useState<{ visible: boolean; request: any | null }>(
    { visible: false, request: null }
  );
  const [packageDetailModal, setPackageDetailModal] = useState<{ visible: boolean; package: any | null }>({
    visible: false,
    package: null,
  });

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
  const [recentPackages, setRecentPackages] = useState<any[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [entryProcessingId, setEntryProcessingId] = useState<string | null>(null);

  const [summary, setSummary] = useState({
    pendingCount: 0,
    authorizedCount: 0,
    presentCount: 0,
    deniedTodayCount: 0,
  });

  const { addListener } = useRealtime();

  const isFetchingRef = useRef(false);

  const fetchSummaryAndRequests = useCallback(async () => {
    if (isFetchingRef.current) return;
    try {
      isFetchingRef.current = true;
      setIsLoadingRequests(true);
      const [summaryRes, pkgsPendingRes, pkgsHistoryRes, historyRes] = await Promise.allSettled([
        api.get('/visit-requests/summary'),
        api.get('/packages/pending'),
        api.get('/packages/history?limit=50'),
        api.get('/visit-requests/history?limit=50'),
      ]);

      if (summaryRes.status === 'fulfilled' && summaryRes.value.data?.data) {
        setSummary(summaryRes.value.data.data);
      }
      if (pkgsPendingRes.status === 'fulfilled' && pkgsPendingRes.value.data?.data) {
        setPackagesCount(pkgsPendingRes.value.data.data.length || 0);
      }

      const rawPackages: any[] = [];
      if (pkgsPendingRes.status === 'fulfilled' && Array.isArray(pkgsPendingRes.value.data?.data)) {
        rawPackages.push(...pkgsPendingRes.value.data.data);
      }
      if (pkgsHistoryRes.status === 'fulfilled' && Array.isArray(pkgsHistoryRes.value.data?.data)) {
        const pendingIds = new Set(rawPackages.map((p) => p.id));
        pkgsHistoryRes.value.data.data.forEach((p: any) => {
          if (!pendingIds.has(p.id)) {
            rawPackages.push(p);
          }
        });
      }
      setRecentPackages(rawPackages);

      if (historyRes.status === 'fulfilled' && historyRes.value.data?.data?.requests) {
        const list = historyRes.value.data.data.requests;
        setRecentRequests(list);
      }
    } catch (err) {
      console.warn('Erro ao atualizar dashboard:', err);
    } finally {
      isFetchingRef.current = false;
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

  // Reset da barra de ações compactas e botão voltar ao topo na troca de aba
  useEffect(() => {
    setShowCompactActions(false);
    setShowScrollTop(false);
    if (activeTab === 'dashboard') {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [activeTab]);

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
    if (activeTab === 'history') return <VisitorHistoryScreen />;
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

    if (activeTab === 'super_admin_orgs') {
      return (
        <SuperAdminOrganizationsScreen
          onBack={() => setActiveTab('settings')}
        />
      );
    }

    if (activeTab === 'settings') {
      return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
          <AppHeader
            title="Configurações"
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

    // Construção da lista unificada de Solicitações (Visitas + Encomendas)
    const unifiedList = [
      ...recentRequests.map((req) => ({
        id: req.id,
        kind: 'visit' as const,
        status: req.status,
        createdAt: req.createdAt,
        title: req.visitor?.name || 'Visitante',
        clientName: req.client?.name || req.client?.ownerName || 'Morador',
        destName: req.destination?.name
          ? `${req.destination.name}${req.destination.block ? ` - ${req.destination.block}` : ''}`
          : '',
        tag: req.visitReason || req.visitorType || 'Visita',
        code: req.code,
        raw: req,
      })),
      ...recentPackages.map((pkg) => ({
        id: pkg.id,
        kind: 'package' as const,
        status: pkg.status, // 'PENDING' (Aguardando retirada) ou 'PICKED_UP' (Entregue)
        createdAt: pkg.receivedAt || pkg.createdAt,
        title: pkg.recipientName || pkg.client?.name || 'Destinatário',
        clientName: pkg.carrier || 'Encomenda',
        destName: pkg.destination?.name
          ? `${pkg.destination.name}${pkg.destination.block ? ` - ${pkg.destination.block}` : ''}`
          : '',
        tag: `Encomenda • ${pkg.carrier || 'Correios'}`,
        code: pkg.code,
        raw: pkg,
      })),
    ];

    // Ordenação: Pendentes primeiro, depois autorizados, depois os mais recentes
    unifiedList.sort((a, b) => {
      const aIsPending = a.status === 'PENDING';
      const bIsPending = b.status === 'PENDING';
      if (aIsPending && !bIsPending) return -1;
      if (!aIsPending && bIsPending) return 1;

      const aIsAuth = a.status === 'AUTHORIZED';
      const bIsAuth = b.status === 'AUTHORIZED';
      if (aIsAuth && !bIsAuth) return -1;
      if (!aIsAuth && bIsAuth) return 1;

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Filtros por Categoria e Data
    const filteredList = unifiedList.filter((item) => {
      if (!matchesDateFilter(item.createdAt, dateFilter)) return false;

      if (requestFilter === 'ALL') return true;
      if (requestFilter === 'PENDING') return item.status === 'PENDING';
      if (requestFilter === 'AUTHORIZED') return item.kind === 'visit' && item.status === 'AUTHORIZED';
      if (requestFilter === 'PACKAGES') return item.kind === 'package';
      if (requestFilter === 'ENTERED') return item.kind === 'visit' && item.status === 'ENTERED';
      return true;
    });

    // Contadores para os filtros
    const pendingTotal =
      summary.pendingCount + recentPackages.filter((p) => p.status === 'PENDING').length;
    const packagesTotal = recentPackages.length;

    // Paginação: limite de 10 por página
    const PAGE_SIZE = 10;
    const totalPages = Math.ceil(filteredList.length / PAGE_SIZE) || 1;
    const currentPageSafe = Math.min(Math.max(currentPage, 1), totalPages);
    const paginatedItems = filteredList.slice(
      (currentPageSafe - 1) * PAGE_SIZE,
      currentPageSafe * PAGE_SIZE
    );

    // Dashboard Tab Principal com Cabeçalho FIXO no Topo (Item 5)
    return (
      <View style={{ flex: 1, backgroundColor: '#F4F7F5' }}>
        {/* Cabeçalho FIXO no Topo com Onda Orgânica Suave */}
        <View style={[styles.header, { paddingTop: topInset + 6 }]}>
          <View style={styles.headerWaveDecoration} />

          <View style={styles.headerTopRow}>
            {/* Avatar + Saudação */}
            <TouchableOpacity
              style={styles.userProfileRow}
              onPress={() => setActiveTab('profile')}
              activeOpacity={0.8}
            >
              <View style={styles.avatarCircle}>
                <User size={24} color="#FFFFFF" strokeWidth={2.4} />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.greetingTitle}>
                  Olá, {user?.name ? user.name.split(' ')[0] : 'Jeferson'}
                </Text>
                <Text style={styles.greetingSubtitle}>
                  {orgProfile.companyName || 'Grupo Combate Portaria'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Ações da Direita */}
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => setIsNotificationsModalOpen(true)}
                activeOpacity={0.75}
              >
                <Bell size={20} color="#0F172A" />
                {(notifications.length > 0 || summary.pendingCount > 0) && (
                  <View style={styles.notificationDot} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.headerIconButton, { marginLeft: 10 }]}
                onPress={() => setActiveTab('settings')}
                activeOpacity={0.75}
              >
                <Settings size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Container Rolável com Barra de Ações Compacta em Sobreposição Absoluta */}
        <View style={{ flex: 1, position: 'relative' }}>
          {/* Conteúdo Rolável Abaixo do Cabeçalho Fixo */}
          <ScrollView
            ref={scrollRef}
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset + 80 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            onScroll={(e) => {
              const y = e.nativeEvent.contentOffset.y;
              setShowScrollTop(y > 200);

              // Histerese para eliminar oscilação e tremida ao scrolar
              if (y > 170 && !showCompactActions) {
                setShowCompactActions(true);
              } else if (y < 120 && showCompactActions) {
                setShowCompactActions(false);
              }
            }}
          >
          <View style={styles.bodyContainer}>
            {/* Ação Principal Hero: Nova Solicitação em Grande Destaque */}
            <TouchableOpacity
              style={styles.heroNewVisitBtn}
              onPress={() => setIsModalOpen(true)}
              activeOpacity={0.88}
            >
              <View style={styles.heroNewVisitIconCircle}>
                <Plus size={26} color="#165337" strokeWidth={2.8} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.heroNewVisitTitle}>Nova Solicitação</Text>
              </View>
              <ChevronRight size={22} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Cards Lado a Lado: Agendamento & Encomendas Centralizados */}
            <View style={styles.secondaryCardsRow}>
              {/* Card Agendamento */}
              <TouchableOpacity
                style={styles.secondaryCard}
                onPress={() => setActiveTab('preauthorizations')}
                activeOpacity={0.85}
              >
                <View style={styles.secondaryIconCircle}>
                  <CalendarCheck size={26} color="#165337" />
                </View>
                <Text style={styles.secondaryCardTitle}>Agendamentos</Text>
              </TouchableOpacity>

              {/* Card Encomendas */}
              <TouchableOpacity
                style={styles.secondaryCard}
                onPress={() => setActiveTab('packages')}
                activeOpacity={0.85}
              >
                <View style={styles.secondaryIconCircle}>
                  <Package size={26} color="#165337" />
                </View>
                <Text style={styles.secondaryCardTitle}>Encomendas</Text>
              </TouchableOpacity>
            </View>

            {/* Seção: Solicitações com Filtro de Status e Filtro de Data */}
            <View style={styles.listSectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.sectionTitle}>Solicitações</Text>
                  <View style={styles.sectionCountBadge}>
                    <Text style={styles.sectionCountBadgeText}>{filteredList.length}</Text>
                  </View>
                </View>

                {/* Filtro Discreto de Data */}
                <TouchableOpacity
                  style={[
                    styles.dateFilterChip,
                    dateFilter !== 'ALL' && styles.dateFilterChipActive,
                  ]}
                  onPress={() => setIsDateModalOpen(true)}
                  activeOpacity={0.75}
                >
                  <Calendar
                    size={14}
                    color="#165337"
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.dateFilterText,
                      dateFilter !== 'ALL' && styles.dateFilterTextActive,
                    ]}
                  >
                    {dateFilterLabels[dateFilter]}
                  </Text>
                  <ChevronRight size={13} color="#64748B" style={{ marginLeft: 3 }} />
                  {dateFilter !== 'ALL' && (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation?.();
                        setDateFilter('ALL');
                        setCurrentPage(1);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ marginLeft: 4 }}
                    >
                      <CircleX size={13} color="#165337" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>

              {/* Barra de Filtros com Rolagem Horizontal */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterPillsScroll}
                style={styles.filterPillsContainer}
              >
                {[
                  { key: 'ALL', label: 'Todos', count: unifiedList.length },
                  { key: 'PENDING', label: 'Aguardando', count: pendingTotal },
                  { key: 'AUTHORIZED', label: 'Autorizados', count: summary.authorizedCount },
                  { key: 'PACKAGES', label: 'Encomendas', count: packagesTotal },
                  { key: 'ENTERED', label: 'No Local', count: summary.presentCount },
                ].map((pill) => {
                  const isSelected = requestFilter === pill.key;
                  return (
                    <TouchableOpacity
                      key={pill.key}
                      style={[styles.filterChip, isSelected && styles.filterChipActive]}
                      onPress={() => {
                        setRequestFilter(pill.key as any);
                        setCurrentPage(1);
                      }}
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
              </ScrollView>

              {isLoadingRequests && unifiedList.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={styles.loadingRequestsText}>Atualizando solicitações...</Text>
                </View>
              ) : filteredList.length === 0 ? (
                <View style={styles.emptyRequestsCard}>
                  <Clock size={32} color="#94A3B8" style={{ marginBottom: 6 }} />
                  <Text style={styles.emptyRequestsTitle}>Nenhuma solicitação encontrada</Text>
                  <Text style={styles.emptyRequestsSubtitle}>
                    {requestFilter === 'ALL'
                      ? 'Nenhuma solicitação ou encomenda no período selecionado.'
                      : 'Nenhum registro correspondente ao filtro ativo.'}
                  </Text>
                </View>
              ) : (
                /* Cards Modernos e Profissionais (Visitas e Encomendas) */
                paginatedItems.map((item) => {
                  const isPackage = item.kind === 'package';
                  const req = item.raw;

                  if (isPackage) {
                    const isPickedUp = item.status === 'PICKED_UP';
                    const timeFormatted = new Date(item.createdAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <TouchableOpacity
                        key={`pkg-${item.id}`}
                        style={[
                          styles.accessCard,
                          isPickedUp ? styles.accessCardPickedUp : styles.accessCardPackage,
                        ]}
                        onPress={() => setPackageDetailModal({ visible: true, package: req })}
                        activeOpacity={0.85}
                      >
                        {/* Lado Esquerdo: Ícone de Encomenda */}
                        <View
                          style={[
                            styles.accessCardIconBox,
                            isPickedUp
                              ? styles.accessCardIconBoxEntered
                              : { backgroundColor: '#EDE9FE' },
                          ]}
                        >
                          {isPickedUp ? (
                            <CheckCircle size={22} color="#16A34A" />
                          ) : (
                            <Package size={22} color="#7C3AED" />
                          )}
                        </View>

                        {/* Conteúdo Central */}
                        <View style={styles.accessCardContent}>
                          <View style={styles.accessCardTopRow}>
                            <Text style={styles.accessVisitorName} numberOfLines={1}>
                              {item.title}
                            </Text>

                            <View
                              style={[
                                styles.accessBadge,
                                isPickedUp
                                  ? { backgroundColor: '#DCFCE7' }
                                  : { backgroundColor: '#EDE9FE' },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.accessBadgeText,
                                  isPickedUp ? { color: '#15803D' } : { color: '#7C3AED' },
                                ]}
                              >
                                {isPickedUp ? 'Retirada' : 'Aguardando Retirada'}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.accessCardMiddleRow}>
                            {item.destName ? (
                              <View style={styles.accessDestTag}>
                                <Building2 size={12} color="#475569" style={{ marginRight: 4 }} />
                                <Text style={styles.accessDestText} numberOfLines={1}>
                                  {item.destName}
                                </Text>
                              </View>
                            ) : null}

                            <View style={styles.accessClientTag}>
                              <Truck size={12} color="#64748B" style={{ marginRight: 4 }} />
                              <Text style={styles.accessClientText} numberOfLines={1}>
                                {req.carrier || 'Encomenda'}
                              </Text>
                            </View>

                            {req.trackingCode ? (
                              <View style={styles.accessClientTag}>
                                <Barcode size={12} color="#64748B" style={{ marginRight: 3 }} />
                                <Text style={styles.accessClientText} numberOfLines={1}>
                                  {req.trackingCode}
                                </Text>
                              </View>
                            ) : null}
                          </View>

                          <View style={styles.accessCardBottomRow}>
                            <View style={[styles.accessReasonBadge, { backgroundColor: '#F3E8FF' }]}>
                              <Text style={[styles.accessReasonText, { color: '#6B21A8' }]}>
                                Encomenda
                              </Text>
                            </View>

                            <View style={styles.accessTimeBox}>
                              <Clock size={11} color="#94A3B8" style={{ marginRight: 3 }} />
                              <Text style={styles.accessTimeText}>{timeFormatted}</Text>
                            </View>
                          </View>
                        </View>

                        {/* Botão Ação Ver Encomenda */}
                        <TouchableOpacity
                          style={[
                            styles.compactEntryBtn,
                            { backgroundColor: isPickedUp ? '#64748B' : '#7C3AED' },
                          ]}
                          onPress={() => setPackageDetailModal({ visible: true, package: req })}
                          activeOpacity={0.85}
                        >
                          <Package size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.compactEntryBtnText}>VER</Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  }

                  // Card de Solicitação de Acesso (Visita)
                  const isPending = req.status === 'PENDING';
                  const isAuthorized = req.status === 'AUTHORIZED';
                  const isEntered = req.status === 'ENTERED';
                  const isExited = req.status === 'EXITED';
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
                      key={`visit-${req.id}`}
                      style={[
                        styles.accessCard,
                        isPending && styles.accessCardPending,
                        isAuthorized && styles.accessCardAuthorized,
                        isEntered && styles.accessCardEntered,
                        isExited && styles.accessCardExited,
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
                          isExited && styles.accessCardIconBoxExited,
                          isDenied && styles.accessCardIconBoxDenied,
                        ]}
                      >
                        {isExited ? (
                          <CheckCircle size={22} color="#059669" />
                        ) : isAuthorized ? (
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
                              isExited && styles.accessBadgeExited,
                              isDenied && styles.accessBadgeDenied,
                            ]}
                          >
                            <Text
                              style={[
                                styles.accessBadgeText,
                                isPending && styles.accessBadgeTextPending,
                                isAuthorized && styles.accessBadgeTextAuthorized,
                                isEntered && styles.accessBadgeTextEntered,
                                isExited && styles.accessBadgeTextExited,
                                isDenied && styles.accessBadgeTextDenied,
                              ]}
                            >
                              {isExited
                                ? 'Finalizada'
                                : isPending
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

              {/* Paginação Discreta (10 solicitações por aba: 1, 2, 3...) */}
              {totalPages > 1 && (
                <View style={styles.paginationContainer}>
                  <TouchableOpacity
                    style={[
                      styles.pageNavBtn,
                      currentPageSafe === 1 && styles.pageNavBtnDisabled,
                    ]}
                    onPress={() => {
                      if (currentPageSafe > 1) {
                        setCurrentPage(currentPageSafe - 1);
                      }
                    }}
                    disabled={currentPageSafe === 1}
                    activeOpacity={0.7}
                  >
                    <ChevronLeft
                      size={16}
                      color={currentPageSafe === 1 ? '#CBD5E1' : '#1E293B'}
                    />
                  </TouchableOpacity>

                  <View style={styles.pageNumbersRow}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                      const isCurrent = pageNum === currentPageSafe;
                      return (
                        <TouchableOpacity
                          key={pageNum}
                          style={[
                            styles.pageNumberBtn,
                            isCurrent && styles.pageNumberBtnActive,
                          ]}
                          onPress={() => setCurrentPage(pageNum)}
                          activeOpacity={0.75}
                        >
                          <Text
                            style={[
                              styles.pageNumberText,
                              isCurrent && styles.pageNumberTextActive,
                            ]}
                          >
                            {pageNum}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.pageNavBtn,
                      currentPageSafe === totalPages && styles.pageNavBtnDisabled,
                    ]}
                    onPress={() => {
                      if (currentPageSafe < totalPages) {
                        setCurrentPage(currentPageSafe + 1);
                      }
                    }}
                    disabled={currentPageSafe === totalPages}
                    activeOpacity={0.7}
                  >
                    <ChevronRight
                      size={16}
                      color={currentPageSafe === totalPages ? '#CBD5E1' : '#1E293B'}
                    />
                  </TouchableOpacity>
                </View>
              )}

              {filteredList.length > 0 && (
                <Text style={styles.paginationSummaryText}>
                  Página {currentPageSafe} de {totalPages} • Total de {filteredList.length} registro(s)
                </Text>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Barra de Ações Compacta Flutuante Fixa no Topo (Não desloca a rolagem) */}
        {showCompactActions && (
          <View style={styles.compactActionsBar}>
            <TouchableOpacity
              style={styles.compactActionBtnPrimary}
              onPress={() => {
                setShowCompactActions(false);
                setIsModalOpen(true);
              }}
              activeOpacity={0.85}
            >
              <Plus size={15} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.compactActionBtnPrimaryText}>Nova Solicitação</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.compactActionBtnSecondary}
              onPress={() => {
                setShowCompactActions(false);
                setActiveTab('preauthorizations');
              }}
              activeOpacity={0.85}
            >
              <CalendarCheck size={15} color="#165337" />
              <Text style={styles.compactActionBtnTextSecondary}>Agendamentos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.compactActionBtnSecondary}
              onPress={() => {
                setShowCompactActions(false);
                setActiveTab('packages');
              }}
              activeOpacity={0.85}
            >
              <Package size={15} color="#165337" />
              <Text style={styles.compactActionBtnTextSecondary}>Encomendas</Text>
              {packagesCount > 0 && (
                <View style={styles.compactActionBadge}>
                  <Text style={styles.compactActionBadgeText}>{packagesCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
        </View>
      </View>
    );
  };

  const isConcierge = user?.role === 'CONCIERGE';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F7F5" />

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
              color={activeTab === 'dashboard' ? '#165337' : '#94A3B8'}
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
                color={activeTab === 'pending' ? '#165337' : '#94A3B8'}
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
                color={activeTab === 'authorized' ? '#165337' : '#94A3B8'}
              />
              {summary.authorizedCount > 0 && (
                <View style={[styles.tabBadgeDot, { backgroundColor: '#165337' }]}>
                  <Text style={styles.tabBadgeText}>{summary.authorizedCount}</Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'authorized' && { color: '#165337', fontWeight: '700' },
              ]}
            >
              Autorizados
            </Text>
            {activeTab === 'authorized' && (
              <View style={styles.activeTabIndicator} />
            )}
          </TouchableOpacity>

          {/* 4. Histórico de Solicitações (Nova Aba) */}
          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => setActiveTab('history')}
            activeOpacity={0.8}
          >
            <History
              size={22}
              color={activeTab === 'history' ? '#165337' : '#94A3B8'}
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'history' && styles.tabLabelActive,
              ]}
            >
              Histórico
            </Text>
            {activeTab === 'history' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>

          {/* 5. Relatórios */}
          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => setActiveTab('reports')}
            activeOpacity={0.8}
          >
            <BarChart3
              size={22}
              color={activeTab === 'reports' ? '#165337' : '#94A3B8'}
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
        </View>

        {/* Modal Nova Solicitação */}
        <NewRequestModal
          visible={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={(newReq?: any) => {
            if (newReq) {
              setRecentRequests((prev) => [newReq, ...prev.filter((r) => r.id !== newReq.id)]);
              setSummary((prev) => ({ ...prev, pendingCount: prev.pendingCount + 1 }));
            }
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
                const isExited = req.status === 'EXITED';
                const statusLabel = isExited
                  ? 'Finalizada (Saída Registrada)'
                  : isPending
                  ? 'Aguardando'
                  : isAuthorized
                  ? 'Autorizado'
                  : isEntered
                  ? 'No Local'
                  : 'Recusado';
                const statusColor = isExited
                  ? '#047857'
                  : isPending
                  ? '#D97706'
                  : isAuthorized
                  ? '#16A34A'
                  : isEntered
                  ? '#2563EB'
                  : '#DC2626';
                const statusBg = isExited
                  ? '#D1FAE5'
                  : isPending
                  ? '#FEF3C7'
                  : isAuthorized
                  ? '#DCFCE7'
                  : isEntered
                  ? '#DBEAFE'
                  : '#FEE2E2';
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

        {/* Modal Detalhes da Encomenda */}
        <Modal
          visible={packageDetailModal.visible}
          transparent
          animationType="slide"
          onRequestClose={() => setPackageDetailModal({ visible: false, package: null })}
        >
          <View style={styles.detailOverlay}>
            <View style={styles.detailSheet}>
              <View style={styles.detailHandle} />

              {packageDetailModal.package && (() => {
                const pkg = packageDetailModal.package;
                const isPickedUp = pkg.status === 'PICKED_UP';
                const createdDate = new Date(pkg.receivedAt || pkg.createdAt);
                const dateStr = createdDate.toLocaleDateString('pt-BR');
                const timeStr = createdDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const clientName = pkg.client?.name || pkg.recipientName || 'Morador';
                const destName = pkg.destination?.name
                  ? `${pkg.destination.name}${pkg.destination.block ? ` - ${pkg.destination.block}` : ''}`
                  : '—';

                return (
                  <>
                    <View style={styles.detailHeaderRow}>
                      <Text style={styles.detailTitle}>Detalhes da Encomenda</Text>
                      <TouchableOpacity
                        onPress={() => setPackageDetailModal({ visible: false, package: null })}
                        style={styles.detailCloseBtn}
                      >
                        <CircleX size={24} color="#64748B" />
                      </TouchableOpacity>
                    </View>

                    <View
                      style={[
                        styles.detailStatusBadge,
                        { backgroundColor: isPickedUp ? '#DCFCE7' : '#EDE9FE' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.detailStatusText,
                          { color: isPickedUp ? '#15803D' : '#7C3AED' },
                        ]}
                      >
                        {isPickedUp ? 'RETIRADA' : 'AGUARDANDO RETIRADA'}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Destinatário</Text>
                      <Text style={styles.detailValue}>{pkg.recipientName || clientName}</Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Transportadora</Text>
                      <Text style={styles.detailValue}>{pkg.carrier || 'Encomenda'}</Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Destino</Text>
                      <Text style={styles.detailValue}>{destName}</Text>
                    </View>

                    {pkg.trackingCode && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Código Rastreio</Text>
                        <Text style={styles.detailValue}>{pkg.trackingCode}</Text>
                      </View>
                    )}

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Recebimento</Text>
                      <Text style={styles.detailValue}>{dateStr} às {timeStr}</Text>
                    </View>

                    {pkg.code && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Identificador</Text>
                        <Text style={styles.detailValue}>{pkg.code}</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={[styles.detailEntryBtn, { backgroundColor: '#7C3AED' }]}
                      onPress={() => {
                        setPackageDetailModal({ visible: false, package: null });
                        setActiveTab('packages');
                      }}
                      activeOpacity={0.85}
                    >
                      <Package size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.detailEntryBtnText}>Abrir na aba Encomendas</Text>
                    </TouchableOpacity>
                  </>
                );
              })()}
            </View>
          </View>
        </Modal>

        {/* Modal Discreto: Seletor de Data */}
        <Modal
          visible={isDateModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsDateModalOpen(false)}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setIsDateModalOpen(false)}
          >
            <View style={styles.datePickerSheet}>
              <Text style={styles.datePickerTitle}>Filtrar Solicitações por Data</Text>
              {(['ALL', 'TODAY', 'YESTERDAY', 'LAST_7_DAYS'] as DateFilterType[]).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.dateOptionItem,
                    dateFilter === f && styles.dateOptionItemActive,
                  ]}
                  onPress={() => {
                    setDateFilter(f);
                    setCurrentPage(1);
                    setIsDateModalOpen(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.dateOptionText,
                      dateFilter === f && styles.dateOptionTextActive,
                    ]}
                  >
                    {dateFilterLabels[f]}
                  </Text>
                  {dateFilter === f && <CircleCheck size={18} color="#2563EB" />}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Botão Flutuante Voltar ao Topo */}
        <ScrollToTopButton
          visible={showScrollTop && activeTab === 'dashboard'}
          onPress={() => {
            scrollRef.current?.scrollTo({ y: 0, animated: true });
            setShowCompactActions(false);
            setShowScrollTop(false);
          }}
          bottom={bottomInset + 65}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F7F5',
  },
  container: {
    flex: 1,
    backgroundColor: '#F4F7F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Cabeçalho Principal com Onda Suave Menta
  header: {
    backgroundColor: '#F4F7F5',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 14 : 10,
    paddingBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  headerWaveDecoration: {
    position: 'absolute',
    top: -50,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(180, 222, 196, 0.32)',
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#165337',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  greetingSubtitle: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 1,
  },
  onlineBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  onlineText: {
    fontSize: 12,
    color: '#165337',
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  notificationDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },

  // Corpo da Página
  bodyContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // Botão de Grande Destaque Hero: Nova Solicitação (Verde Esmeralda)
  heroNewVisitBtn: {
    backgroundColor: '#165337',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#165337',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  heroNewVisitIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  heroNewVisitBadge: {
    backgroundColor: '#F59E0B',
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
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  heroNewVisitSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
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
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  secondaryIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EDF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  secondaryCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },

  // Seção da Lista de Solicitações com Filtro
  listSectionContainer: {
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionCountBadge: {
    backgroundColor: '#EDF7ED',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  sectionCountBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#165337',
  },
  dateFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dateFilterChipActive: {
    borderColor: '#165337',
    backgroundColor: '#EDF7ED',
  },
  dateFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  dateFilterTextActive: {
    color: '#165337',
    fontWeight: '700',
  },

  // Barra de Filtros com Rolagem Horizontal
  filterPillsContainer: {
    marginBottom: 12,
  },
  filterPillsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: '#165337',
    borderColor: '#165337',
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
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 5,
  },
  filterChipBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
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
  accessCardExited: {
    borderLeftColor: '#059669', // Verde esmeralda para saída finalizada
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
  accessCardIconBoxExited: {
    backgroundColor: '#ECFDF5',
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
  accessBadgeExited: {
    backgroundColor: '#D1FAE5',
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
  accessBadgeTextExited: {
    color: '#047857',
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
    color: '#165337',
    fontWeight: '700',
  },
  activeTabIndicator: {
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#165337',
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

  // Barra de Ações Compacta Fixa ao Scrolar (Flutuante em Sobreposição Absoluta)
  compactActionsBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 50,
  },
  compactActionBtnPrimary: {
    flex: 1.2,
    backgroundColor: '#165337',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    shadowColor: '#165337',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  compactActionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  compactActionBtnSecondary: {
    flex: 1,
    backgroundColor: '#EDF7ED',
    borderWidth: 1,
    borderColor: '#C8E6C9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  compactActionBtnTextSecondary: {
    color: '#165337',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  compactActionBadge: {
    backgroundColor: '#165337',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    marginLeft: 4,
  },
  compactActionBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  datePickerSheet: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  datePickerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
    textAlign: 'center',
  },
  dateOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
  },
  dateOptionItemActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  dateOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  dateOptionTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },

  // Paginação
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    marginBottom: 8,
  },
  pageNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNavBtnDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  pageNumbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageNumberBtn: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumberBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  pageNumberText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  pageNumberTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  paginationSummaryText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 10,
  },

  // Cores de Borda de Pacote
  accessCardPackage: {
    borderLeftColor: '#7C3AED',
  },
  accessCardPickedUp: {
    borderLeftColor: '#10B981',
  },

});

