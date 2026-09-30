import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { api } from '../../config/api';
import { colors } from '../../theme/colors';

type Area = { id: string; name: string; kind: string; active: boolean };

const KINDS = [
  { id: 'SALAO', label: 'Salão' },
  { id: 'CHURRASQUEIRA', label: 'Churrasqueira' },
  { id: 'LAZER', label: 'Lazer' },
];

export const AmenitiesScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [items, setItems] = useState<Area[]>([]);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('SALAO');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/amenities');
      setItems(res.data.data || []);
    } catch (err: any) {
      Alert.alert('Não foi possível carregar', err.response?.data?.error?.message || 'Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (name.trim().length < 2) {
      Alert.alert('Informe o nome', 'Exemplo: Salão de festas ou Churrasqueira 1.');
      return;
    }
    try {
      setSaving(true);
      await api.post('/amenities', { name: name.trim(), kind });
      setName('');
      await load();
    } catch (err: any) {
      Alert.alert('Não foi possível salvar', err.response?.data?.error?.message || 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader title="Áreas comuns" subtitle="Salão, churrasqueira e outros espaços" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.help}>O morador reserva no calendário da área dele. Dois horários no mesmo espaço não se cruzam.</Text>
        <TextInput style={styles.input} placeholder="Nome da área" placeholderTextColor={colors.textSecondary} value={name} onChangeText={setName} />
        <View style={styles.kinds}>
          {KINDS.map((item) => (
            <TouchableOpacity key={item.id} style={[styles.kind, kind === item.id && styles.kindOn]} onPress={() => setKind(item.id)}>
              <Text style={[styles.kindText, kind === item.id && styles.kindTextOn]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.primary} onPress={create} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Incluir área</Text>}
        </TouchableOpacity>
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} /> : items.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{KINDS.find((kindItem) => kindItem.id === item.kind)?.label || item.kind}</Text>
            </View>
            <Switch value={item.active} onValueChange={async (active) => {
              await api.patch(`/amenities/${item.id}`, { active });
              load();
            }} />
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
  kinds: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  kind: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  kindOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  kindText: { color: colors.textSecondary, fontWeight: '700' },
  kindTextOn: { color: '#FFFFFF' },
  primary: { backgroundColor: colors.primary, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '700' },
  card: { marginTop: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' },
  name: { color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
  meta: { color: colors.textSecondary, marginTop: 4 },
});
