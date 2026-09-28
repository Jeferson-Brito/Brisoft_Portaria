import React, { useState } from 'react';
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
  ImageBackground,
  Dimensions,
  Image,
} from 'react-native';
import {
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Settings,
  ArrowRight,
  Shield,
  Check,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { useAuth } from '../../contexts/AuthContext';

const { height } = Dimensions.get('window');

export const LoginScreen: React.FC<{ onRegisterPress?: () => void }> = ({ onRegisterPress }) => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Por favor, preencha o e-mail e a senha.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      await signIn(email.trim(), password);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao efetuar login.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillQuickCredentials = (userEmail: string, pass: string) => {
    setEmail(userEmail);
    setPassword(pass);
    setErrorMessage(null);
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
        {/* Metade Superior: Imagem Arquitetônica com Overlay Escuro */}
        <ImageBackground
          source={require('../../../assets/condo_gatehouse.jpg')}
          style={styles.heroBackground}
          resizeMode="cover"
        >
          <View style={styles.heroOverlay}>
            {/* Logo Oficial Combate Portaria */}
            <Image
              source={require('../../../assets/logo.png')}
              style={{ width: 240, height: 115, marginBottom: 6 }}
              resizeMode="contain"
            />
            <Text style={styles.brandSubtitle}>Controle de Acesso Inteligente</Text>
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
          <View style={styles.inputGroup}>
            <View style={styles.fieldLabelRow}>
              <Mail size={16} color={colors.textPrimary} style={{ marginRight: 6 }} />
              <Text style={styles.fieldLabel}>E-mail ou Usuário</Text>
            </View>
            <View style={styles.inputBox}>
              <Mail size={18} color={colors.textMuted} style={styles.inputPrefixIcon} />
              <TextInput
                style={styles.input}
                placeholder="ex: porteiro@exemple.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>
          </View>

          {/* Campo Senha */}
          <View style={styles.inputGroup}>
            <View style={styles.fieldLabelRow}>
              <Lock size={16} color={colors.textPrimary} style={{ marginRight: 6 }} />
              <Text style={styles.fieldLabel}>Senha de Acesso</Text>
            </View>
            <View style={styles.inputBox}>
              <Lock size={18} color={colors.textMuted} style={styles.inputPrefixIcon} />
              <TextInput
                style={styles.input}
                placeholder="Digite sua senha"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                activeOpacity={0.7}
              >
                {showPassword ? (
                  <EyeOff size={20} color={colors.textSecondary} />
                ) : (
                  <Eye size={20} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Botão Entrar no Sistema */}
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.88}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <View style={styles.loginBtnContent}>
                <Text style={styles.loginBtnText}>Entrar no Sistema</Text>
                <ArrowRight size={18} color={colors.white} style={{ marginLeft: 8 }} />
              </View>
            )}
          </TouchableOpacity>

          {/* Link para cadastro */}
          {onRegisterPress && (
            <TouchableOpacity onPress={onRegisterPress} style={{ alignItems: 'center', marginTop: 16 }}>
              <Text style={{ color: '#64748B', fontSize: 14 }}>
                Ainda não tem conta?{' '}
                <Text style={{ color: '#3B82F6', fontWeight: '700' }}>Criar conta grátis</Text>
              </Text>
            </TouchableOpacity>
          )}

          {/* Rodapé institucional */}
          <Text style={styles.footerText}>
            Grupo Combate Segurança e Tecnologia © 2026
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F203D',
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#0F203D',
  },
  heroBackground: {
    width: '100%',
    height: height * 0.44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(8, 20, 45, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 30,
  },
  logoBadgeWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  shieldIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 32, 61, 0.65)',
  },
  innerShieldGraphic: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
  },
  innerBar: {
    width: 3,
    height: 14,
    backgroundColor: colors.white,
    borderRadius: 2,
  },
  verifiedCheckBadge: {
    position: 'absolute',
    bottom: -4,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0F203D',
  },
  brandTitleCombate: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 2,
    textAlign: 'center',
  },
  brandTitlePortaria: {
    fontSize: 19,
    fontWeight: '700',
    color: '#CBD5E1',
    letterSpacing: 4,
    marginTop: -2,
    textAlign: 'center',
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  sheetCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -24,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.statusDenied,
    marginBottom: 16,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 16,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  inputPrefixIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  eyeButton: {
    padding: 6,
  },
  loginBtn: {
    backgroundColor: '#0F203D',
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#0F203D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  loginBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.3,
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
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    paddingHorizontal: 8,
    letterSpacing: 0.8,
  },
  quickButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: '#FFFFFF',
  },
  quickBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 'auto',
    paddingTop: 8,
  },
});
