import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  User,
  FileText,
  Phone,
  Briefcase,
  Car,
  Camera,
  MessageSquare,
  Trash2,
} from 'lucide-react-native';
import { colors } from '../theme/colors';

export interface VisitorFormData {
  name: string;
  documentType: 'CPF' | 'RG' | 'CNH' | 'OUTRO';
  documentNumber: string;
  phone: string;
  company: string;
  visitorType: string;
  visitReason: string;
  hasVehicle: boolean;
  vehicleModel: string;
  vehicleColor: string;
  vehiclePlate: string;
  photoBase64?: string;
  notes: string;
}

interface VisitorFormSectionProps {
  data: VisitorFormData;
  onChange: (data: VisitorFormData) => void;
}

export const VisitorFormSection: React.FC<VisitorFormSectionProps> = ({ data, onChange }) => {
  const updateField = (field: keyof VisitorFormData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const visitorTypes = [
    'Visitante',
    'Prestador de serviço',
    'Entregador',
    'Técnico',
    'Funcionário',
  ];

  const visitReasons = ['Visita', 'Serviço', 'Entrega', 'Manutenção', 'Reunião'];

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão da Câmera',
          'É necessário conceder permissão de acesso à câmera para fotografar o visitante.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          updateField('photoBase64', `data:image/jpeg;base64,${asset.base64}`);
        } else if (asset.uri) {
          updateField('photoBase64', asset.uri);
        }
      }
    } catch (err: any) {
      Alert.alert('Erro ao abrir câmera', err?.message || 'Falha ao acessar a câmera do dispositivo.');
    }
  };

  const handleChooseFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão da Galeria',
          'É necessário conceder permissão para selecionar uma foto da galeria.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          updateField('photoBase64', `data:image/jpeg;base64,${asset.base64}`);
        } else if (asset.uri) {
          updateField('photoBase64', asset.uri);
        }
      }
    } catch (err: any) {
      Alert.alert('Erro ao abrir galeria', err?.message || 'Falha ao acessar a galeria.');
    }
  };

  const promptPhotoOptions = () => {
    Alert.alert('Foto do Visitante', 'Escolha como deseja adicionar a foto:', [
      { text: 'Tirar Foto com a Câmera', onPress: handleTakePhoto },
      { text: 'Escolher da Galeria', onPress: handleChooseFromGallery },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* 1. DADOS DO VISITANTE */}
      <Text style={styles.sectionHeader}>1. Dados do Visitante</Text>

      {/* Nome Completo (Obrigatório) */}
      <Text style={styles.label}>
        Nome Completo <Text style={styles.required}>*</Text>
      </Text>
      <View style={styles.inputContainer}>
        <User size={18} color={colors.textSecondary} style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="Ex: Carlos Eduardo Santos"
          placeholderTextColor={colors.textMuted}
          value={data.name}
          onChangeText={(v) => updateField('name', v)}
        />
      </View>

      {/* Documento (CPF / RG) */}
      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.label}>Documento (Opcional)</Text>
          <View style={styles.inputContainer}>
            <FileText size={18} color={colors.textSecondary} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="000.000.000-00"
              placeholderTextColor={colors.textMuted}
              value={data.documentNumber}
              onChangeText={(v) => updateField('documentNumber', v)}
            />
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Telefone (Opcional)</Text>
          <View style={styles.inputContainer}>
            <Phone size={18} color={colors.textSecondary} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="(11) 99999-9999"
              placeholderTextColor={colors.textMuted}
              value={data.phone}
              onChangeText={(v) => updateField('phone', v)}
              keyboardType="phone-pad"
            />
          </View>
        </View>
      </View>

      {/* Empresa Representada (Opcional - Seção 9) */}
      <Text style={styles.label}>Empresa (Opcional)</Text>
      <View style={styles.inputContainer}>
        <Briefcase size={18} color={colors.textSecondary} style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="Ex: ABC Tecnologia / Mercado Livre"
          placeholderTextColor={colors.textMuted}
          value={data.company}
          onChangeText={(v) => updateField('company', v)}
        />
      </View>

      {/* Tipo de Visitante (Seção 10) */}
      <Text style={styles.label}>Tipo de Visitante</Text>
      <View style={styles.chipsRow}>
        {visitorTypes.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.chip, data.visitorType === type && styles.chipActive]}
            onPress={() => updateField('visitorType', type)}
          >
            <Text style={[styles.chipText, data.visitorType === type && styles.chipTextActive]}>
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Motivo da Visita (Obrigatório - Seção 11) */}
      <Text style={styles.label}>
        Motivo da Visita <Text style={styles.required}>*</Text>
      </Text>
      <View style={styles.chipsRow}>
        {visitReasons.map((reason) => (
          <TouchableOpacity
            key={reason}
            style={[styles.chip, data.visitReason === reason && styles.chipActive]}
            onPress={() => updateField('visitReason', reason)}
          >
            <Text style={[styles.chipText, data.visitReason === reason && styles.chipTextActive]}>
              {reason}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 2. SEÇÃO VEÍCULO (Seção 12) */}
      <View style={styles.vehicleHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Car size={20} color="#165337" style={{ marginRight: 8 }} />
          <Text style={styles.sectionHeaderVehicle}>Possui Veículo?</Text>
        </View>
        <Switch
          value={data.hasVehicle}
          onValueChange={(v) => updateField('hasVehicle', v)}
          trackColor={{ false: '#CBD5E1', true: '#165337' }}
          thumbColor={data.hasVehicle ? '#FFFFFF' : '#64748B'}
          ios_backgroundColor="#CBD5E1"
        />
      </View>

      {data.hasVehicle && (
        <View style={styles.vehicleCard}>
          <Text style={styles.label}>
            Modelo do Veículo <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Ex: Honda Civic, Fiat Uno"
              placeholderTextColor={colors.textMuted}
              value={data.vehicleModel}
              onChangeText={(v) => updateField('vehicleModel', v)}
            />
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Cor</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Prata"
                  placeholderTextColor={colors.textMuted}
                  value={data.vehicleColor}
                  onChangeText={(v) => updateField('vehicleColor', v)}
                />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Placa</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="ABC1D23"
                  placeholderTextColor={colors.textMuted}
                  value={data.vehiclePlate}
                  onChangeText={(v) => updateField('vehiclePlate', v.toUpperCase())}
                  autoCapitalize="characters"
                />
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 3. FOTO DO VISITANTE (Seção 14) */}
      <Text style={styles.sectionHeader}>Foto do Visitante (Opcional)</Text>
      <View style={styles.photoContainer}>
        {data.photoBase64 ? (
          <View style={styles.photoPreviewWrapper}>
            <Image
              source={{
                uri: data.photoBase64.startsWith('data:') || data.photoBase64.startsWith('file:') || data.photoBase64.startsWith('http')
                  ? data.photoBase64
                  : `data:image/jpeg;base64,${data.photoBase64}`,
              }}
              style={styles.photoPreview}
            />
            <TouchableOpacity
              style={styles.removePhotoButton}
              onPress={() => updateField('photoBase64', undefined)}
              activeOpacity={0.8}
            >
              <Trash2 size={16} color={colors.white} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.captureButton}
            onPress={promptPhotoOptions}
            activeOpacity={0.8}
          >
            <Camera size={26} color="#165337" style={{ marginBottom: 6 }} />
            <Text style={styles.captureText}>Fotografar Visitante</Text>
            <Text style={styles.captureSubtext}>Tirar foto ou escolher da galeria</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 4. OBSERVAÇÕES (Seção 13) */}
      <Text style={styles.label}>Observações (Opcional)</Text>
      <View style={[styles.inputContainer, { height: 72 }]}>
        <MessageSquare size={18} color={colors.textSecondary} style={[styles.icon, { alignSelf: 'flex-start', marginTop: 12 }]} />
        <TextInput
          style={[styles.input, { height: '100%', textAlignVertical: 'top', paddingTop: 8 }]}
          placeholder="Ex: Acompanhado de mais 2 pessoas, entregando pacote"
          placeholderTextColor={colors.textMuted}
          value={data.notes}
          onChangeText={(v) => updateField('notes', v)}
          multiline
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    marginVertical: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  required: {
    color: colors.statusDenied,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 12,
    height: 48,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    backgroundColor: colors.surface,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: '#EDF7ED',
    borderColor: '#165337',
  },
  chipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#165337',
    fontWeight: '700',
  },
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeaderVehicle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  vehicleCard: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  photoContainer: {
    marginVertical: 8,
  },
  captureButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureText: {
    fontSize: 14,
    color: '#165337',
    fontWeight: '700',
  },
  captureSubtext: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  photoPreviewWrapper: {
    position: 'relative',
    alignSelf: 'center',
  },
  photoPreview: {
    width: 140,
    height: 140,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#165337',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.statusDenied,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
