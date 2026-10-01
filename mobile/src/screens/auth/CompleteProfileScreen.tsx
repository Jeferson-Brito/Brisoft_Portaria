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
  const [isLoading, setIsLoading] = useState(false);

  const sendCode = async () => {
    if (phone.replace(/\D/g, '').length < 10) {
      Alert.alert('Atenção', 'Informe o WhatsApp com DDD.');
      return;
    }
    try {
      setIsLoading(true);
      await api.post('/auth/whatsapp-code', { phone });
      setCodeSent(true);
      Alert.alert('Código enviado', 'Digite o código de 8 caracteres recebido no WhatsApp.');
    } catch (err: any) {
      Alert.alert('Não foi possível enviar', err.response?.data?.error?.message || 'Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const finish = async () => {
    if (password.length < 8) {
      Alert.alert('Atenção', 'A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Atenção', 'As senhas não coincidem.');
      return;
    }
    if (code.trim().length !== 8) {
      Alert.alert('Atenção', 'Confirme o código enviado no WhatsApp.');
      return;
    }
    try {
      setIsLoading(true);
      await api.post('/auth/complete-profile', {
        newPassword: password,
        phone,
        code: code.trim(),
      });
      await patchUser({ mustCompleteProfile: false, whatsappVerified: true });
    } catch (err: any) {
      Alert.alert('Não foi possível concluir', err.response?.data?.error?.message || 'Verifique o código e tente novamente.');
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
          <View style={styles.box}>
            <Lock size={18} color="#64748B" />
            <TextInput
              style={styles.input}
              placeholder="Mínimo de 8 caracteres"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <Text style={styles.label}>Confirmar senha</Text>
          <View style={styles.box}>
            <Lock size={18} color="#64748B" />
            <TextInput
              style={styles.input}
              placeholder="Repita a nova senha"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </View>

          <Text style={styles.label}>WhatsApp</Text>
          <View style={styles.box}>
            <Phone size={18} color="#64748B" />
            <TextInput
              style={styles.input}
              placeholder="(83) 90000-0000"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          <TouchableOpacity style={styles.secondary} onPress={sendCode} disabled={isLoading}>
            <Text style={styles.secondaryText}>{codeSent ? 'Reenviar código' : 'Enviar código no WhatsApp'}</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Código recebido</Text>
          <View style={styles.box}>
            <TextInput
              style={styles.input}
              placeholder="8 caracteres"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              value={code}
              onChangeText={(value) => setCode(value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase())}
            />
          </View>

          <TouchableOpacity style={styles.primary} onPress={finish} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Concluir cadastro</Text>}
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
  leave: { marginTop: 16, alignItems: 'center' },
  leaveText: { color: '#64748B', fontWeight: '600' },
});
