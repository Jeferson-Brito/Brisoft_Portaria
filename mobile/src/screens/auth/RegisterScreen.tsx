import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
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
  const [orgDocument, setOrgDocument] = useState('');
  const [whatsappCode, setWhatsappCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  const handleNextFromStep1 = () => {
    if (!adminName.trim()) {
      Alert.alert('Atenção', 'Informe seu nome completo.');
      return;
    }
    if (!adminEmail.trim() || !adminEmail.includes('@')) {
      Alert.alert('Atenção', 'Informe um e-mail válido.');
      return;
    }
    if (adminPassword.length < 8) {
      Alert.alert('Atenção', 'A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (adminPassword !== adminConfirmPassword) {
      Alert.alert('Atenção', 'As senhas não coincidem.');
      return;
    }
    if (adminPhone.replace(/\D/g, '').length < 10) {
      Alert.alert('Atenção', 'Informe o WhatsApp com DDD. Ele recebe o código de confirmação.');
      return;
    }
    setStep(2);
  };

  const handleNextFromStep2 = () => {
    if (!orgName.trim()) {
      Alert.alert('Atenção', 'Informe o nome do condomínio ou empresa.');
      return;
    }
    if (orgDocument.replace(/\D/g, '').length !== 14) {
      Alert.alert('Atenção', 'Informe o CNPJ da empresa com 14 dígitos.');
      return;
    }
    setStep(3);
  };

  const sendWhatsappCode = async () => {
    try {
      setIsLoading(true);
      await api.post('/auth/register/whatsapp-code', {
        email: adminEmail.trim(),
        phone: adminPhone.trim(),
      });
      setCodeSent(true);
      Alert.alert('Código enviado', 'Olhe o WhatsApp informado e digite o código de 8 caracteres.');
    } catch (err: any) {
      Alert.alert('Não foi possível enviar', err.response?.data?.error?.message || 'O WhatsApp da plataforma precisa estar conectado.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalRegister = async () => {
    if (whatsappCode.trim().length !== 8) {
      Alert.alert('Atenção', 'Digite o código de 8 caracteres recebido no WhatsApp.');
      return;
    }
    setIsLoading(true);
    try {
      const data: RegisterData = {
        organizationName: orgName.trim(),
        organizationDocument: orgDocument.trim(),
        adminName: adminName.trim(),
        adminEmail: adminEmail.trim(),
        adminPassword,
        adminPhone: adminPhone.trim(),
        verificationCode: whatsappCode.trim(),
      };
      await register(data);
    } catch (err: any) {
      Alert.alert('Erro ao criar conta', err.message);
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
              <View style={styles.inputBox}>
                <User size={18} color="#64748B" style={styles.inputIcon} />
                <View style={styles.inputContent}>
                  <Text style={styles.fieldLabel}>Nome completo</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Digite seu nome completo"
                    placeholderTextColor="#94A3B8"
                    value={adminName}
                    onChangeText={setAdminName}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* E-mail */}
              <View style={styles.inputBox}>
                <Mail size={18} color="#64748B" style={styles.inputIcon} />
                <View style={styles.inputContent}>
                  <Text style={styles.fieldLabel}>E-mail</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="ex: usuario@exemplo.com"
                    placeholderTextColor="#94A3B8"
                    value={adminEmail}
                    onChangeText={setAdminEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Telefone / WhatsApp */}
              <View style={styles.inputBox}>
                <Phone size={18} color="#64748B" style={styles.inputIcon} />
                <View style={styles.inputContent}>
                  <Text style={styles.fieldLabel}>WhatsApp</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="(00) 00000-0000"
                    placeholderTextColor="#94A3B8"
                    value={adminPhone}
                    onChangeText={setAdminPhone}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              {/* Senha */}
              <View style={styles.inputBox}>
                <Lock size={18} color="#64748B" style={styles.inputIcon} />
                <View style={[styles.inputContent, { paddingRight: 40 }]}>
                  <Text style={styles.fieldLabel}>Senha</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Digite sua senha (mín. 8 caracteres)"
                    placeholderTextColor="#94A3B8"
                    value={adminPassword}
                    onChangeText={setAdminPassword}
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

              {/* Confirmar Senha */}
              <View style={styles.inputBox}>
                <Lock size={18} color="#64748B" style={styles.inputIcon} />
                <View style={[styles.inputContent, { paddingRight: 40 }]}>
                  <Text style={styles.fieldLabel}>Confirmar senha</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Repita sua senha"
                    placeholderTextColor="#94A3B8"
                    value={adminConfirmPassword}
                    onChangeText={setAdminConfirmPassword}
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

            </View>
          )}

          {/* PASSO 2: DADOS DA EMPRESA */}
          {step === 2 && (
            <View style={styles.formContainer}>
              {/* Nome do Condomínio / Empresa */}
              <View style={styles.inputBox}>
                <Building size={18} color="#64748B" style={styles.inputIcon} />
                <View style={styles.inputContent}>
                  <Text style={styles.fieldLabel}>Nome do Condomínio ou Empresa</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ex: Residencial Parque das Flores"
                    placeholderTextColor="#94A3B8"
                    value={orgName}
                    onChangeText={setOrgName}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* CNPJ ou Documento */}
              <View style={styles.inputBox}>
                <FileText size={18} color="#64748B" style={styles.inputIcon} />
                <View style={styles.inputContent}>
                  <Text style={styles.fieldLabel}>CNPJ</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="00.000.000/0001-00"
                    placeholderTextColor="#94A3B8"
                    value={orgDocument}
                    onChangeText={(value) => setOrgDocument(maskCnpj(value))}
                    keyboardType="numeric"
                  />
                </View>
              </View>

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

                <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.summaryLabel}>Período de Teste:</Text>
                  <Text style={[styles.summaryValue, { color: '#165337', fontWeight: '700' }]}>
                    7 dias grátis
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={styles.primaryBtn} onPress={sendWhatsappCode} disabled={isLoading} activeOpacity={0.88}>
                <Text style={styles.primaryBtnText}>{codeSent ? 'Reenviar código' : 'Enviar código no WhatsApp'}</Text>
              </TouchableOpacity>

              <View style={[styles.inputBox, { marginTop: 12 }]}>
                <FileText size={18} color="#64748B" style={styles.inputIcon} />
                <View style={styles.inputContent}>
                  <Text style={styles.fieldLabel}>Código do WhatsApp</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="8 caracteres"
                    placeholderTextColor="#94A3B8"
                    value={whatsappCode}
                    onChangeText={(value) => setWhatsappCode(value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase())}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryBtn, isLoading && { opacity: 0.7 }]}
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
