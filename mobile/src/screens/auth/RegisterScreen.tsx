import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ArrowRight,
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Building,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from 'lucide-react-native';
import { useAuth, RegisterData } from '../../contexts/AuthContext';
import { api } from '../../config/api';
import { colors } from '../../theme/colors';
import { PasswordStrength } from '../../components/PasswordField';

interface RegisterScreenProps {
  onLoginPress: () => void;
}

function maskCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function maskCpf(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function isValidCpf(value: string) {
  const cpf = value.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const digit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) sum += Number(cpf[index]) * (length + 1 - index);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

function isValidCnpj(value: string) {
  const cnpj = value.replace(/\D/g, '');
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const calc = (factors: number[]) => {
    const sum = factors.reduce((total, factor, index) => total + Number(cnpj[index]) * factor, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cnpj[12])
    && calc([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cnpj[13]);
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ onLoginPress }) => {
  const { register } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1 = Dados Pessoais | 2 = Empresa | 3 = Confirmação
  const [isLoading, setIsLoading] = useState(false);

  // Campos Responsável (Dados Pessoais)
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Campos Empresa
  const [orgName, setOrgName] = useState('');
  const [documentType, setDocumentType] = useState<'CPF' | 'CNPJ'>('CNPJ');
  const [orgDocument, setOrgDocument] = useState('');
  const [whatsappCode, setWhatsappCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [isCodeBusy, setIsCodeBusy] = useState(false);
  const phonePromptArmed = useRef(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const phoneDigits = adminPhone.replace(/\D/g, '');

  const handleNextFromStep1 = () => {
    const next: Record<string, string> = {};
    if (adminName.trim().length < 2) next.name = 'Informe seu nome completo.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim())) next.email = 'Informe um e-mail válido.';
    if (adminPassword.length < 8) next.password = 'A senha deve ter no mínimo 8 caracteres.';
    if (adminPassword !== adminConfirmPassword) next.confirmPassword = 'As senhas não coincidem.';
    if (phoneDigits.length !== 11 || phoneDigits[2] !== '9') {
      next.phone = 'Informe o DDD e o número de celular com o 9.';
    }
    if (!phoneVerified) next.phone = next.phone || 'Confirme o WhatsApp antes de continuar.';
    setFieldErrors(next);
    if (Object.keys(next).length === 0) setStep(2);
  };

  const handleNextFromStep2 = async () => {
    const next: Record<string, string> = {};
    if (orgName.trim().length < 2) next.orgName = 'Informe o nome do condomínio ou da empresa.';
    if (documentType === 'CPF' && !isValidCpf(orgDocument)) {
      next.document = 'Este CPF é inválido. Confira os números digitados.';
    }
    if (documentType === 'CNPJ' && !isValidCnpj(orgDocument)) {
      next.document = 'Este CNPJ é inválido. Confira os números digitados.';
    }
    if (next.document || next.orgName) {
      setFieldErrors(next);
      return;
    }
    try {
      setIsLoading(true);
      await api.post('/auth/register/check-document', { documentType, document: orgDocument });
      setFieldErrors({});
      setStep(3);
    } catch (err: any) {
      setFieldErrors({
        document: err.response?.data?.error?.message || 'Não foi possível validar o documento.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const closePhoneModal = () => {
    setPhoneModalOpen(false);
  };

  const sendWhatsappCode = async () => {
    if (phoneDigits.length !== 11 || phoneDigits[2] !== '9') {
      setFieldErrors((current) => ({ ...current, phone: 'Informe o DDD e o número de celular com o 9.' }));
      return;
    }
    const emailReady = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim());
    try {
      setIsCodeBusy(true);
      await api.post('/auth/register/whatsapp-code', {
        ...(emailReady ? { email: adminEmail.trim() } : {}),
        phone: adminPhone.trim(),
      });
      setCodeSent(true);
      setWhatsappCode('');
      setPhoneVerified(false);
      clearError('phone');
    } catch (err: any) {
      setFieldErrors((current) => ({
        ...current,
        phone: err.response?.data?.error?.message === 'Required'
          ? 'Não foi possível enviar o código para esse número. Tente novamente.'
          : err.response?.data?.error?.message || 'Não foi possível enviar o código.',
      }));
    } finally {
      setIsCodeBusy(false);
    }
  };

  const confirmWhatsappCode = async () => {
    if (!/^\d{6}$/.test(whatsappCode.trim())) {
      setFieldErrors((current) => ({ ...current, code: 'Informe o código de 6 números.' }));
      return;
    }
    const emailReady = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim());
    try {
      setIsCodeBusy(true);
      await api.post('/auth/register/confirm-whatsapp', {
        ...(emailReady ? { email: adminEmail.trim() } : {}),
        phone: adminPhone.trim(),
        code: whatsappCode.trim(),
      });
      setPhoneVerified(true);
      closePhoneModal();
      clearError('code');
      clearError('phone');
    } catch (err: any) {
      setPhoneVerified(false);
      setFieldErrors((current) => ({
        ...current,
        code: err.response?.data?.error?.message || 'Código incorreto.',
      }));
    } finally {
      setIsCodeBusy(false);
    }
  };

  const handleFinalRegister = async () => {
    if (!/^\d{6}$/.test(whatsappCode.trim())) {
      Alert.alert('Atenção', 'Digite o código de 6 números recebido no WhatsApp.');
      return;
    }
    setIsLoading(true);
    try {
      const data: RegisterData = {
        organizationName: orgName.trim(),
        organizationDocument: orgDocument.trim(),
        documentType,
        adminName: adminName.trim(),
        adminEmail: adminEmail.trim(),
        adminPassword,
        adminPhone: adminPhone.trim(),
        verificationCode: whatsappCode.trim(),
      };
      await register(data);
    } catch (err: any) {
      const message = err.message || 'Não foi possível criar a conta.';
      if (/e-mail/i.test(message)) {
        setFieldErrors({ email: message });
        setStep(1);
      } else if (/whatsapp|número|numero|celular/i.test(message)) {
        setPhoneVerified(false);
        setFieldErrors({ phone: message });
        setStep(1);
      } else if (/cpf|cnpj|documento/i.test(message)) {
        setFieldErrors({ document: message });
        setStep(2);
      } else {
        Alert.alert('Erro ao criar conta', message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F7F5" />

      {/* Onda suave orgânica no topo direito */}
      <View style={styles.topRightWave} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => {
                if (step === 3) setStep(2);
                else if (step === 2) setStep(1);
                else onLoginPress();
              }}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <ArrowLeft size={22} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <View style={styles.titleRow}>
            <View style={styles.logoBadge}>
              <ShieldCheck size={22} color="#FFFFFF" strokeWidth={2.2} />
            </View>
            <Text style={styles.title}>Criar sua conta</Text>
            <Text style={styles.subtitle}>
              {step === 1 ? 'Seus dados de acesso' : step === 2 ? 'Dados da empresa' : 'Confira e conclua'}
            </Text>
          </View>

          <View style={styles.stepperContainer}>
            {/* Passo 1: Dados Pessoais */}
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, step >= 1 && styles.stepCircleActive]}>
                <Text style={[styles.stepNumber, step >= 1 && styles.stepNumberActive]}>1</Text>
              </View>
              <Text style={[styles.stepLabel, step >= 1 && styles.stepLabelActive]}>
                Dados Pessoais
              </Text>
            </View>

            {/* Linha Conectora 1 -> 2 */}
            <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />

            {/* Passo 2: Empresa */}
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, step >= 2 && styles.stepCircleActive]}>
                <Text style={[styles.stepNumber, step >= 2 && styles.stepNumberActive]}>2</Text>
              </View>
              <Text style={[styles.stepLabel, step >= 2 && styles.stepLabelActive]}>
                Empresa
              </Text>
            </View>

            {/* Linha Conectora 2 -> 3 */}
            <View style={[styles.stepLine, step >= 3 && styles.stepLineActive]} />

            {/* Passo 3: Confirmação */}
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, step >= 3 && styles.stepCircleActive]}>
                <Text style={[styles.stepNumber, step >= 3 && styles.stepNumberActive]}>3</Text>
              </View>
              <Text style={[styles.stepLabel, step >= 3 && styles.stepLabelActive]}>
                Confirmação
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.formScroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* CONTEÚDO DE CADA PASSO */}

          {/* PASSO 1: DADOS PESSOAIS */}
          {step === 1 && (
            <View style={styles.formContainer}>
              {/* Nome Completo */}
              <View style={[styles.inputBox, fieldErrors.name && styles.inputBoxError]}>
                <User size={18} color={fieldErrors.name ? '#DC2626' : '#64748B'} style={styles.inputIcon} />
                <View style={styles.inputContent}>
                  <Text style={styles.fieldLabel}>Nome completo</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Digite seu nome completo"
                    placeholderTextColor="#94A3B8"
                    value={adminName}
                    onChangeText={(value) => { setAdminName(value); clearError('name'); }}
                    autoCapitalize="words"
                  />
                </View>
              </View>
              {fieldErrors.name ? <Text style={styles.fieldError}>{fieldErrors.name}</Text> : null}

              <View style={[styles.inputBox, fieldErrors.email && styles.inputBoxError]}>
                <Mail size={18} color={fieldErrors.email ? '#DC2626' : '#64748B'} style={styles.inputIcon} />
                <View style={styles.inputContent}>
                  <Text style={styles.fieldLabel}>E-mail</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="ex: usuario@exemplo.com"
                    placeholderTextColor="#94A3B8"
                    value={adminEmail}
                    onChangeText={(value) => { setAdminEmail(value); clearError('email'); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>
              {fieldErrors.email ? <Text style={styles.fieldError}>{fieldErrors.email}</Text> : null}

              <View style={[styles.inputBox, fieldErrors.phone && styles.inputBoxError]}>
                <Phone size={18} color={fieldErrors.phone ? '#DC2626' : '#64748B'} style={styles.inputIcon} />
                <View style={styles.inputContent}>
                  <Text style={styles.fieldLabel}>WhatsApp</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="(00) 90000-0000"
                    placeholderTextColor="#94A3B8"
                    value={adminPhone}
                    onChangeText={(value) => {
                      const masked = maskPhone(value);
                      const digits = masked.replace(/\D/g, '');
                      setAdminPhone(masked);
                      setPhoneVerified(false);
                      setCodeSent(false);
                      setWhatsappCode('');
                      clearError('phone');
                      if (digits.length < 11) {
                        phonePromptArmed.current = true;
                        setPhoneModalOpen(false);
                      } else if (phonePromptArmed.current) {
                        phonePromptArmed.current = false;
                        setPhoneModalOpen(true);
                      }
                    }}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
              {fieldErrors.phone ? <Text style={styles.fieldError}>{fieldErrors.phone}</Text> : null}
              {phoneVerified ? <Text style={styles.verifiedText}>WhatsApp confirmado</Text> : null}

              <View style={[styles.inputBox, fieldErrors.password && styles.inputBoxError]}>
                <Lock size={18} color="#64748B" style={styles.inputIcon} />
                <View style={[styles.inputContent, { paddingRight: 40 }]}>
                  <Text style={styles.fieldLabel}>Senha</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Digite sua senha (mín. 8 caracteres)"
                    placeholderTextColor="#94A3B8"
                    value={adminPassword}
                    onChangeText={(value) => { setAdminPassword(value); clearError('password'); }}
                    secureTextEntry={!showPassword}
                  />
                </View>
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} color="#64748B" /> : <Eye size={18} color="#64748B" />}
                </TouchableOpacity>
              </View>
              <PasswordStrength value={adminPassword} />
              {fieldErrors.password ? <Text style={styles.fieldError}>{fieldErrors.password}</Text> : null}

              <View style={[styles.inputBox, fieldErrors.confirmPassword && styles.inputBoxError]}>
                <Lock size={18} color={fieldErrors.confirmPassword ? '#DC2626' : '#64748B'} style={styles.inputIcon} />
                <View style={[styles.inputContent, { paddingRight: 40 }]}>
                  <Text style={styles.fieldLabel}>Confirmar senha</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Repita sua senha"
                    placeholderTextColor="#94A3B8"
                    value={adminConfirmPassword}
                    onChangeText={(value) => { setAdminConfirmPassword(value); clearError('confirmPassword'); }}
                    secureTextEntry={!showConfirmPassword}
                  />
                </View>
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff size={18} color="#64748B" /> : <Eye size={18} color="#64748B" />}
                </TouchableOpacity>
              </View>
              {fieldErrors.confirmPassword ? <Text style={styles.fieldError}>{fieldErrors.confirmPassword}</Text> : null}

            </View>
          )}

          {/* PASSO 2: DADOS DA EMPRESA */}
          {step === 2 && (
            <View style={styles.formContainer}>
              {/* Nome do Condomínio / Empresa */}
              <View style={[styles.inputBox, fieldErrors.orgName && styles.inputBoxError]}>
                <Building size={18} color={fieldErrors.orgName ? '#DC2626' : '#64748B'} style={styles.inputIcon} />
                <View style={styles.inputContent}>
                  <Text style={styles.fieldLabel}>Nome do condomínio ou empresa</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ex: Residencial Parque das Flores"
                    placeholderTextColor="#94A3B8"
                    value={orgName}
                    onChangeText={(value) => { setOrgName(value); clearError('orgName'); }}
                    autoCapitalize="words"
                  />
                </View>
              </View>
              {fieldErrors.orgName ? <Text style={styles.fieldError}>{fieldErrors.orgName}</Text> : null}

              <View style={styles.choiceRow}>
                <TouchableOpacity
                  style={[styles.choice, documentType === 'CPF' && styles.choiceActive]}
                  onPress={() => { setDocumentType('CPF'); setOrgDocument(''); clearError('document'); }}
                >
                  <Text style={[styles.choiceText, documentType === 'CPF' && styles.choiceTextActive]}>Pessoa física</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.choice, documentType === 'CNPJ' && styles.choiceActive]}
                  onPress={() => { setDocumentType('CNPJ'); setOrgDocument(''); clearError('document'); }}
                >
                  <Text style={[styles.choiceText, documentType === 'CNPJ' && styles.choiceTextActive]}>Pessoa jurídica</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.inputBox, fieldErrors.document && styles.inputBoxError]}>
                <FileText size={18} color={fieldErrors.document ? '#DC2626' : '#64748B'} style={styles.inputIcon} />
                <View style={styles.inputContent}>
                  <Text style={styles.fieldLabel}>{documentType === 'CPF' ? 'CPF' : 'CNPJ'}</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder={documentType === 'CPF' ? '000.000.000-00' : '00.000.000/0001-00'}
                    placeholderTextColor="#94A3B8"
                    value={orgDocument}
                    onChangeText={(value) => {
                      setOrgDocument(documentType === 'CPF' ? maskCpf(value) : maskCnpj(value));
                      clearError('document');
                    }}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              {fieldErrors.document ? <Text style={styles.fieldError}>{fieldErrors.document}</Text> : null}

              {/* Card de Benefício dos 7 dias */}
              <View style={styles.securityAlertCard}>
                <Sparkles size={20} color="#165337" style={{ marginRight: 10 }} />
                <Text style={styles.securityAlertText}>
                  Aproveite 7 dias de teste grátis com todas as funcionalidades liberadas, sem necessidade de cartão de crédito.
                </Text>
              </View>

            </View>
          )}

          {/* PASSO 3: CONFIRMAÇÃO */}
          {step === 3 && (
            <View style={styles.formContainer}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Resumo do Cadastro</Text>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Administrador:</Text>
                  <Text style={styles.summaryValue}>{adminName}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>E-mail:</Text>
                  <Text style={styles.summaryValue}>{adminEmail}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Telefone:</Text>
                  <Text style={styles.summaryValue}>{adminPhone || 'Não informado'}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Empresa:</Text>
                  <Text style={styles.summaryValue}>{orgName}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{documentType === 'CPF' ? 'CPF:' : 'CNPJ:'}</Text>
                  <Text style={styles.summaryValue}>{orgDocument}</Text>
                </View>

                <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.summaryLabel}>Período de Teste:</Text>
                  <Text style={[styles.summaryValue, { color: '#165337', fontWeight: '700' }]}>
                    7 dias grátis
                  </Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
            onPress={step === 1 ? handleNextFromStep1 : step === 2 ? handleNextFromStep2 : handleFinalRegister}
            disabled={isLoading}
            activeOpacity={0.88}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>
                  {step === 3 ? 'Finalizar e criar conta' : 'Continuar'}
                </Text>
                {step === 3 ? (
                  <CheckCircle2 size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                ) : (
                  <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                )}
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footerLinkRow}>
            <Text style={styles.footerText}>Já tem uma conta? </Text>
            <TouchableOpacity onPress={onLoginPress} disabled={isLoading}>
              <Text style={styles.loginLinkHighlight}>Fazer login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={phoneModalOpen} transparent animationType="fade" onRequestClose={closePhoneModal} onShow={() => Keyboard.dismiss()}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirmar WhatsApp</Text>
            <Text style={styles.modalText}>
              {`Enviaremos um código para ${adminPhone}. Toque em Verificar para receber e digite os 6 números abaixo.`}
            </Text>
            <TouchableOpacity style={styles.modalPrimary} onPress={sendWhatsappCode} disabled={isCodeBusy}>
              {isCodeBusy && !codeSent ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.modalPrimaryText}>{codeSent ? 'Reenviar código' : 'Verificar'}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={closePhoneModal} style={styles.modalSecondary}>
              <Text style={styles.modalSecondaryText}>Editar número</Text>
            </TouchableOpacity>
            {codeSent ? (
              <>
                <View style={[styles.inputBox, fieldErrors.code && styles.inputBoxError, { marginTop: 14 }]}>
                  <View style={styles.inputContent}>
                    <Text style={styles.fieldLabel}>Código do WhatsApp</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="6 números"
                      placeholderTextColor="#94A3B8"
                      value={whatsappCode}
                      onChangeText={(value) => {
                        setWhatsappCode(value.replace(/\D/g, '').slice(0, 6));
                        clearError('code');
                      }}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
                {fieldErrors.code ? <Text style={styles.fieldError}>{fieldErrors.code}</Text> : null}
                <TouchableOpacity
                  style={[styles.modalPrimary, { marginTop: 8 }]}
                  onPress={confirmWhatsappCode}
                  disabled={isCodeBusy}
                >
                  <Text style={styles.modalPrimaryText}>Confirmar código</Text>
                </TouchableOpacity>
              </>
            ) : null}
            {fieldErrors.email ? <Text style={styles.fieldError}>{fieldErrors.email}</Text> : null}
            {fieldErrors.phone ? <Text style={styles.fieldError}>{fieldErrors.phone}</Text> : null}
            <TouchableOpacity onPress={closePhoneModal} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7F5',
  },
  topRightWave: {
    position: 'absolute',
    top: 0,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(180, 222, 196, 0.25)',
  },
  header: {
    paddingHorizontal: 24,
  },
  formScroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 12,
  },
  topBar: {
    marginTop: 4,
    marginBottom: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  titleRow: {
    alignItems: 'center',
    marginBottom: 14,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#165337',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    includeFontPadding: false,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
    includeFontPadding: false,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stepItem: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepCircleActive: {
    backgroundColor: '#165337',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  stepNumberActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  stepLabelActive: {
    color: '#165337',
    fontWeight: '700',
  },
  stepLine: {
    width: 44,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
    marginBottom: 18,
  },
  stepLineActive: {
    backgroundColor: '#165337',
  },
  formContainer: {
    width: '100%',
  },
  inputBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  inputBoxError: {
    borderColor: '#DC2626',
    marginBottom: 4,
  },
  fieldError: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    marginLeft: 4,
  },
  verifyLink: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    marginLeft: 4,
    paddingVertical: 4,
  },
  verifyLinkText: {
    color: '#165337',
    fontWeight: '700',
    fontSize: 13,
  },
  verifiedText: {
    color: '#165337',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 12,
    marginLeft: 4,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  choice: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  choiceActive: {
    borderColor: '#165337',
    backgroundColor: '#EDF7ED',
  },
  choiceText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 13,
  },
  choiceTextActive: {
    color: '#165337',
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    marginBottom: 16,
  },
  modalPrimary: {
    backgroundColor: '#165337',
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  modalSecondary: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 15,
  },
  modalClose: {
    alignItems: 'center',
    paddingTop: 14,
  },
  modalCloseText: {
    color: '#64748B',
    fontWeight: '700',
  },
  inputIcon: {
    marginRight: 12,
  },
  inputContent: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  textInput: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
    padding: 0,
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    padding: 6,
  },
  securityAlertCard: {
    backgroundColor: '#EDF7ED',
    borderWidth: 1,
    borderColor: '#C8E6C9',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  securityAlertText: {
    flex: 1,
    fontSize: 12,
    color: '#165337',
    fontWeight: '500',
    lineHeight: 18,
  },
  primaryBtn: {
    backgroundColor: '#165337',
    borderRadius: 14,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#165337',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  footerLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 22,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    maxWidth: '60%',
    textAlign: 'right',
  },
  footerText: {
    fontSize: 14,
    color: '#64748B',
  },
  loginLinkHighlight: {
    fontSize: 14,
    fontWeight: '700',
    color: '#165337',
  },
});
