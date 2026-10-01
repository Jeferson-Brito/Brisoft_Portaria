import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock, Phone } from 'lucide-react-native';
import { api } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';

export const CompleteProfileScreen: React.FC = () => {
  const { patchUser, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const phoneDigits = phone.replace(/\D/g, '');
  const canSave = password.length > 0 && confirmPassword.length > 0 && phoneVerified;

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
        `Enviamos um código pelo WhatsApp para ${phone}. Digite os 8 números no campo abaixo.`
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
    if (!/^\d{8}$/.test(code.trim())) {
      setErrors((current) => ({ ...current, code: 'Informe o código de 8 números.' }));
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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Complete seu acesso</Text>
          <Text style={styles.subtitle}>
            Isso acontece só no primeiro acesso. Troque a senha e confirme o WhatsApp para recuperar a conta depois.
          </Text>

          <Text style={styles.label}>Nova senha</Text>
          <View style={[styles.box, errors.password ? styles.boxError : null]}>
            <Lock size={18} color={errors.password ? '#DC2626' : '#64748B'} />
            <TextInput
              style={styles.input}
              placeholder="Mínimo de 8 caracteres"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setErrors((current) => ({ ...current, password: '' }));
              }}
            />
          </View>
          {errors.password ? <Text style={styles.error}>{errors.password}</Text> : null}

          <Text style={styles.label}>Confirmar senha</Text>
          <View style={[styles.box, errors.confirmPassword ? styles.boxError : null]}>
            <Lock size={18} color={errors.confirmPassword ? '#DC2626' : '#64748B'} />
            <TextInput
              style={styles.input}
              placeholder="Repita a nova senha"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value);
                setErrors((current) => ({ ...current, confirmPassword: '' }));
              }}
            />
          </View>
          {errors.confirmPassword ? <Text style={styles.error}>{errors.confirmPassword}</Text> : null}

          <Text style={styles.label}>WhatsApp</Text>
          <View style={[styles.box, errors.phone ? styles.boxError : null]}>
            <Phone size={18} color={errors.phone ? '#DC2626' : '#64748B'} />
            <TextInput
              style={styles.input}
              placeholder="(83) 90000-0000"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(value) => {
                const digits = value.replace(/\D/g, '').slice(0, 11);
                const masked = digits.length <= 2
                  ? digits
                  : digits.length <= 7
                    ? `(${digits.slice(0, 2)}) ${digits.slice(2)}`
                    : `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
                setPhone(masked);
                setPhoneVerified(false);
                setCodeSent(false);
                setCode('');
                setErrors((current) => ({ ...current, phone: '' }));
              }}
            />
          </View>
          {errors.phone ? <Text style={styles.error}>{errors.phone}</Text> : null}
          {phoneVerified ? (
            <Text style={styles.ok}>WhatsApp confirmado</Text>
          ) : phoneDigits.length === 11 ? (
            <TouchableOpacity style={styles.secondary} onPress={sendCode} disabled={isLoading}>
              <Text style={styles.secondaryText}>{codeSent ? 'Reenviar código' : 'Verificar número'}</Text>
            </TouchableOpacity>
          ) : null}

          {codeSent && !phoneVerified ? (
            <>
              <Text style={styles.label}>Código do WhatsApp</Text>
              <View style={[styles.box, errors.code ? styles.boxError : null]}>
                <TextInput
                  style={styles.input}
                  placeholder="8 números"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  value={code}
                  onChangeText={(value) => {
                    setCode(value.replace(/\D/g, '').slice(0, 8));
                    setErrors((current) => ({ ...current, code: '' }));
                  }}
                />
              </View>
              {errors.code ? <Text style={styles.error}>{errors.code}</Text> : null}
              <TouchableOpacity style={styles.secondary} onPress={confirmCode} disabled={isLoading || code.length !== 8}>
                <Text style={styles.secondaryText}>Confirmar código</Text>
              </TouchableOpacity>
            </>
          ) : null}

          <TouchableOpacity
            style={[styles.primary, (!canSave || isLoading) && styles.primaryDisabled]}
            onPress={finish}
            disabled={!canSave || isLoading}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Salvar</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={signOut} style={styles.leave}>
            <Text style={styles.leaveText}>Sair</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7F5' },
  content: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  subtitle: { marginTop: 8, marginBottom: 20, color: '#64748B', lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 6, marginTop: 10 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  boxError: { borderColor: '#DC2626' },
  error: { color: '#DC2626', fontSize: 12, fontWeight: '600', marginTop: 6 },
  ok: { color: '#165337', fontWeight: '700', marginTop: 8 },
  input: { flex: 1, color: '#0F172A', fontSize: 15 },
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
  leave: { marginTop: 16, alignItems: 'center' },
  leaveText: { color: '#64748B', fontWeight: '600' },
});
