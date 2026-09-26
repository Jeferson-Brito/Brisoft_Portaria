import React, { useState, useRef } from 'react';
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
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, RegisterData } from '../../contexts/AuthContext';

interface RegisterScreenProps {
  onLoginPress: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ onLoginPress }) => {
  const { register } = useAuth();
  const [step, setStep] = useState(1); // 1 = Empresa | 2 = Responsável
  const [isLoading, setIsLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Campos empresa
  const [orgName, setOrgName] = useState('');
  const [orgDocument, setOrgDocument] = useState('');

  // Campos admin
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const goToStep2 = () => {
    if (!orgName.trim()) {
      Alert.alert('Atenção', 'Informe o nome do estabelecimento.');
      return;
    }
    Animated.timing(slideAnim, {
      toValue: -400,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setStep(2));
  };

  const goToStep1 = () => {
    setStep(1);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const handleRegister = async () => {
    if (!adminName.trim()) {
      Alert.alert('Atenção', 'Informe seu nome completo.');
      return;
    }
    if (!adminEmail.trim()) {
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
      // Após registro bem-sucedido o AuthContext muda o user e o App navega automaticamente
    } catch (err: any) {
      Alert.alert('Erro ao criar conta', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepLabel}>PASSO 1 DE 2</Text>
        <Text style={styles.stepTitle}>Sobre seu estabelecimento</Text>
        <Text style={styles.stepDesc}>
          Residencial, condomínio, clínica ou empresa — o sistema se adapta ao seu negócio.
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nome do Estabelecimento *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: Residencial Parque das Flores"
          placeholderTextColor="#64748B"
          value={orgName}
          onChangeText={setOrgName}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>CNPJ (opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder="00.000.000/0001-00"
          placeholderTextColor="#64748B"
          value={orgDocument}
          onChangeText={setOrgDocument}
          keyboardType="numeric"
        />
      </View>

      {/* Banner de trial */}
      <View style={styles.trialBanner}>
        <Text style={styles.trialIcon}>🎉</Text>
        <View>
          <Text style={styles.trialTitle}>7 dias grátis, sem cartão</Text>
          <Text style={styles.trialDesc}>Após o período, apenas R$149/mês com acesso completo.</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={goToStep2}>
        <Text style={styles.primaryButtonText}>Continuar →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity onPress={goToStep1} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Voltar</Text>
      </TouchableOpacity>

      <View style={styles.stepHeader}>
        <Text style={styles.stepLabel}>PASSO 2 DE 2</Text>
        <Text style={styles.stepTitle}>Sua conta de acesso</Text>
        <Text style={styles.stepDesc}>
          Você será o administrador responsável pela assinatura.
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Seu Nome Completo *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: João Silva"
          placeholderTextColor="#64748B"
          value={adminName}
          onChangeText={setAdminName}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>E-mail *</Text>
        <TextInput
          style={styles.input}
          placeholder="seu@email.com"
          placeholderTextColor="#64748B"
          value={adminEmail}
          onChangeText={setAdminEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>WhatsApp / Telefone</Text>
        <TextInput
          style={styles.input}
          placeholder="(11) 99999-9999"
          placeholderTextColor="#64748B"
          value={adminPhone}
          onChangeText={setAdminPhone}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Senha *</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Mín. 8 caracteres"
            placeholderTextColor="#64748B"
            value={adminPassword}
            onChangeText={setAdminPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Confirmar Senha *</Text>
        <TextInput
          style={styles.input}
          placeholder="Repita a senha"
          placeholderTextColor="#64748B"
          value={adminConfirmPassword}
          onChangeText={setAdminConfirmPassword}
          secureTextEntry={!showPassword}
        />
      </View>

      <Text style={styles.termsText}>
        Ao criar sua conta, você concorda com os{' '}
        <Text style={styles.termsLink}>Termos de Uso</Text> e{' '}
        <Text style={styles.termsLink}>Política de Privacidade</Text>.
      </Text>

      <TouchableOpacity
        style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.primaryButtonText}>Criar Conta Grátis 🚀</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.brand}>Combate Portaria</Text>
            <Text style={styles.tagline}>Controle de Acesso Profissional</Text>
          </View>

          {/* Indicador de progresso */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressDot, step >= 1 && styles.progressDotActive]} />
            <View style={[styles.progressLine, step >= 2 && styles.progressLineActive]} />
            <View style={[styles.progressDot, step >= 2 && styles.progressDotActive]} />
          </View>

          {/* Conteúdo do step */}
          {step === 1 ? renderStep1() : renderStep2()}

          {/* Link para login */}
          <TouchableOpacity onPress={onLoginPress} style={styles.loginLink}>
            <Text style={styles.loginLinkText}>
              Já tem uma conta? <Text style={styles.loginLinkBold}>Fazer login</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1A30',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tagline: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    gap: 8,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1E3A5F',
    borderWidth: 2,
    borderColor: '#334155',
  },
  progressDotActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  progressLine: {
    flex: 1,
    maxWidth: 80,
    height: 2,
    backgroundColor: '#1E3A5F',
  },
  progressLineActive: {
    backgroundColor: '#3B82F6',
  },
  stepContainer: {
    flex: 1,
  },
  stepHeader: {
    marginBottom: 28,
  },
  stepLabel: {
    color: '#3B82F6',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  stepTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  stepDesc: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
  },
  backButton: {
    marginBottom: 20,
  },
  backButtonText: {
    color: '#3B82F6',
    fontSize: 15,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyeButton: {
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  eyeText: {
    fontSize: 18,
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: 14,
    padding: 16,
    marginVertical: 20,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
    gap: 12,
  },
  trialIcon: {
    fontSize: 28,
  },
  trialTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  trialDesc: {
    color: '#94A3B8',
    fontSize: 12,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  termsText: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 16,
  },
  termsLink: {
    color: '#3B82F6',
    textDecorationLine: 'underline',
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 32,
  },
  loginLinkText: {
    color: '#64748B',
    fontSize: 14,
  },
  loginLinkBold: {
    color: '#3B82F6',
    fontWeight: '700',
  },
});
