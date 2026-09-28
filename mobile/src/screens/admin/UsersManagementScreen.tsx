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
  UserCheck,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { api } from '../../config/api';

interface UsersManagementScreenProps {
  onBack?: () => void;
}

export const UsersManagementScreen: React.FC<UsersManagementScreenProps> = ({ onBack }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal Novo Usuário
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'CONCIERGE' | 'SUPERVISOR' | 'ADMIN'>('CONCIERGE');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/users');
      setUsers(res.data.data?.users || res.data.data || []);
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

  const handleCreateUser = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Atenção', 'Preencha o nome, e-mail e senha do usuário.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.post('/users', {
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        role,
        phone: phone.trim() || undefined,
      });

      if (res.data.success) {
        Alert.alert('Sucesso', 'Porteiro/Usuário cadastrado com sucesso!');
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

  const getRoleLabel = (r: string) => {
    switch (r) {
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
          <View style={styles.iconCircle}>
            <UserCheck size={22} color={colors.white} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.headerTitle}>Gestão de Porteiros & Equipe</Text>
            <Text style={styles.headerSubtitle}>Cadastro de operadores da portaria</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setIsModalOpen(true)}
          activeOpacity={0.85}
        >
          <Plus size={18} color="#165337" style={{ marginRight: 6 }} />
          <Text style={styles.addBtnText}>Cadastrar Novo Porteiro</Text>
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
                Toque no botão acima para adicionar porteiros ou administradores.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const badge = getRoleBadgeStyle(item.role);
            return (
              <View style={styles.userCard}>
                <View style={styles.userCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{item.name}</Text>
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
                  <View style={[styles.roleBadge, { backgroundColor: badge.backgroundColor }]}>
                    <Text style={[styles.roleBadgeText, { color: badge.color }]}>
                      {getRoleLabel(item.role)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Modal Cadastro de Usuário */}
      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={() => setIsModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cadastrar Novo Membro</Text>
            <Text style={styles.modalSubtitle}>Crie o acesso de porteiro, supervisor ou admin.</Text>

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
              <Text style={styles.inputLabel}>Senha de Acesso *</Text>
              <TextInput
                style={styles.input}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
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
                  <Text style={styles.saveBtnText}>Salvar Acesso</Text>
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
    marginBottom: 14,
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
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingVertical: 11,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#165337',
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
  userCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  userContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  userEmail: {
    fontSize: 12,
    color: '#64748B',
  },
  userPhone: {
    fontSize: 12,
    color: '#64748B',
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
