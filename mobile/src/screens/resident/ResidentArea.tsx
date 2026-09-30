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
  Platform,
  StatusBar,
  BackHandler,
  Share,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, CalendarCheck, ChevronLeft, ChevronRight, Home, Package, Trees, UserRound } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../config/api';
import { colors } from '../../theme/colors';
import { AppHeader } from '../../components/AppHeader';
import QRCode from 'react-native-qrcode-svg';
import { ResidentAreas } from './ResidentAreas';
import { WEEKDAY_SHORT, weekdayText } from '../../utils/release';

type Tab = 'home' | 'visits' | 'packages' | 'areas' | 'profile' | 'alerts' | 'new';

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
  qrToken?: string | null;
  endDate?: string;
  weekdays?: string | null;
  destination?: { name: string; block?: string | null };
};

const PACKAGE_STATUS: Record<string, string> = {
  RECEIVED: 'Aguardando retirada',
  PICKED_UP: 'Retirada',
  RETURNED: 'Devolvida',
};

function visitStatus(visit: Visit) {
  if (visit.cancelledAt) return 'Cancelada';
  const end = saoPauloDay(visit.endDate || visit.startDate);
  if (visit.weekdays) return end < todayKey() ? 'Encerrada' : 'Recorrente';
  if (visit.isUsed) return 'Utilizada';
  if (saoPauloDay(visit.startDate) < todayKey()) return 'Encerrada';
  return 'Agendada';
}

function isOpenVisit(visit: Visit) {
  const status = visitStatus(visit);
  return status === 'Agendada' || status === 'Recorrente';
}

function weekdayOfKey(dayKey: string) {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}

function visitCoversDay(visit: Visit, dayKey: string) {
  if (visit.cancelledAt) return false;
  const start = saoPauloDay(visit.startDate);
  const end = saoPauloDay(visit.endDate || visit.startDate);
  if (dayKey < start || dayKey > end) return false;
  if (!visit.weekdays) return dayKey === start;
  return visit.weekdays.split(',').includes(String(weekdayOfKey(dayKey)));
}

function statusTone(status: string) {
  if (status === 'Agendada' || status === 'Recorrente' || status === 'Aguardando retirada') return { bg: '#DCFCE7', text: '#166534' };
  if (status === 'Cancelada' || status === 'Devolvida') return { bg: '#FEE2E2', text: '#991B1B' };
  return { bg: '#F1F5F9', text: '#475569' };
}

function saoPauloDay(value: string) {
  return new Date(value).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function todayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function maskDate(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, '').replace(/^55/, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function toWhatsappPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

function todayBR() {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${date.getFullYear()}`;
}

function toIsoDate(value: string) {
  const match = value.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function formatDay(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short' });
}

export const ResidentArea: React.FC = () => {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 48 : 12);
  const [tab, setTab] = useState<Tab>('home');
  const [context, setContext] = useState<any>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [selected, setSelected] = useState<Visit | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasVehicle, setHasVehicle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([2, 4]);
  const [validUntil, setValidUntil] = useState('');
  const [form, setForm] = useState({
    visitorName: '',
    phone: '',
    document: '',
    company: '',
    date: todayBR(),
    entryTime: '14:00',
    exitTime: '18:00',
    vehicleModel: '',
    vehiclePlate: '',
    notes: '',
  });

  const load = useCallback(async () => {
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

  const residentName = context?.resident?.name || user?.name || 'Morador';
  const upcoming = visits.filter((visit) => isOpenVisit(visit) && !visitCoversDay(visit, todayKey())).slice(0, 3);
  const today = visits.filter((visit) => isOpenVisit(visit) && visitCoversDay(visit, todayKey()));
  const pendingPackages = packages.filter((item) => item.status === 'RECEIVED');
  const unit = context?.units?.[0];
  const unitLabel = unit ? `${unit.name}${unit.block ? ` · ${unit.block}` : ''}` : 'Unidade';
  const mainTab = (tab === 'home' || tab === 'visits' || tab === 'packages' || tab === 'areas') && !selected && !selectedPackage;

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedPackage) {
        setSelectedPackage(null);
        return true;
      }
      if (selected) {
        setSelected(null);
        return true;
      }
      if (tab !== 'home') {
        setTab('home');
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [tab, selected, selectedPackage]);
  const noticeCount = today.length + pendingPackages.length;

  const createVisit = async () => {
    if (!form.visitorName.trim()) {
      Alert.alert('Informe o nome', 'O nome do visitante é obrigatório.');
      return;
    }
    const isoDate = toIsoDate(form.date);
    if (!isoDate) {
      Alert.alert('Data inválida', 'Use o formato DD-MM-AAAA, por exemplo 10-10-2026.');
      return;
    }
    if (isoDate < todayKey()) {
      Alert.alert('Data inválida', 'Não é possível convidar alguém para uma data que já passou.');
      return;
    }
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      Alert.alert('Telefone inválido', 'Informe o celular com DDD para enviar o convite no WhatsApp.');
      return;
    }
    const untilIso = repeat ? toIsoDate(validUntil) : '';
    if (repeat && weekdays.length === 0) {
      Alert.alert('Escolha os dias', 'Marque pelo menos um dia da semana, por exemplo terça e quinta.');
      return;
    }
    if (repeat && !untilIso) {
      Alert.alert('Validade', 'Informe até quando a visita recorrente vale, no formato DD-MM-AAAA.');
      return;
    }
    if (repeat && untilIso < isoDate) {
      Alert.alert('Validade', 'A data final não pode ser anterior ao primeiro dia.');
      return;
    }
    try {
      setSaving(true);
      await api.post('/me/visits', {
        ...form,
        date: isoDate,
        phone: toWhatsappPhone(form.phone),
        document: undefined,
        company: undefined,
        vehicleModel: hasVehicle ? form.vehicleModel : '',
        vehiclePlate: hasVehicle ? form.vehiclePlate : '',
        weekdays: repeat ? weekdays : undefined,
        validUntil: repeat ? untilIso : undefined,
      });
      setForm({ ...form, visitorName: '', phone: '', document: '', company: '', vehicleModel: '', vehiclePlate: '', notes: '' });
      setRepeat(false);
      setValidUntil('');
      setTab('visits');
      await load();
    } catch (err: any) {
      Alert.alert('Não foi possível agendar', err.response?.data?.error?.message || 'Tente novamente.');
    } finally {
      setSaving(false);
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

  const headerAction = mainTab ? (
    <View style={styles.headerActions}>
      <TouchableOpacity style={styles.headerIcon} onPress={() => setTab('alerts')} activeOpacity={0.8}>
        <Bell size={18} color="#FFFFFF" />
        {noticeCount > 0 ? <View style={styles.noticeDot} /> : null}
      </TouchableOpacity>
      <TouchableOpacity style={styles.headerIcon} onPress={() => setTab('profile')} activeOpacity={0.8}>
        <UserRound size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#165337" />
      <AppHeader
        title={
          selectedPackage ? 'Encomenda'
            : selected ? 'Visita'
            : tab === 'new' ? 'Nova visita'
            : tab === 'visits' ? 'Minhas visitas'
            : tab === 'packages' ? 'Encomendas'
            : tab === 'areas' ? 'Áreas'
            : tab === 'profile' ? 'Meu perfil'
            : tab === 'alerts' ? 'Avisos'
            : 'Início'
        }
        subtitle={unitLabel}
        onBack={mainTab ? undefined : () => { setSelected(null); setSelectedPackage(null); setTab('home'); }}
        rightAction={headerAction}
      />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 96 }]} showsVerticalScrollIndicator={false}>
          {tab === 'home' && (
            <>
              <Text style={styles.hello}>Olá, {residentName}</Text>
              <Text style={styles.org}>{context?.organization?.name || user?.organizationName}</Text>
              <View style={styles.summaryRow}>
                <TouchableOpacity style={styles.summaryCard} onPress={() => setTab('visits')} activeOpacity={0.85}>
                  <CalendarCheck size={18} color={colors.primary} />
                  <Text style={styles.summaryValue}>{today.length}</Text>
                  <Text style={styles.summaryLabel}>Visitas hoje</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.summaryCard} onPress={() => setTab('packages')} activeOpacity={0.85}>
                  <Package size={18} color={colors.primary} />
                  <Text style={styles.summaryValue}>{pendingPackages.length}</Text>
                  <Text style={styles.summaryLabel}>Encomendas</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.section}>Próximas visitas</Text>
              {upcoming.length === 0 ? (
                <View style={styles.emptyCard}><Text style={styles.empty}>Nenhuma visita futura.</Text></View>
              ) : upcoming.map((visit) => (
                <VisitCard key={visit.id} visit={visit} onPress={() => { setSelected(visit); setTab('visits'); }} />
              ))}
              <TouchableOpacity style={styles.primary} onPress={() => setTab('new')} activeOpacity={0.85}>
                <Text style={styles.primaryText}>Nova visita</Text>
              </TouchableOpacity>
            </>
          )}

          {tab === 'new' && (
            <View style={styles.formCard}>
              <Field label="Nome do visitante" value={form.visitorName} onChange={(visitorName) => setForm({ ...form, visitorName })} />
              <Field label="WhatsApp" value={form.phone} onChange={(phone) => setForm({ ...form, phone: maskPhone(phone) })} keyboard="phone-pad" />
              <Field label="Data" value={form.date} onChange={(date) => setForm({ ...form, date: maskDate(date) })} keyboard="number-pad" />
              <View style={styles.timeRow}>
                <View style={{ flex: 1 }}><Field label="Entrada" value={form.entryTime} onChange={(entryTime) => setForm({ ...form, entryTime })} /></View>
                <View style={{ flex: 1 }}><Field label="Saída" value={form.exitTime} onChange={(exitTime) => setForm({ ...form, exitTime })} /></View>
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Repetir toda semana</Text>
                <Switch value={repeat} onValueChange={setRepeat} />
              </View>
              {repeat ? (
                <>
                  <View style={styles.dayRow}>
                    {WEEKDAY_SHORT.map((label, index) => {
                      const active = weekdays.includes(index);
                      return (
                        <TouchableOpacity
                          key={label}
                          style={[styles.dayChip, active && styles.dayChipActive]}
                          onPress={() => setWeekdays(active ? weekdays.filter((day) => day !== index) : [...weekdays, index].sort())}
                        >
                          <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Field label="Válido até" value={validUntil} onChange={(value) => setValidUntil(maskDate(value))} keyboard="number-pad" />
                </>
              ) : null}
              <Field label="Observação" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Visitante de veículo</Text>
                <Switch
                  value={hasVehicle}
                  onValueChange={setHasVehicle}
                  trackColor={{ false: '#E2E8F0', true: '#23734C' }}
                  thumbColor="#FFFFFF"
                />
              </View>
              {hasVehicle ? (
                <>
                  <Field label="Veículo" value={form.vehicleModel} onChange={(vehicleModel) => setForm({ ...form, vehicleModel })} />
                  <Field label="Placa" value={form.vehiclePlate} onChange={(vehiclePlate) => setForm({ ...form, vehiclePlate: vehiclePlate.toUpperCase() })} autoCapitalize="characters" />
                </>
              ) : null}
              <TouchableOpacity style={styles.primary} onPress={createVisit} disabled={saving} activeOpacity={0.85}>
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Confirmar visita</Text>}
              </TouchableOpacity>
            </View>
          )}

          {tab === 'visits' && !selected && (
            <>
              <VisitCalendar
                month={monthCursor}
                visits={visits}
                pickedDay={pickedDay}
                onPrev={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
                onNext={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
                onPick={(day) => setPickedDay(pickedDay === day ? null : day)}
              />
              {pickedDay ? (
                <>
                  <Text style={styles.section}>Dia {pickedDay.split('-').reverse().join('/')}</Text>
                  {visits.filter((visit) => visitCoversDay(visit, pickedDay)).length === 0 ? (
                    <View style={styles.emptyCard}><Text style={styles.empty}>Nenhuma visita neste dia.</Text></View>
                  ) : visits.filter((visit) => visitCoversDay(visit, pickedDay)).map((visit) => (
                    <VisitCard key={visit.id} visit={visit} onPress={() => setSelected(visit)} />
                  ))}
                </>
              ) : null}
              {(['Hoje', 'Próximas', 'Histórico'] as const).map((group) => {
                const list = visits.filter((visit) => {
                  const status = visitStatus(visit);
                  const open = status === 'Agendada' || status === 'Recorrente';
                  if (group === 'Hoje') return open && visitCoversDay(visit, todayKey());
                  if (group === 'Próximas') return open && !visitCoversDay(visit, todayKey());
                  return !open;
                });
                return (
                  <View key={group}>
                    <Text style={styles.section}>{group}</Text>
                    {list.length === 0 ? (
                      <View style={styles.emptyCard}><Text style={styles.empty}>Nenhuma visita.</Text></View>
                    ) : list.map((visit) => (
                      <VisitCard key={visit.id} visit={visit} onPress={() => setSelected(visit)} />
                    ))}
                  </View>
                );
              })}
            </>
          )}

          {tab === 'visits' && selected && (
            <View style={styles.detailCard}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{selected.visitorName}</Text>
                <StatusPill label={visitStatus(selected)} />
              </View>
              <Detail label="Data" value={selected.weekdays
                ? `${weekdayText(selected.weekdays)} até ${new Date(selected.endDate || selected.startDate).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
                : new Date(selected.startDate).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} />
              <Detail label="Horário" value={`${selected.expectedTimeStart || '--:--'} até ${selected.expectedTimeEnd || '--:--'}`} />
              {selected.destination ? <Detail label="Unidade" value={selected.destination.name} /> : null}
              {selected.phone ? <Detail label="Telefone" value={selected.phone} /> : null}
              {selected.vehicleModel ? <Detail label="Veículo" value={`${selected.vehicleModel} ${selected.vehiclePlate || ''}`.trim()} /> : null}
              {selected.notes ? <Detail label="Observação" value={selected.notes} /> : null}
              {selected.qrToken && isOpenVisit(selected) ? (
                <View style={styles.qrBox}>
                  <QRCode value={selected.qrToken} size={180} />
                  <Text style={styles.code}>{selected.qrToken}</Text>
                  <Text style={styles.cardMeta}>{selected.weekdays
                    ? `Válido ${weekdayText(selected.weekdays)}, até ${new Date(selected.endDate || selected.startDate).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}, das ${selected.expectedTimeStart || '00:00'} às ${selected.expectedTimeEnd || '23:59'}`
                    : `Válido em ${new Date(selected.startDate).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} das ${selected.expectedTimeStart || '00:00'} às ${selected.expectedTimeEnd || '23:59'}`}</Text>
                  <TouchableOpacity
                    style={styles.primary}
                    onPress={() => Share.share({
                      message: `Você foi convidado por ${residentName} para visitar:\n\n${context?.organization?.name || ''}\n${unitLabel}${context?.organization?.address ? `\nEndereço: ${context.organization.address}` : ''}\n\n${selected.weekdays ? `Repete: ${weekdayText(selected.weekdays)}\nVálido até: ${new Date(selected.endDate || selected.startDate).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : `Data: ${new Date(selected.startDate).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`}\nHorário: ${selected.expectedTimeStart || '00:00'} às ${selected.expectedTimeEnd || '23:59'}\n\nApresente este QR Code na portaria.\nhttps://portaria.brisoft.com.br/convite/${selected.qrToken}`,
                    })}
                  >
                    <Text style={styles.primaryText}>Compartilhar convite</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {isOpenVisit(selected) && (
                <TouchableOpacity style={styles.cancelButton} onPress={() => cancelVisit(selected)} activeOpacity={0.85}>
                  <Text style={styles.cancelText}>Cancelar visita</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {tab === 'areas' && <ResidentAreas />}

          {tab === 'packages' && !selectedPackage && (
            packages.length === 0 ? (
              <View style={styles.emptyCard}><Text style={styles.empty}>Nenhuma encomenda para a sua unidade.</Text></View>
            ) : packages.map((item) => {
              const label = PACKAGE_STATUS[item.status] || item.status;
              return (
                <TouchableOpacity key={item.id} style={styles.card} onPress={() => setSelectedPackage(item)} activeOpacity={0.85}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle}>{item.carrier || 'Encomenda'}</Text>
                    <StatusPill label={label} />
                  </View>
                  <Text style={styles.cardMeta}>{formatDay(item.receivedAt)}</Text>
                  {item.status === 'RECEIVED' ? <Text style={styles.code}>Código {item.pickupCode}</Text> : null}
                </TouchableOpacity>
              );
            })
          )}

          {tab === 'packages' && selectedPackage && (
            <View style={styles.detailCard}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{selectedPackage.carrier || 'Encomenda'}</Text>
                <StatusPill label={PACKAGE_STATUS[selectedPackage.status] || selectedPackage.status} />
              </View>
              <Detail label="Recebida em" value={new Date(selectedPackage.receivedAt).toLocaleDateString('pt-BR')} />
              {selectedPackage.code ? <Detail label="Registro" value={selectedPackage.code} /> : null}
              {selectedPackage.trackingCode ? <Detail label="Rastreio" value={selectedPackage.trackingCode} /> : null}
              {selectedPackage.sender ? <Detail label="Remetente" value={selectedPackage.sender} /> : null}
              {selectedPackage.recipientName ? <Detail label="Destinatário" value={selectedPackage.recipientName} /> : null}
              {selectedPackage.destination ? <Detail label="Unidade" value={`${selectedPackage.destination.name}${selectedPackage.destination.block ? ` · ${selectedPackage.destination.block}` : ''}`} /> : null}
              {selectedPackage.status === 'RECEIVED' ? <Detail label="Código de retirada" value={selectedPackage.pickupCode} /> : null}
              {selectedPackage.notes ? <Detail label="Observação" value={selectedPackage.notes} /> : null}
            </View>
          )}

          {tab === 'alerts' && (
            noticeCount === 0 ? (
              <View style={styles.emptyCard}><Text style={styles.empty}>Nenhum aviso no momento.</Text></View>
            ) : (
              <>
                {today.map((visit) => (
                  <View key={visit.id} style={styles.card}>
                    <Text style={styles.cardTitle}>Visita hoje</Text>
                    <Text style={styles.cardMeta}>{visit.visitorName} · {visit.expectedTimeStart || 'horário livre'}</Text>
                  </View>
                ))}
                {pendingPackages.map((item) => (
                  <View key={item.id} style={styles.card}>
                    <Text style={styles.cardTitle}>Encomenda aguardando</Text>
                    <Text style={styles.cardMeta}>{item.carrier || 'Encomenda'} · código {item.pickupCode}</Text>
                  </View>
                ))}
              </>
            )
          )}

          {tab === 'profile' && (
            <View style={styles.detailCard}>
              <Text style={styles.cardTitle}>{residentName}</Text>
              <Detail label="E-mail" value={user?.email || '—'} />
              <Detail label="Empresa" value={context?.organization?.name || user?.organizationName || '—'} />
              <Detail label="Unidade" value={unitLabel} />
              <TouchableOpacity style={styles.cancelButton} onPress={signOut} activeOpacity={0.85}>
                <Text style={styles.cancelText}>Sair da conta</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {mainTab && (
        <View style={[styles.tabs, { paddingBottom: bottomInset }]}>
          {([
            ['home', 'Início', Home],
            ['visits', 'Visitas', CalendarCheck],
            ['packages', 'Encomendas', Package],
            ['areas', 'Áreas', Trees],
          ] as const).map(([key, label, Icon]) => {
            const active = tab === key;
            return (
              <TouchableOpacity key={key} style={styles.tab} onPress={() => { setSelected(null); setSelectedPackage(null); setTab(key); }} activeOpacity={0.8}>
                <Icon size={20} color={active ? colors.primary : '#94A3B8'} />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const VisitCalendar: React.FC<{
  month: Date;
  visits: Visit[];
  pickedDay: string | null;
  onPrev: () => void;
  onNext: () => void;
  onPick: (day: string) => void;
}> = ({ month, visits, pickedDay, onPrev, onNext, onPick }) => {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const marked = new Set<string>();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (visits.some((visit) => visitCoversDay(visit, key))) marked.add(key);
  }
  const today = todayKey();
  const title = month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <View style={styles.calendar}>
      <View style={styles.calendarHead}>
        <TouchableOpacity onPress={onPrev} style={styles.calendarArrow} activeOpacity={0.8}>
          <ChevronLeft size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.calendarTitle}>{title}</Text>
        <TouchableOpacity onPress={onNext} style={styles.calendarArrow} activeOpacity={0.8}>
          <ChevronRight size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.calendarWeek}>
        {WEEKDAYS.map((label, index) => (
          <Text key={`${label}-${index}`} style={styles.calendarWeekDay}>{label}</Text>
        ))}
      </View>
      <View style={styles.calendarGrid}>
        {cells.map((day, index) => {
          if (!day) return <View key={`empty-${index}`} style={styles.calendarCell} />;
          const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const hasVisit = marked.has(key);
          const selectedCell = pickedDay === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.calendarCell, selectedCell && styles.calendarCellSelected, key === today && styles.calendarCellToday]}
              onPress={() => onPick(key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.calendarDay, selectedCell && styles.calendarDaySelected]}>{day}</Text>
              {hasVisit ? <View style={[styles.calendarDot, selectedCell && styles.calendarDotSelected]} /> : <View style={styles.calendarDotSpacer} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const VisitCard: React.FC<{ visit: Visit; onPress: () => void }> = ({ visit, onPress }) => (
  <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
    <View style={styles.cardTop}>
      <Text style={styles.cardTitle}>{visit.visitorName}</Text>
      <StatusPill label={visitStatus(visit)} />
    </View>
    <Text style={styles.cardMeta}>{formatDay(visit.startDate)} · {visit.expectedTimeStart || 'horário livre'}</Text>
  </TouchableOpacity>
);

const StatusPill: React.FC<{ label: string }> = ({ label }) => {
  const tone = statusTone(label);
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.pillText, { color: tone.text }]}>{label}</Text>
    </View>
  );
};

const Detail: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const Field: React.FC<{ label: string; value: string; onChange: (value: string) => void; keyboard?: 'default' | 'phone-pad' | 'number-pad'; autoCapitalize?: 'none' | 'characters' }> = ({ label, value, onChange, keyboard = 'default', autoCapitalize = 'none' }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChange}
      style={styles.input}
      placeholderTextColor={colors.textMuted}
      keyboardType={keyboard}
      autoCapitalize={autoCapitalize}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  hello: { color: colors.textPrimary, fontSize: 24, fontWeight: '800' },
  org: { color: colors.textSecondary, marginTop: 2, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  summaryCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  summaryValue: { color: colors.primary, fontSize: 28, fontWeight: '800', marginTop: 8 },
  summaryLabel: { color: colors.textSecondary, marginTop: 2, fontSize: 13 },
  section: { color: colors.textPrimary, fontWeight: '800', fontSize: 16, marginTop: 18, marginBottom: 8 },
  calendar: { backgroundColor: colors.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  calendarHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  calendarTitle: { color: colors.textPrimary, fontWeight: '800', fontSize: 16, textTransform: 'capitalize' },
  calendarArrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  calendarWeek: { flexDirection: 'row' },
  calendarWeekDay: { flex: 1, textAlign: 'center', color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { width: '14.28%', alignItems: 'center', paddingVertical: 6, borderRadius: 10 },
  calendarCellSelected: { backgroundColor: colors.primary },
  calendarCellToday: { borderWidth: 1, borderColor: colors.primarySoftBorder },
  calendarDay: { color: colors.textPrimary, fontWeight: '600' },
  calendarDaySelected: { color: '#FFFFFF' },
  calendarDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#34D399', marginTop: 3 },
  calendarDotSelected: { backgroundColor: '#FFFFFF' },
  calendarDotSpacer: { width: 5, height: 5, marginTop: 3 },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  empty: { color: colors.textSecondary },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 16, flex: 1 },
  cardMeta: { color: colors.textSecondary, marginTop: 6 },
  code: { color: colors.primary, fontWeight: '800', marginTop: 8, letterSpacing: 1 },
  qrBox: { alignItems: 'center', marginTop: 18, gap: 8 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: '700' },
  primary: { backgroundColor: colors.primary, borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  formCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  timeRow: { flexDirection: 'row', gap: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 4 },
  switchLabel: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  dayChip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  dayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayChipText: { color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
  dayChipTextActive: { color: '#FFFFFF' },
  fieldLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 4, fontWeight: '600' },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, minHeight: 46, color: colors.textPrimary },
  detailCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  detailRow: { marginTop: 12 },
  detailLabel: { color: colors.textMuted, fontSize: 12 },
  detailValue: { color: colors.textPrimary, fontSize: 15, fontWeight: '600', marginTop: 2 },
  cancelButton: { marginTop: 20, borderRadius: 12, minHeight: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2' },
  cancelText: { color: '#B91C1C', fontWeight: '700' },
  tabs: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  tabText: { color: '#94A3B8', fontSize: 11, fontWeight: '600', marginTop: 4 },
  tabTextActive: { color: colors.primary },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  noticeDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FDE68A' },
});
