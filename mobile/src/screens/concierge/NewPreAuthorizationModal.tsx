import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { X, Calendar, Clock, CircleCheck, UserCheck, ShieldCheck } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { usePlaceTerms } from '../../utils/placeTerms';
import { ClientAutocomplete, ClientDestinationItem } from '../../components/ClientAutocomplete';
import { api } from '../../config/api';

interface NewPreAuthorizationModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const NewPreAuthorizationModal: React.FC<NewPreAuthorizationModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const terms = usePlaceTerms();
  const [selectedClient, setSelectedClient] = useState<ClientDestinationItem | null>(null);
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>('');
  const [visitorName, setVisitorName] = useState('');
  const [visitorDocument, setVisitorDocument] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [visitorType, setVisitorType] = useState('Prestador de Serviço');
  const [expectedTimeStart, setExpectedTimeStart] = useState('08:00');
  const [expectedTimeEnd, setExpectedTimeEnd] = useState('18:00');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const resetForm = () => {
    setSelectedClient(null);
    setSelectedDestinationId('');
    setVisitorName('');
    setVisitorDocument('');
    setCompany('');
    setPhone('');
    setVisitorType('Prestador de Serviço');
    setExpectedTimeStart('08:00');
    setExpectedTimeEnd('18:00');
    setNotes('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedClient || !selectedDestinationId) {
      Alert.alert('Atenção', `Selecione o ${terms.client.toLowerCase()} e a ${terms.unit.toLowerCase()} de destino.`);
      return;
    }

    if (!visitorName.trim()) {
      Alert.alert('Atenção', 'Informe o nome do visitante ou prestador.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    try {
      setIsLoading(true);
      const res = await api.post('/pre-authorizations', {
        clientId: selectedClient.id,
        destinationId: selectedDestinationId,
        visitorName: visitorName.trim(),
        visitorDocument: visitorDocument.trim() || undefined,
        company: company.trim() || undefined,
        phone: phone.trim() || undefined,
        visitorType,
        startDate: todayStr,
        endDate: todayStr,
        expectedTimeStart,
        expectedTimeEnd,
        notes: notes.trim() || undefined,
      });

      if (res.data.success) {
        Alert.alert(
          'Pré-Autorização Cadastrada! ✅',
          `O visitante ${visitorName} está pré-autorizado para a unidade selecionada.\nQuando chegar, a entrada poderá ser liberada imediatamente sem aguardar resposta no WhatsApp.`
        );
        resetForm();
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error?.message || 'Falha ao salvar pré-autorização.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ShieldCheck size={22} color={colors.statusPending} style={{ marginRight: 8 }} />
              <Text style={styles.modalTitle}>Nova Pré-Autorização</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Aviso Explicativo */}
            <View style={styles.infoBox}>
              <UserCheck size={20} color={colors.statusPending} style={{ marginRight: 10 }} />
              <Text style={styles.infoBoxText}>
                Cadastre aqui visitas previamente comunicadas pelo {terms.client.toLowerCase()}. Ao chegarem na portaria, a liberação será instantânea.
              </Text>
            </View>

            {/* 1. Selecionar Morador / Destino */}
            <Text style={styles.sectionLabel}>1. DESTINO *</Text>
            <ClientAutocomplete
              showLabel={false}
              onSelectClient={(client, destId) => {
                setSelectedClient(client);
                setSelectedDestinationId(destId);
              }}
              selectedClientId={selectedClient?.id}
            />

            {/* 2. Dados do Visitante */}
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>2. DADOS DO VISITANTE *</Text>

            <Text style={styles.inputLabel}>Nome Completo *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Carlos Eduardo da Silva"
              placeholderTextColor={colors.textSecondary}
              value={visitorName}
              onChangeText={setVisitorName}
            />

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputLabel}>Empresa / Prestador</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: ABC Climatização"
                  placeholderTextColor={colors.textSecondary}
                  value={company}
                  onChangeText={setCompany}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Documento (Opcional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="CPF / RG"
                  placeholderTextColor={colors.textSecondary}
                  value={visitorDocument}
                  onChangeText={setVisitorDocument}
                />
              </View>
            </View>

            {/* Tipo de Visita */}
            <Text style={styles.inputLabel}>Tipo de Acesso</Text>
            <View style={styles.typeButtonsRow}>
              {['Prestador de Serviço', 'Visitante', 'Entregador'].map((type) => {
                const isSelected = visitorType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeButton, isSelected && styles.typeButtonSelected]}
                    onPress={() => setVisitorType(type)}
                  >
                    <Text style={[styles.typeButtonText, isSelected && styles.typeButtonTextSelected]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 3. Horário Previsto */}
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>3. HORÁRIO PREVISTO HOJE</Text>
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputLabel}>Início Previsto</Text>
                <View style={styles.timeInputBox}>
                  <Clock size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
                  <TextInput
                    style={styles.timeInput}
                    placeholder="08:00"
                    placeholderTextColor={colors.textSecondary}
                    value={expectedTimeStart}
                    onChangeText={setExpectedTimeStart}
                  />
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Término Previsto</Text>
                <View style={styles.timeInputBox}>
                  <Clock size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
                  <TextInput
                    style={styles.timeInput}
                    placeholder="18:00"
                    placeholderTextColor={colors.textSecondary}
                    value={expectedTimeEnd}
                    onChangeText={setExpectedTimeEnd}
                  />
                </View>
              </View>
            </View>

            {/* Observações */}
            <Text style={[styles.inputLabel, { marginTop: 12 }]}>Observações / Motivo</Text>
            <TextInput
              style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
              placeholder="Ex: Manutenção agendada da geladeira ou visita de familiares..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
            />

            {/* Botão de Envio */}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <CircleCheck size={20} color={colors.white} style={{ marginRight: 8 }} />
                  <Text style={styles.submitButtonText}>SALVAR PRÉ-AUTORIZAÇÃO</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
  },
  scrollContent: {
    padding: 20,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.statusPending,
    marginBottom: 16,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryLight,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
  },
  timeInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    padding: 0,
  },
  typeButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
  },
  typeButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  typeButtonTextSelected: {
    color: colors.white,
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.5,
  },
});
