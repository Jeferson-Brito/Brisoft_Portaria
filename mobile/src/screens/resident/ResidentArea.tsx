import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../config/api';
import { colors } from '../../theme/colors';
import { AppHeader } from '../../components/AppHeader';

type Tab = 'home' | 'visits' | 'packages' | 'profile' | 'new';

type Visit = {
  id: string;
  visitorName: string;
  startDate: string;
  expectedTimeStart?: string | null;
  expectedTimeEnd?: string | null;
  cancelledAt?: string | null;
  isUsed: boolean;
  phone?: string | null;
  visitorDocument?: string | null;
  company?: string | null;
  vehicleModel?: string | null;
  vehiclePlate?: string | null;
  notes?: string | null;
  destination?: { name: string; block?: string | null };
};

function visitStatus(visit: Visit) {
  if (visit.cancelledAt) return 'Cancelada';
  if (visit.isUsed) return 'Utilizada';
  const end = new Date(visit.startDate);
  end.setHours(23, 59, 59, 999);
  if (end.getTime() < Date.now()) return 'Encerrada';
  return 'Agendada';
}

function sameDay(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

export const ResidentArea: React.FC = () => {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('home');
  const [context, setContext] = useState<any>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [selected, setSelected] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    visitorName: '',
    phone: '',
    document: '',
    company: '',
    date: new Date().toISOString().slice(0, 10),
    entryTime: '14:00',
    exitTime: '18:00',
    vehicleModel: '',
    vehiclePlate: '',
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [contextRes, visitsRes, packagesRes] = await Promise.all([
        api.get('/me/context'),
        api.get('/me/visits'),
        api.get('/me/packages'),
      ]);
      setContext(contextRes.data.data);
      setVisits(visitsRes.data.data || []);
      setPackages(packagesRes.data.data || []);
    } catch (err: any) {
      Alert.alert('Não foi possível carregar', err.response?.data?.error?.message || 'Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upcoming = visits.filter((visit) => visitStatus(visit) === 'Agendada' && !sameDay(visit.startDate)).slice(0, 3);
  const today = visits.filter((visit) => sameDay(visit.startDate) && !visit.cancelledAt);
  const pendingPackages = packages.filter((item) => item.status === 'RECEIVED');
  const unit = context?.units?.[0];

  const createVisit = async () => {
    if (!form.visitorName.trim()) {
      Alert.alert('Informe o nome', 'O nome do visitante é obrigatório.');
      return;
    }
    try {
      setLoading(true);
      await api.post('/me/visits', form);
      setForm({ ...form, visitorName: '', phone: '', document: '', company: '', vehicleModel: '', vehiclePlate: '', notes: '' });
      setTab('visits');
      await load();
    } catch (err: any) {
      Alert.alert('Não foi possível agendar', err.response?.data?.error?.message || 'Tente novamente.');
      setLoading(false);
    }
  };

  const cancelVisit = async (visit: Visit) => {
    try {
      await api.patch(`/me/visits/${visit.id}/cancel`);
      setSelected(null);
      await load();
    } catch (err: any) {
      Alert.alert('Não foi possível cancelar', err.response?.data?.error?.message || 'Esta visita não pode mais ser cancelada.');
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title={tab === 'new' ? 'Nova visita' : tab === 'visits' ? 'Minhas visitas' : tab === 'packages' ? 'Encomendas' : tab === 'profile' ? 'Meu perfil' : 'Início'}
        subtitle={unit ? `${unit.name}${unit.block ? ` · ${unit.block}` : ''}` : user?.organizationName}
        onBack={tab === 'home' ? undefined : () => { setSelected(null); setTab('home'); }}
      />
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {tab === 'home' && (
            <>
              <Text style={styles.hello}>Olá, {context?.resident?.name || user?.name}</Text>
              <Text style={styles.org}>{context?.organization?.name || user?.organizationName}</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{today.length}</Text>
                  <Text style={styles.summaryLabel}>Visitas hoje</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{pendingPackages.length}</Text>
                  <Text style={styles.summaryLabel}>Encomendas</Text>
                </View>
              </View>
              <Text style={styles.section}>Próximas visitas</Text>
              {upcoming.length === 0 ? <Text style={styles.empty}>Nenhuma visita futura.</Text> : upcoming.map((visit) => (
                <TouchableOpacity key={visit.id} style={styles.card} onPress={() => { setSelected(visit); setTab('visits'); }}>
                  <Text style={styles.cardTitle}>{visit.visitorName}</Text>
                  <Text style={styles.cardMeta}>{new Date(visit.startDate).toLocaleDateString('pt-BR')} · {visit.expectedTimeStart || 'horário livre'}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.primary} onPress={() => setTab('new')}><Text style={styles.primaryText}>Nova visita</Text></TouchableOpacity>
            </>
          )}

          {tab === 'new' && (
            <View style={styles.form}>
              <Field label="Nome" value={form.visitorName} onChange={(visitorName) => setForm({ ...form, visitorName })} />
              <Field label="Telefone" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
              <Field label="Documento" value={form.document} onChange={(document) => setForm({ ...form, document })} />
              <Field label="Empresa" value={form.company} onChange={(company) => setForm({ ...form, company })} />
              <Field label="Data" value={form.date} onChange={(date) => setForm({ ...form, date })} />
              <Field label="Entrada" value={form.entryTime} onChange={(entryTime) => setForm({ ...form, entryTime })} />
              <Field label="Saída" value={form.exitTime} onChange={(exitTime) => setForm({ ...form, exitTime })} />
              <Field label="Veículo" value={form.vehicleModel} onChange={(vehicleModel) => setForm({ ...form, vehicleModel })} />
              <Field label="Placa" value={form.vehiclePlate} onChange={(vehiclePlate) => setForm({ ...form, vehiclePlate })} />
              <Field label="Observação" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
              <TouchableOpacity style={styles.primary} onPress={createVisit}><Text style={styles.primaryText}>Confirmar visita</Text></TouchableOpacity>
            </View>
          )}

          {tab === 'visits' && !selected && (
            <>
              {['Hoje', 'Próximas', 'Histórico'].map((group) => {
                const list = visits.filter((visit) => {
                  const status = visitStatus(visit);
                  if (group === 'Hoje') return sameDay(visit.startDate) && status === 'Agendada';
                  if (group === 'Próximas') return status === 'Agendada' && !sameDay(visit.startDate);
                  return status !== 'Agendada';
                });
                return (
                  <View key={group}>
                    <Text style={styles.section}>{group}</Text>
                    {list.length === 0 ? <Text style={styles.empty}>Nenhuma visita.</Text> : list.map((visit) => (
                      <TouchableOpacity key={visit.id} style={styles.card} onPress={() => setSelected(visit)}>
                        <Text style={styles.cardTitle}>{visit.visitorName}</Text>
                        <Text style={styles.cardMeta}>{new Date(visit.startDate).toLocaleDateString('pt-BR')} · {visit.expectedTimeStart || '--:--'} · {visitStatus(visit)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}
            </>
          )}

          {tab === 'visits' && selected && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{selected.visitorName}</Text>
              <Text style={styles.cardMeta}>Status: {visitStatus(selected)}</Text>
              <Text style={styles.cardMeta}>Data: {new Date(selected.startDate).toLocaleDateString('pt-BR')}</Text>
              <Text style={styles.cardMeta}>Horário: {selected.expectedTimeStart || '--:--'} até {selected.expectedTimeEnd || '--:--'}</Text>
              {selected.destination ? <Text style={styles.cardMeta}>Unidade: {selected.destination.name}</Text> : null}
              {selected.vehicleModel ? <Text style={styles.cardMeta}>Veículo: {selected.vehicleModel} {selected.vehiclePlate || ''}</Text> : null}
              {selected.notes ? <Text style={styles.cardMeta}>Obs.: {selected.notes}</Text> : null}
              {visitStatus(selected) === 'Agendada' && (
                <TouchableOpacity style={styles.cancel} onPress={() => cancelVisit(selected)}>
                  <Text style={styles.cancelText}>Cancelar visita</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {tab === 'packages' && (
            pendingPackages.length === 0 && packages.length === 0
              ? <Text style={styles.empty}>Nenhuma encomenda para a sua unidade.</Text>
              : packages.map((item) => (
                <View key={item.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{item.carrier || 'Encomenda'}</Text>
                  <Text style={styles.cardMeta}>{new Date(item.receivedAt).toLocaleDateString('pt-BR')} · {item.status === 'RECEIVED' ? 'Aguardando retirada' : item.status}</Text>
                  {item.status === 'RECEIVED' ? <Text style={styles.cardMeta}>Código: {item.pickupCode}</Text> : null}
                </View>
              ))
          )}

          {tab === 'profile' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{user?.name}</Text>
              <Text style={styles.cardMeta}>{user?.email}</Text>
              <Text style={styles.cardMeta}>{context?.organization?.name}</Text>
              <Text style={styles.cardMeta}>{unit ? `${unit.name}${unit.block ? ` · ${unit.block}` : ''}` : 'Sem unidade vinculada'}</Text>
              <TouchableOpacity style={styles.cancel} onPress={signOut}><Text style={styles.cancelText}>Sair</Text></TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      <View style={styles.tabs}>
        {([
          ['home', 'Início'],
          ['visits', 'Visitas'],
          ['packages', 'Encomendas'],
          ['profile', 'Perfil'],
        ] as Array<[Tab, string]>).map(([key, label]) => (
          <TouchableOpacity key={key} style={styles.tab} onPress={() => { setSelected(null); setTab(key); }}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (value: string) => void }> = ({ label, value, onChange }) => (
  <View style={{ marginBottom: 10 }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput value={value} onChangeText={onChange} style={styles.input} placeholderTextColor={colors.textMuted} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 90 },
  hello: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  org: { color: colors.textSecondary, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border },
  summaryValue: { color: colors.primary, fontSize: 28, fontWeight: '800' },
  summaryLabel: { color: colors.textSecondary, marginTop: 4 },
  section: { color: colors.textPrimary, fontWeight: '700', marginTop: 8, marginBottom: 8 },
  empty: { color: colors.textSecondary, marginBottom: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
  cardMeta: { color: colors.textSecondary, marginTop: 4 },
  primary: { backgroundColor: colors.primary, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  primaryText: { color: '#FFFFFF', fontWeight: '700' },
  form: { paddingBottom: 20 },
  fieldLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 4 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, minHeight: 44, color: colors.textPrimary },
  cancel: { marginTop: 16, alignItems: 'center' },
  cancelText: { color: '#B91C1C', fontWeight: '700' },
  tabs: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 64, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: colors.primary },
});
