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
  Modal,
} from 'react-native';
import { User, Phone, Mail, Check, AlertTriangle, KeyRound, X } from 'lucide-react-native';
import { AppHeader } from '../../components/AppHeader';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../config/api';
import { PasswordField, PasswordStrength } from '../../components/PasswordField';

interface ProfileScreenProps {
  onBack?: () => void;
  /** Quando true, não renderiza o AppHeader (útil na aba Perfil do SuperAdmin). */
  embedded?: boolean;
  /** Blocos exclusivos (ex.: WhatsApp da plataforma no SuperAdmin). */
  extraSections?: React.ReactNode;
  onLogout?: () => void;
  logoutLabel?: string;
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

function roleLabelFor(role?: string) {
  switch (role) {
    case 'ADMIN':
      return 'Administrador';
    case 'SUPERVISOR':
      return 'Supervisor';
    case 'SUPER_ADMIN':
      return 'Superadministrador';
    case 'CLIENT':
      return 'Morador';
    default:
      return 'Porteiro';
  }
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onBack,
  embedded = false,
  extraSections,
  onLogout,
  logoutLabel = 'Sair da conta',
}) => {
  const { user, patchUser, refreshSubscription, signOut } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [whatsapp, setWhatsapp] = useState(displayWhatsApp(user?.whatsappNumber || user?.phone));
  const [whatsappVerified, setWhatsappVerified] = useState(Boolean(user?.whatsappVerified));
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [isCodeBusy, setIsCodeBusy] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [codeError, setCodeError] = useState('');

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordStep, setPasswordStep] = useState<'form' | 'code'>('form');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordCode, setPasswordCode] = useState('');
  const [isPasswordBusy, setIsPasswordBusy] = useState(false);

  const phoneDigits = whatsapp.replace(/\D/g, '');
  const savedDigits = (user?.whatsappNumber || user?.phone || '').replace(/\D/g, '').slice(-11);
  const numberChanged = phoneDigits !== savedDigits;
  const isConfirmed = whatsappVerified && !numberChanged;
  const needsVerification = !isConfirmed;

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
      Alert.alert('WhatsApp confirmado', 'Número atualizado com sucesso.');
    } catch (err: any) {
      setWhatsappVerified(false);
      setCodeError(err.response?.data?.error?.message || 'Código incorreto.');
    } finally {
      setIsCodeBusy(false);
    }
  };

  const openPasswordModal = () => {
    if (!isConfirmed) {
      Alert.alert('Confirme o WhatsApp', 'Confirme seu WhatsApp antes de alterar a senha.');
      return;
    }
    setPasswordStep('form');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordCode('');
    setPasswordModalOpen(true);
  };

  const closePasswordModal = () => {
    if (isPasswordBusy) return;
    setPasswordModalOpen(false);
    setPasswordStep('form');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordCode('');
  };

  const requestPasswordChange = async () => {
    if (!currentPassword.trim()) {
      Alert.alert('Atenção', 'Informe a senha atual.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Atenção', 'A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Atenção', 'A confirmação não confere com a nova senha.');
      return;
    }
    try {
      setIsPasswordBusy(true);
      await api.post('/auth/change-password/request', {
        currentPassword,
        newPassword,
      });
      setPasswordStep('code');
      setPasswordCode('');
      Alert.alert('Código enviado', 'Enviamos um código de redefinição para o seu WhatsApp.');
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error?.message || 'Não foi possível enviar o código.');
    } finally {
      setIsPasswordBusy(false);
    }
  };

  const confirmPasswordChange = async () => {
    if (!/^\d{6}$/.test(passwordCode.trim())) {
      Alert.alert('Atenção', 'Informe o código de 6 números.');
      return;
    }
    try {
      setIsPasswordBusy(true);
      await api.post('/auth/change-password/confirm', {
        code: passwordCode.trim(),
        newPassword,
      });
      setPasswordModalOpen(false);
      setPasswordStep('form');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordCode('');
      Alert.alert('Senha alterada', 'Sua senha foi atualizada com sucesso.');
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error?.message || 'Não foi possível alterar a senha.');
    } finally {
      setIsPasswordBusy(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Atenção', 'O nome não pode ficar em branco.');
      return;
    }
    if (needsVerification) {
      Alert.alert('Confirme o WhatsApp', 'Confirme seu número de WhatsApp antes de salvar o perfil.');
      return;
    }

    try {
      setIsSaving(true);
      setSuccessMessage(null);
      const res = await api.patch('/users/me', { name: name.trim() });
      if (res.data?.success) {
        await patchUser({ name: name.trim() });
        setSuccessMessage('Perfil atualizado com sucesso!');
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch (err: any) {
      Alert.alert('Erro ao Salvar', err.response?.data?.error?.message || err.message || 'Falha ao atualizar perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    if (onLogout) onLogout();
    else signOut();
  };

  return (
    <View style={styles.container}>
      {!embedded && onBack ? (
        <AppHeader title="Meu Perfil" subtitle="Dados, WhatsApp e senha" onBack={onBack} />
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.scrollContent, embedded && { paddingTop: 8 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.profileBadgeCard}>
            <View style={styles.avatarCircle}>
              <User size={34} color="#FFFFFF" />
            </View>
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text style={styles.profileName}>{user?.name || 'Operador'}</Text>
              <Text style={styles.roleText}>{roleLabelFor(user?.role)}</Text>
              <Text style={styles.profileOrg}>{user?.organizationName || 'Brisoft Portaria'}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.changePasswordTopBtn} onPress={openPasswordModal} activeOpacity={0.85}>
            <KeyRound size={18} color="#165337" style={{ marginRight: 8 }} />
            <Text style={styles.changePasswordTopBtnText}>Alterar senha</Text>
          </TouchableOpacity>

          {successMessage ? (
            <View style={styles.successBanner}>
              <Check size={18} color="#16A34A" style={{ marginRight: 8 }} />
              <Text style={styles.successBannerText}>{successMessage}</Text>
            </View>
          ) : null}

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Dados pessoais</Text>

            <Text style={styles.fieldLabel}>Nome completo</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Seu nome"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>E-mail de login</Text>
            <View style={styles.disabledInputBox}>
              <Mail size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <Text style={styles.disabledInputText}>{user?.email || 'email@exemplo.com'}</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>WhatsApp</Text>
            <Text style={styles.sectionDesc}>
              Usado para avisos, contato da plataforma, recuperação de senha e confirmações importantes.
            </Text>

            <Text style={styles.fieldLabel}>Número</Text>
            <View style={[styles.phoneRow, !isConfirmed && styles.phoneRowWarn]}>
              <Phone size={16} color="#64748B" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.phoneInput}
                value={whatsapp}
                onChangeText={changeWhatsapp}
                placeholder="(83) 99999-9999"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
              />
              <View style={styles.statusIconWrap}>
                {isConfirmed ? (
                  <Check size={18} color="#16A34A" strokeWidth={2.8} />
                ) : (
                  <AlertTriangle size={18} color="#D97706" strokeWidth={2.4} />
                )}
              </View>
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

          {extraSections}

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
                <Text style={styles.saveBtnText}>Salvar alterações</Text>
              </>
            )}
          </TouchableOpacity>

          {embedded ? (
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
              <Text style={styles.logoutBtnText}>{logoutLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={passwordModalOpen} transparent animationType="fade" onRequestClose={closePasswordModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {passwordStep === 'form' ? 'Alterar senha' : 'Código do WhatsApp'}
              </Text>
              <TouchableOpacity onPress={closePasswordModal} disabled={isPasswordBusy}>
                <X size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {passwordStep === 'form' ? (
              <>
                <Text style={styles.modalHint}>
                  Informe a senha atual e a nova senha. Em seguida enviaremos um código no WhatsApp.
                </Text>
                <Text style={styles.fieldLabel}>Senha atual</Text>
                <PasswordField
                  containerStyle={styles.input}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Senha atual"
                />
                <Text style={styles.fieldLabel}>Nova senha</Text>
                <PasswordField
                  containerStyle={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Mínimo 8 caracteres"
                />
                <PasswordStrength value={newPassword} />
                <Text style={styles.fieldLabel}>Confirmar nova senha</Text>
                <PasswordField
                  containerStyle={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repita a nova senha"
                />
                <TouchableOpacity
                  style={[styles.confirmBtn, { marginTop: 16 }, isPasswordBusy && { opacity: 0.7 }]}
                  onPress={requestPasswordChange}
                  disabled={isPasswordBusy}
                >
                  {isPasswordBusy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.confirmBtnText}>Enviar código no WhatsApp</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalHint}>
                  Digite o código de 6 números enviado para o seu WhatsApp para concluir a alteração.
                </Text>
                <Text style={styles.fieldLabel}>Código</Text>
                <TextInput
                  style={styles.input}
                  value={passwordCode}
                  onChangeText={(value) => setPasswordCode(value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <TouchableOpacity
                  style={[styles.confirmBtn, { marginTop: 16 }, isPasswordBusy && { opacity: 0.7 }]}
                  onPress={confirmPasswordChange}
                  disabled={isPasswordBusy}
                >
                  {isPasswordBusy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.confirmBtnText}>Confirmar e alterar senha</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={requestPasswordChange}
                  disabled={isPasswordBusy}
                >
                  <Text style={styles.secondaryBtnText}>Reenviar código</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    marginBottom: 12,
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
  roleText: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  profileOrg: {
    marginTop: 2,
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  changePasswordTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#165337',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    minHeight: 46,
    marginBottom: 14,
  },
  changePasswordTopBtnText: {
    color: '#165337',
    fontWeight: '800',
    fontSize: 14,
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
    marginBottom: 10,
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
  phoneRowWarn: {
    borderColor: '#F59E0B',
  },
  phoneInput: {
    flex: 1,
    color: '#0F172A',
    fontSize: 15,
  },
  statusIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
  logoutBtn: {
    marginTop: 16,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  logoutBtnText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalHint: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 8,
  },
});
