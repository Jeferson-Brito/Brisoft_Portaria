import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Image,
  ImageBackground,
  Dimensions,
} from 'react-native';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  ArrowRight,
  Check,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../config/api';

const { height } = Dimensions.get('window');

export const LoginScreen: React.FC<{ onRegisterPress?: () => void }> = ({ onRegisterPress }) => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [resetStep, setResetStep] = useState<'email' | 'code' | 'password'>('email');
  const [resetCode, setResetCode] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('@brisoft_portaria:rememberedEmail').then((saved) => {
      if (saved) setEmail(saved);
    });
    AsyncStorage.getItem('@brisoft_portaria:remember').then((saved) => {
      if (saved === '0') setRememberMe(false);
    });
  }, []);

  const sendResetCode = async () => {
    if (!email.trim()) {
      setErrorMessage('Informe o e-mail da conta.');
      return;
    }
    try {
      setIsLoading(true);
      setErrorMessage(null);
      await api.post('/auth/forgot-password', { email: email.trim() });
      setResetCode('');
      setResetStep('code');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error?.message || 'Não foi possível enviar o código.');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmResetCode = async () => {
    if (resetCode.trim().length !== 8) {
      setErrorMessage('Digite o código de 8 números recebido no WhatsApp.');
      return;
    }
    try {
      setIsLoading(true);
      setErrorMessage(null);
      await api.post('/auth/forgot-password/check', { email: email.trim(), code: resetCode.trim() });
      setResetStep('password');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error?.message || 'Código incorreto.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setErrorMessage('Preencha o e-mail e a nova senha.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage('A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('As senhas não coincidem.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      await api.post('/auth/reset-password', {
        email: email.trim(),
        code: resetCode.trim(),
        newPassword,
      });
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setResetMode(false);
      setErrorMessage(null);
      await signIn(email.trim(), newPassword, rememberMe);
    } catch (err: any) {
      const message =
        err.response?.data?.error?.message ||
        err.message ||
        'Não foi possível redefinir a senha.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Por favor, preencha o e-mail e a senha.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      await signIn(email.trim(), password, rememberMe);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao efetuar login.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Metade Superior: Imagem com Overlay Verde Floresta Profundo */}
        <ImageBackground
          source={require('../../../assets/condo_gatehouse.jpg')}
          style={styles.heroBackground}
          resizeMode="cover"
        >
          <View style={styles.heroOverlay}>
            {/* Badge Central Oficial: Logo Brisoft Portaria */}
            <View style={styles.logoBadge}>
              <Image
                source={require('../../../assets/logo.png')}
                style={{ width: 68, height: 68, borderRadius: 16 }}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandTitle}>Brisoft Portaria</Text>
            <Text style={styles.brandSubtitle}>
              {resetMode
                ? 'Informe o e-mail da conta e escolha uma nova senha.'
                : 'Faça login para acessar o sistema de controle de acesso.'}
            </Text>
          </View>
        </ImageBackground>

        {/* Metade Inferior: Card Branco Arredondado */}
        <View style={styles.sheetCard}>
          {errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Campo E-mail */}
          <View style={styles.inputBox}>
            <Mail size={18} color="#64748B" style={styles.inputIcon} />
            <View style={styles.inputContent}>
              <Text style={styles.fieldLabel}>E-mail ou Usuário</Text>
              <TextInput
                style={styles.textInput}
                placeholder="ex: portaria@exemplo.com"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>
          </View>

          {!resetMode ? (
          <View style={styles.inputBox}>
            <Lock size={18} color="#64748B" style={styles.inputIcon} />
            <View style={[styles.inputContent, { paddingRight: 40 }]}>
              <Text style={styles.fieldLabel}>Senha</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Digite sua senha"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
            </View>
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeBtn}
              activeOpacity={0.7}
            >
              {showPassword ? (
                <EyeOff size={18} color="#64748B" />
              ) : (
                <Eye size={18} color="#64748B" />
              )}
            </TouchableOpacity>
          </View>
          ) : resetStep === 'code' ? (
          <View style={styles.inputBox}>
            <Lock size={18} color="#64748B" style={styles.inputIcon} />
            <View style={styles.inputContent}>
              <Text style={styles.fieldLabel}>Código do WhatsApp</Text>
              <TextInput
                style={styles.textInput}
                placeholder="8 números"
                placeholderTextColor="#94A3B8"
                value={resetCode}
                onChangeText={(value) => setResetCode(value.replace(/\D/g, '').slice(0, 8))}
                keyboardType="number-pad"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>
          </View>
          ) : resetStep === 'password' ? (
          <>
          <View style={styles.inputBox}>
            <Lock size={18} color="#64748B" style={styles.inputIcon} />
            <View style={[styles.inputContent, { paddingRight: 40 }]}>
              <Text style={styles.fieldLabel}>Nova senha</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Mínimo de 8 caracteres"
                placeholderTextColor="#94A3B8"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                editable={!isLoading}
              />
            </View>
            <TouchableOpacity
              onPress={() => setShowNewPassword(!showNewPassword)}
              style={styles.eyeBtn}
              activeOpacity={0.7}
            >
              {showNewPassword ? (
                <EyeOff size={18} color="#64748B" />
              ) : (
                <Eye size={18} color="#64748B" />
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.inputBox}>
            <Lock size={18} color="#64748B" style={styles.inputIcon} />
            <View style={styles.inputContent}>
              <Text style={styles.fieldLabel}>Confirmar nova senha</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Repita a nova senha"
                placeholderTextColor="#94A3B8"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showNewPassword}
                editable={!isLoading}
              />
            </View>
          </View>
          </>
          ) : null}

          <View style={styles.optionsRow}>
            {!resetMode ? (
            <TouchableOpacity
              style={styles.rememberMeRow}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                {rememberMe && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
              </View>
              <Text style={styles.rememberMeText}>Lembrar de mim</Text>
            </TouchableOpacity>
            ) : <View />}

            <TouchableOpacity
              activeOpacity={0.7}
            onPress={() => {
              setErrorMessage(null);
              if (!resetMode) {
                setResetStep('email');
                setResetMode(true);
                return;
              }
              if (resetStep === 'password') setResetStep('code');
              else if (resetStep === 'code') setResetStep('email');
              else setResetMode(false);
            }}
          >
              <Text style={styles.forgotPasswordText}>
                {resetMode ? 'Voltar ao login' : 'Esqueceu a senha?'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.loginBtn}
            onPress={resetMode ? (resetStep === 'email' ? sendResetCode : resetStep === 'code' ? confirmResetCode : handleResetPassword) : handleLogin}
            disabled={isLoading}
            activeOpacity={0.88}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.loginBtnContent}>
                <Text style={styles.loginBtnText}>
                  {resetMode ? (resetStep === 'email' ? 'Enviar código' : resetStep === 'code' ? 'Confirmar código' : 'Salvar nova senha') : 'Entrar no Sistema'}
                </Text>
                <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </View>
            )}
          </TouchableOpacity>

          {/* Divisor "ou" */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Botão Criar Conta Grátis */}
          {onRegisterPress && (
            <TouchableOpacity
              style={styles.registerBtn}
              onPress={onRegisterPress}
              activeOpacity={0.88}
            >
              <User size={18} color="#165337" style={{ marginRight: 8 }} />
              <Text style={styles.registerBtnText}>Criar conta grátis</Text>
            </TouchableOpacity>
          )}

          {/* Rodapé institucional */}
          <Text style={styles.footerText}>
            Brisoft Portaria • Segurança e Tecnologia © 2026
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#165337',
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#165337',
  },
  heroBackground: {
    width: '100%',
    height: height * 0.40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10, 42, 28, 0.84)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 28,
  },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: '#1E6A47',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
    textAlign: 'center',
  },
  brandSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 28,
    marginTop: -20,
    flexGrow: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  inputBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 14,
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
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 22,
  },
  rememberMeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxActive: {
    backgroundColor: '#165337',
    borderColor: '#165337',
  },
  rememberMeText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  forgotPasswordText: {
    fontSize: 13,
    color: '#165337',
    fontWeight: '600',
  },
  loginBtn: {
    backgroundColor: '#165337',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#165337',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  loginBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  registerBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#165337',
    borderRadius: 14,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  registerBtnText: {
    color: '#165337',
    fontSize: 15,
    fontWeight: '700',
  },
  footerText: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 'auto',
    paddingTop: 16,
  },
});
