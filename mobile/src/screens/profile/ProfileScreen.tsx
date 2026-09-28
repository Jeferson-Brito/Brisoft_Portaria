import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { User, Lock, Phone, Mail, ShieldCheck, Check, ArrowLeft } from 'lucide-react-native';
import { AppHeader } from '../../components/AppHeader';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../config/api';
import { colors } from '../../theme/colors';

interface ProfileScreenProps {
  onBack: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBack }) => {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Atenção', 'O nome não pode ficar em branco.');
      return;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        Alert.alert('Atenção', 'A nova senha deve ter pelo menos 6 caracteres.');
        return;
      }
      if (newPassword !== confirmPassword) {
        Alert.alert('Atenção', 'A confirmação de senha não confere com a nova senha.');
        return;
      }
    }

    try {
      setIsSaving(true);
      setSuccessMessage(null);

      const payload: any = { name: name.trim() };
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await api.patch('/users/me', payload);

      if (res.data?.success) {
        setSuccessMessage('Perfil atualizado com sucesso!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch (err: any) {
      Alert.alert('Erro ao Salvar', err.response?.data?.error?.message || err.message || 'Falha ao atualizar perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  const roleLabel =
    user?.role === 'ADMIN'
      ? 'Administrador Geral'
      : user?.role === 'SUPERVISOR'
      ? 'Supervisor de Posto'
      : 'Porteiro Operador';

  return (
    <View style={styles.container}>
      <AppHeader
        title="Meu Perfil"
        subtitle="Gerencie seus dados de acesso e senha"
        onBack={onBack}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Badge Perfil */}
          <View style={styles.profileBadgeCard}>
            <View style={styles.avatarCircle}>
              <User size={34} color="#FFFFFF" />
            </View>
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text style={styles.profileName}>{user?.name || 'Operador'}</Text>
              <View style={styles.roleTag}>
                <ShieldCheck size={13} color="#2563EB" style={{ marginRight: 4 }} />
                <Text style={styles.roleTagText}>{roleLabel}</Text>
              </View>
              <Text style={styles.profileOrg}>{user?.organizationName || 'Combate Portaria'}</Text>
            </View>
          </View>

          {successMessage && (
            <View style={styles.successBanner}>
              <Check size={18} color="#16A34A" style={{ marginRight: 8 }} />
              <Text style={styles.successBannerText}>{successMessage}</Text>
            </View>
          )}

          {/* Dados Pessoais */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Dados Pessoais</Text>

            <Text style={styles.fieldLabel}>Nome Completo</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Seu nome"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>E-mail de Login</Text>
            <View style={styles.disabledInputBox}>
              <Mail size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <Text style={styles.disabledInputText}>{user?.email || 'email@exemplo.com'}</Text>
            </View>
            <Text style={styles.helperText}>O e-mail de acesso é fixo e definido pela administração.</Text>
          </View>

          {/* Alteração de Senha */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Alterar Senha de Acesso</Text>
            <Text style={styles.sectionDesc}>
              Deixe os campos em branco se não desejar alterar sua senha.
            </Text>

            <Text style={styles.fieldLabel}>Senha Atual (se for alterar)</Text>
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Digite a senha atual"
              placeholderTextColor="#94A3B8"
              secureTextEntry
            />

            <Text style={styles.fieldLabel}>Nova Senha (mínimo 6 dígitos)</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Digite a nova senha"
              placeholderTextColor="#94A3B8"
              secureTextEntry
            />

            <Text style={styles.fieldLabel}>Confirmar Nova Senha</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirme a nova senha"
              placeholderTextColor="#94A3B8"
              secureTextEntry
            />
          </View>

          {/* Botão Salvar */}
          <TouchableOpacity
            style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Check size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.saveBtnText}>Salvar Alterações</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 160,
  },
  profileBadgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#165337',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 4,
  },
  roleTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  profileOrg: {
    fontSize: 13,
    color: '#64748B',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  successBannerText: {
    color: '#15803D',
    fontWeight: '700',
    fontSize: 14,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  sectionDesc: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  disabledInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  disabledInputText: {
    fontSize: 14,
    color: '#64748B',
  },
  helperText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  saveBtn: {
    backgroundColor: '#165337',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#165337',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
