import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User,
  Plus,
  Shield,
  Phone,
  Mail,
  Lock,
  ArrowLeft,
  CircleCheck,
  CircleX,
  Trash2,
  Pencil,
  Key,
  MoreVertical,
  Power,
  ShieldAlert,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { api } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { PasswordField } from '../../components/PasswordField';

interface UsersManagementScreenProps {
  onBack?: () => void;
}

export const UsersManagementScreen: React.FC<UsersManagementScreenProps> = ({ onBack }) => {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const isSupervisor = currentUser?.role === 'SUPERVISOR';

  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Menu de ações por card
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Modal Novo Usuário
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'CONCIERGE' | 'SUPERVISOR' | 'ADMIN'>('CONCIERGE');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Editar Usuário
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<'CONCIERGE' | 'SUPERVISOR' | 'ADMIN'>('CONCIERGE');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Modal Alterar Senha
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [targetUserForPassword, setTargetUserForPassword] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/users');
      const list = res.data.data?.users || res.data.data || [];
      setUsers(list.filter((item: any) => item.role !== 'CLIENT'));
    } catch (err: any) {
      console.warn('Erro ao carregar usuários:', err.message);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Verifica se o usuário atual tem permissão para editar/excluir este membro
  const canManageUser = (targetUser: any) => {
    if (isAdmin) return true;
    if (isSupervisor) {
      return targetUser.role === 'CONCIERGE';
    }
    return false;
  };

  const handleCreateUser = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Atenção', 'Preencha o nome, e-mail e senha do usuário.');
      return;
    }

    if (password.trim().length < 6) {
      Alert.alert('Atenção', 'A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.post('/users', {
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        role: isSupervisor ? 'CONCIERGE' : role,
        phone: phone.trim() || undefined,
      });

      if (res.data.success) {
        Alert.alert('Sucesso', 'Membro cadastrado com sucesso!');
        setIsModalOpen(false);
        setName('');
        setEmail('');
        setPassword('');
        setPhone('');
        setRole('CONCIERGE');
        loadUsers();
      }
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error?.message || 'Falha ao cadastrar usuário');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (u: any) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPhone(u.phone || '');
    setEditRole(u.role || 'CONCIERGE');
    setActiveMenuId(null);
    setIsEditModalOpen(true);
  };

  const handleEditUser = async () => {
    if (!editName.trim()) {
      Alert.alert('Atenção', 'O nome não pode ficar em branco.');
      return;
    }
    if (!editEmail.trim()) {
      Alert.alert('Atenção', 'O e-mail não pode ficar em branco.');
      return;
    }

    try {
      setIsSubmittingEdit(true);
      await api.patch(`/users/${editingUser.id}`, {
        name: editName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim() || null,
        role: isAdmin ? editRole : undefined,
      });

      Alert.alert('Sucesso', 'Dados do usuário atualizados com sucesso!');
      setIsEditModalOpen(false);
      loadUsers();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error?.message || 'Falha ao atualizar dados');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const openPasswordModal = (u: any) => {
    setTargetUserForPassword(u);
    setNewPassword('');
    setActiveMenuId(null);
    setIsPasswordModalOpen(true);
  };

  const handleChangePassword = async () => {
    if (!newPassword.trim() || newPassword.trim().length < 6) {
      Alert.alert('Atenção', 'A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    try {
      setIsSubmittingPassword(true);
      await api.patch(`/users/${targetUserForPassword.id}`, {
        newPassword: newPassword.trim(),
      });

      Alert.alert('Sucesso', `Senha de ${targetUserForPassword.name} alterada com sucesso!`);
      setIsPasswordModalOpen(false);
      setNewPassword('');
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error?.message || 'Falha ao alterar senha');
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const handleToggleActive = async (u: any) => {
    setActiveMenuId(null);
    const actionText = u.isActive ? 'desativar' : 'reativar';
    Alert.alert(
      `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} Acesso`,
      `Deseja realmente ${actionText} o acesso de ${u.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: u.isActive ? 'Desativar' : 'Reativar',
          style: u.isActive ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await api.patch(`/users/${u.id}/toggle-active`);
              Alert.alert('Sucesso', `Status de ${u.name} atualizado.`);
              loadUsers();
            } catch (err: any) {
              Alert.alert('Erro', err.response?.data?.error?.message || 'Falha ao alterar status');
            }
          },
        },
      ]
    );
  };

  const handleDeleteUser = (u: any) => {
    setActiveMenuId(null);
    if (u.id === currentUser?.id) {
      Alert.alert('Atenção', 'Você não pode excluir sua própria conta.');
      return;
    }

    Alert.alert(
      'Excluir Usuário',
      `Tem certeza que deseja excluir ${u.name}? O operador perderá o acesso à portaria.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/users/${u.id}`);
              Alert.alert('Sucesso', 'Usuário removido com sucesso.');
              loadUsers();
            } catch (err: any) {
              Alert.alert('Erro', err.response?.data?.error?.message || 'Falha ao excluir usuário');
            }
          },
        },
      ]
    );
  };

  const getRoleLabel = (r: string) => {
    switch (r) {
      case 'SUPER_ADMIN':
        return 'Super Admin';
      case 'ADMIN':
        return 'Administrador';
      case 'SUPERVISOR':
        return 'Supervisor';
      default:
        return 'Porteiro';
    }
  };

  const getRoleBadgeStyle = (r: string) => {
    switch (r) {
      case 'SUPER_ADMIN':
        return { backgroundColor: '#F3E8FF', color: '#7E22CE' };
      case 'ADMIN':
        return { backgroundColor: '#FEE2E2', color: '#B91C1C' };
      case 'SUPERVISOR':
        return { backgroundColor: '#FEF3C7', color: '#D97706' };
      default:
        return { backgroundColor: '#DBEAFE', color: '#1D4ED8' };
    }
  };

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0) + 14;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding }]}>
        <View style={styles.headerRow}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
              <ArrowLeft size={20} color={colors.white} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Equipe da portaria</Text>
            <Text style={styles.headerSubtitle}>
              {isAdmin
                ? 'Porteiros, supervisores e administradores'
                : 'Porteiros e senhas da portaria'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.toolbar}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setIsModalOpen(true)}
          activeOpacity={0.85}
        >
          <Plus size={18} color={colors.white} style={{ marginRight: 6 }} />
          <Text style={styles.addButtonText}>
            {isSupervisor && !isAdmin ? 'Cadastrar porteiro' : 'Cadastrar membro'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lista */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Carregando equipe...</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadUsers();
              }}
              colors={['#2563EB']}
            />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <User size={48} color="#94A3B8" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>Nenhum usuário cadastrado</Text>
              <Text style={styles.emptySub}>
                Toque no botão acima para adicionar membros à equipe.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const badge = getRoleBadgeStyle(item.role);
            const canManage = canManageUser(item);
            const menuOpen = activeMenuId === item.id;

            return (
              <View style={[styles.userCard, !item.isActive && styles.userCardInactive]}>
                <View style={styles.userCardTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.userNameRow}>
                      <Text style={styles.userName}>{item.name}</Text>
                      {!item.isActive && (
                        <View style={styles.inactiveBadge}>
                          <Text style={styles.inactiveBadgeText}>INATIVO</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.userContactRow}>
                      <Mail size={13} color="#64748B" style={{ marginRight: 4 }} />
                      <Text style={styles.userEmail}>{item.email}</Text>
                    </View>

                    {item.phone && (
                      <View style={styles.userContactRow}>
                        <Phone size={13} color="#64748B" style={{ marginRight: 4 }} />
                        <Text style={styles.userPhone}>{item.phone}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.topRightCol}>
                    <View style={[styles.roleBadge, { backgroundColor: badge.backgroundColor }]}>
                      <Text style={[styles.roleBadgeText, { color: badge.color }]}>
                        {getRoleLabel(item.role)}
                      </Text>
                    </View>

                    {canManage && (
                      <TouchableOpacity
                        style={styles.menuBtn}
                        onPress={() => setActiveMenuId(menuOpen ? null : item.id)}
                        activeOpacity={0.7}
                      >
                        <MoreVertical size={18} color="#64748B" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Menu de Ações Expandido */}
                {menuOpen && canManage && (
                  <View style={styles.actionMenu}>
                    <TouchableOpacity style={styles.actionItem} onPress={() => openEditModal(item)}>
                      <Pencil size={15} color="#1D4ED8" />
                      <Text style={[styles.actionText, { color: '#1D4ED8' }]}>Editar dados</Text>
                    </TouchableOpacity>

                    <View style={styles.actionDivider} />

                    <TouchableOpacity style={styles.actionItem} onPress={() => openPasswordModal(item)}>
                      <Key size={15} color="#D97706" />
                      <Text style={[styles.actionText, { color: '#D97706' }]}>Alterar senha</Text>
                    </TouchableOpacity>

                    <View style={styles.actionDivider} />

                    <TouchableOpacity style={styles.actionItem} onPress={() => handleToggleActive(item)}>
                      <Power size={15} color={item.isActive ? '#64748B' : '#16A34A'} />
                      <Text style={[styles.actionText, { color: item.isActive ? '#64748B' : '#16A34A' }]}>
                        {item.isActive ? 'Desativar acesso' : 'Reativar acesso'}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.actionDivider} />

                    <TouchableOpacity style={styles.actionItem} onPress={() => handleDeleteUser(item)}>
                      <Trash2 size={15} color="#DC2626" />
                      <Text style={[styles.actionText, { color: '#DC2626' }]}>Excluir usuário</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Modal 1: Cadastrar Novo Membro */}
      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={() => setIsModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {isSupervisor && !isAdmin ? 'Cadastrar Novo Porteiro' : 'Cadastrar Novo Membro'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {isSupervisor && !isAdmin
                ? 'Crie o acesso do operador da portaria.'
                : 'Crie o acesso de porteiro, supervisor ou admin.'}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Nome Completo *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Porteiro Silva"
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>E-mail de Acesso *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="porteiro@grupocombate.com.br"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Senha de Acesso * (Mínimo 6 caracteres)</Text>
                <PasswordField
                  containerStyle={styles.input}
                  placeholder="Digite a senha provisória"
                  value={password}
                  onChangeText={setPassword}
                  showStrength
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Telefone / WhatsApp (Opcional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="11999998888"
                  placeholderTextColor="#94A3B8"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>

              {isAdmin && (
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Perfil de Acesso *</Text>
                  <View style={styles.rolePickerRow}>
                    <TouchableOpacity
                      style={[styles.roleOption, role === 'CONCIERGE' && styles.roleOptionSelected]}
                      onPress={() => setRole('CONCIERGE')}
                    >
                      <Text style={[styles.roleOptionText, role === 'CONCIERGE' && styles.roleOptionTextSelected]}>
                        Porteiro
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.roleOption, role === 'SUPERVISOR' && styles.roleOptionSelected]}
                      onPress={() => setRole('SUPERVISOR')}
                    >
                      <Text style={[styles.roleOptionText, role === 'SUPERVISOR' && styles.roleOptionTextSelected]}>
                        Supervisor
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.roleOption, role === 'ADMIN' && styles.roleOptionSelected]}
                      onPress={() => setRole('ADMIN')}
                    >
                      <Text style={[styles.roleOptionText, role === 'ADMIN' && styles.roleOptionTextSelected]}>
                        Admin
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleCreateUser}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Salvar Cadastro</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal 2: Editar Membro */}
      <Modal visible={isEditModalOpen} animationType="slide" transparent onRequestClose={() => setIsEditModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar Usuário</Text>
            <Text style={styles.modalSubtitle}>Atualize os dados cadastrais do membro.</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Nome Completo *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nome do usuário"
                  placeholderTextColor="#94A3B8"
                  value={editName}
                  onChangeText={setEditName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>E-mail de Acesso *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="email@grupocombate.com.br"
                  placeholderTextColor="#94A3B8"
                  value={editEmail}
                  onChangeText={setEditEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Telefone / WhatsApp</Text>
                <TextInput
                  style={styles.input}
                  placeholder="11999998888"
                  placeholderTextColor="#94A3B8"
                  value={editPhone}
                  onChangeText={setEditPhone}
                  keyboardType="phone-pad"
                />
              </View>

              {isAdmin && (
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Perfil de Acesso</Text>
                  <View style={styles.rolePickerRow}>
                    <TouchableOpacity
                      style={[styles.roleOption, editRole === 'CONCIERGE' && styles.roleOptionSelected]}
                      onPress={() => setEditRole('CONCIERGE')}
                    >
                      <Text style={[styles.roleOptionText, editRole === 'CONCIERGE' && styles.roleOptionTextSelected]}>
                        Porteiro
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.roleOption, editRole === 'SUPERVISOR' && styles.roleOptionSelected]}
                      onPress={() => setEditRole('SUPERVISOR')}
                    >
                      <Text style={[styles.roleOptionText, editRole === 'SUPERVISOR' && styles.roleOptionTextSelected]}>
                        Supervisor
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.roleOption, editRole === 'ADMIN' && styles.roleOptionSelected]}
                      onPress={() => setEditRole('ADMIN')}
                    >
                      <Text style={[styles.roleOptionText, editRole === 'ADMIN' && styles.roleOptionTextSelected]}>
                        Admin
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsEditModalOpen(false)}
                  disabled={isSubmittingEdit}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleEditUser}
                  disabled={isSubmittingEdit}
                >
                  {isSubmittingEdit ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Salvar Alterações</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal 3: Alterar Senha */}
      <Modal visible={isPasswordModalOpen} animationType="slide" transparent onRequestClose={() => setIsPasswordModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Redefinir Senha de Acesso</Text>
            <Text style={styles.modalSubtitle}>
              Digite a nova senha para {targetUserForPassword?.name}.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Nova Senha * (Mínimo 6 caracteres)</Text>
              <PasswordField
                containerStyle={styles.input}
                placeholder="Digite a nova senha"
                value={newPassword}
                onChangeText={setNewPassword}
                showStrength
                autoFocus
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsPasswordModalOpen(false)}
                disabled={isSubmittingPassword}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: '#D97706' }]}
                onPress={handleChangePassword}
                disabled={isSubmittingPassword}
              >
                {isSubmittingPassword ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Atualizar Senha</Text>
                )}
              </TouchableOpacity>
            </View>
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
  header: {
    backgroundColor: '#165337',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#D1FAE5',
    marginTop: 2,
  },
  toolbar: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#165337',
    height: 46,
    borderRadius: 12,
  },
  addButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
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
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  userCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  userCardInactive: {
    opacity: 0.7,
    backgroundColor: '#F1F5F9',
  },
  userCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  inactiveBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inactiveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },
  userContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  userEmail: {
    fontSize: 12,
    color: '#64748B',
  },
  userPhone: {
    fontSize: 12,
    color: '#64748B',
  },
  topRightCol: {
    alignItems: 'flex-end',
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  menuBtn: {
    padding: 4,
  },
  actionMenu: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#CBD5E1',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
    marginTop: 2,
  },
  formGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    color: '#0F172A',
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  roleOptionSelected: {
    backgroundColor: '#165337',
    borderColor: '#165337',
  },
  roleOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  roleOptionTextSelected: {
    color: colors.white,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    marginBottom: 10,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  saveBtn: {
    flex: 1.5,
    backgroundColor: '#165337',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 8,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
});
