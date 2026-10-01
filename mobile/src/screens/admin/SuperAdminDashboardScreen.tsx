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
  BackHandler,
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
import { PasswordField } from '../../components/PasswordField';
import { CustomConfirmModal } from '../../components/CustomConfirmModal';
import { WhatsAppConfigScreen } from './WhatsAppConfigScreen';

type SuperAdminTab = 'overview' | 'organizations' | 'users' | 'finance' | 'profile';

function isInternalCompany(org?: { slug?: string; name?: string } | null) {
  if (!org) return false;
  const slug = org.slug || '';
  const name = org.name || '';
  return slug === 'saas-master' || slug.startsWith('system-') || /saas master/i.test(name);
}

export const SuperAdminDashboardScreen: React.FC = () => {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<SuperAdminTab>('overview');
  const [showPlatformWhatsapp, setShowPlatformWhatsapp] = useState(false);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeTab === 'overview') return false;
      setActiveTab('overview');
      return true;
    });
    return () => subscription.remove();
  }, [activeTab]);
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
    address: '',
    plan: 'PRO',
    monthlyPrice: '99.90',
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
  const [planPrice, setPlanPrice] = useState(99.9);
  const [planPriceInput, setPlanPriceInput] = useState('99,90');
  const [paymentOrg, setPaymentOrg] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Carregar Métricas e Dados
  const loadDashboardData = useCallback(async () => {
    try {
      const [metricsRes, orgsRes, usersRes] = await Promise.allSettled([
        api.get('/super-admin/dashboard'),
        api.get('/super-admin/organizations?limit=100'),
        api.get('/super-admin/users?limit=100'),
      ]);

      if (metricsRes.status === 'fulfilled' && metricsRes.value.data?.data) {
        const data = metricsRes.value.data.data;
        setMetrics({
          ...data,
          alerts: {
            whatsappDisconnected: (data.alerts?.whatsappDisconnected || []).filter((item: any) => !isInternalCompany(item)),
            pendingPayments: (data.alerts?.pendingPayments || []).filter((item: any) => !isInternalCompany(item)),
          },
          recentOrganizations: (data.recentOrganizations || []).filter((item: any) => !isInternalCompany(item)),
        });
      }
      if (orgsRes.status === 'fulfilled' && orgsRes.value.data?.organizations) {
        setOrganizations(orgsRes.value.data.organizations.filter((item: any) => !isInternalCompany(item)));
      }
      if (usersRes.status === 'fulfilled' && usersRes.value.data?.users) {
        setUsersList(usersRes.value.data.users);
      }
      try {
        const priceRes = await api.get('/super-admin/plan-price');
        const price = Number(priceRes.data?.data?.price);
        if (price > 0) {
          setPlanPrice(price);
          setPlanPriceInput(price.toFixed(2).replace('.', ','));
        }
      } catch {
        /* o valor local continua até o servidor publicar o preço */
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
        trialDays: parseInt(orgForm.trialDays, 10) || 7,
        address: orgForm.address.trim() || undefined,
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
        address: '',
        plan: 'PRO',
        monthlyPrice: '99.90',
        trialDays: '7',
      });
      loadDashboardData();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error?.message || err.response?.data?.message || 'Falha ao cadastrar empresa.');
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
        paymentStatus: editingOrg.paymentStatus,
        settings: { address: (editingOrg.address || '').trim() },
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

  const handleExpireTrial = (org: any) => {
    Alert.alert(
      'Remover Período de Teste?',
      `Deseja cancelar o teste gratuito de 7 dias da empresa "${org.name}"? As ações dos usuários serão imediatamente bloqueadas até que realizem o pagamento no Stripe.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sim, Encerrar Teste',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSubmitting(true);
              const res = await api.post(`/super-admin/organizations/${org.id}/expire-trial`);
              Alert.alert('Sucesso', res.data?.message || 'Período de teste removido.');
              loadDashboardData();
            } catch (err: any) {
              Alert.alert('Erro', err.response?.data?.message || 'Falha ao remover teste.');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleActivateSubscription = (org: any) => {
    Alert.alert(
      'Ativar Assinatura (30 Dias)?',
      `Liberar 30 dias de acesso completo para "${org.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sim, Ativar',
          onPress: async () => {
            try {
              setIsSubmitting(true);
              const res = await api.post(`/super-admin/organizations/${org.id}/activate-subscription`, { periodDays: 30 });
              Alert.alert('Sucesso', res.data?.message || 'Assinatura ativada por 30 dias!');
              loadDashboardData();
            } catch (err: any) {
              Alert.alert('Erro', err.response?.data?.message || 'Falha ao ativar assinatura.');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleToggleOrgActive = async (org: any) => {
    try {
      await api.patch(`/super-admin/organizations/${org.id}/toggle-active`);
      loadDashboardData();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Falha ao alterar status da empresa.');
    }
  };

  const readPaymentHistory = (data: any) => {
    if (Array.isArray(data?.paymentHistory) && data.paymentHistory.length > 0) return data.paymentHistory;
    let parsed = data?.settingsParsed;
    if (!parsed && typeof data?.settings === 'string') {
      try {
        parsed = JSON.parse(data.settings);
      } catch {
        parsed = null;
      }
    }
    if (Array.isArray(parsed?.paymentHistory) && parsed.paymentHistory.length > 0) return parsed.paymentHistory;
    if (parsed?.paidAt) {
      return [{
        id: 'paidAt',
        paidAt: parsed.paidAt,
        periodEnd: parsed.currentPeriodEnd || null,
        source: 'MANUAL',
        label: 'Último pagamento',
        amount: typeof parsed.monthlyPrice === 'number' ? parsed.monthlyPrice : 0,
      }];
    }
    return Array.isArray(data?.paymentHistory) ? data.paymentHistory : [];
  };

  const openPaymentHistory = async (org: any) => {
    setPaymentOrg(org);
    setPaymentHistory(readPaymentHistory(org));
    setLoadingHistory(true);
    try {
      const res = await api.get(`/super-admin/organizations/${org.id}`);
      const data = res.data?.data || res.data || {};
      setPaymentHistory(readPaymentHistory(data));
    } catch {
      setPaymentHistory(readPaymentHistory(org));
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleQuickPaymentStatus = async (orgId: string, paymentStatus: string) => {
    try {
      if (paymentStatus === 'ACTIVE') {
        await api.post(`/super-admin/subscriptions/${orgId}/activate`, { periodDays: 30 });
      } else if (paymentStatus === 'SUSPENDED') {
        await api.post(`/super-admin/subscriptions/${orgId}/suspend`);
      } else if (paymentStatus === 'TRIAL') {
        const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await api.patch(`/super-admin/subscriptions/${orgId}`, { paymentStatus: 'TRIAL', trialEndsAt });
      } else {
        await api.patch(`/super-admin/subscriptions/${orgId}`, { paymentStatus: 'PENDING' });
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
  const payingOrgs = organizations.filter((org) => org.paymentStatus === 'ACTIVE' && org.isActive);
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
            <Text style={styles.heroAmount}>{formatCurrency(payingOrgs.length * planPrice)}</Text>
            <Text style={styles.heroPeriod}>/mês em assinaturas pagas ativas</Text>
          </View>
          <View style={styles.heroIconBadge}>
            <TrendingUp size={26} color="#10B981" />
          </View>
        </View>

        <View style={styles.heroDivider} />

        <View style={styles.heroGrid}>
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatNum}>{payingOrgs.length}</Text>
            <Text style={styles.heroStatLabel}>Assinantes Pagantes</Text>
          </View>
          <View style={styles.heroStatItem}>
            <Text style={[styles.heroStatNum, { color: '#F59E0B' }]}>{organizations.filter((org) => org.paymentStatus === 'TRIAL').length}</Text>
            <Text style={styles.heroStatLabel}>Em Teste (7 dias)</Text>
          </View>
          <View style={styles.heroStatItem}>
            <Text style={[styles.heroStatNum, { color: '#EF4444' }]}>{organizations.filter((org) => org.paymentStatus === 'EXPIRED' || org.paymentStatus === 'PENDING').length}</Text>
            <Text style={styles.heroStatLabel}>Pagamento Pendente</Text>
          </View>
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatNum}>{organizations.length}</Text>
            <Text style={styles.heroStatLabel}>Total Empresas</Text>
          </View>
        </View>
      </View>

      {/* Alertas Urgentes de Operação */}
      {(metrics.alerts?.pendingPayments?.length > 0) && (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeaderTitle}>ALERTAS OPERACIONAIS</Text>

          {/* Alerta de Pagamento Pendente */}
          {metrics.alerts?.pendingPayments?.map((item: any) => (
            <View key={`pay-${item.id}`} style={styles.alertCardAmber}>
              <View style={styles.alertIconCircleAmber}>
                <AlertTriangle size={20} color="#D97706" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.alertCardTitle}>{item.name}</Text>
                <Text style={styles.alertCardDesc}>
                  Assinatura pendente ({formatCurrency(planPrice)}/mês). O administrador precisa pagar para continuar.
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
                <View style={styles.recentOrgTitleBlock}>
                  <Text style={styles.recentOrgName} numberOfLines={2}>{org.name}</Text>
                  <Text style={styles.recentOrgSlug} numberOfLines={1}>{org.slug}.brisoftportaria.com</Text>
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
                      ? 'PAGO'
                      : org.paymentStatus === 'TRIAL'
                        ? 'TESTE'
                        : 'PENDENTE'}
                  </Text>
                </View>
              </View>
              <Text style={styles.recentOrgPrice}>
                {org.paymentStatus === 'ACTIVE'
                  ? `${formatCurrency(planPrice)} por mês`
                  : org.paymentStatus === 'TRIAL'
                    ? `Teste grátis. Depois, ${formatCurrency(planPrice)} por mês`
                    : `Bloqueada até pagar ${formatCurrency(planPrice)} por mês`}
              </Text>

              <View style={styles.recentOrgFooter}>
                <View style={styles.recentOrgInfoRow}>
                  <Users size={13} color="#64748B" />
                  <Text style={styles.recentOrgInfoText}>{org.usersCount || 0} operadores</Text>
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
        <View style={styles.chipsContainer}>
          {[
            { key: 'ALL', label: `Todas (${organizations.length})` },
            { key: 'ACTIVE', label: 'Pagas & Ativas' },
            { key: 'TRIAL', label: 'Em Teste (7d)' },
            { key: 'PENDING', label: 'Pendentes' },
            { key: 'SUSPENDED', label: 'Suspensas' },
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
        </View>
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
            const isSuspended = !org.isActive || org.paymentStatus === 'SUSPENDED';

            return (
              <View key={org.id} style={[styles.orgCard, isSuspended && styles.orgCardSuspended]}>
                <View style={styles.orgCardTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orgCardTitle} numberOfLines={2}>{org.name}</Text>
                    <Text style={styles.orgCardSub} numberOfLines={2}>Slug: {org.slug} {org.document ? `• Doc: ${org.document}` : ''}</Text>
                  </View>

                  <View style={styles.orgStatusColumn}>
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
                          ? 'Pago'
                          : org.paymentStatus === 'TRIAL'
                            ? 'Teste'
                            : org.paymentStatus === 'SUSPENDED'
                              ? 'Suspenso'
                              : org.paymentStatus === 'EXPIRED'
                                ? 'Vencido'
                                : 'Pendente'}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.orgPriceTag}>
                  {org.paymentStatus === 'ACTIVE'
                    ? `${formatCurrency(planPrice)} por mês`
                    : org.paymentStatus === 'TRIAL'
                      ? `Teste grátis. Depois, ${formatCurrency(planPrice)} por mês`
                      : `Pagar ${formatCurrency(planPrice)} por mês para voltar`}
                </Text>

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
                    <Edit2 size={14} color="#165337" />
                    <Text style={[styles.actionBtnText, { color: '#165337' }]}>Editar</Text>
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

                {/* Linha Exclusiva: Gestão de Teste & Assinatura */}
                <View style={styles.orgCardSubscriptionActionsRow}>
                  {(org.paymentStatus === 'TRIAL' || org.isTrial) && (
                    <TouchableOpacity
                      style={styles.actionExpireTrialBtn}
                      onPress={() => handleExpireTrial(org)}
                      activeOpacity={0.85}
                    >
                      <AlertTriangle size={13} color="#B91C1C" style={{ marginRight: 5 }} />
                      <Text style={styles.actionExpireTrialBtnText}>Remover Teste (Forçar Pagamento)</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.actionActivateSubBtn}
                    onPress={() => handleActivateSubscription(org)}
                    activeOpacity={0.85}
                  >
                    <CheckCircle2 size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
                    <Text style={styles.actionActivateSubBtnText}>Ativar Assinatura (30d)</Text>
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
        <View style={styles.orgFilterWrap}>
          <TouchableOpacity
            style={[styles.orgFilterChip, selectedOrgFilter === 'ALL' && styles.orgFilterChipActive]}
            onPress={() => setSelectedOrgFilter('ALL')}
          >
            <Text style={[styles.orgFilterChipText, selectedOrgFilter === 'ALL' && styles.orgFilterChipTextActive]}>
              Todas
            </Text>
          </TouchableOpacity>
          {organizations.map((org) => (
            <TouchableOpacity
              key={org.id}
              style={[styles.orgFilterChip, selectedOrgFilter === org.id && styles.orgFilterChipActive]}
              onPress={() => setSelectedOrgFilter(org.id)}
            >
              <Text style={[styles.orgFilterChipText, selectedOrgFilter === org.id && styles.orgFilterChipTextActive]} numberOfLines={1}>
                {org.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

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
                      <Text style={styles.userOrgNameText}>{u.role === 'SUPER_ADMIN' ? 'Sem empresa' : (u.organization?.name || 'Sem empresa')}</Text>
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
    <View style={styles.plansScreen}>
      <View style={styles.priceCard}>
        <Text style={styles.priceLabel}>Valor mensal do plano</Text>
        <View style={styles.priceRow}>
          <Text style={styles.pricePrefix}>R$</Text>
          <TextInput
            style={styles.priceInput}
            value={planPriceInput}
            onChangeText={setPlanPriceInput}
            keyboardType="decimal-pad"
            placeholder="99,90"
            placeholderTextColor="#94A3B8"
          />
          <TouchableOpacity
            style={styles.priceSave}
            onPress={async () => {
              const parsed = Number(planPriceInput.replace(/\s/g, '').replace(/\.(?=\d{3}(,|$))/, '').replace(',', '.'));
              if (!parsed || parsed <= 0) {
                Alert.alert('Valor inválido', 'Informe um preço maior que zero, por exemplo 99,90.');
                return;
              }
              try {
                setIsSubmitting(true);
                await api.put('/super-admin/plan-price', { price: parsed });
                setPlanPrice(parsed);
                setPlanPriceInput(parsed.toFixed(2).replace('.', ','));
                Alert.alert('Plano atualizado', `O valor mensal passou a ser ${parsed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`);
                loadDashboardData();
              } catch (err: any) {
                Alert.alert('Não foi possível salvar', err.response?.data?.error?.message || err.response?.data?.message || 'Tente novamente.');
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            <Text style={styles.priceSaveText}>{isSubmitting ? '...' : 'Salvar'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.priceHint}>Esse valor vale para todas as empresas. Quem está em teste não entra no faturamento.</Text>
      </View>

      <View style={styles.financeMetricsRow}>
        <View style={styles.planStat}>
          <Text style={styles.planStatValue}>{payingOrgs.length}</Text>
          <Text style={styles.planStatLabel}>Pagas</Text>
          <Text style={styles.planStatMoney}>{formatCurrency(payingOrgs.length * planPrice)}/mês</Text>
        </View>
        <View style={styles.planStat}>
          <Text style={[styles.planStatValue, { color: '#B45309' }]}>{organizations.filter((org) => org.paymentStatus === 'TRIAL').length}</Text>
          <Text style={styles.planStatLabel}>Em teste</Text>
          <Text style={styles.planStatMoney}>ainda não cobradas</Text>
        </View>
      </View>

      <Text style={styles.sectionHeaderTitle}>Empresas</Text>

      <ScrollView
        style={styles.tabScroll}
        contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {organizations.map((org) => (
          <View key={org.id} style={styles.financeOrgCard}>
            <TouchableOpacity style={styles.financeOrgTop} activeOpacity={0.7} onPress={() => openPaymentHistory(org)}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.financeOrgName} numberOfLines={2}>{org.name}</Text>
                <Text style={styles.financeOrgPlan}>{org.paymentStatus === 'ACTIVE' ? `Paga ${formatCurrency(planPrice)} por mês` : org.paymentStatus === 'TRIAL' ? `Teste grátis. Depois paga ${formatCurrency(planPrice)} por mês` : `Sem acesso até pagar ${formatCurrency(planPrice)} por mês`}</Text>
                <Text style={styles.financeHistoryHint}>Histórico de pagamentos</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: org.paymentStatus === 'ACTIVE' ? '#DCFCE7' : org.paymentStatus === 'TRIAL' ? '#FEF3C7' : '#FEE2E2' }]}>
                <Text style={[styles.statusPillText, { color: org.paymentStatus === 'ACTIVE' ? '#15803D' : org.paymentStatus === 'TRIAL' ? '#B45309' : '#B91C1C' }]}>
                  {org.paymentStatus === 'ACTIVE' ? 'Pago' : org.paymentStatus === 'TRIAL' ? 'Teste' : org.paymentStatus === 'SUSPENDED' ? 'Suspenso' : 'Vencido'}
                </Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" style={{ marginTop: 4 }} />
            </TouchableOpacity>
            <View style={styles.financeActionsBar}>
              <TouchableOpacity style={[styles.financeBtn, { backgroundColor: '#DCFCE7' }]} onPress={() => handleQuickPaymentStatus(org.id, 'ACTIVE')}>
                <Text style={[styles.financeBtnText, { color: '#15803D' }]}>Marcar pago</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.financeBtn, { backgroundColor: '#FEF3C7' }]} onPress={() => handleQuickPaymentStatus(org.id, 'TRIAL')}>
                <Text style={[styles.financeBtnText, { color: '#B45309' }]}>Estender teste</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.financeBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => handleQuickPaymentStatus(org.id, 'PENDING')}>
                <Text style={[styles.financeBtnText, { color: '#B91C1C' }]}>Vencido</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
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
          onPress={() => setShowPlatformWhatsapp(true)}
        >
          <View style={styles.profileMenuIcon}>
            <Wifi size={20} color="#165337" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.profileMenuTitle}>WhatsApp da plataforma</Text>
            <Text style={styles.profileMenuDesc}>Leia o QR Code para o bot enviar os códigos</Text>
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

  if (showPlatformWhatsapp) {
    return <WhatsAppConfigScreen onBack={() => setShowPlatformWhatsapp(false)} />;
  }

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0B132B" />

      {/* Top Header Fixo do Super Admin */}
      <View style={[styles.superHeader, { paddingTop: topInset }]}>
        <View style={styles.superHeaderTop}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.superHeaderBadge}>SUPER ADMINISTRADOR</Text>
            <Text style={styles.superHeaderTitle} numberOfLines={1}>{user?.name || 'Painel'}</Text>
          </View>
          <TouchableOpacity style={styles.refreshIconBtn} onPress={onRefresh}>
            {isRefreshing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <RefreshCw size={18} color="#FFFFFF" />}
          </TouchableOpacity>
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
          style={[styles.navTab, activeTab === 'overview' && styles.navTabActive]}
          onPress={() => setActiveTab('overview')}
          activeOpacity={0.8}
        >
          <BarChart3 size={20} color={activeTab === 'overview' ? '#165337' : '#64748B'} />
          <Text style={[styles.navTabLabel, activeTab === 'overview' && styles.navTabLabelActive]}>
            Início
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, activeTab === 'organizations' && styles.navTabActive]}
          onPress={() => setActiveTab('organizations')}
          activeOpacity={0.8}
        >
          <Building2 size={20} color={activeTab === 'organizations' ? '#165337' : '#64748B'} />
          <Text style={[styles.navTabLabel, activeTab === 'organizations' && styles.navTabLabelActive]}>
            Empresas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, activeTab === 'users' && styles.navTabActive]}
          onPress={() => setActiveTab('users')}
          activeOpacity={0.8}
        >
          <Users size={20} color={activeTab === 'users' ? '#165337' : '#64748B'} />
          <Text style={[styles.navTabLabel, activeTab === 'users' && styles.navTabLabelActive]}>
            Usuários
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, activeTab === 'finance' && styles.navTabActive]}
          onPress={() => setActiveTab('finance')}
          activeOpacity={0.8}
        >
          <CreditCard size={20} color={activeTab === 'finance' ? '#165337' : '#64748B'} />
          <Text style={[styles.navTabLabel, activeTab === 'finance' && styles.navTabLabelActive]}>
            Planos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navTab, activeTab === 'profile' && styles.navTabActive]}
          onPress={() => setActiveTab('profile')}
          activeOpacity={0.8}
        >
          <User size={20} color={activeTab === 'profile' ? '#165337' : '#64748B'} />
          <Text style={[styles.navTabLabel, activeTab === 'profile' && styles.navTabLabelActive]}>
            Perfil
          </Text>
        </TouchableOpacity>
      </View>

      {/* ─── MODAIS ────────────────────────────────────────────── */}

      <Modal
        visible={!!paymentOrg}
        animationType="slide"
        transparent
        onRequestClose={() => setPaymentOrg(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.modalHeaderTitle} numberOfLines={2}>{paymentOrg?.name}</Text>
                <Text style={styles.modalHeaderSubtitle}>Histórico de pagamentos</Text>
              </View>
              <TouchableOpacity onPress={() => setPaymentOrg(null)}>
                <X size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {loadingHistory ? (
              <ActivityIndicator size="small" color="#2563EB" style={{ marginVertical: 24 }} />
            ) : paymentHistory.length === 0 ? (
              <Text style={styles.historyEmpty}>Nenhum pagamento registrado para esta empresa.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {paymentHistory.map((item, index) => {
                  const paid = item?.paidAt ? new Date(item.paidAt) : null;
                  const until = item?.periodEnd ? new Date(item.periodEnd) : null;
                  const paidLabel = paid && !Number.isNaN(paid.getTime()) ? paid.toLocaleDateString('pt-BR') : 'Data não informada';
                  const untilLabel = until && !Number.isNaN(until.getTime()) ? until.toLocaleDateString('pt-BR') : null;
                  return (
                    <View key={String(item?.id || index)} style={styles.historyRow}>
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={styles.historyLabel}>{item?.label || 'Pagamento'}</Text>
                        <Text style={styles.historyDate}>{paidLabel}{untilLabel ? ` · válido até ${untilLabel}` : ''}</Text>
                      </View>
                      <Text style={styles.historyAmount}>
                        {typeof item?.amount === 'number' && item.amount > 0 ? formatCurrency(item.amount) : 'Cortesia'}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

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

              <Text style={styles.inputLabel}>Endereço do local</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Rua, número, bairro, cidade"
                placeholderTextColor="#94A3B8"
                value={orgForm.address}
                onChangeText={(t) => setOrgForm((prev) => ({ ...prev, address: t }))}
              />

              <Text style={styles.inputLabel}>Plano</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="PRO"
                placeholderTextColor="#94A3B8"
                value={orgForm.plan}
                onChangeText={(t) => setOrgForm((prev) => ({ ...prev, plan: t }))}
              />

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
              <PasswordField
                containerStyle={styles.modalInput}
                placeholder="Mínimo 6 caracteres"
                value={orgForm.adminPassword}
                onChangeText={(t) => setOrgForm((prev) => ({ ...prev, adminPassword: t }))}
                showStrength
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

                <Text style={styles.inputLabel}>Endereço do local</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Rua, número, bairro, cidade"
                  placeholderTextColor="#94A3B8"
                  value={editingOrg.address || ''}
                  onChangeText={(t) => setEditingOrg((prev: any) => ({ ...prev, address: t }))}
                />

                <Text style={{ fontSize: 13, lineHeight: 19, color: '#475569', marginBottom: 14 }}>
                  {`A mensalidade é única para todas as empresas: ${formatCurrency(planPrice)}. O administrador desta empresa paga esse valor quando os 7 dias acabam. Sem o pagamento, o acesso é bloqueado.`}
                </Text>

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
              <PasswordField
                containerStyle={styles.modalInput}
                placeholder="Mínimo 6 caracteres"
                value={userForm.password}
                onChangeText={(t) => setUserForm((prev) => ({ ...prev, password: t }))}
                showStrength
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
            <PasswordField
              containerStyle={styles.modalInput}
              placeholder="Mínimo 6 caracteres"
              value={newPasswordInput}
              onChangeText={setNewPasswordInput}
              showStrength
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
    backgroundColor: '#0D3824',
  },
  tabScroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Header Mestre
  superHeader: {
    backgroundColor: '#0D3824',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  superHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  superHeaderBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 1.2,
  },
  superHeaderTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  heroStatItem: {
    width: '48%',
    alignItems: 'flex-start',
  },
  heroStatNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroStatLabel: {
    fontSize: 12,
    color: '#D1FAE5',
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
    gap: 8,
  },
  recentOrgTitleBlock: {
    flex: 1,
    paddingRight: 8,
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
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 10,
    lineHeight: 18,
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
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 10,
    lineHeight: 18,
  },
  orgStatusColumn: {
    marginLeft: 8,
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
  orgCardSubscriptionActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    flexWrap: 'wrap',
  },
  actionExpireTrialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  actionExpireTrialBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
  },
  actionActivateSubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#165337',
  },
  actionActivateSubBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Usuários (Aba 3)
  usersHeaderBox: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  orgFilterWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  orgFilterChip: {
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
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
    marginBottom: 18,
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
    lineHeight: 17,
  },
  financeHistoryHint: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
    marginTop: 6,
  },
  historyEmpty: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  historyLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  historyDate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },
  historyAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803D',
  },
  financeActionsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  financeBtn: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  financeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  plansScreen: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  priceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  priceLabel: { color: '#64748B', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  pricePrefix: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  priceInput: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    backgroundColor: '#F8FAF9',
  },
  priceSave: { backgroundColor: '#165337', borderRadius: 12, minHeight: 48, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  priceSaveText: { color: '#FFFFFF', fontWeight: '700' },
  priceHint: { color: '#64748B', fontSize: 12, lineHeight: 18, marginTop: 10 },
  planStat: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', padding: 14 },
  planStatValue: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  planStatLabel: { color: '#64748B', marginTop: 2, fontWeight: '600' },
  planStatMoney: { color: '#165337', marginTop: 6, fontWeight: '700', fontSize: 13 },

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
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
    paddingHorizontal: 6,
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    borderRadius: 16,
    gap: 2,
  },
  navTabActive: {
    backgroundColor: '#E7F6EE',
  },
  navTabLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  navTabLabelActive: {
    color: '#165337',
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
