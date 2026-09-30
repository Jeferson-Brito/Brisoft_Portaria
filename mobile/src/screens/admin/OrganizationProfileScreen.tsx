import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Building2,
  Briefcase,
  Stethoscope,
  Factory,
  GraduationCap,
  Globe,
  Save,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { api } from '../../config/api';
import { AppHeader } from '../../components/AppHeader';
import { AddressMap } from '../../components/AddressMap';

interface OrganizationProfileScreenProps {
  onBack?: () => void;
  onSaved?: () => void;
}

export type EstablishmentType =
  | 'RESIDENTIAL'
  | 'COMMERCIAL'
  | 'CLINIC'
  | 'INDUSTRIAL'
  | 'EDUCATIONAL'
  | 'OTHER';

interface EstablishmentOption {
  type: EstablishmentType;
  title: string;
  short: string;
  subtitle: string;
  icon: any;
  iconBg: string;
  iconColor: string;
  defaultUnit: string;
  defaultClient: string;
}

const ESTABLISHMENT_OPTIONS: EstablishmentOption[] = [
  {
    type: 'RESIDENTIAL',
    title: 'Residencial / Condomínio',
    short: 'Residencial',
    subtitle: 'Prédios, edifícios residenciais, vilas e condomínios fechados.',
    icon: Building2,
    iconBg: '#DCFCE7',
    iconColor: '#16A34A',
    defaultUnit: 'Apartamento / Casa',
    defaultClient: 'Morador',
  },
  {
    type: 'COMMERCIAL',
    title: 'Empresarial / Comercial',
    short: 'Comercial',
    subtitle: 'Prédios comerciais, sedes de empresas, escritórios e coworkings.',
    icon: Briefcase,
    iconBg: '#DBEAFE',
    iconColor: '#1D4ED8',
    defaultUnit: 'Sala / Conjunto / Andar',
    defaultClient: 'Colaborador / Responsável',
  },
  {
    type: 'CLINIC',
    title: 'Clínica & Consultórios',
    short: 'Clínica',
    subtitle: 'Clínicas médicas, odontologia, laboratórios, terapias e hospitais.',
    icon: Stethoscope,
    iconBg: '#FCE7F3',
    iconColor: '#DB2777',
    defaultUnit: 'Consultório / Ala / Sala',
    defaultClient: 'Médico / Especialista / Secretária',
  },
  {
    type: 'INDUSTRIAL',
    title: 'Indústria & Logística',
    short: 'Indústria',
    subtitle: 'Fábricas, galpões, centros de distribuição e pátios logísticos.',
    icon: Factory,
    iconBg: '#FEF3C7',
    iconColor: '#D97706',
    defaultUnit: 'Setor / Doca / Galpão',
    defaultClient: 'Gestor / Responsável pelo Setor',
  },
  {
    type: 'EDUCATIONAL',
    title: 'Educação & Ensino',
    short: 'Ensino',
    subtitle: 'Escolas, faculdades, colégios e centros de capacitação.',
    icon: GraduationCap,
    iconBg: '#EDE9FE',
    iconColor: '#7C3AED',
    defaultUnit: 'Sala / Bloco / Departamento',
    defaultClient: 'Professor / Coordenação / Direção',
  },
  {
    type: 'OTHER',
    title: 'Geral / Outros Nichos',
    short: 'Outros',
    subtitle: 'Clubes, associações, órgãos públicos e estabelecimentos diversos.',
    icon: Globe,
    iconBg: '#F1F5F9',
    iconColor: '#475569',
    defaultUnit: 'Setor / Unidade',
    defaultClient: 'Responsável',
  },
];

export const OrganizationProfileScreen: React.FC<OrganizationProfileScreenProps> = ({
  onBack,
  onSaved,
}) => {
  const [selectedType, setSelectedType] = useState<EstablishmentType>('RESIDENTIAL');
  const [companyName, setCompanyName] = useState('');
  const [unitLabel, setUnitLabel] = useState('Apartamento / Casa');
  const [clientLabel, setClientLabel] = useState('Morador');
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [mapLocked, setMapLocked] = useState(false);
  const insets = useSafeAreaInsets();
  const aboveTabs = Math.max(insets.bottom, 12) + 74;

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/organizations/current');
      if (res.data?.success && res.data?.data) {
        const org = res.data.data;
        const profile = org.profile || {};
        setSelectedType(profile.type || 'RESIDENTIAL');
        setCompanyName(profile.companyName || org.name || '');
        setUnitLabel(profile.unitLabel || 'Apartamento / Casa');
        setClientLabel(profile.clientLabel || 'Morador');
        setAddress(profile.address || '');
      }
    } catch (err: any) {
      console.warn('Erro ao carregar perfil da organização:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectType = (opt: EstablishmentOption) => {
    setSelectedType(opt.type);
    setUnitLabel(opt.defaultUnit);
    setClientLabel(opt.defaultClient);
  };

  const handleSave = async () => {
    if (!companyName.trim()) {
      Alert.alert('Atenção', 'Informe o nome do estabelecimento / condomínio atendido.');
      return;
    }

    try {
      setIsSaving(true);
      await api.patch('/organizations/current', {
        name: companyName.trim(),
        companyName: companyName.trim(),
        type: selectedType,
        unitLabel: unitLabel.trim(),
        clientLabel: clientLabel.trim(),
        address: address.trim(),
      });

      Alert.alert(
        'Perfil Atualizado! 🟢',
        `A portaria agora está configurada para o segmento "${ESTABLISHMENT_OPTIONS.find((o) => o.type === selectedType)?.title}". As nomenclaturas e formulários foram adaptados com sucesso!`
      );
      if (onSaved) onSaved();
      if (onBack) onBack();
    } catch (err: any) {
      Alert.alert('Erro ao salvar', err.response?.data?.message || 'Falha ao atualizar perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1D4ED8" />
        <Text style={styles.loadingText}>Carregando perfil do estabelecimento...</Text>
      </View>
    );
  }

  const selected = ESTABLISHMENT_OPTIONS.find((item) => item.type === selectedType) || ESTABLISHMENT_OPTIONS[0];

  return (
    <View style={[styles.container, { paddingBottom: aboveTabs }]}>
      <AppHeader
        title="Perfil do Estabelecimento"
        subtitle="Nome, endereço e como a portaria chama cada unidade"
        onBack={onBack}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!mapLocked}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.kicker}>Nome</Text>
        <TextInput
          style={styles.nameInput}
          placeholder="Condomínio, clínica ou empresa"
          placeholderTextColor="#94A3B8"
          value={companyName}
          onChangeText={setCompanyName}
        />

        <Text style={styles.kicker}>Endereço</Text>
        <AddressMap value={address} onChange={setAddress} onTouchMap={setMapLocked} />

        <Text style={[styles.kicker, styles.kickerSpace]}>Tipo do local</Text>
        <View style={styles.grid}>
          {ESTABLISHMENT_OPTIONS.map((opt) => {
            const isSelected = selectedType === opt.type;
            const IconComponent = opt.icon;
            return (
              <TouchableOpacity
                key={opt.type}
                style={[styles.tile, isSelected && styles.tileActive]}
                onPress={() => handleSelectType(opt)}
                activeOpacity={0.85}
              >
                <IconComponent size={18} color={isSelected ? '#FFFFFF' : opt.iconColor} />
                <Text style={[styles.tileText, isSelected && styles.tileTextActive]} numberOfLines={1}>
                  {opt.short}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.caption}>{selected.subtitle}</Text>

        <View style={styles.pair}>
          <View style={styles.pairField}>
            <Text style={styles.label}>Unidade</Text>
            <TextInput
              style={styles.input}
              placeholder="Apartamento"
              placeholderTextColor="#94A3B8"
              value={unitLabel}
              onChangeText={setUnitLabel}
            />
          </View>
          <View style={styles.pairField}>
            <Text style={styles.label}>Responsável</Text>
            <TextInput
              style={styles.input}
              placeholder="Morador"
              placeholderTextColor="#94A3B8"
              value={clientLabel}
              onChangeText={setClientLabel}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.85}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Save size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.saveBtnText}>Salvar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, fontSize: 14, color: colors.textSecondary },
  kicker: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 8 },
  kickerSpace: { marginTop: 22 },
  nameInput: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    minHeight: 54,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 22,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: {
    width: '32%',
    marginBottom: 8,
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
  },
  tileActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tileText: { color: colors.textPrimary, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  tileTextActive: { color: '#FFFFFF' },
  caption: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 10 },
  pair: { flexDirection: 'row', gap: 10, marginTop: 18 },
  pairField: { flex: 1 },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    minHeight: 46,
    fontSize: 14,
    color: colors.textPrimary,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    minHeight: 50,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
