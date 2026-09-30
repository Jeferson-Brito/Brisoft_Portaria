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
  CircleCheck,
  Save,
  Shield,
  Layers,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { api } from '../../config/api';
import { AppHeader } from '../../components/AppHeader';

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

  return (
    <View style={styles.container}>
      <AppHeader
        title="Perfil do Estabelecimento"
        subtitle="Defina o nicho de atuação e termos da portaria"
        onBack={onBack}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Informativo */}
        <View style={styles.infoBanner}>
          <Shield size={22} color="#1D4ED8" style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoBannerTitle}>Portaria Multi-Segmento</Text>
            <Text style={styles.infoBannerText}>
              O sistema se adapta ao tipo de local onde o porteiro e supervisor atuam. Ao escolher o nicho, os termos (moradores, colaboradores, médicos, etc.) e os destinos se adaptam automaticamente.
            </Text>
          </View>
        </View>

        {/* Campo: Nome do Posto / Empresa Atendida */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>1. Nome do Estabelecimento / Posto</Text>
          <Text style={styles.sectionSubtitle}>
            Como este condomínio, clínica ou empresa é identificado na portaria.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Condomínio Grand Park, Clínica Vida, Tech Hub..."
            placeholderTextColor="#94A3B8"
            value={companyName}
            onChangeText={setCompanyName}
          />
        </View>

        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>2. Endereço do local</Text>
          <Text style={styles.sectionSubtitle}>
            Aparece no convite do WhatsApp e no link do visitante, com atalho para o Google Maps e o Waze.
          </Text>
          <TextInput
            style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
            placeholder="Ex: Rua das Flores, 120 - Centro, São Paulo - SP"
            placeholderTextColor="#94A3B8"
            value={address}
            onChangeText={setAddress}
            multiline
          />
        </View>

        {/* Seleção do Nicho */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>3. Selecione o Tipo de Empresa / Local</Text>
          <Text style={styles.sectionSubtitle}>
            Escolha o modelo de operação deste posto de portaria:
          </Text>

          {ESTABLISHMENT_OPTIONS.map((opt) => {
            const isSelected = selectedType === opt.type;
            const IconComponent = opt.icon;

            return (
              <TouchableOpacity
                key={opt.type}
                style={[styles.typeOptionCard, isSelected && styles.typeOptionCardActive]}
                onPress={() => handleSelectType(opt)}
                activeOpacity={0.85}
              >
                <View style={[styles.typeIconBox, { backgroundColor: opt.iconBg }]}>
                  <IconComponent size={24} color={opt.iconColor} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.typeTitle, isSelected && styles.typeTitleActive]}>
                    {opt.title}
                  </Text>
                  <Text style={styles.typeSubtitle}>{opt.subtitle}</Text>
                  <View style={styles.termsPreview}>
                    <Text style={styles.termsPreviewText}>
                      Destino: <Text style={{ fontWeight: '700' }}>{opt.defaultUnit}</Text> • Responsável:{' '}
                      <Text style={{ fontWeight: '700' }}>{opt.defaultClient}</Text>
                    </Text>
                  </View>
                </View>
                {isSelected && (
                  <View style={styles.checkIcon}>
                    <CircleCheck size={20} color="#16A34A" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Personalização dos Termos */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>4. Nomenclaturas Customizadas</Text>
          <Text style={styles.sectionSubtitle}>
            Como o porteiro e os visitantes devem visualizar as unidades e responsáveis:
          </Text>

          <Text style={styles.label}>Rótulo da Unidade / Destino:</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Apartamento, Sala, Consultório, Setor..."
            placeholderTextColor="#94A3B8"
            value={unitLabel}
            onChangeText={setUnitLabel}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Rótulo do Titular / Responsável:</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Morador, Colaborador, Médico, Gestor..."
            placeholderTextColor="#94A3B8"
            value={clientLabel}
            onChangeText={setClientLabel}
          />
        </View>

        {/* Botão Salvar */}
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
              <Save size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.saveBtnText}>Salvar Perfil do Estabelecimento</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  infoBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1D4ED8',
    marginBottom: 2,
  },
  infoBannerText: {
    fontSize: 12,
    color: '#3B82F6',
    lineHeight: 17,
  },
  cardSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 14,
  },
  input: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  typeOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  typeOptionCardActive: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  typeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  typeTitleActive: {
    color: '#15803D',
  },
  typeSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  termsPreview: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  termsPreviewText: {
    fontSize: 10,
    color: '#475569',
  },
  checkIcon: {
    marginLeft: 10,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
