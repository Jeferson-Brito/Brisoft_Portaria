import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import {
  QrCode,
  Phone,
  Wifi,
  WifiOff,
  RefreshCw,
  Send,
  CircleCheck,
  CircleX,
  MessageSquare,
  HelpCircle,
  Power,
  ArrowLeft,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { api } from '../../config/api';
import { AppHeader } from '../../components/AppHeader';

interface WhatsAppStatusData {
  status: 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'CONNECTED';
  phoneConnected?: string;
  qrCode?: string;
  lastConnectedAt?: string;
}

interface PendingRequestOption {
  id: string;
  code: string;
  visitorName: string;
  clientName: string;
  clientPhone: string;
  destinationName: string;
}

interface WhatsAppConfigScreenProps {
  onBack?: () => void;
}

export const WhatsAppConfigScreen: React.FC<WhatsAppConfigScreenProps> = ({ onBack }) => {
  const [statusData, setStatusData] = useState<WhatsAppStatusData>({
    status: 'DISCONNECTED',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingRequestOption[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<PendingRequestOption | null>(null);
  const [customReply, setCustomReply] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);

  // Busca status do WhatsApp
  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/whatsapp/status');
      if (res.data.success) {
        setStatusData(res.data.data);
      }
    } catch (err: any) {
      console.warn('Erro ao carregar status do WhatsApp:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Busca solicitações pendentes para o simulador
  const fetchPendingRequests = async () => {
    try {
      const res = await api.get('/visit-requests/pending?limit=5');
      if (res.data.success) {
        const mapped = (res.data.data.items || []).map((item: any) => ({
          id: item.id,
          code: item.code,
          visitorName: item.visitor.name,
          clientName: item.client.name,
          clientPhone: item.client.whatsappNumber,
          destinationName: item.destination.name,
        }));
        setPendingRequests(mapped);
        if (mapped.length > 0 && !selectedRequest) {
          setSelectedRequest(mapped[0]);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar pendências para simulador:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchPendingRequests();

    // Polling regular se estiver aguardando QR Code ou conectando
    const interval = setInterval(() => {
      fetchStatus();
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Iniciar conexão e gerar QR Code
  const handleConnect = async () => {
    try {
      setIsActionLoading(true);
      const res = await api.post('/whatsapp/connect');
      if (res.data.success) {
        setStatusData(res.data.data);
      }
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error?.message || 'Falha ao iniciar conexão');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Desconectar sessão
  const handleDisconnect = async () => {
    Alert.alert(
      'Desconectar WhatsApp',
      'Tem certeza de que deseja encerrar a sessão do WhatsApp da portaria?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsActionLoading(true);
              await api.post('/whatsapp/disconnect');
              await fetchStatus();
            } catch (err: any) {
              Alert.alert('Erro', err.response?.data?.error?.message || 'Falha ao desconectar');
            } finally {
              setIsActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // Disparar simulação de resposta do morador
  const handleSimulateResponse = async (textToSend: string) => {
    if (!selectedRequest) {
      Alert.alert('Atenção', 'Selecione uma solicitação pendente para simular');
      return;
    }

    try {
      setIsSimulating(true);
      const res = await api.post('/whatsapp/simulate-incoming', {
        fromPhone: selectedRequest.clientPhone,
        text: textToSend,
      });

      if (res.data.success) {
        Alert.alert(
          'Sucesso!',
          `Simulação executada!\nMorador: ${selectedRequest.clientName}\nResposta: "${textToSend}"`
        );
        setCustomReply('');
        fetchPendingRequests();
      }
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error?.message || 'Falha ao simular resposta');
    } finally {
      setIsSimulating(false);
    }
  };

  const renderStatusBadge = () => {
    switch (statusData.status) {
      case 'CONNECTED':
        return (
          <View style={[styles.badgeContainer, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
            <Wifi size={16} color={colors.statusAuthorized} />
            <Text style={[styles.badgeText, { color: colors.statusAuthorized }]}>
              CONECTADO
            </Text>
          </View>
        );
      case 'QR_READY':
        return (
          <View style={[styles.badgeContainer, { backgroundColor: 'rgba(234, 179, 8, 0.15)' }]}>
            <QrCode size={16} color={colors.statusPending} />
            <Text style={[styles.badgeText, { color: colors.statusPending }]}>
              AGUARDANDO LEITURA DO QR CODE
            </Text>
          </View>
        );
      case 'CONNECTING':
        return (
          <View style={[styles.badgeContainer, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
            <ActivityIndicator size="small" color={colors.primaryLight} style={{ marginRight: 6 }} />
            <Text style={[styles.badgeText, { color: colors.primaryLight }]}>
              CONECTANDO...
            </Text>
          </View>
        );
      default:
        return (
          <View style={[styles.badgeContainer, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
            <WifiOff size={16} color={colors.statusDenied} />
            <Text style={[styles.badgeText, { color: colors.statusDenied }]}>
              DESCONECTADO
            </Text>
          </View>
        );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <AppHeader
        title="Conexão WhatsApp"
        subtitle="Aparelhos conectados, QR Code ao vivo e status"
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Card de Status da Conexão */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Phone size={20} color={colors.primaryLight} style={{ marginRight: 8 }} />
            <Text style={styles.cardTitle}>Conexão WhatsApp</Text>
          </View>
          <TouchableOpacity onPress={fetchStatus} disabled={isLoading} style={styles.iconButton}>
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <RefreshCw size={18} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.statusRow}>{renderStatusBadge()}</View>

        {statusData.status === 'CONNECTED' && (
          <View style={styles.connectedInfoBox}>
            <Text style={styles.connectedPhoneLabel}>Número Conectado:</Text>
            <Text style={styles.connectedPhoneValue}>
              +{statusData.phoneConnected || '55...'}
            </Text>
            <Text style={styles.connectedSubtext}>
              Pronto para despachar solicitações de entrada e receber respostas dos moradores.
            </Text>

            <TouchableOpacity
              style={styles.disconnectButton}
              onPress={handleDisconnect}
              disabled={isActionLoading}
            >
              <Power size={18} color={colors.statusDenied} style={{ marginRight: 8 }} />
              <Text style={styles.disconnectButtonText}>Desconectar Sessão</Text>
            </TouchableOpacity>
          </View>
        )}

        {statusData.status === 'QR_READY' && statusData.qrCode && (
          <View style={styles.qrContainer}>
            <Text style={styles.qrInstruction}>
              Abra o WhatsApp no aparelho da portaria → Configurações → Aparelhos Conectados → Conectar um Aparelho
            </Text>
            <View style={styles.qrWrapper}>
              <Image
                source={{ uri: statusData.qrCode }}
                style={styles.qrImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.qrAutoRefreshNotice}>
              O QR Code se atualiza automaticamente em tempo real.
            </Text>
          </View>
        )}

        {statusData.status === 'DISCONNECTED' && (
          <View style={styles.disconnectedBox}>
            <Text style={styles.disconnectedText}>
              O serviço de WhatsApp não está ativo nesta portaria. Clique abaixo para iniciar a conexão e ler o QR Code.
            </Text>
            <TouchableOpacity
              style={styles.connectButton}
              onPress={handleConnect}
              disabled={isActionLoading}
            >
              {isActionLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <QrCode size={20} color={colors.white} style={{ marginRight: 8 }} />
                  <Text style={styles.connectButtonText}>Gerar QR Code de Conexão</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Botão para alternar ferramentas de teste/simulador */}
      <TouchableOpacity
        style={{
          marginTop: 18,
          paddingVertical: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceElevated,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
        }}
        onPress={() => setShowSimulator(!showSimulator)}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
          {showSimulator ? '▲ Ocultar Ferramentas de Teste' : '▼ Ferramentas Avançadas de Teste'}
        </Text>
      </TouchableOpacity>

      {/* Simulador de Respostas do Morador (Opcional para testes) */}
      {showSimulator && (
        <View style={[styles.card, { marginTop: 12 }]}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MessageSquare size={20} color={colors.primaryLight} style={{ marginRight: 8 }} />
              <Text style={styles.cardTitle}>Simulador de Resposta do Morador</Text>
            </View>
            <TouchableOpacity onPress={fetchPendingRequests} style={styles.iconButton}>
              <RefreshCw size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

        <Text style={styles.simulatorDescription}>
          Utilize esta ferramenta para testar o fluxo de autorização sem precisar de um WhatsApp conectado no modo local.
        </Text>

        {pendingRequests.length === 0 ? (
          <View style={styles.emptyPendingBox}>
            <HelpCircle size={24} color={colors.textSecondary} style={{ marginBottom: 6 }} />
            <Text style={styles.emptyPendingText}>
              Nenhuma solicitação pendente no momento. Registre um visitante na aba "Visão Geral" para testar a resposta do morador.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.inputLabel}>1. Selecione a Solicitação Pendente:</Text>
            <View style={styles.requestOptionsContainer}>
              {pendingRequests.map((req) => {
                const isSelected = selectedRequest?.id === req.id;
                return (
                  <TouchableOpacity
                    key={req.id}
                    style={[
                      styles.requestOptionCard,
                      isSelected && styles.requestOptionCardSelected,
                    ]}
                    onPress={() => setSelectedRequest(req)}
                  >
                    <View style={styles.requestOptionHeader}>
                      <Text style={styles.requestOptionCode}>{req.code}</Text>
                      <Text style={styles.requestOptionDest}>{req.destinationName}</Text>
                    </View>
                    <Text style={styles.requestOptionVisitor}>
                      Visitante: <Text style={{ color: colors.white }}>{req.visitorName}</Text>
                    </Text>
                    <Text style={styles.requestOptionClient}>
                      Morador: {req.clientName} ({req.clientPhone})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>
              2. Simule a Ação que o Morador Enviaria:
            </Text>

            <View style={styles.simulationButtonsRow}>
              {/* Botão 1 - Autorizar */}
              <TouchableOpacity
                style={[styles.simButton, styles.simButtonAuthorize]}
                onPress={() => handleSimulateResponse('1')}
                disabled={isSimulating}
              >
                <CircleCheck size={18} color={colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.simButtonText}>Enviar "1" (Autorizar)</Text>
              </TouchableOpacity>

              {/* Botão 2 - Recusar */}
              <TouchableOpacity
                style={[styles.simButton, styles.simButtonDeny]}
                onPress={() => handleSimulateResponse('2')}
                disabled={isSimulating}
              >
                <CircleX size={18} color={colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.simButtonText}>Enviar "2" (Recusar)</Text>
              </TouchableOpacity>
            </View>

            {/* Resposta personalizada */}
            <View style={styles.customReplyContainer}>
              <TextInput
                style={styles.customReplyInput}
                placeholder="Ou digite: 'SIM', 'NAO', 'Liberado'..."
                placeholderTextColor={colors.textSecondary}
                value={customReply}
                onChangeText={setCustomReply}
              />
              <TouchableOpacity
                style={styles.customReplyButton}
                onPress={() => handleSimulateResponse(customReply)}
                disabled={isSimulating || !customReply.trim()}
              >
                <Send size={18} color={colors.white} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
      )}
    </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  iconButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: colors.surfaceElevated,
  },
  statusRow: {
    marginBottom: 14,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  connectedInfoBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: colors.statusAuthorized,
  },
  connectedPhoneLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  connectedPhoneValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  connectedSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  disconnectButtonText: {
    color: colors.statusDenied,
    fontWeight: '700',
    fontSize: 13,
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  qrInstruction: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 10,
    lineHeight: 18,
  },
  qrWrapper: {
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  qrImage: {
    width: 220,
    height: 220,
  },
  qrAutoRefreshNotice: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 12,
  },
  disconnectedBox: {
    paddingVertical: 10,
  },
  disconnectedText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  connectButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  connectButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  simulatorDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  emptyPendingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    paddingHorizontal: 16,
  },
  emptyPendingText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  requestOptionsContainer: {
    gap: 8,
    marginBottom: 8,
  },
  requestOptionCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  requestOptionCardSelected: {
    borderColor: colors.primaryLight,
    backgroundColor: 'rgba(30, 64, 175, 0.15)',
  },
  requestOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  requestOptionCode: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryLight,
  },
  requestOptionDest: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  requestOptionVisitor: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  requestOptionClient: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  simulationButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  simButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  simButtonAuthorize: {
    backgroundColor: colors.statusAuthorized,
  },
  simButtonDeny: {
    backgroundColor: colors.statusDenied,
  },
  simButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 12,
  },
  customReplyContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  customReplyInput: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.border,
  },
  customReplyButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
