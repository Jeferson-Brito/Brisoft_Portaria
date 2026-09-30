import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../../config/api';
import { colors } from '../../theme/colors';

type Area = { id: string; name: string };
type Slot = {
  id: string;
  amenityId: string;
  amenityName: string;
  date: string;
  startTime: string;
  endTime: string;
  mine: boolean;
  clientName?: string | null;
};

function todayIso() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function maskDate(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

function toIso(value: string) {
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
}

export const ResidentAreas: React.FC = () => {
  const [areas, setAreas] = useState<Area[]>([]);
  const [areaId, setAreaId] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('18:00');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const month = (toIso(date) || todayIso()).slice(0, 7);

  const load = useCallback(async () => {
    try {
      const [areasRes, calendarRes] = await Promise.all([
        api.get('/me/amenities'),
        api.get(`/me/amenities/calendar?month=${month}`),
      ]);
      const list = areasRes.data.data || [];
      setAreas(list);
      if (!areaId && list[0]) setAreaId(list[0].id);
      setSlots(calendarRes.data.data || []);
    } catch (err: any) {
      Alert.alert('Não foi possível carregar', err.response?.data?.error?.message || 'Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [areaId, month]);

  useEffect(() => { load(); }, [load]);

  const day = toIso(date);
  const daySlots = slots.filter((slot) => slot.amenityId === areaId && (!day || slot.date === day));

  const book = async () => {
    const iso = toIso(date);
    if (!areaId || !iso) {
      Alert.alert('Reserva incompleta', 'Escolha a área e a data.');
      return;
    }
    try {
      setSaving(true);
      await api.post(`/me/amenities/${areaId}/bookings`, { date: iso, startTime, endTime });
      setDate('');
      await load();
    } catch (err: any) {
      Alert.alert('Não foi possível reservar', err.response?.data?.error?.message || 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />;
  if (areas.length === 0) {
    return <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>Nenhuma área comum foi liberada pela administração ainda.</Text>;
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {areas.map((area) => (
          <TouchableOpacity key={area.id} onPress={() => setAreaId(area.id)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: areaId === area.id ? colors.primary : colors.surface, borderWidth: 1, borderColor: areaId === area.id ? colors.primary : colors.border }}>
            <Text style={{ color: areaId === area.id ? '#FFFFFF' : colors.textPrimary, fontWeight: '700' }}>{area.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput value={date} onChangeText={(value) => setDate(maskDate(value))} placeholder="Data DD-MM-AAAA" placeholderTextColor={colors.textSecondary} keyboardType="number-pad" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, minHeight: 46, marginBottom: 8, color: colors.textPrimary }} />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <TextInput value={startTime} onChangeText={setStartTime} placeholder="Início" placeholderTextColor={colors.textSecondary} style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, minHeight: 46, color: colors.textPrimary }} />
        <TextInput value={endTime} onChangeText={setEndTime} placeholder="Fim" placeholderTextColor={colors.textSecondary} style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, minHeight: 46, color: colors.textPrimary }} />
      </View>
      <TouchableOpacity onPress={book} disabled={saving} style={{ backgroundColor: colors.primary, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Reservar</Text>}
      </TouchableOpacity>
      {daySlots.length === 0 ? <Text style={{ color: colors.textSecondary }}>Nenhuma reserva neste período.</Text> : daySlots.map((slot) => (
        <View key={slot.id} style={{ backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 8 }}>
          <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{slot.date.split('-').reverse().join('/')} · {slot.startTime} às {slot.endTime}</Text>
          <Text style={{ color: colors.textSecondary, marginTop: 4 }}>{slot.mine ? `Sua reserva${slot.clientName ? '' : ''}` : 'Ocupado'}</Text>
          {slot.mine ? (
            <TouchableOpacity onPress={async () => { await api.patch(`/me/amenities/bookings/${slot.id}/cancel`); load(); }}>
              <Text style={{ color: '#B91C1C', fontWeight: '700', marginTop: 8 }}>Cancelar</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ))}
    </View>
  );
};
