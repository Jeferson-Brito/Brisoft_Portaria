import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BarChart3,
  Building2,
  Users,
  CreditCard,
  User,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wifi,
  WifiOff,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Key,
  LogOut,
  ChevronRight,
  DollarSign,
  Lock,
  Mail,
  Phone,
  Check,
  X,
  Sparkles,
  RefreshCw,
  Calendar,
  Building,
} from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../config/api';
import { colors } from '../../theme/colors';
import { CustomConfirmModal } from '../../components/CustomConfirmModal';

type SuperAdminTab = 'overview' | 'organizations' | 'users' | 'finance' | 'profile';

export const SuperAdminDashboardScreen: React.FC = () => {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<SuperAdminTab>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dados do Dashboard SaaS
  const [metrics, setMetrics] = useState<any>({
    organizations: { total: 0, active: 0, suspended: 0, newLast30Days: 0 },
    subscriptions: { paidActive: 0, trial: 0, pending: 0, suspended: 0, totalMRR: 0, trialMRR: 0 },
    whatsapp: { total: 0, connected: 0, disconnected: 0, disconnectedList: [] },
    alerts: { whatsappDisconnected: [], pendingPayments: [] },
    recentOrganizations: [],
    usage: { totalUsers: 0, totalVisits: 0 },
  });

  // Lista de Organizações
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [orgSearch, setOrgSearch] = useState('');
  const [orgStatusFilter, setOrgStatusFilter] = useState<'ALL' | 'ACTIVE' | 'TRIAL' | 'PENDING' | 'SUSPENDED' | 'WA_OFF'>('ALL');

  // Lista de Usuários Multi-empresa
  const [usersList, setUsersList] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('ALL');

  // Modais de Criação & Edição
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);
  const [isEditOrgModalOpen, setIsEditOrgModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<any | null>(null);

  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);

  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [targetUserForPassword, setTargetUserForPassword] = useState<any | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // Confirmação de Exclusão
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    visible: boolean;
    type: 'org' | 'user';
    id: string;
    title: string;
    description: string;
  }>({ visible: false, type: 'org', id: '', title: '', description: '' });

  // Formulário Nova Empresa
  const [orgForm, setOrgForm] = useState({
    organizationName: '',
    organizationDocument: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    adminPhone: '',
    plan: 'PRO',
    monthlyPrice: '149.90',
    trialDays: '7',
  });

  // Formulário Novo Usuário
  const [userForm, setUserForm] = useState({
    organizationId: '',
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'CONCIERGE',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Carregar Métricas e Dados
  const loadDashboardData = useCallback(async () => {
    try {
      const [metricsRes, orgsRes, usersRes] = await Promise.allSettled([
        api.get('/super-admin/dashboard'),
        api.get('/super-admin/organizations?limit=100'),
        api.get('/super-admin/users?limit=100'),
      ]);

      if (metricsRes.status === 'fulfilled' && metricsRes.value.data?.data) {
        setMetrics(metricsRes.value.data.data);
      }
      if (orgsRes.status === 'fulfilled' && orgsRes.value.data?.organizations) {
        setOrganizations(orgsRes.value.data.organizations);
      }
      if (usersRes.status === 'fulfilled' && usersRes.value.data?.users) {
        setUsersList(usersRes.value.data.users);
      }
    } catch (error) {
      console.warn('Erro ao carregar dados do Super Admin:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadDashboardData();
  };

  // ─── AÇÕES DE EMPRESAS ─────────────────────────────────────────

  const handleCreateOrg = async () => {
    if (!orgForm.organizationName.trim()) {
      Alert.alert('Atenção', 'Informe o nome da empresa ou condomínio.');
      return;
    }
    if (!orgForm.adminName.trim() || !orgForm.adminEmail.trim() || !orgForm.adminPassword.trim()) {
      Alert.alert('Atenção', 'Preencha os dados do primeiro administrador (nome, e-mail e senha).');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/super-admin/organizations', {
        organizationName: orgForm.organizationName.trim(),
        organizationDocument: orgForm.organizationDocument.trim() || undefined,
        adminName: orgForm.adminName.trim(),
        adminEmail: orgForm.adminEmail.trim().toLowerCase(),
        adminPassword: orgForm.adminPassword,
        adminPhone: orgForm.adminPhone.trim() || undefined,
        plan: orgForm.plan,
        monthlyPrice: parseFloat(orgForm.monthlyPrice.replace(',', '.')) || 149.9,
        trialDays: parseInt(orgForm.trialDays, 10) || 7,
      });

      Alert.alert('Sucesso', `Empresa "${orgForm.organizationName}" cadastrada com sucesso!`);
      setIsCreateOrgModalOpen(false);
      setOrgForm({
        organizationName: '',
        organizationDocument: '',
        adminName: '',
        adminEmail: '',
        adminPassword: '',
        adminPhone: '',
        plan: 'PRO',
        monthlyPrice: '149.90',
        trialDays: '7',
      });
      loadDashboardData();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Falha ao cadastrar empresa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateOrg = async () => {
    if (!editingOrg) return;
    try {
      setIsSubmitting(true);
      await api.put(`/super-admin/organizations/${editingOrg.id}`, {
        name: editingOrg.name,
        document: editingOrg.document,
        plan: editingOrg.plan,
        monthlyPrice: parseFloat(String(editingOrg.monthlyPrice).replace(',', '.')) || 149.9,
        paymentStatus: editingOrg.paymentStatus,
      });

      Alert.alert('Sucesso', 'Empresa atualizada com sucesso!');
      setIsEditOrgModalOpen(false);
      setEditingOrg(null);
      loadDashboardData();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Falha ao atualizar empresa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleOrgActive = async (org: any) => {
    try {
      await api.patch(`/super-admin/organizations/${org.id}/toggle-active`);
      loadDashboardData();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Falha ao alterar status da empresa.');
    }
  };

  const handleQuickPaymentStatus = async (orgId: string, paymentStatus: string) => {
    try {
      if (paymentStatus === 'ACTIVE') {
        await api.post(`/super-admin/subscriptions/${orgId}/activate`, { periodDays: 30 });
      } else if (paymentStatus === 'SUSPENDED') {
        await api.post(`/super-admin/subscriptions/${orgId}/suspend`);
      } else {
        await api.patch(`/super-admin/subscriptions/${orgId}`, { paymentStatus });
      }
      loadDashboardData();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Falha ao atualizar status financeiro.');
    }
  };

  const confirmDeleteOrg = (org: any) => {
    setConfirmDeleteModal({
      visible: true,
      type: 'org',
      id: org.id,
      title: 'Excluir Empresa Permanentemente?',
      description: `Tem certeza que deseja excluir "${org.name}"? Todos os operadores, moradores, solicitações e dados vinculados a esta empresa serão removidos do sistema.`,
    });
  };

  // ─── AÇÕES DE USUÁRIOS ─────────────────────────────────────────

  const handleCreateUser = async () => {
    if (!userForm.organizationId) {
      Alert.alert('Atenção', 'Selecione a empresa à qual o usuário pertencerá.');
      return;
    }
    if (!userForm.name.trim() || !userForm.email.trim() || !userForm.password.trim()) {
      Alert.alert('Atenção', 'Informe nome, e-mail e senha do usuário.');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/super-admin/users', {
        organizationId: userForm.organizationId,
        name: userForm.name.trim(),
        email: userForm.email.trim().toLowerCase(),
        password: userForm.password,
        phone: userForm.phone.trim() || undefined,
        role: userForm.role,
      });

      Alert.alert('Sucesso', 'Usuário criado com sucesso!');
      setIsCreateUserModalOpen(false);
      setUserForm({
        organizationId: '',
        name: '',
        email: '',
        password: '',
        phone: '',
        role: 'CONCIERGE',
      });
      loadDashboardData();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Falha ao criar usuário.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      setIsSubmitting(true);
      await api.put(`/super-admin/users/${editingUser.id}`, {
        name: editingUser.name,
        email: editingUser.email,
        phone: editingUser.phone,
        role: editingUser.role,
        isActive: editingUser.isActive,
      });

      Alert.alert('Sucesso', 'Usuário atualizado com sucesso!');
      setIsEditUserModalOpen(false);
      setEditingUser(null);
      loadDashboardData();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Falha ao atualizar usuário.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async () => {
    if (!targetUserForPassword || !newPasswordInput.trim()) {
      Alert.alert('Atenção', 'Digite a nova senha.');
      return;
    }
    if (newPasswordInput.length < 6) {
      Alert.alert('Atenção', 'A senha deve conter pelo menos 6 caracteres.');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.patch(`/super-admin/users/${targetUserForPassword.id}/password`, {
        newPassword: newPasswordInput.trim(),
      });

      Alert.alert('Senha Alterada', `A nova senha de "${targetUserForPassword.name}" foi redefinida com sucesso!`);
      setIsChangePasswordModalOpen(false);
      setTargetUserForPassword(null);
      setNewPasswordInput('');
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Falha ao redefinir senha.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteUser = (u: any) => {
    setConfirmDeleteModal({
      visible: true,
      type: 'user',
      id: u.id,
      title: 'Excluir Usuário?',
      description: `Tem certeza que deseja excluir o usuário "${u.name}" (${u.email})?`,
    });
  };

  const executeDelete = async () => {
    try {
      setIsSubmitting(true);
      if (confirmDeleteModal.type === 'org') {
        await api.delete(`/super-admin/organizations/${confirmDeleteModal.id}`);
        Alert.alert('Excluído', 'Empresa excluída com sucesso.');
      } else {
        await api.delete(`/super-admin/users/${confirmDeleteModal.id}`);
        Alert.alert('Excluído', 'Usuário excluído com sucesso.');
      }
      setConfirmDeleteModal((prev) => ({ ...prev, visible: false }));
      loadDashboardData();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Falha ao excluir.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── FILTROS ──────────────────────────────────────────────────

  const filteredOrganizations = organizations.filter((org) => {
    if (orgSearch) {
      const q = orgSearch.toLowerCase();
      const matchName = org.name?.toLowerCase().includes(q);
      const matchSlug = org.slug?.toLowerCase().includes(q);
      const matchDoc = org.document?.includes(q);
      if (!matchName && !matchSlug && !matchDoc) return false;
    }

    if (orgStatusFilter === 'ACTIVE') return org.isActive && org.paymentStatus === 'ACTIVE';
    if (orgStatusFilter === 'TRIAL') return org.paymentStatus === 'TRIAL' || org.isTrial;
    if (orgStatusFilter === 'PENDING') return org.paymentStatus === 'PENDING';
    if (orgStatusFilter === 'SUSPENDED') return !org.isActive || org.paymentStatus === 'SUSPENDED';
    if (orgStatusFilter === 'WA_OFF') return org.whatsappStatus !== 'CONNECTED';

    return true;
  });

  const filteredUsers = usersList.filter((u) => {
    if (selectedOrgFilter !== 'ALL' && u.organizationId !== selectedOrgFilter) {
      return false;
    }
    if (userSearch) {
      const q = userSearch.toLowerCase();
      const matchName = u.name?.toLowerCase().includes(q);
      const matchEmail = u.email?.toLowerCase().includes(q);
      const matchOrg = u.organization?.name?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchOrg) return false;
    }
    return true;
  });

  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0) + 14;
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 12);

  // Formatação de Moeda
  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // ─── TELAS / ABAS ─────────────────────────────────────────────

  // 1. VISÃO GERAL (GESTÃO SAAS)
  const renderOverviewTab = () => (
    <ScrollView
      style={styles.tabScroll}
      contentContainerStyle={{ paddingBottom: bottomInset + 80 }}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      {/* Hero: Métricas Financeiras & Assinaturas */}
      <View style={styles.heroFinanceCard}>
        <View style={styles.heroHeaderRow}>
          <View>
            <Text style={styles.heroLabel}>FATURAMENTO RECORRENTE (MRR)</Text>
            <Text style={styles.heroAmount}>{formatCurrency(metrics.subscriptions?.totalMRR || 0)}</Text>
            <Text style={styles.heroPeriod}>/mês em assinaturas pagas ativas</Text>
          </View>
          <View style={styles.heroIconBadge}>
            <TrendingUp size={26} color="#10B981" />
          </View>
        </View>

        <View style={styles.heroDivider} />

        <View style={styles.heroGrid}>
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatNum}>{metrics.subscriptions?.paidActive || 0}</Text>
            <Text style={styles.heroStatLabel}>Assinantes Pagantes</Text>
          </View>
          <View style={styles.heroStatItem}>
            <Text style={[styles.heroStatNum, { color: '#F59E0B' }]}>{metrics.subscriptions?.trial || 0}</Text>
            <Text style={styles.heroStatLabel}>Em Teste (7 dias)</Text>
          </View>
          <View style={styles.heroStatItem}>
            <Text style={[styles.heroStatNum, { color: '#EF4444' }]}>{metrics.subscriptions?.pending || 0}</Text>
            <Text style={styles.heroStatLabel}>Pagamento Pendente</Text>
          </View>
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatNum}>{metrics.organizations?.total || 0}</Text>
            <Text style={styles.heroStatLabel}>Total Empresas</Text>
          </View>
        </View>
      </View>

      {/* Alertas Urgentes de Operação */}
      {(metrics.alerts?.whatsappDisconnected?.length > 0 || metrics.alerts?.pendingPayments?.length > 0) && (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeaderTitle}>ALERTAS OPERACIONAIS</Text>

          {/* Alerta de WhatsApp Desconectado */}
          {metrics.alerts?.whatsappDisconnected?.map((item: any) => (
            <View key={`wa-${item.id}`} style={styles.alertCardRed}>
              <View style={styles.alertIconCircleRed}>
                <WifiOff size={20} color="#DC2626" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.alertCardTitle}>{item.name}</Text>
                  <View style={styles.waOffBadge}>
                    <Text style={styles.waOffBadgeText}>WHATSAPP OFF</Text>
                  </View>
                </View>
                <Text style={styles.alertCardDesc}>
                  A portaria está com o WhatsApp desconectado. Notificações não estão sendo enviadas.
                </Text>
                {item.admin && (
                  <Text style={styles.alertCardContact}>
                    Contato Admin: {item.admin.name} ({item.admin.phone || item.admin.email})
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.alertActionBtn}
                onPress={() => {
                  setOrgSearch(item.name);
                  setActiveTab('organizations');
                }}
              >
                <ChevronRight size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
          ))}

          {/* Alerta de Pagamento Pendente */}
          {metrics.alerts?.pendingPayments?.map((item: any) => (
            <View key={`pay-${item.id}`} style={styles.alertCardAmber}>
              <View style={styles.alertIconCircleAmber}>
                <AlertTriangle size={20} color="#D97706" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.alertCardTitle}>{item.name}</Text>
                <Text style={styles.alertCardDesc}>
                  Assinatura pendente ({formatCurrency(item.monthlyPrice)}/mês). Cobrança aguardando confirmação.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.quickPayBtn}
                onPress={() => handleQuickPaymentStatus(item.id, 'ACTIVE')}
              >
                <Check size={14} color="#FFFFFF" />
                <Text style={styles.quickPayBtnText}>Pagar</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Ações Rápidas de Gestão */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionHeaderTitle}>AÇÕES RÁPIDAS</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionQuickCard}
            onPress={() => setIsCreateOrgModalOpen(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#EFF6FF' }]}>
              <Building2 size={24} color="#2563EB" />
            </View>
            <Text style={styles.actionQuickTitle}>+ Nova Empresa</Text>
            <Text style={styles.actionQuickSubtitle}>Cadastrar condomínio</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionQuickCard}
            onPress={() => {
              if (organizations.length > 0) {
                setUserForm((prev) => ({ ...prev, organizationId: organizations[0].id }));
              }
              setIsCreateUserModalOpen(true);
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#F0FDF4' }]}>
              <Users size={24} color="#16A34A" />
            </View>
            <Text style={styles.actionQuickTitle}>+ Novo Usuário</Text>
            <Text style={styles.actionQuickSubtitle}>Porteiro ou admin</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Novas Empresas Cadastradas Recentemente */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeaderBetween}>
          <Text style={styles.sectionHeaderTitle}>EMPRESAS RECENTES</Text>
          <TouchableOpacity onPress={() => setActiveTab('organizations')}>
            <Text style={styles.seeAllLink}>Ver todas ({organizations.length})</Text>
          </TouchableOpacity>
        </View>

        {metrics.recentOrganizations?.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Nenhuma empresa cadastrada ainda.</Text>
          </View>
        ) : (
          metrics.recentOrganizations?.map((org: any) => (
            <View key={org.id} style={styles.recentOrgCard}>
              <View style={styles.recentOrgHeader}>
                <View>
                  <Text style={styles.recentOrgName}>{org.name}</Text>
                  <Text style={styles.recentOrgSlug}>{org.slug}.combateportaria.com</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor:
                          org.paymentStatus === 'ACTIVE'
                            ? '#DCFCE7'
                            : org.paymentStatus === 'TRIAL'
                              ? '#FEF3C7'
                              : '#FEE2E2',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        {
                          color:
                            org.paymentStatus === 'ACTIVE'
                              ? '#15803D'
                              : org.paymentStatus === 'TRIAL'
                                ? '#B45309'
                                : '#B91C1C',
                        },
                      ]}
                    >
                      {org.paymentStatus === 'ACTIVE'
                        ? 'PAGO & ATIVO'
                        : org.paymentStatus === 'TRIAL'
                          ? 'TESTE 7 DIAS'
                          : 'PENDENTE'}
                    </Text>
                  </View>
                  <Text style={styles.recentOrgPrice}>{formatCurrency(org.monthlyPrice)}/mês</Text>
                </View>
              </View>

              <View style={styles.recentOrgFooter}>
                <View style={styles.recentOrgInfoRow}>
                  <Users size={13} color="#64748B" />
                  <Text style={styles.recentOrgInfoText}>{org.usersCount || 0} operadores</Text>
                  <Text style={styles.recentOrgDot}>•</Text>
                  <View
                    style={[
                      styles.waStatusDot,
                      { backgroundColor: org.whatsappStatus === 'CONNECTED' ? '#10B981' : '#EF4444' },
                    ]}
                  />
                  <Text style={styles.recentOrgInfoText}>
                    WhatsApp {org.whatsappStatus === 'CONNECTED' ? 'Online' : 'Desconectado'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setEditingOrg(org);
                    setIsEditOrgModalOpen(true);
                  }}
                  style={styles.recentEditBtn}
                >
                  <Edit2 size={14} color="#2563EB" />
                  <Text style={styles.recentEditBtnText}>Gerenciar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  // 2. ABA EMPRESAS (GESTÃO COMPLETA)
  const renderOrganizationsTab = () => (
    <View style={{ flex: 1 }}>
      {/* Barra de Busca & Botão Nova Empresa */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBox}>
          <Search size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nome, slug ou CNPJ..."
            placeholderTextColor="#94A3B8"
            value={orgSearch}
            onChangeText={setOrgSearch}
          />
          {orgSearch.length > 0 && (
            <TouchableOpacity onPress={() => setOrgSearch('')}>
              <X size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setIsCreateOrgModalOpen(true)}
          activeOpacity={0.8}
        >
          <Plus size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Chips de Filtros de Status */}
      <View style={styles.chipsScrollWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
          {[
            { key: 'ALL', label: `Todas (${organizations.length})` },
            { key: 'ACTIVE', label: 'Pagas & Ativas' },
            { key: 'TRIAL', label: 'Em Teste (7d)' },
            { key: 'PENDING', label: 'Pendentes' },
            { key: 'SUSPENDED', label: 'Suspensas' },
            { key: 'WA_OFF', label: 'WhatsApp Off' },
          ].map((chip) => (
            <TouchableOpacity
              key={chip.key}
              style={[styles.chipItem, orgStatusFilter === chip.key && styles.chipItemActive]}
              onPress={() => setOrgStatusFilter(chip.key as any)}
            >
              <Text style={[styles.chipText, orgStatusFilter === chip.key && styles.chipTextActive]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Lista de Empresas */}
      <ScrollView
        style={styles.tabScroll}
        contentContainerStyle={{ paddingBottom: bottomInset + 80 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        {filteredOrganizations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Building2 size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>Nenhuma empresa encontrada</Text>
            <Text style={styles.emptySubtitle}>Tente ajustar a busca ou filtro selecionado.</Text>
          </View>
        ) : (
          filteredOrganizations.map((org) => {
            const isWAConnected = org.whatsappStatus === 'CONNECTED';
            const isSuspended = !org.isActive || org.paymentStatus === 'SUSPENDED';

            return (
              <View key={org.id} style={[styles.orgCard, isSuspended && styles.orgCardSuspended]}>
                <View style={styles.orgCardTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orgCardTitle}>{org.name}</Text>
                    <Text style={styles.orgCardSub}>Slug: {org.slug} {org.document ? `• Doc: ${org.document}` : ''}</Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor:
                            org.paymentStatus === 'ACTIVE'
                              ? '#DCFCE7'
                              : org.paymentStatus === 'TRIAL'
                                ? '#FEF3C7'
                                : '#FEE2E2',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          {
                            color:
                              org.paymentStatus === 'ACTIVE'
                                ? '#15803D'
                                : org.paymentStatus === 'TRIAL'
                                  ? '#B45309'
                                  : '#B91C1C',
                          },
                        ]}
                      >
                        {org.paymentStatus === 'ACTIVE'
                          ? 'PAGO'
                          : org.paymentStatus === 'TRIAL'
                            ? 'TESTE 7D'
                            : 'PENDENTE'}
                      </Text>
                    </View>
                    <Text style={styles.orgPriceTag}>{formatCurrency(org.monthlyPrice)}/mês</Text>
                  </View>
                </View>

                {/* Métricas e Status de Conexão */}
                <View style={styles.orgCardStatsRow}>
                  <View style={styles.orgStatCol}>
                    <Text style={styles.orgStatNumber}>{org._count?.users || 0}</Text>
                    <Text style={styles.orgStatLabel}>Operadores</Text>
                  </View>
                  <View style={styles.orgStatCol}>
                    <Text style={styles.orgStatNumber}>{org._count?.clients || 0}</Text>
                    <Text style={styles.orgStatLabel}>Moradores</Text>
                  </View>
                  <View style={styles.orgStatCol}>
                    <Text style={styles.orgStatNumber}>{org._count?.visitRequests || 0}</Text>
                    <Text style={styles.orgStatLabel}>Visitas</Text>
                  </View>
                  <View style={styles.orgStatCol}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={[
                          styles.waDotSmall,
                          { backgroundColor: isWAConnected ? '#10B981' : '#EF4444' },
                        ]}
                      />
                      <Text
                        style={[
                          styles.waStatusText,
                          { color: isWAConnected ? '#15803D' : '#DC2626' },
                        ]}
                      >
                        {isWAConnected ? 'Online' : 'Off'}
                      </Text>
                    </View>
                    <Text style={styles.orgStatLabel}>WhatsApp</Text>
                  </View>
                </View>

                {/* Barra de Ações: Editar, Suspender, Usuários, Excluir */}
                <View style={styles.orgCardActionsRow}>
                  <TouchableOpacity
                    style={styles.actionBtnSecondary}
                    onPress={() => {
                      setSelectedOrgFilter(org.id);
                      setActiveTab('users');
                    }}
                  >
                    <Users size={14} color="#334155" />
                    <Text style={styles.actionBtnText}>Usuários</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtnSecondary}
                    onPress={() => {
                      setEditingOrg(org);
                      setIsEditOrgModalOpen(true);
                    }}
                  >
                    <Edit2 size={14} color="#2563EB" />
                    <Text style={[styles.actionBtnText, { color: '#2563EB' }]}>Editar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionBtnSecondary,
                      { backgroundColor: org.isActive ? '#FFF1F2' : '#F0FDF4' },
                    ]}
                    onPress={() => handleToggleOrgActive(org)}
                  >
                    <Text
                      style={[
                        styles.actionBtnText,
                        { color: org.isActive ? '#E11D48' : '#16A34A', fontWeight: '700' },
                      ]}
                    >
                      {org.isActive ? 'Suspender' : 'Ativar'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionDeleteIconBtn}
                    onPress={() => confirmDeleteOrg(org)}
                  >
                    <Trash2 size={16} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );

  // 3. ABA USUÁRIOS (MULTI-EMPRESA)
  const renderUsersTab = () => (
    <View style={{ flex: 1 }}>
      {/* Filtro de Empresa & Busca */}
      <View style={styles.usersHeaderBox}>
        {/* Seletor Horizontal de Empresas */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          <TouchableOpacity
            style={[styles.orgFilterChip, selectedOrgFilter === 'ALL' && styles.orgFilterChipActive]}
            onPress={() => setSelectedOrgFilter('ALL')}
          >
            <Text
              style={[
                styles.orgFilterChipText,
                selectedOrgFilter === 'ALL' && styles.orgFilterChipTextActive,
              ]}
            >
              Todas as Empresas ({usersList.length})
            </Text>
          </TouchableOpacity>
          {organizations.map((o) => (
            <TouchableOpacity
              key={o.id}
              style={[styles.orgFilterChip, selectedOrgFilter === o.id && styles.orgFilterChipActive]}
              onPress={() => setSelectedOrgFilter(o.id)}
            >
              <Text
                style={[
                  styles.orgFilterChipText,
                  selectedOrgFilter === o.id && styles.orgFilterChipTextActive,
                ]}
              >
                {o.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.searchBarContainerUsers}>
          <View style={styles.searchBox}>
            <Search size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nome ou e-mail..."
              placeholderTextColor="#94A3B8"
              value={userSearch}
              onChangeText={setUserSearch}
            />
            {userSearch.length > 0 && (
              <TouchableOpacity onPress={() => setUserSearch('')}>
                <X size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => {
              if (selectedOrgFilter !== 'ALL') {
                setUserForm((prev) => ({ ...prev, organizationId: selectedOrgFilter }));
              } else if (organizations.length > 0) {
                setUserForm((prev) => ({ ...prev, organizationId: organizations[0].id }));
              }
              setIsCreateUserModalOpen(true);
            }}
            activeOpacity={0.8}
          >
            <Plus size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista de Usuários */}
      <ScrollView
        style={styles.tabScroll}
        contentContainerStyle={{ paddingBottom: bottomInset + 80 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        {filteredUsers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Users size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>Nenhum usuário encontrado</Text>
            <Text style={styles.emptySubtitle}>Crie novos operadores ou selecione outra empresa.</Text>
          </View>
        ) : (
          filteredUsers.map((u) => {
            const roleLabels: Record<string, string> = {
              SUPER_ADMIN: 'Super Admin',
              ADMIN: 'Administrador',
              SUPERVISOR: 'Supervisor',
              CONCIERGE: 'Porteiro / Operador',
            };

            const roleColors: Record<string, { bg: string; text: string }> = {
              SUPER_ADMIN: { bg: '#F3E8FF', text: '#7E22CE' },
              ADMIN: { bg: '#EFF6FF', text: '#1D4ED8' },
              SUPERVISOR: { bg: '#FEF3C7', text: '#B45309' },
              CONCIERGE: { bg: '#F1F5F9', text: '#475569' },
            };

            const rc = roleColors[u.role] || { bg: '#F1F5F9', text: '#475569' };

            return (
              <View key={u.id} style={styles.userCard}>
                <View style={styles.userCardTopRow}>
                  <View style={styles.userAvatarBox}>
                    <Text style={styles.userAvatarInitials}>
                      {u.name?.slice(0, 2).toUpperCase() || 'US'}
                    </Text>
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.userNameText}>{u.name}</Text>
                      {!u.isActive && (
                        <View style={styles.userInactivePill}>
                          <Text style={styles.userInactivePillText}>INATIVO</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.userEmailText}>{u.email}</Text>
                    {u.phone && <Text style={styles.userPhoneText}>{u.phone}</Text>}

                    <View style={styles.userOrgBadgeRow}>
                      <Building2 size={12} color="#64748B" />
                      <Text style={styles.userOrgNameText}>{u.organization?.name || 'SaaS'}</Text>
                    </View>
                  </View>

                  <View style={[styles.roleBadge, { backgroundColor: rc.bg }]}>
                    <Text style={[styles.roleBadgeText, { color: rc.text }]}>
                      {roleLabels[u.role] || u.role}
                    </Text>
                  </View>
                </View>

                {/* Ações: Redefinir Senha, Editar, Excluir */}
                <View style={styles.userCardActionsRow}>
                  <TouchableOpacity
                    style={styles.userActionBtn}
                    onPress={() => {
                      setTargetUserForPassword(u);
                      setNewPasswordInput('');
                      setIsChangePasswordModalOpen(true);
                    }}
                  >
                    <Key size={14} color="#D97706" />
                    <Text style={[styles.userActionBtnText, { color: '#B45309' }]}>Alterar Senha</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.userActionBtn}
                    onPress={() => {
                      setEditingUser(u);
                      setIsEditUserModalOpen(true);
                    }}
                  >
                    <Edit2 size={14} color="#2563EB" />
                    <Text style={[styles.userActionBtnText, { color: '#2563EB' }]}>Editar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.userActionBtnDelete}
                    onPress={() => confirmDeleteUser(u)}
                  >
                    <Trash2 size={15} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );

  // 4. ABA FINANCEIRO & ASSINATURAS
  const renderFinanceTab = () => (
    <ScrollView
      style={styles.tabScroll}
      contentContainerStyle={{ paddingBottom: bottomInset + 80 }}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.financeSummaryCard}>
        <Text style={styles.financeSummaryTitle}>CONTROLE DE ASSINATURAS & COBRANÇA</Text>
        <Text style={styles.financeSummarySubtitle}>
          Gerencie o faturamento de cada empresa, libere períodos ou suspenda inadimplentes.
        </Text>

        <View style={styles.financeMetricsRow}>
          <View style={styles.financeBox}>
            <Text style={styles.financeBoxVal}>{metrics.subscriptions?.paidActive || 0}</Text>
            <Text style={styles.financeBoxLabel}>Assinantes Ativos</Text>
            <Text style={styles.financeBoxMoney}>{formatCurrency(metrics.subscriptions?.totalMRR || 0)}/mês</Text>
          </View>
          <View style={styles.financeBox}>
            <Text style={[styles.financeBoxVal, { color: '#F59E0B' }]}>{metrics.subscriptions?.trial || 0}</Text>
            <Text style={styles.financeBoxLabel}>Em Período de Teste</Text>
            <Text style={styles.financeBoxMoney}>{formatCurrency(metrics.subscriptions?.trialMRR || 0)} potencial</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionHeaderTitle}>EMPRESAS & SITUAÇÃO FINANCEIRA</Text>

        {organizations.map((org) => (
          <View key={org.id} style={styles.financeOrgCard}>
            <View style={styles.financeOrgTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.financeOrgName}>{org.name}</Text>
                <Text style={styles.financeOrgPlan}>Plano: {org.plan || 'PRO'} • {formatCurrency(org.monthlyPrice)}/mês</Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor:
                      org.paymentStatus === 'ACTIVE'
                        ? '#DCFCE7'
                        : org.paymentStatus === 'TRIAL'
                          ? '#FEF3C7'
                          : '#FEE2E2',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    {
                      color:
                        org.paymentStatus === 'ACTIVE'
                          ? '#15803D'
                          : org.paymentStatus === 'TRIAL'
                            ? '#B45309'
                            : '#B91C1C',
                    },
                  ]}
                >
                  {org.paymentStatus === 'ACTIVE'
                    ? 'PAGO & ATIVO'
                    : org.paymentStatus === 'TRIAL'
                      ? 'TESTE 7 DIAS'
                      : 'PENDENTE'}
                </Text>
              </View>
            </View>

            <View style={styles.financeActionsBar}>
              <TouchableOpacity
                style={[styles.financeBtn, { backgroundColor: '#DCFCE7' }]}
                onPress={() => handleQuickPaymentStatus(org.id, 'ACTIVE')}
              >
                <Check size={14} color="#15803D" />
                <Text style={[styles.financeBtnText, { color: '#15803D' }]}>Marcar como Pago (+30d)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.financeBtn, { backgroundColor: '#FEF3C7' }]}
                onPress={() => handleQuickPaymentStatus(org.id, 'TRIAL')}
              >
                <Clock size={14} color="#B45309" />
                <Text style={[styles.financeBtnText, { color: '#B45309' }]}>Estender Teste</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.financeBtn, { backgroundColor: '#FEE2E2' }]}
                onPress={() => handleQuickPaymentStatus(org.id, 'PENDING')}
              >
                <AlertTriangle size={14} color="#B91C1C" />
                <Text style={[styles.financeBtnText, { color: '#B91C1C' }]}>Pendente</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  // 5. ABA PERFIL DO SUPER ADMIN
  const renderProfileTab = () => (
    <ScrollView style={styles.tabScroll} contentContainerStyle={{ paddingBottom: bottomInset + 80 }}>
      <View style={styles.profileMasterCard}>
        <View style={styles.masterAvatarCircle}>
          <ShieldCheck size={40} color="#FFFFFF" />
        </View>
        <Text style={styles.masterName}>{user?.name || 'Jefferson Brito'}</Text>
        <Text style={styles.masterEmail}>{user?.email}</Text>
        <View style={styles.superAdminTag}>
          <Text style={styles.superAdminTagText}>SUPER ADMINISTRADOR (DONO DO SAAS)</Text>
        </View>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionHeaderTitle}>SEGURANÇA DA CONTA</Text>

        <TouchableOpacity
          style={styles.profileMenuRow}
          onPress={() => {
            setTargetUserForPassword(user);
            setNewPasswordInput('');
            setIsChangePasswordModalOpen(true);
          }}
        >
          <View style={styles.profileMenuIcon}>
            <Key size={20} color="#2563EB" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.profileMenuTitle}>Alterar Minha Senha</Text>
            <Text style={styles.profileMenuDesc}>Redefina a senha de acesso mestre do SaaS</Text>
          </View>
          <ChevronRight size={18} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.profileMenuRow, { marginTop: 12 }]}
          onPress={onRefresh}
        >
          <View style={styles.profileMenuIcon}>
            <RefreshCw size={20} color="#10B981" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.profileMenuTitle}>Sincronizar Banco de Dados</Text>
            <Text style={styles.profileMenuDesc}>Recarregar métricas em tempo real</Text>
          </View>
          <ChevronRight size={18} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.logoutBtn, { marginTop: 24 }]}
          onPress={signOut}
          activeOpacity={0.85}
        >
          <LogOut size={20} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.logoutBtnText}>Sair da Conta Mestre</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0B132B" />

      {/* Top Header Fixo do Super Admin */}
      <View style={[styles.superHeader, { paddingTop: topInset }]}>
        <View style={styles.superHeaderTop}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ShieldCheck size={20} color="#60A5FA" style={{ marginRight: 6 }} />
              <Text style={styles.superHeaderBadge}>PAINEL SAAS MASTER</Text>
            </View>
            <Text style={styles.superHeaderTitle}>Combate Portaria</Text>
          </View>

          <TouchableOpacity style={styles.refreshIconBtn} onPress={onRefresh}>
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <RefreshCw size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>

        {/* Resumo Rápido no Header */}
        <View style={styles.headerMiniMetricsRow}>
          <View style={styles.headerMiniMetric}>
            <Text style={styles.headerMiniMetricVal}>{metrics.organizations?.total || 0}</Text>
            <Text style={styles.headerMiniMetricLabel}>Empresas</Text>
          </View>
          <View style={styles.headerMiniMetricSep} />
          <View style={styles.headerMiniMetric}>
            <Text style={[styles.headerMiniMetricVal, { color: '#34D399' }]}>
              {metrics.subscriptions?.paidActive || 0}
            </Text>
            <Text style={styles.headerMiniMetricLabel}>Assinantes</Text>
          </View>
          <View style={styles.headerMiniMetricSep} />
          <View style={styles.headerMiniMetric}>
            <Text style={[styles.headerMiniMetricVal, { color: '#FBBF24' }]}>
              {metrics.subscriptions?.trial || 0}
            </Text>
            <Text style={styles.headerMiniMetricLabel}>Trial 7d</Text>
          </View>
          <View style={styles.headerMiniMetricSep} />
          <View style={styles.headerMiniMetric}>
            <Text
              style={[
                styles.headerMiniMetricVal,
                { color: metrics.whatsapp?.disconnected > 0 ? '#F87171' : '#34D399' },
              ]}
            >
              {metrics.whatsapp?.disconnected || 0}
            </Text>
            <Text style={styles.headerMiniMetricLabel}>WA Off</Text>
          </View>
        </View>
      </View>

      {/* Conteúdo Dinâmico por Aba */}
      <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        {isLoading ? (
          <View style={styles.loadingScreen}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Carregando gestão do SaaS...</Text>
          </View>
        ) : (
          <>
            {activeTab === 'overview' && renderOverviewTab()}
            {activeTab === 'organizations' && renderOrganizationsTab()}
            {activeTab === 'users' && renderUsersTab()}
            {activeTab === 'finance' && renderFinanceTab()}
            {activeTab === 'profile' && renderProfileTab()}
          </>
        )}
      </View>

      {/* Barra de Navegação Inferior Exclusiva do Super Admin */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(bottomInset, 10) }]}>
        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setActiveTab('overview')}
          activeOpacity={0.8}
        >
          <BarChart3 size={22} color={activeTab === 'overview' ? '#2563EB' : '#94A3B8'} />
          <Text style={[styles.navTabLabel, activeTab === 'overview' && styles.navTabLabelActive]}>
            Visão Geral
          </Text>
          {activeTab === 'overview' && <View style={styles.navIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setActiveTab('organizations')}
          activeOpacity={0.8}
        >
          <Building2 size={22} color={activeTab === 'organizations' ? '#2563EB' : '#94A3B8'} />
          <Text style={[styles.navTabLabel, activeTab === 'organizations' && styles.navTabLabelActive]}>
            Empresas
          </Text>
          {activeTab === 'organizations' && <View style={styles.navIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setActiveTab('users')}
          activeOpacity={0.8}
        >
          <Users size={22} color={activeTab === 'users' ? '#2563EB' : '#94A3B8'} />
          <Text style={[styles.navTabLabel, activeTab === 'users' && styles.navTabLabelActive]}>
            Usuários
          </Text>
          {activeTab === 'users' && <View style={styles.navIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setActiveTab('finance')}
          activeOpacity={0.8}
        >
          <CreditCard size={22} color={activeTab === 'finance' ? '#2563EB' : '#94A3B8'} />
          <Text style={[styles.navTabLabel, activeTab === 'finance' && styles.navTabLabelActive]}>
            Financeiro
          </Text>
          {activeTab === 'finance' && <View style={styles.navIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setActiveTab('profile')}
          activeOpacity={0.8}
        >
          <User size={22} color={activeTab === 'profile' ? '#2563EB' : '#94A3B8'} />
          <Text style={[styles.navTabLabel, activeTab === 'profile' && styles.navTabLabelActive]}>
            Perfil
          </Text>
          {activeTab === 'profile' && <View style={styles.navIndicator} />}
        </TouchableOpacity>
      </View>

      {/* ─── MODAIS ────────────────────────────────────────────── */}

      {/* MODAL: + NOVA EMPRESA */}
      <Modal
        visible={isCreateOrgModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsCreateOrgModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeaderTitle}>Cadastrar Nova Empresa</Text>
                <Text style={styles.modalHeaderSubtitle}>Criar condomínio ou empresa cliente</Text>
              </View>
              <TouchableOpacity onPress={() => setIsCreateOrgModalOpen(false)}>
                <X size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.formGroupTitle}>DADOS DO CLIENTE / CONDOMÍNIO</Text>
              <Text style={styles.inputLabel}>Nome da Empresa ou Condomínio *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: Residencial Flores, Logística ABC"
                placeholderTextColor="#94A3B8"
                value={orgForm.organizationName}
                onChangeText={(t) => setOrgForm((prev) => ({ ...prev, organizationName: t }))}
              />

              <Text style={styles.inputLabel}>CNPJ ou CPF (Opcional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: 00.000.000/0001-00"
                placeholderTextColor="#94A3B8"
                value={orgForm.organizationDocument}
                onChangeText={(t) => setOrgForm((prev) => ({ ...prev, organizationDocument: t }))}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Plano</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="PRO, ENTERPRISE"
                    placeholderTextColor="#94A3B8"
                    value={orgForm.plan}
                    onChangeText={(t) => setOrgForm((prev) => ({ ...prev, plan: t }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Valor Mensal (R$)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="149.90"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={orgForm.monthlyPrice}
                    onChangeText={(t) => setOrgForm((prev) => ({ ...prev, monthlyPrice: t }))}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Dias de Teste Grátis (Trial)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="7"
                keyboardType="numeric"
                placeholderTextColor="#94A3B8"
                value={orgForm.trialDays}
                onChangeText={(t) => setOrgForm((prev) => ({ ...prev, trialDays: t }))}
              />

              <Text style={[styles.formGroupTitle, { marginTop: 16 }]}>PRIMEIRO ADMINISTRADOR</Text>
              <Text style={styles.inputLabel}>Nome do Administrador *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: Síndico Carlos Silva"
                placeholderTextColor="#94A3B8"
                value={orgForm.adminName}
                onChangeText={(t) => setOrgForm((prev) => ({ ...prev, adminName: t }))}
              />

              <Text style={styles.inputLabel}>E-mail de Login *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="sindico@condominio.com"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                keyboardType="email-address"
                value={orgForm.adminEmail}
                onChangeText={(t) => setOrgForm((prev) => ({ ...prev, adminEmail: t }))}
              />

              <Text style={styles.inputLabel}>Senha Provisória *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor="#94A3B8"
                secureTextEntry
                value={orgForm.adminPassword}
                onChangeText={(t) => setOrgForm((prev) => ({ ...prev, adminPassword: t }))}
              />

              <Text style={styles.inputLabel}>WhatsApp / Telefone (Opcional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: 11999998888"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={orgForm.adminPhone}
                onChangeText={(t) => setOrgForm((prev) => ({ ...prev, adminPhone: t }))}
              />
            </ScrollView>

            <TouchableOpacity
              style={styles.submitModalBtn}
              onPress={handleCreateOrg}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitModalBtnText}>Cadastrar Empresa</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: EDITAR EMPRESA */}
      <Modal
        visible={isEditOrgModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEditOrgModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeaderTitle}>Editar Empresa</Text>
                <Text style={styles.modalHeaderSubtitle}>{editingOrg?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsEditOrgModalOpen(false)}>
                <X size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {editingOrg && (
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>Nome da Empresa</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editingOrg.name}
                  onChangeText={(t) => setEditingOrg((prev: any) => ({ ...prev, name: t }))}
                />

                <Text style={styles.inputLabel}>Documento (CNPJ/CPF)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editingOrg.document || ''}
                  onChangeText={(t) => setEditingOrg((prev: any) => ({ ...prev, document: t }))}
                />

                <Text style={styles.inputLabel}>Valor Mensal da Assinatura (R$)</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={String(editingOrg.monthlyPrice || '')}
                  onChangeText={(t) => setEditingOrg((prev: any) => ({ ...prev, monthlyPrice: t }))}
                />

                <Text style={styles.inputLabel}>Status de Pagamento</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
                  {['ACTIVE', 'TRIAL', 'PENDING', 'SUSPENDED'].map((st) => (
                    <TouchableOpacity
                      key={st}
                      style={[
                        styles.statusSelectPill,
                        editingOrg.paymentStatus === st && styles.statusSelectPillActive,
                      ]}
                      onPress={() => setEditingOrg((prev: any) => ({ ...prev, paymentStatus: st }))}
                    >
                      <Text
                        style={[
                          styles.statusSelectText,
                          editingOrg.paymentStatus === st && styles.statusSelectTextActive,
                        ]}
                      >
                        {st === 'ACTIVE'
                          ? 'Pago'
                          : st === 'TRIAL'
                            ? 'Teste'
                            : st === 'PENDING'
                              ? 'Pendente'
                              : 'Suspenso'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.submitModalBtn}
              onPress={handleUpdateOrg}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitModalBtnText}>Salvar Alterações</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: + NOVO USUÁRIO */}
      <Modal
        visible={isCreateUserModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsCreateUserModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeaderTitle}>Novo Usuário</Text>
                <Text style={styles.modalHeaderSubtitle}>Criar operador em uma empresa</Text>
              </View>
              <TouchableOpacity onPress={() => setIsCreateUserModalOpen(false)}>
                <X size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Selecione a Empresa / Condomínio *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {organizations.map((org) => (
                  <TouchableOpacity
                    key={org.id}
                    style={[
                      styles.orgPickerChip,
                      userForm.organizationId === org.id && styles.orgPickerChipActive,
                    ]}
                    onPress={() => setUserForm((prev) => ({ ...prev, organizationId: org.id }))}
                  >
                    <Text
                      style={[
                        styles.orgPickerChipText,
                        userForm.organizationId === org.id && styles.orgPickerChipTextActive,
                      ]}
                    >
                      {org.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Nome Completo *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: João Silva"
                placeholderTextColor="#94A3B8"
                value={userForm.name}
                onChangeText={(t) => setUserForm((prev) => ({ ...prev, name: t }))}
              />

              <Text style={styles.inputLabel}>E-mail de Acesso *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="joao@condominio.com"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                keyboardType="email-address"
                value={userForm.email}
                onChangeText={(t) => setUserForm((prev) => ({ ...prev, email: t }))}
              />

              <Text style={styles.inputLabel}>Senha Inicial *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor="#94A3B8"
                secureTextEntry
                value={userForm.password}
                onChangeText={(t) => setUserForm((prev) => ({ ...prev, password: t }))}
              />

              <Text style={styles.inputLabel}>Telefone / WhatsApp (Opcional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: 11988887777"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={userForm.phone}
                onChangeText={(t) => setUserForm((prev) => ({ ...prev, phone: t }))}
              />

              <Text style={styles.inputLabel}>Função / Perfil</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
                {[
                  { key: 'CONCIERGE', label: 'Porteiro' },
                  { key: 'SUPERVISOR', label: 'Supervisor' },
                  { key: 'ADMIN', label: 'Administrador' },
                ].map((r) => (
                  <TouchableOpacity
                    key={r.key}
                    style={[
                      styles.statusSelectPill,
                      userForm.role === r.key && styles.statusSelectPillActive,
                    ]}
                    onPress={() => setUserForm((prev) => ({ ...prev, role: r.key }))}
                  >
                    <Text
                      style={[
                        styles.statusSelectText,
                        userForm.role === r.key && styles.statusSelectTextActive,
                      ]}
                    >
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.submitModalBtn}
              onPress={handleCreateUser}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitModalBtnText}>Criar Usuário</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: EDITAR USUÁRIO */}
      <Modal
        visible={isEditUserModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEditUserModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeaderTitle}>Editar Usuário</Text>
                <Text style={styles.modalHeaderSubtitle}>{editingUser?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsEditUserModalOpen(false)}>
                <X size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {editingUser && (
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>Nome</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editingUser.name}
                  onChangeText={(t) => setEditingUser((prev: any) => ({ ...prev, name: t }))}
                />

                <Text style={styles.inputLabel}>E-mail</Text>
                <TextInput
                  style={styles.modalInput}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={editingUser.email}
                  onChangeText={(t) => setEditingUser((prev: any) => ({ ...prev, email: t }))}
                />

                <Text style={styles.inputLabel}>Telefone</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="phone-pad"
                  value={editingUser.phone || ''}
                  onChangeText={(t) => setEditingUser((prev: any) => ({ ...prev, phone: t }))}
                />

                <Text style={styles.inputLabel}>Função</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
                  {[
                    { key: 'CONCIERGE', label: 'Porteiro' },
                    { key: 'SUPERVISOR', label: 'Supervisor' },
                    { key: 'ADMIN', label: 'Administrador' },
                  ].map((r) => (
                    <TouchableOpacity
                      key={r.key}
                      style={[
                        styles.statusSelectPill,
                        editingUser.role === r.key && styles.statusSelectPillActive,
                      ]}
                      onPress={() => setEditingUser((prev: any) => ({ ...prev, role: r.key }))}
                    >
                      <Text
                        style={[
                          styles.statusSelectText,
                          editingUser.role === r.key && styles.statusSelectTextActive,
                        ]}
                      >
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.toggleUserActiveBtn,
                    { backgroundColor: editingUser.isActive ? '#EFF6FF' : '#FEF2F2' },
                  ]}
                  onPress={() =>
                    setEditingUser((prev: any) => ({ ...prev, isActive: !prev.isActive }))
                  }
                >
                  <Text
                    style={[
                      styles.toggleUserActiveText,
                      { color: editingUser.isActive ? '#2563EB' : '#DC2626' },
                    ]}
                  >
                    Status: {editingUser.isActive ? 'USUÁRIO ATIVO' : 'USUÁRIO INATIVO'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.submitModalBtn}
              onPress={handleUpdateUser}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitModalBtnText}>Salvar Alterações</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: ALTERAR SENHA DO USUÁRIO */}
      <Modal
        visible={isChangePasswordModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsChangePasswordModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainerSmall}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeaderTitle}>Definir Nova Senha</Text>
                <Text style={styles.modalHeaderSubtitle}>Para {targetUserForPassword?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsChangePasswordModalOpen(false)}>
                <X size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Digite a Nova Senha *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              value={newPasswordInput}
              onChangeText={setNewPasswordInput}
            />

            <TouchableOpacity
              style={[styles.submitModalBtn, { marginTop: 12 }]}
              onPress={handleChangePassword}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitModalBtnText}>Salvar Nova Senha</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <CustomConfirmModal
        visible={confirmDeleteModal.visible}
        title={confirmDeleteModal.title}
        message={confirmDeleteModal.description}
        confirmText="Sim, Excluir"
        cancelText="Cancelar"
        type="danger"
        isLoading={isSubmitting}
        onConfirm={executeDelete}
        onCancel={() => setConfirmDeleteModal((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#0B132B',
  },
  tabScroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Header Mestre
  superHeader: {
    backgroundColor: '#0B132B',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  superHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  superHeaderBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#60A5FA',
    letterSpacing: 1.2,
  },
  superHeaderTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  refreshIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMiniMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  headerMiniMetric: {
    alignItems: 'center',
    flex: 1,
  },
  headerMiniMetricVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerMiniMetricLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 2,
  },
  headerMiniMetricSep: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Loading
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },

  // Hero Card de Faturamento
  heroFinanceCard: {
    backgroundColor: '#165337',
    margin: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  heroAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 4,
  },
  heroPeriod: {
    fontSize: 12,
    color: '#34D399',
    fontWeight: '600',
    marginTop: 2,
  },
  heroIconBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 16,
  },
  heroGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroStatItem: {
    alignItems: 'center',
  },
  heroStatNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroStatLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 2,
  },

  // Seções e Títulos
  sectionContainer: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 10,
  },
  sectionHeaderBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  seeAllLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },

  // Alertas Vermelho e Amarelo
  alertCardRed: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  alertIconCircleRed: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertCardAmber: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  alertIconCircleAmber: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  alertCardDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  alertCardContact: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
    marginTop: 4,
  },
  waOffBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  waOffBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  alertActionBtn: {
    padding: 6,
  },
  quickPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  quickPayBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 4,
  },

  // Ações Rápidas
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionQuickCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionQuickTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  actionQuickSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  // Cards de Empresas Recentes
  recentOrgCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  recentOrgHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  recentOrgName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  recentOrgSlug: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  recentOrgPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  recentOrgFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  recentOrgInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentOrgInfoText: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 4,
  },
  recentOrgDot: {
    marginHorizontal: 6,
    color: '#CBD5E1',
  },
  waStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  recentEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentEditBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
    marginLeft: 4,
  },

  // Barra de Busca e Filtros
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
  },
  searchBarContainerUsers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#0F172A',
  },
  createBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsScrollWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 8,
  },
  chipsContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chipItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipItemActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Lista de Organizações (Aba 2)
  orgCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  orgCardSuspended: {
    backgroundColor: '#FAFAFA',
    borderColor: '#F1F5F9',
    opacity: 0.85,
  },
  orgCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orgCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  orgCardSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  orgPriceTag: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  orgCardStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  orgStatCol: {
    alignItems: 'center',
    flex: 1,
  },
  orgStatNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  orgStatLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  waDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  waStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  orgCardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    gap: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  actionDeleteIconBtn: {
    marginLeft: 'auto',
    padding: 7,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },

  // Usuários (Aba 3)
  usersHeaderBox: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  orgFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  orgFilterChipActive: {
    backgroundColor: '#165337',
    borderColor: '#165337',
  },
  orgFilterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  orgFilterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  userCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  userAvatarBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarInitials: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  userEmailText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  userPhoneText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  userOrgBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  userOrgNameText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  userInactivePill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  userInactivePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  userCardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  userActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  userActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  userActionBtnDelete: {
    marginLeft: 'auto',
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },

  // Financeiro (Aba 4)
  financeSummaryCard: {
    backgroundColor: '#165337',
    margin: 16,
    borderRadius: 20,
    padding: 20,
  },
  financeSummaryTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  financeSummarySubtitle: {
    fontSize: 13,
    color: '#E2E8F0',
    marginTop: 4,
  },
  financeMetricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  financeBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 12,
  },
  financeBoxVal: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  financeBoxLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  financeBoxMoney: {
    fontSize: 12,
    fontWeight: '700',
    color: '#34D399',
    marginTop: 4,
  },
  financeOrgCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  financeOrgTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  financeOrgName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  financeOrgPlan: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  financeActionsBar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  financeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  financeBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Perfil Super Admin (Aba 5)
  profileMasterCard: {
    backgroundColor: '#165337',
    margin: 16,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  masterAvatarCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  masterName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  masterEmail: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  superAdminTag: {
    backgroundColor: 'rgba(96, 165, 250, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.4)',
  },
  superAdminTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#60A5FA',
    letterSpacing: 1,
  },
  profileMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  profileMenuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileMenuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  profileMenuDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    paddingVertical: 14,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },

  // Barra de Navegação Inferior
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: '#165337',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 10,
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 4,
  },
  navTabLabelActive: {
    color: '#60A5FA',
    fontWeight: '800',
  },
  navIndicator: {
    position: 'absolute',
    bottom: -6,
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#60A5FA',
  },

  // Estados Vazios
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
  },

  // Modais de Formulário
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalContainerSmall: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: '40%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalHeaderSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  formGroupTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 1,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 12,
  },
  submitModalBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  submitModalBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statusSelectPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusSelectPillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  statusSelectText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  statusSelectTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  orgPickerChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  orgPickerChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  orgPickerChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  orgPickerChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  toggleUserActiveBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  toggleUserActiveText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
