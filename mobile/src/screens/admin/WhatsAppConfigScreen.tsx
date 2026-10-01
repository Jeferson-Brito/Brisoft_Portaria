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
} from 'react-native';
import {
  QrCode,
  Phone,
  Wifi,
  WifiOff,
  RefreshCw,
  Power,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { usePlaceTerms } from '../../utils/placeTerms';
import { api } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtime } from '../../contexts/RealtimeContext';
import { AppHeader } from '../../components/AppHeader';

interface WhatsAppStatusData {
  status: 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'CONNECTED';
  phoneConnected?: string;
  qrCode?: string;
  lastConnectedAt?: string;
}

interface WhatsAppConfigScreenProps {
  onBack?: () => void;
}

export const WhatsAppConfigScreen: React.FC<WhatsAppConfigScreenProps> = ({ onBack }) => {
  const terms = usePlaceTerms();
  const { user } = useAuth();
  const { addListener } = useRealtime();
  const [statusData, setStatusData] = useState<WhatsAppStatusData>({
    status: 'DISCONNECTED',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

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

  useEffect(() => {
    fetchStatus();
    return addListener('whatsapp:status', () => fetchStatus());
  }, [addListener]);

  const isPairing = statusData.status === 'CONNECTING' || statusData.status === 'QR_READY';
  useEffect(() => {
    if (!isPairing) return;
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, [isPairing]);

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
        title={user?.role === 'SUPER_ADMIN' ? 'WhatsApp da plataforma' : 'Conexão WhatsApp'}
        subtitle={user?.role === 'SUPER_ADMIN' ? 'Leia o QR Code para o bot enviar os códigos' : 'Aparelhos conectados, QR Code ao vivo e status'}
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
              Pronto para despachar solicitações de entrada e receber respostas dos {terms.clients.toLowerCase()}.
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
});
