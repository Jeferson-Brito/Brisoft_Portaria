import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, Lock, Phone, ShieldCheck } from 'lucide-react-native';
import { api } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { PasswordStrength } from '../../components/PasswordField';

const { height } = Dimensions.get('window');

function maskPhone(raw: string) {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export const CompleteProfileScreen: React.FC = () => {
  const { user, patchUser, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneFromCadastro, setPhoneFromCadastro] = useState(false);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const phoneDigits = phone.replace(/\D/g, '');
  const canSave = password.length > 0 && confirmPassword.length > 0 && phoneVerified;

  useEffect(() => {
    const fill = (raw?: string | null) => {
      if (!raw) return false;
      setPhone(maskPhone(raw));
      setPhoneFromCadastro(true);
      return true;
    };

    if (fill(user?.whatsappNumber || user?.phone)) return;

    let active = true;
    api
      .get('/auth/me')
      .then((response) => {
        const profile = response.data?.data?.user;
        if (!active) return;
        fill(profile?.whatsappNumber || profile?.phone);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user?.whatsappNumber, user?.phone]);

  const changePhone = (value: string) => {
    setPhone(maskPhone(value));
    setPhoneFromCadastro(false);
    setPhoneVerified(false);
    setCodeSent(false);
    setCode('');
    setErrors((current) => ({ ...current, phone: '' }));
  };

  const sendCode = async () => {
    if (phoneDigits.length !== 11 || phoneDigits[2] !== '9') {
      setErrors((current) => ({ ...current, phone: 'Informe o DDD e o número de celular com o 9.' }));
      return;
    }
    try {
      setIsLoading(true);
      await api.post('/auth/whatsapp-code', { phone });
      setCodeSent(true);
      setCode('');
      setPhoneVerified(false);
      setErrors((current) => ({ ...current, phone: '' }));
      Alert.alert(
        'Código enviado',
        `Enviamos um código pelo WhatsApp para ${phone}. Digite os 6 números no campo abaixo.`
      );
    } catch (err: any) {
      setErrors((current) => ({
        ...current,
        phone: err.response?.data?.error?.message || 'Não foi possível enviar o código.',
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const confirmCode = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setErrors((current) => ({ ...current, code: 'Informe o código de 6 números.' }));
      return;
    }
    try {
      setIsLoading(true);
      await api.post('/auth/whatsapp-code/confirm', { phone, code: code.trim() });
      setPhoneVerified(true);
      setErrors((current) => ({ ...current, code: '', phone: '' }));
    } catch (err: any) {
      setPhoneVerified(false);
      setErrors((current) => ({
        ...current,
        code: err.response?.data?.error?.message || 'Código incorreto.',
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const finish = async () => {
    const next: Record<string, string> = {};
    if (password.length < 8) next.password = 'A nova senha deve ter no mínimo 8 caracteres.';
    if (password !== confirmPassword) next.confirmPassword = 'As senhas não coincidem.';
    if (phoneDigits.length !== 11 || phoneDigits[2] !== '9') next.phone = 'Informe o DDD e o número de celular com o 9.';
    if (!phoneVerified) next.phone = next.phone || 'Confirme o WhatsApp antes de salvar.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      setIsLoading(true);
      await api.post('/auth/complete-profile', {
        newPassword: password,
        phone,
        code: code.trim(),
      });
      await patchUser({ mustCompleteProfile: false, whatsappVerified: true });
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'Verifique os dados e tente novamente.';
      if (/whatsapp|número|numero|código|codigo/i.test(message)) {
        setPhoneVerified(false);
        setErrors({ phone: /código|codigo/i.test(message) ? '' : message, code: /código|codigo/i.test(message) ? message : '' });
      } else {
        Alert.alert('Não foi possível concluir', message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <ImageBackground source={require('../../../assets/condo_gatehouse.jpg')} style={styles.heroBackground}>
            <View style={styles.heroOverlay}>
              <View style={styles.logoBadge}>
                <Image source={require('../../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
              </View>
              <Text style={styles.brandTitle}>Complete seu acesso</Text>
              <Text style={styles.brandSubtitle}>
                Isso acontece só no primeiro acesso. Troque a senha e confirme o WhatsApp.
              </Text>
            </View>
          </ImageBackground>

          <View style={styles.sheetCard}>
            <View style={[styles.inputBox, errors.password ? styles.inputBoxError : null]}>
              <Lock size={18} color={errors.password ? '#DC2626' : '#64748B'} style={styles.inputIcon} />
              <View style={styles.inputContent}>
                <Text style={styles.fieldLabel}>Nova senha</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Mínimo de 8 caracteres"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setErrors((current) => ({ ...current, password: '' }));
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
              <TouchableOpacity onPress={() => setShowPassword((current) => !current)} style={styles.eyeBtn} hitSlop={8}>
                {showPassword ? <EyeOff size={18} color="#64748B" /> : <Eye size={18} color="#64748B" />}
              </TouchableOpacity>
            </View>
            <PasswordStrength value={password} />
            {errors.password ? <Text style={styles.error}>{errors.password}</Text> : null}

            <View style={[styles.inputBox, errors.confirmPassword ? styles.inputBoxError : null]}>
              <Lock size={18} color={errors.confirmPassword ? '#DC2626' : '#64748B'} style={styles.inputIcon} />
              <View style={styles.inputContent}>
                <Text style={styles.fieldLabel}>Confirmar senha</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Repita a nova senha"
                  placeholderTextColor="#94A3B8"
                  value={confirmPassword}
                  onChangeText={(value) => {
                    setConfirmPassword(value);
                    setErrors((current) => ({ ...current, confirmPassword: '' }));
                  }}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
              <TouchableOpacity onPress={() => setShowConfirm((current) => !current)} style={styles.eyeBtn} hitSlop={8}>
                {showConfirm ? <EyeOff size={18} color="#64748B" /> : <Eye size={18} color="#64748B" />}
              </TouchableOpacity>
            </View>
            {errors.confirmPassword ? <Text style={styles.error}>{errors.confirmPassword}</Text> : null}

            <View style={[styles.inputBox, errors.phone ? styles.inputBoxError : null]}>
              <Phone size={18} color={errors.phone ? '#DC2626' : '#64748B'} style={styles.inputIcon} />
              <View style={styles.inputContent}>
                <Text style={styles.fieldLabel}>WhatsApp</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="(83) 90000-0000"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={changePhone}
                  editable={!isLoading}
                />
              </View>
            </View>
            {phoneFromCadastro ? (
              <Text style={styles.hint}>Número informado no cadastro. Confirme com o código ou altere se estiver incorreto.</Text>
            ) : null}
            {errors.phone ? <Text style={styles.error}>{errors.phone}</Text> : null}
            {phoneVerified ? (
              <View style={styles.okRow}>
                <ShieldCheck size={16} color="#165337" />
                <Text style={styles.ok}>WhatsApp confirmado</Text>
              </View>
            ) : phoneDigits.length === 11 ? (
              <TouchableOpacity style={styles.secondary} onPress={sendCode} disabled={isLoading}>
                <Text style={styles.secondaryText}>{codeSent ? 'Reenviar código' : 'Verificar número'}</Text>
              </TouchableOpacity>
            ) : null}

            {codeSent && !phoneVerified ? (
              <>
                <View style={[styles.inputBox, errors.code ? styles.inputBoxError : null]}>
                  <Text style={styles.fieldLabelInline}>Código</Text>
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    placeholder="6 números"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    value={code}
                    onChangeText={(value) => {
                      setCode(value.replace(/\D/g, '').slice(0, 6));
                      setErrors((current) => ({ ...current, code: '' }));
                    }}
                    editable={!isLoading}
                  />
                </View>
                {errors.code ? <Text style={styles.error}>{errors.code}</Text> : null}
                <TouchableOpacity style={styles.secondary} onPress={confirmCode} disabled={isLoading || code.length !== 6}>
                  <Text style={styles.secondaryText}>Confirmar código</Text>
                </TouchableOpacity>
              </>
            ) : null}

            <TouchableOpacity
              style={[styles.primary, (!canSave || isLoading) && styles.primaryDisabled]}
              onPress={finish}
              disabled={!canSave || isLoading}
              activeOpacity={0.88}
            >
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Salvar</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={signOut} style={styles.leave}>
              <Text style={styles.leaveText}>Sair</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#165337' },
  scrollContent: { flexGrow: 1, backgroundColor: '#165337' },
  heroBackground: {
    width: '100%',
    height: height * 0.32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10, 42, 28, 0.84)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#1E6A47',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  logoImage: { width: 42, height: 42 },
  brandTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  brandSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
    maxWidth: 300,
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 36,
    marginTop: -20,
    flexGrow: 1,
  },
  inputBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 12,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputBoxError: { borderColor: '#DC2626' },
  inputIcon: { marginRight: 12 },
  inputContent: { flex: 1, paddingRight: 36 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: '#64748B', marginBottom: 2 },
  fieldLabelInline: { fontSize: 11, fontWeight: '700', color: '#64748B', marginRight: 10 },
  textInput: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '500',
    padding: 0,
    minHeight: 22,
  },
  eyeBtn: { position: 'absolute', right: 14, padding: 6 },
  error: { color: '#DC2626', fontSize: 12, fontWeight: '600', marginTop: 6 },
  hint: { color: '#64748B', fontSize: 12, lineHeight: 18, marginTop: 8 },
  okRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  ok: { color: '#165337', fontWeight: '700' },
  secondary: { marginTop: 12, alignItems: 'center', padding: 12 },
  secondaryText: { color: '#165337', fontWeight: '700' },
  primary: {
    marginTop: 18,
    backgroundColor: '#165337',
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  primaryDisabled: { backgroundColor: '#94A3B8' },
  leave: { marginTop: 16, alignItems: 'center', marginBottom: 8 },
  leaveText: { color: '#64748B', fontWeight: '600' },
});
