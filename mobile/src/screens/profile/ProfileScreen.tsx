import React, { useEffect, useState } from 'react';
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
import { User, Phone, Mail, ShieldCheck, Check } from 'lucide-react-native';
import { AppHeader } from '../../components/AppHeader';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../config/api';
import { colors } from '../../theme/colors';
import { PasswordField, PasswordStrength } from '../../components/PasswordField';

interface ProfileScreenProps {
  onBack: () => void;
}

function maskPhone(raw: string) {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function displayWhatsApp(raw?: string | null) {
  if (!raw) return '';
  return maskPhone(raw);
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBack }) => {
  const { user, patchUser, refreshSubscription } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [whatsapp, setWhatsapp] = useState(displayWhatsApp(user?.whatsappNumber || user?.phone));
  const [whatsappVerified, setWhatsappVerified] = useState(Boolean(user?.whatsappVerified));
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [isCodeBusy, setIsCodeBusy] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [codeError, setCodeError] = useState('');

  const phoneDigits = whatsapp.replace(/\D/g, '');
  const savedDigits = (user?.whatsappNumber || user?.phone || '').replace(/\D/g, '').slice(-11);
  const numberChanged = phoneDigits !== savedDigits;
  const needsVerification = !whatsappVerified || numberChanged;

  useEffect(() => {
    let active = true;
    api
      .get('/auth/me')
      .then((response) => {
        const profile = response.data?.data?.user;
        if (!active || !profile) return;
        setWhatsapp(displayWhatsApp(profile.whatsappNumber || profile.phone));
        setWhatsappVerified(Boolean(profile.whatsappVerified));
        if (profile.name) setName(profile.name);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const changeWhatsapp = (value: string) => {
    setWhatsapp(maskPhone(value));
    setCodeSent(false);
    setCode('');
    setPhoneError('');
    setCodeError('');
    const nextDigits = value.replace(/\D/g, '');
    const currentSaved = (user?.whatsappNumber || '').replace(/\D/g, '').slice(-11);
    if (nextDigits === currentSaved && user?.whatsappVerified) {
      setWhatsappVerified(true);
    } else {
      setWhatsappVerified(false);
    }
  };

  const sendWhatsappCode = async () => {
    if (phoneDigits.length !== 11 || phoneDigits[2] !== '9') {
      setPhoneError('Informe o DDD e o celular com o 9 (11 dígitos).');
      return;
    }
    try {
      setIsCodeBusy(true);
      setPhoneError('');
      await api.post('/auth/whatsapp-code', { phone: whatsapp });
      setCodeSent(true);
      setCode('');
      Alert.alert('Código enviado', `Enviamos um código de 6 números para ${whatsapp}.`);
    } catch (err: any) {
      setPhoneError(err.response?.data?.error?.message || 'Não foi possível enviar o código.');
    } finally {
      setIsCodeBusy(false);
    }
  };

  const confirmWhatsappCode = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setCodeError('Informe o código de 6 números.');
      return;
    }
    try {
      setIsCodeBusy(true);
      setCodeError('');
      await api.post('/auth/whatsapp-code/confirm', { phone: whatsapp, code: code.trim() });
      setWhatsappVerified(true);
      setCodeSent(false);
      setCode('');
      await patchUser({
        whatsappVerified: true,
        whatsappNumber: phoneDigits.length === 11 ? `55${phoneDigits}` : phoneDigits,
        phone: phoneDigits.length === 11 ? `55${phoneDigits}` : phoneDigits,
      });
      await refreshSubscription().catch(() => undefined);
      Alert.alert('WhatsApp confirmado', 'Este número será usado para recuperar a senha.');
    } catch (err: any) {
      setWhatsappVerified(false);
      setCodeError(err.response?.data?.error?.message || 'Código incorreto.');
    } finally {
      setIsCodeBusy(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Atenção', 'O nome não pode ficar em branco.');
      return;
    }

    if (needsVerification) {
      Alert.alert(
        'Confirme o WhatsApp',
        'O WhatsApp é obrigatório para recuperação de senha. Envie o código, confirme o número e depois salve o perfil.'
      );
      return;
    }

    if (newPassword) {
      if (newPassword.length < 8) {
        Alert.alert('Atenção', 'A nova senha deve ter pelo menos 8 caracteres.');
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
        await patchUser({ name: name.trim() });
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
      : user?.role === 'SUPER_ADMIN'
      ? 'Superadministrador'
      : 'Porteiro Operador';

  return (
    <View style={styles.container}>
      <AppHeader
        title="Meu Perfil"
        subtitle="Gerencie seus dados, WhatsApp e senha"
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
              <Text style={styles.profileOrg}>{user?.organizationName || 'Brisoft Portaria'}</Text>
            </View>
          </View>

          {successMessage ? (
            <View style={styles.successBanner}>
              <Check size={18} color="#16A34A" style={{ marginRight: 8 }} />
              <Text style={styles.successBannerText}>{successMessage}</Text>
            </View>
          ) : null}

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

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>WhatsApp de recuperação</Text>
            <Text style={styles.sectionDesc}>
              Este número recebe o código quando você esquecer a senha. Ele é obrigatório e precisa estar confirmado.
            </Text>

            <View
              style={[
                styles.statusBox,
                whatsappVerified && !numberChanged ? styles.statusOk : styles.statusWarn,
              ]}
            >
              <Text style={styles.statusText}>
                {whatsappVerified && !numberChanged
                  ? 'WhatsApp confirmado e pronto para recuperação de senha'
                  : 'Confirme o WhatsApp para poder recuperar a senha'}
              </Text>
            </View>

            <Text style={styles.fieldLabel}>Número do WhatsApp</Text>
            <View style={styles.phoneRow}>
              <Phone size={16} color="#64748B" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.phoneInput}
                value={whatsapp}
                onChangeText={changeWhatsapp}
                placeholder="(83) 99999-9999"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
              />
            </View>
            {phoneError ? <Text style={styles.fieldError}>{phoneError}</Text> : null}

            {needsVerification ? (
              <>
                <TouchableOpacity
                  style={[styles.secondaryBtn, isCodeBusy && { opacity: 0.7 }]}
                  onPress={sendWhatsappCode}
                  disabled={isCodeBusy}
                  activeOpacity={0.85}
                >
                  {isCodeBusy && !codeSent ? (
                    <ActivityIndicator color="#165337" />
                  ) : (
                    <Text style={styles.secondaryBtnText}>
                      {codeSent ? 'Reenviar código' : 'Enviar código no WhatsApp'}
                    </Text>
                  )}
                </TouchableOpacity>

                {codeSent ? (
                  <>
                    <Text style={styles.fieldLabel}>Código de 6 números</Text>
                    <TextInput
                      style={styles.input}
                      value={code}
                      onChangeText={(value) => {
                        setCode(value.replace(/\D/g, '').slice(0, 6));
                        setCodeError('');
                      }}
                      placeholder="000000"
                      placeholderTextColor="#94A3B8"
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    {codeError ? <Text style={styles.fieldError}>{codeError}</Text> : null}
                    <TouchableOpacity
                      style={[styles.confirmBtn, isCodeBusy && { opacity: 0.7 }]}
                      onPress={confirmWhatsappCode}
                      disabled={isCodeBusy}
                      activeOpacity={0.85}
                    >
                      {isCodeBusy ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.confirmBtnText}>Confirmar WhatsApp</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : null}
              </>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Alterar Senha de Acesso</Text>
            <Text style={styles.sectionDesc}>
              Deixe os campos em branco se não desejar alterar sua senha.
            </Text>

            <Text style={styles.fieldLabel}>Senha Atual (se for alterar)</Text>
            <PasswordField
              containerStyle={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Digite a senha atual"
            />

            <Text style={styles.fieldLabel}>Nova Senha (mínimo 8 caracteres)</Text>
            <PasswordField
              containerStyle={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Digite a nova senha"
            />
            <PasswordStrength value={newPassword} />

            <Text style={styles.fieldLabel}>Confirmar Nova Senha</Text>
            <PasswordField
              containerStyle={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirme a nova senha"
            />
          </View>

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
    paddingBottom: 40,
  },
  profileBadgeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
    marginTop: 4,
  },
  roleTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  profileOrg: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  successBanner: {
    backgroundColor: 'rgba(22, 163, 74, 0.1)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  successBannerText: {
    color: '#166534',
    fontWeight: '700',
    flex: 1,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  sectionDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 48,
    color: '#0F172A',
    fontSize: 15,
  },
  disabledInputBox: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  disabledInputText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
  },
  helperText: {
    marginTop: 6,
    fontSize: 12,
    color: '#94A3B8',
  },
  statusBox: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  statusOk: {
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
  },
  statusWarn: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  phoneInput: {
    flex: 1,
    color: '#0F172A',
    fontSize: 15,
  },
  fieldError: {
    marginTop: 6,
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },
  secondaryBtn: {
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: '#165337',
    borderRadius: 12,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryBtnText: {
    color: '#165337',
    fontWeight: '800',
    fontSize: 14,
  },
  confirmBtn: {
    marginTop: 10,
    backgroundColor: '#165337',
    borderRadius: 12,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: '#165337',
    borderRadius: 14,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
});
