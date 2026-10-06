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
  Power,
  Bell,
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

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function displayPhone(value?: string | null) {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
  return maskPhone(local);
}

export const WhatsAppConfigScreen: React.FC<WhatsAppConfigScreenProps> = ({ onBack }) => {
  const terms = usePlaceTerms();
  const { user } = useAuth();
  const { addListener } = useRealtime();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [statusData, setStatusData] = useState<WhatsAppStatusData>({
    status: 'DISCONNECTED',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [adminPhone, setAdminPhone] = useState('');
  const [adminEnabled, setAdminEnabled] = useState(true);
  const [adminActive, setAdminActive] = useState(false);
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);

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

  const fetchAdminNotifications = async () => {
    if (!isSuperAdmin) return;
    try {
      const res = await api.get('/super-admin/admin-notifications');
      if (res.data.success) {
        setAdminPhone(displayPhone(res.data.data.phone));
        setAdminEnabled(res.data.data.enabled !== false);
        setAdminActive(Boolean(res.data.data.active));
      }
    } catch (err: any) {
      console.warn('Erro ao carregar notificações administrativas:', err.message);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchAdminNotifications();
    return addListener('whatsapp:status', () => fetchStatus());
  }, [addListener, isSuperAdmin]);

  const isPairing = statusData.status === 'CONNECTING' || statusData.status === 'QR_READY';
  useEffect(() => {
    if (!isPairing) return;
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, [isPairing]);

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

  const handleDisconnect = async () => {
    Alert.alert(
      'Desconectar WhatsApp',
      isSuperAdmin
        ? 'Tem certeza de que deseja encerrar a sessão do WhatsApp da plataforma?'
        : 'Tem certeza de que deseja encerrar a sessão do WhatsApp da portaria?',
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

  const handleSaveAdminNotifications = async () => {
    const digits = adminPhone.replace(/\D/g, '');
    if (adminEnabled && digits.length > 0 && digits.length < 10) {
      Alert.alert('Número inválido', 'Informe o DDD e o número completo do WhatsApp.');
      return;
    }
    try {
      setIsSavingAdmin(true);
      const res = await api.put('/super-admin/admin-notifications', {
        phone: digits.length ? adminPhone : null,
        enabled: adminEnabled,
        clearPhone: !digits.length,
      });
      if (res.data.success) {
        setAdminPhone(displayPhone(res.data.data.phone));
        setAdminEnabled(res.data.data.enabled !== false);
        setAdminActive(Boolean(res.data.data.active));
        Alert.alert('Salvo', 'Configuração de notificações administrativas atualizada.');
      }
    } catch (err: any) {
      const status = err.response?.status;
      const apiMessage = err.response?.data?.error?.message;
      Alert.alert(
        'Erro',
        apiMessage ||
          (status === 404
            ? 'A API ainda não tem essa configuração publicada. Aguarde o deploy ou use o servidor local.'
            : status === 401
              ? 'Sessão expirada. Faça login novamente e tente salvar.'
              : !err.response
                ? 'Sem conexão com a API. Verifique se o servidor local está no ar.'
                : 'Não foi possível salvar.')
      );
    } finally {
      setIsSavingAdmin(false);
    }
  };

  const renderStatusBadge = () => {
    switch (statusData.status) {
      case 'CONNECTED':
        return (
          <View style={[styles.badgeContainer, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
            <Wifi size={16} color={colors.statusAuthorized} />
            <Text style={[styles.badgeText, { color: colors.statusAuthorized }]}>CONECTADO</Text>
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
            <Text style={[styles.badgeText, { color: colors.primaryLight }]}>CONECTANDO...</Text>
          </View>
        );
      default:
        return (
          <View style={[styles.badgeContainer, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
            <WifiOff size={16} color={colors.statusDenied} />
            <Text style={[styles.badgeText, { color: colors.statusDenied }]}>DESCONECTADO</Text>
          </View>
        );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <AppHeader
        title={isSuperAdmin ? 'WhatsApp da plataforma' : 'Conexão WhatsApp'}
        subtitle={
          isSuperAdmin
            ? 'Bot do sistema, códigos e notificações administrativas'
            : 'Aparelhos conectados, QR Code ao vivo e status'
        }
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.container}>
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
              <Text style={styles.connectedPhoneLabel}>
                {isSuperAdmin ? 'Número utilizado pelo bot:' : 'Número Conectado:'}
              </Text>
              <Text style={styles.connectedPhoneValue}>+{statusData.phoneConnected || '55...'}</Text>
              <Text style={styles.connectedSubtext}>
                {isSuperAdmin
                  ? 'Pronto para enviar códigos e notificações administrativas da plataforma.'
                  : `Pronto para despachar solicitações de entrada e receber respostas dos ${terms.clients.toLowerCase()}.`}
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
                Abra o WhatsApp no aparelho → Configurações → Aparelhos Conectados → Conectar um Aparelho
              </Text>
              <View style={styles.qrWrapper}>
                <Image source={{ uri: statusData.qrCode }} style={styles.qrImage} resizeMode="contain" />
              </View>
              <Text style={styles.qrAutoRefreshNotice}>
                O QR Code se atualiza automaticamente em tempo real.
              </Text>
            </View>
          )}

          {statusData.status === 'DISCONNECTED' && (
            <View style={styles.disconnectedBox}>
              <Text style={styles.disconnectedText}>
                {isSuperAdmin
                  ? 'O WhatsApp da plataforma não está ativo. Gere o QR Code para conectar o bot.'
                  : 'O serviço de WhatsApp não está ativo nesta portaria. Clique abaixo para iniciar a conexão e ler o QR Code.'}
              </Text>
              <TouchableOpacity style={styles.connectButton} onPress={handleConnect} disabled={isActionLoading}>
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

        {isSuperAdmin ? (
          <View style={[styles.card, { marginTop: 14 }]}>
            <View style={styles.cardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Bell size={20} color={colors.primaryLight} style={{ marginRight: 8 }} />
                <Text style={styles.cardTitle}>Notificações administrativas</Text>
              </View>
            </View>

            <Text style={styles.helperText}>
              Esse número recebe avisos automáticos do bot da plataforma sobre novas empresas, novos usuários,
              fim de teste e assinaturas pendentes.
            </Text>

            <View
              style={[
                styles.adminStatusBox,
                adminActive ? styles.adminStatusActive : styles.adminStatusInactive,
              ]}
            >
              <Text style={styles.adminStatusText}>
                {adminActive
                  ? '🟢 Notificações administrativas ativas'
                  : '⚪ Notificações administrativas desativadas'}
              </Text>
            </View>

            <Text style={styles.fieldLabel}>Número para receber notificações</Text>
            <View style={styles.inputBox}>
              <Phone size={18} color="#64748B" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                placeholder="(83) 99999-9999"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={adminPhone}
                onChangeText={(value) => setAdminPhone(maskPhone(value))}
              />
            </View>

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setAdminEnabled((current) => !current)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, adminEnabled && styles.checkboxActive]}>
                {adminEnabled ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <Text style={styles.checkText}>Receber notificações administrativas</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.connectButton, isSavingAdmin && { opacity: 0.7 }]}
              onPress={handleSaveAdminNotifications}
              disabled={isSavingAdmin}
            >
              {isSavingAdmin ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.connectButtonText}>Salvar configurações</Text>
              )}
            </TouchableOpacity>

            {adminPhone ? (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => {
                  setAdminPhone('');
                  setAdminEnabled(false);
                }}
              >
                <Text style={styles.clearBtnText}>Remover número</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
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
  helperText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
  },
  adminStatusBox: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  adminStatusActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  adminStatusInactive: {
    backgroundColor: '#F1F5F9',
  },
  adminStatusText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 48,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#FFFFFF',
  },
  checkboxActive: {
    backgroundColor: '#165337',
    borderColor: '#165337',
  },
  checkboxMark: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  checkText: {
    flex: 1,
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  clearBtn: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  clearBtnText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 13,
  },
});
