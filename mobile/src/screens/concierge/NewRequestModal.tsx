import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { X, Send, CircleCheck, ArrowRight, ShieldAlert } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { api } from '../../config/api';
import { ClientAutocomplete, ClientDestinationItem } from '../../components/ClientAutocomplete';
import { VisitorFormSection, VisitorFormData } from '../../components/VisitorFormSection';

interface NewRequestModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (newReq?: any) => void;
}

export const NewRequestModal: React.FC<NewRequestModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<'form' | 'confirmation'>('form');
  const [selectedClient, setSelectedClient] = useState<ClientDestinationItem | null>(null);
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [visitorForm, setVisitorForm] = useState<VisitorFormData>({
    name: '',
    documentType: 'CPF',
    documentNumber: '',
    phone: '',
    company: '',
    visitorType: 'Visitante',
    visitReason: 'Visita',
    hasVehicle: false,
    vehicleModel: '',
    vehicleColor: '',
    vehiclePlate: '',
    notes: '',
  });

  const handleSelectClient = (client: ClientDestinationItem | null, destId: string) => {
    setSelectedClient(client);
    setSelectedDestinationId(destId);
  };

  const handleProceedToConfirmation = () => {
    if (!selectedClient || !selectedDestinationId) {
      Alert.alert('Atenção', 'Selecione o cliente e a unidade de destino.');
      return;
    }
    if (!visitorForm.name.trim()) {
      Alert.alert('Atenção', 'Informe o nome completo do visitante.');
      return;
    }
    if (visitorForm.hasVehicle && !visitorForm.vehicleModel.trim()) {
      Alert.alert('Atenção', 'Informe o modelo do veículo.');
      return;
    }

    setStep('confirmation');
  };

  const handleSubmitRequest = async () => {
    try {
      setIsSubmitting(true);

      // 1. Cadastra ou atualiza o visitante primeiro
      const visitorRes = await api.post('/visitors', {
        name: visitorForm.name,
        documentType: visitorForm.documentType,
        documentNumber: visitorForm.documentNumber || undefined,
        phone: visitorForm.phone || undefined,
        company: visitorForm.company || undefined,
        photoUrl: visitorForm.photoBase64,
        notes: visitorForm.notes || undefined,
        vehicle: visitorForm.hasVehicle
          ? {
              model: visitorForm.vehicleModel,
              color: visitorForm.vehicleColor || undefined,
              licensePlate: visitorForm.vehiclePlate || undefined,
            }
          : undefined,
      });

      const visitorId = visitorRes.data.data.visitor.id;
      const vehicleId = visitorRes.data.data.visitor.vehicles?.[0]?.id;

      // 2. Cria a solicitação de visita
      const requestRes = await api.post('/visit-requests', {
        clientId: selectedClient?.id,
        destinationId: selectedDestinationId,
        visitorId,
        vehicleId,
        visitorType: visitorForm.visitorType,
        visitReason: visitorForm.visitReason,
        notes: visitorForm.notes || undefined,
      });

      const createdReq = requestRes.data?.data?.visitRequest;

      // Reset form
      setStep('form');
      setSelectedClient(null);
      setSelectedDestinationId('');
      setVisitorForm({
        name: '',
        documentType: 'CPF',
        documentNumber: '',
        phone: '',
        company: '',
        visitorType: 'Visitante',
        visitReason: 'Visita',
        hasVehicle: false,
        vehicleModel: '',
        vehicleColor: '',
        vehiclePlate: '',
        notes: '',
      });

      onSuccess(createdReq);
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Falha ao registrar solicitação na portaria.';
      Alert.alert('Erro ao Enviar', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <StatusBar barStyle="light-content" backgroundColor="#165337" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalContainer}
      >
        {/* Modal Header Premium Verde Esmeralda */}
        <View style={styles.header}>
          <View style={styles.headerWaveDecoration} />
          <View style={styles.headerContentRow}>
            <View>
              <Text style={styles.headerSubtext}>
                {step === 'form' ? 'Portaria e Controle' : 'Revisão'}
              </Text>
              <Text style={styles.title}>
                {step === 'form' ? 'Nova Solicitação' : 'Confirmar Acesso'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
              <X size={20} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 'form' ? (
            <>
              {/* Seleção do Destino / Cliente */}
              <ClientAutocomplete
                onSelectClient={handleSelectClient}
                selectedClientId={selectedClient?.id}
              />

              {/* Dados do Visitante e Veículo */}
              <VisitorFormSection data={visitorForm} onChange={setVisitorForm} />

              {/* Botão de Avançar para Resumo */}
              <TouchableOpacity
                style={styles.advanceButton}
                onPress={handleProceedToConfirmation}
                activeOpacity={0.88}
              >
                <Text style={styles.advanceButtonText}>Avançar para Confirmação</Text>
                <ArrowRight size={20} color={colors.white} style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            </>
          ) : (
            /* TELA DE RESUMO E CONFIRMAÇÃO (Seção 15 da especificação) */
            <View style={styles.summaryContainer}>
              <View style={styles.summaryCard}>
                <Text style={styles.summarySectionTitle}>Destino da Visita</Text>
                <Text style={styles.summaryTextBold}>
                  {selectedClient?.destinations[0]?.destination.name || 'Unidade'}
                </Text>
                <Text style={styles.summaryText}>
                  Morador/Responsável: {selectedClient?.name}
                </Text>
                <Text style={styles.summaryTextMuted}>
                  WhatsApp: {selectedClient?.whatsappNumber}
                </Text>

                <View style={styles.divider} />

                <Text style={styles.summarySectionTitle}>Visitante</Text>
                <Text style={styles.summaryTextBold}>{visitorForm.name}</Text>
                {visitorForm.company ? (
                  <Text style={styles.summaryText}>Empresa: {visitorForm.company}</Text>
                ) : null}
                <Text style={styles.summaryText}>Tipo: {visitorForm.visitorType}</Text>
                <Text style={styles.summaryText}>Motivo: {visitorForm.visitReason}</Text>

                {visitorForm.hasVehicle ? (
                  <>
                    <View style={styles.divider} />
                    <Text style={styles.summarySectionTitle}>Veículo</Text>
                    <Text style={styles.summaryText}>
                      {visitorForm.vehicleModel} — {visitorForm.vehicleColor || 'Cor não informada'}
                    </Text>
                    <Text style={styles.summaryTextBold}>
                      Placa: {visitorForm.vehiclePlate || 'Sem placa'}
                    </Text>
                  </>
                ) : null}
              </View>

              {/* Botões de Ação Final */}
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.btnDisabled]}
                onPress={handleSubmitRequest}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Send size={20} color={colors.white} style={{ marginRight: 8 }} />
                    <Text style={styles.submitButtonText}>Confirmar e Enviar para WhatsApp</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setStep('form')}
                disabled={isSubmitting}
              >
                <Text style={styles.backButtonText}>Voltar e Corrigir Dados</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: '#165337',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 14 : 52,
    paddingBottom: 18,
    position: 'relative',
    overflow: 'hidden',
  },
  headerWaveDecoration: {
    position: 'absolute',
    top: -45,
    right: -35,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(180, 222, 196, 0.2)',
  },
  headerContentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  headerSubtext: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A7F3D0',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 18,
    paddingBottom: 32,
  },
  advanceButton: {
    backgroundColor: '#165337',
    borderRadius: 14,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 10,
    shadowColor: '#165337',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  advanceButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  summaryContainer: {
    paddingTop: 8,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  summarySectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryTextBold: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  summaryText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  summaryTextMuted: {
    fontSize: 12,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  submitButton: {
    backgroundColor: colors.statusAuthorized,
    borderRadius: 12,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.statusAuthorized,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  backButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
