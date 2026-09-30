import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { api } from '../../config/api';
import { colors } from '../../theme/colors';

type Restriction = {
  id: string;
  name: string;
  documentNumber?: string | null;
  reason: string;
  active: boolean;
};

export const RestrictionsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [items, setItems] = useState<Restriction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/restrictions');
      setItems(res.data.data || []);
    } catch (err: any) {
      Alert.alert('Não foi possível carregar', err.response?.data?.error?.message || 'Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (name.trim().length < 2 || reason.trim().length < 3) {
      Alert.alert('Dados incompletos', 'Informe o nome e o motivo da restrição.');
      return;
    }
    try {
      setSaving(true);
      await api.post('/restrictions', {
        name: name.trim(),
        documentNumber: documentNumber.trim() || undefined,
        reason: reason.trim(),
      });
      setName('');
      setDocumentNumber('');
      setReason('');
      await load();
    } catch (err: any) {
      Alert.alert('Não foi possível salvar', err.response?.data?.error?.message || 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (item: Restriction) => {
    try {
      await api.patch(`/restrictions/${item.id}`, { active: !item.active });
      await load();
    } catch (err: any) {
      Alert.alert('Não foi possível atualizar', err.response?.data?.error?.message || 'Tente novamente.');
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader title="Lista de restrição" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.help}>
          Nome ou documento bloqueado. O porteiro vê o aviso antes de liberar a entrada e não consegue ignorar sem confirmar.
        </Text>
        <TextInput style={styles.input} placeholder="Nome completo" placeholderTextColor={colors.textSecondary} value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Documento, se houver" placeholderTextColor={colors.textSecondary} value={documentNumber} onChangeText={setDocumentNumber} />
        <TextInput style={styles.input} placeholder="Motivo" placeholderTextColor={colors.textSecondary} value={reason} onChangeText={setReason} />
        <TouchableOpacity style={styles.primary} onPress={create} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Incluir na lista</Text>}
        </TouchableOpacity>

        {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} /> : items.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              {item.documentNumber ? <Text style={styles.meta}>{item.documentNumber}</Text> : null}
              <Text style={styles.meta}>{item.reason}</Text>
            </View>
            <View style={styles.switchBox}>
              <Text style={styles.meta}>{item.active ? 'Ativa' : 'Inativa'}</Text>
              <Switch value={item.active} onValueChange={() => toggle(item)} />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  help: { color: colors.textSecondary, marginBottom: 14, lineHeight: 20 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, minHeight: 46, color: colors.textPrimary, marginBottom: 10 },
  primary: { backgroundColor: colors.primary, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '700' },
  card: { marginTop: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', gap: 12, alignItems: 'center' },
  name: { color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
  meta: { color: colors.textSecondary, marginTop: 4 },
  switchBox: { alignItems: 'flex-end' },
});
