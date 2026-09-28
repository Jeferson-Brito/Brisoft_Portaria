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
import { colors } from '../../theme/colors';

interface RegisterScreenProps {
  onLoginPress: () => void;
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
    setStep(2);
  };

  const handleNextFromStep2 = () => {
    if (!orgName.trim()) {
      Alert.alert('Atenção', 'Informe o nome do condomínio ou empresa.');
      return;
    }
    setStep(3);
  };

  const handleFinalRegister = async () => {
    setIsLoading(true);
    try {
      const data: RegisterData = {
        organizationName: orgName.trim(),
        organizationDocument: orgDocument.trim() || undefined,
        adminName: adminName.trim(),
        adminEmail: adminEmail.trim(),
        adminPassword,
        adminPhone: adminPhone.trim() || undefined,
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Superior: Botão Voltar */}
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

          {/* Logo / Badge Central Oficial */}
          <View style={styles.logoBadgeContainer}>
            <View style={styles.logoBadge}>
              <ShieldCheck size={38} color="#FFFFFF" strokeWidth={2.2} />
            </View>
          </View>

          {/* Títulos */}
          <Text style={styles.title}>Criar sua conta</Text>
          <Text style={styles.subtitle}>
            Preencha os dados abaixo para começar a usar o sistema.
          </Text>

          {/* Stepper com 3 Passos */}
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
                  <Text style={styles.fieldLabel}>Telefone / WhatsApp</Text>
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

              {/* Card de Aviso / Segurança */}
              <View style={styles.securityAlertCard}>
                <ShieldCheck size={20} color="#165337" style={{ marginRight: 10 }} />
                <Text style={styles.securityAlertText}>
                  Sua conta será aprovada pela administração do condomínio.
                </Text>
              </View>

              {/* Botão Continuar */}
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleNextFromStep1}
                activeOpacity={0.88}
              >
                <Text style={styles.primaryBtnText}>Continuar</Text>
                <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
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
                  <Text style={styles.fieldLabel}>CNPJ (opcional)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="00.000.000/0001-00"
                    placeholderTextColor="#94A3B8"
                    value={orgDocument}
                    onChangeText={setOrgDocument}
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

              {/* Botão Continuar */}
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleNextFromStep2}
                activeOpacity={0.88}
              >
                <Text style={styles.primaryBtnText}>Continuar</Text>
                <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBackBtn}
                onPress={() => setStep(1)}
              >
                <Text style={styles.secondaryBackBtnText}>← Voltar aos dados pessoais</Text>
              </TouchableOpacity>
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

              {/* Botão Finalizar */}
              <TouchableOpacity
                style={[styles.primaryBtn, isLoading && { opacity: 0.7 }]}
                onPress={handleFinalRegister}
                disabled={isLoading}
                activeOpacity={0.88}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>Finalizar e Criar Conta</Text>
                    <CheckCircle2 size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBackBtn}
                onPress={() => setStep(2)}
                disabled={isLoading}
              >
                <Text style={styles.secondaryBackBtnText}>← Voltar</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Link para Fazer Login */}
          <View style={styles.footerLinkRow}>
            <Text style={styles.footerText}>Já tem uma conta? </Text>
            <TouchableOpacity onPress={onLoginPress}>
              <Text style={styles.loginLinkHighlight}>Fazer login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  topBar: {
    marginTop: 8,
    marginBottom: 8,
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
  logoBadgeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#165337',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#165337',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 26,
    lineHeight: 20,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
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
  secondaryBackBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  secondaryBackBtnText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
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
  footerLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
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
