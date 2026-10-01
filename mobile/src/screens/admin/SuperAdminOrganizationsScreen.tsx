import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
} from 'react-native';
import {
  Building2,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Users,
  Shield,
  Clock,
  ChevronRight,
  User,
  Mail,
  Lock,
  Phone,
  FileText,
  Power,
  X,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
} from 'lucide-react-native';
import { api } from '../../config/api';
import { PasswordField, PasswordStrength } from '../../components/PasswordField';
import { AppHeader } from '../../components/AppHeader';
import { ScrollToTopButton } from '../../components/ScrollToTopButton';

interface OrganizationItem {
  id: string;
  name: string;
  document?: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  _count?: {
    users: number;
    visitRequests: number;
  };
}

interface SuperAdminOrganizationsScreenProps {
  onBack: () => void;
}

export const SuperAdminOrganizationsScreen: React.FC<SuperAdminOrganizationsScreenProps> = ({
  onBack,
}) => {
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const listRef = useRef<FlatList>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Modal Nova Empresa
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgDocument, setOrgDocument] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPhone, setAdminPhone] = useState('');

  // Modal Detalhes da Empresa
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [orgDetailsModalOpen, setOrgDetailsModalOpen] = useState(false);

  const fetchOrganizations = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/super-admin/organizations', {
        params: { search: search.trim() || undefined, limit: 50 },
      });
      if (res.data?.success && res.data?.organizations) {
        setOrganizations(res.data.organizations);
      }
    } catch (err: any) {
      console.warn('Erro ao listar organizações:', err);
      Alert.alert('Erro', err.response?.data?.message || 'Falha ao carregar empresas.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const handleOpenDetails = async (orgId: string) => {
    try {
      setIsLoadingDetails(true);
      setOrgDetailsModalOpen(true);
      const res = await api.get(`/super-admin/organizations/${orgId}`);
      if (res.data?.success && res.data?.data) {
        setSelectedOrg(res.data.data);
      }
    } catch (err: any) {
      Alert.alert('Erro', 'Não foi possível carregar os detalhes da empresa.');
      setOrgDetailsModalOpen(false);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleToggleActive = (org: OrganizationItem) => {
    const actionText = org.isActive ? 'desativar' : 'ativar';
    Alert.alert(
      'Confirmar Alteração',
      `Deseja realmente ${actionText} a empresa "${org.name}"? ${
        org.isActive ? 'Os funcionários dela não conseguirão acessar.' : ''
      }`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: `Sim, ${actionText}`,
          style: org.isActive ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const res = await api.patch(`/super-admin/organizations/${org.id}/toggle-active`);
              if (res.data?.success) {
                Alert.alert('Sucesso', res.data.message || 'Status atualizado com sucesso.');
                fetchOrganizations();
              }
            } catch (err: any) {
              Alert.alert('Erro', err.response?.data?.message || 'Falha ao alterar status.');
            }
          },
        },
      ]
    );
  };

  const handleExpireTrial = (org: OrganizationItem | any) => {
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
              fetchOrganizations();
              if (selectedOrg?.id === org.id) handleOpenDetails(org.id);
            } catch (err: any) {
              Alert.alert('Erro', err.response?.data?.message || 'Falha ao remover período de teste.');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleActivateSubscription = (org: OrganizationItem | any) => {
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
              fetchOrganizations();
              if (selectedOrg?.id === org.id) handleOpenDetails(org.id);
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

  const handleCreateOrganization = async () => {
    if (!orgName.trim()) {
      Alert.alert('Atenção', 'Informe o nome da empresa ou condomínio.');
      return;
    }
    if (!adminName.trim()) {
      Alert.alert('Atenção', 'Informe o nome do administrador da empresa.');
      return;
    }
    if (!adminEmail.trim() || !adminEmail.includes('@')) {
      Alert.alert('Atenção', 'Informe um e-mail válido para o administrador.');
      return;
    }
    if (!adminPassword || adminPassword.length < 8) {
      Alert.alert('Atenção', 'A senha do administrador deve ter no mínimo 8 caracteres.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.post('/super-admin/organizations', {
        organizationName: orgName.trim(),
        organizationDocument: orgDocument.trim() || undefined,
        adminName: adminName.trim(),
        adminEmail: adminEmail.trim().toLowerCase(),
        adminPassword: adminPassword.trim(),
        adminPhone: adminPhone.trim() || undefined,
      });

      if (res.data?.success) {
        Alert.alert(
          'Empresa Criada! 🏢',
          `A empresa "${orgName.trim()}" e a conta de administrador foram criadas com sucesso!`,
          [
            {
              text: 'OK',
              onPress: () => {
                setIsNewModalOpen(false);
                setOrgName('');
                setOrgDocument('');
                setAdminName('');
                setAdminEmail('');
                setAdminPassword('');
                setAdminPhone('');
                fetchOrganizations();
              },
            },
          ]
        );
      }
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Falha ao criar nova empresa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeCount = organizations.filter((o) => o.isActive).length;

  return (
    <View style={styles.container}>
      <AppHeader
        title="Gestão de Empresas"
        subtitle="Painel Super Admin SaaS Master"
        onBack={onBack}
      />

      {/* Barra de Pesquisa e Botão Criar */}
      <View style={styles.topActionsContainer}>
        <View style={styles.searchBar}>
          <Search size={18} color="#94A3B8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nome ou CNPJ..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={fetchOrganizations}
            returnKeyType="search"
          />
        </View>

        <TouchableOpacity
          style={styles.newOrgBtn}
          onPress={() => setIsNewModalOpen(true)}
          activeOpacity={0.85}
        >
          <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.newOrgBtnText}>Nova Empresa</Text>
        </TouchableOpacity>
      </View>

      {/* Métricas Rápidas */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>
          Total: <Text style={styles.summaryHighlight}>{organizations.length}</Text> empresa(s) •{' '}
          <Text style={[styles.summaryHighlight, { color: '#16A34A' }]}>{activeCount} ativas</Text>
        </Text>
      </View>

      {/* Lista de Organizações */}
      {isLoading && organizations.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Carregando empresas do sistema...</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={organizations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 150)}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                fetchOrganizations();
              }}
              colors={['#2563EB']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Building2 size={48} color="#94A3B8" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>Nenhuma empresa encontrada</Text>
              <Text style={styles.emptySubtitle}>
                Toque no botão "+ Nova Empresa" acima para cadastrar a primeira empresa ou condomínio cliente.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const usersCount = item._count?.users || 0;
            const visitsCount = item._count?.visitRequests || 0;
            const isSystem = item.slug === 'system-combate-portaria';

            return (
              <TouchableOpacity
                style={[styles.orgCard, !item.isActive && styles.orgCardInactive]}
                onPress={() => handleOpenDetails(item.id)}
                activeOpacity={0.88}
              >
                <View style={styles.orgCardHeader}>
                  <View style={styles.orgIconCircle}>
                    <Building2 size={20} color="#2563EB" />
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.orgName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.orgDoc}>
                      {item.document ? `CNPJ/CPF: ${item.document}` : `Slug: ${item.slug}`}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      item.isActive ? styles.statusBadgeActive : styles.statusBadgeInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        item.isActive ? styles.statusBadgeTextActive : styles.statusBadgeTextInactive,
                      ]}
                    >
                      {item.isActive ? 'ATIVA' : 'SUSPENSA'}
                    </Text>
                  </View>
                </View>

                {/* Linha de Métricas da Empresa */}
                <View style={styles.orgMetricsRow}>
                  <View style={styles.orgMetricItem}>
                    <Users size={13} color="#64748B" style={{ marginRight: 4 }} />
                    <Text style={styles.orgMetricText}>
                      <Text style={styles.orgMetricBold}>{usersCount}</Text> funcionário(s)
                    </Text>
                  </View>

                  <View style={styles.orgMetricItem}>
                    <Clock size={13} color="#64748B" style={{ marginRight: 4 }} />
                    <Text style={styles.orgMetricText}>
                      <Text style={styles.orgMetricBold}>{visitsCount}</Text> visitas
                    </Text>
                  </View>

                  <View style={styles.orgMetricItem}>
                    <Shield size={13} color="#64748B" style={{ marginRight: 4 }} />
                    <Text style={styles.orgMetricText}>
                      Desde {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                    </Text>
                  </View>
                </View>

                {/* Ações da Empresa */}
                <View style={styles.orgActionsRow}>
                  <TouchableOpacity
                    style={styles.viewDetailsBtn}
                    onPress={() => handleOpenDetails(item.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.viewDetailsBtnText, { color: '#165337' }]}>Ver Usuários & Detalhes</Text>
                    <ChevronRight size={14} color="#165337" />
                  </TouchableOpacity>

                  {!isSystem && (
                    <TouchableOpacity
                      style={[
                        styles.toggleActiveBtn,
                        item.isActive ? styles.toggleActiveBtnDeactivate : styles.toggleActiveBtnActivate,
                      ]}
                      onPress={() => handleToggleActive(item)}
                      activeOpacity={0.8}
                    >
                      <Power size={13} color={item.isActive ? '#DC2626' : '#16A34A'} style={{ marginRight: 4 }} />
                      <Text
                        style={[
                          styles.toggleActiveBtnText,
                          { color: item.isActive ? '#DC2626' : '#16A34A' },
                        ]}
                      >
                        {item.isActive ? 'Suspender' : 'Ativar'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Linha Exclusiva: Gestão de Teste & Assinatura */}
                <View style={styles.orgCardSubscriptionActionsRow}>
                  <TouchableOpacity
                    style={styles.actionExpireTrialBtn}
                    onPress={() => handleExpireTrial(item)}
                    activeOpacity={0.85}
                  >
                    <AlertTriangle size={13} color="#B91C1C" style={{ marginRight: 4 }} />
                    <Text style={styles.actionExpireTrialBtnText}>Remover Teste (Forçar Pagamento)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionActivateSubBtn}
                    onPress={() => handleActivateSubscription(item)}
                    activeOpacity={0.85}
                  >
                    <CheckCircle2 size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.actionActivateSubBtnText}>Ativar 30 Dias</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Botão Flutuante Voltar ao Topo */}
      <ScrollToTopButton
        visible={showScrollTop}
        onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
        bottom={30}
      />

      {/* Modal: Cadastrar Nova Empresa */}
      <Modal visible={isNewModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Cadastrar Nova Empresa</Text>
                <Text style={styles.modalSubtitle}>Cria a organização isolada e o Administrador</Text>
              </View>
              <TouchableOpacity onPress={() => setIsNewModalOpen(false)}>
                <X size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Dados da Organização */}
              <Text style={styles.formSectionHeader}>1. Dados da Organização / Condomínio</Text>

              <Text style={styles.inputLabel}>Nome da Empresa / Condomínio *</Text>
              <View style={styles.inputBox}>
                <Building2 size={16} color="#64748B" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Residencial Alphaville, Empresa XYZ..."
                  value={orgName}
                  onChangeText={setOrgName}
                />
              </View>

              <Text style={styles.inputLabel}>CNPJ ou CPF (Opcional)</Text>
              <View style={styles.inputBox}>
                <FileText size={16} color="#64748B" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="00.000.000/0001-00"
                  value={orgDocument}
                  onChangeText={setOrgDocument}
                />
              </View>

              {/* Dados do Primeiro Administrador */}
              <Text style={[styles.formSectionHeader, { marginTop: 18 }]}>
                2. Administrador Principal da Empresa
              </Text>

              <Text style={styles.inputLabel}>Nome do Administrador *</Text>
              <View style={styles.inputBox}>
                <User size={16} color="#64748B" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Carlos Oliveira"
                  value={adminName}
                  onChangeText={setAdminName}
                />
              </View>

              <Text style={styles.inputLabel}>E-mail do Administrador (Login) *</Text>
              <View style={styles.inputBox}>
                <Mail size={16} color="#64748B" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="admin@empresa.com.br"
                  value={adminEmail}
                  onChangeText={setAdminEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <Text style={styles.inputLabel}>Senha Provisória (Mínimo 8 dígitos) *</Text>
              <View style={styles.inputBox}>
                <Lock size={16} color="#64748B" style={{ marginRight: 8 }} />
                <PasswordField
                  containerStyle={{ flex: 1 }}
                  inputStyle={styles.input}
                  placeholder="Senha forte para login inicial"
                  value={adminPassword}
                  onChangeText={setAdminPassword}
                  showStrength={false}
                />
              </View>
              <PasswordStrength value={adminPassword} />

              <Text style={styles.inputLabel}>Telefone / WhatsApp (Opcional)</Text>
              <View style={styles.inputBox}>
                <Phone size={16} color="#64748B" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="(83) 99999-8888"
                  value={adminPhone}
                  onChangeText={setAdminPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
                onPress={handleCreateOrganization}
                disabled={isSubmitting}
                activeOpacity={0.88}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Building2 size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.submitBtnText}>Criar Empresa e Acesso</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Detalhes da Empresa */}
      <Modal visible={orgDetailsModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {selectedOrg?.name || 'Detalhes da Empresa'}
                </Text>
                <Text style={styles.modalSubtitle}>Funcionários e métricas cadastradas</Text>
              </View>
              <TouchableOpacity onPress={() => setOrgDetailsModalOpen(false)}>
                <X size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {isLoadingDetails ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={{ marginTop: 10, color: '#64748B', fontSize: 13 }}>
                  Carregando dados da empresa...
                </Text>
              </View>
            ) : selectedOrg ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Resumo */}
                <View style={styles.detailsSummaryCard}>
                  <Text style={styles.detailsSummaryTitle}>Métricas da Empresa</Text>
                  <View style={styles.detailsSummaryGrid}>
                    <View style={styles.detailsGridItem}>
                      <Text style={styles.detailsGridNum}>{selectedOrg._count?.visitRequests || 0}</Text>
                      <Text style={styles.detailsGridLabel}>Visitas</Text>
                    </View>
                    <View style={styles.detailsGridItem}>
                      <Text style={styles.detailsGridNum}>{selectedOrg._count?.clients || 0}</Text>
                      <Text style={styles.detailsGridLabel}>Moradores</Text>
                    </View>
                    <View style={styles.detailsGridItem}>
                      <Text style={styles.detailsGridNum}>{selectedOrg._count?.packages || 0}</Text>
                      <Text style={styles.detailsGridLabel}>Encomendas</Text>
                    </View>
                  </View>
                </View>

                {/* Usuários Cadastrados */}
                <Text style={styles.formSectionHeader}>
                  Funcionários / Operadores ({selectedOrg.users?.length || 0})
                </Text>

                {selectedOrg.users && selectedOrg.users.length > 0 ? (
                  selectedOrg.users.map((u: any) => (
                    <View key={u.id} style={styles.userItemCard}>
                      <View style={styles.userItemAvatar}>
                        <User size={18} color="#2563EB" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.userItemName}>{u.name}</Text>
                        <Text style={styles.userItemEmail}>{u.email}</Text>
                      </View>
                      <View
                        style={[
                          styles.userRoleBadge,
                          u.role === 'ADMIN' && { backgroundColor: '#EDE9FE' },
                          u.role === 'CONCIERGE' && { backgroundColor: '#EFF6FF' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.userRoleBadgeText,
                            u.role === 'ADMIN' && { color: '#7C3AED' },
                            u.role === 'CONCIERGE' && { color: '#2563EB' },
                          ]}
                        >
                          {u.role === 'ADMIN' ? 'ADMIN' : u.role === 'CONCIERGE' ? 'PORTEIRO' : u.role}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', marginVertical: 12 }}>
                    Nenhum usuário cadastrado nesta empresa ainda.
                  </Text>
                )}
              </ScrollView>
            ) : null}
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
  topActionsContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  newOrgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#165337',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 10,
  },
  newOrgBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 4,
  },
  summaryBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  summaryText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  summaryHighlight: {
    fontWeight: '800',
    color: '#0F172A',
  },
  listContent: {
    padding: 16,
    paddingBottom: 60,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
  },
  emptyContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  orgCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  orgCardInactive: {
    backgroundColor: '#F8FAFC',
    opacity: 0.8,
    borderColor: '#CBD5E1',
  },
  orgCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orgIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  orgDoc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeActive: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeInactive: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusBadgeTextActive: {
    color: '#15803D',
  },
  statusBadgeTextInactive: {
    color: '#B91C1C',
  },
  orgMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  orgMetricItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orgMetricText: {
    fontSize: 12,
    color: '#64748B',
  },
  orgMetricBold: {
    fontWeight: '700',
    color: '#334155',
  },
  orgActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewDetailsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#165337',
    marginRight: 2,
  },
  toggleActiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  toggleActiveBtnDeactivate: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  toggleActiveBtnActivate: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  toggleActiveBtnText: {
    fontSize: 11,
    fontWeight: '700',
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
    paddingVertical: 6,
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
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#165337',
  },
  actionActivateSubBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  formSectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2563EB',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: '#F8FAFC',
    marginBottom: 12,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 10,
    marginBottom: 10,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  // Details Modal
  detailsSummaryCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  detailsSummaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1D4ED8',
    marginBottom: 10,
  },
  detailsSummaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  detailsGridItem: {
    alignItems: 'center',
  },
  detailsGridNum: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
  },
  detailsGridLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  userItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  userItemAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  userItemEmail: {
    fontSize: 11,
    color: '#64748B',
  },
  userRoleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  userRoleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
});
