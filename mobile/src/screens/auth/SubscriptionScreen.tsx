import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import {
  Check,
  CreditCard,
  MessageCircle,
  RefreshCw,
  Building2,
  Smartphone,
  Users,
  Package,
  BarChart3,
  Bell,
} from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../config/api';
import { colors } from '../../theme/colors';
import { AppHeader } from '../../components/AppHeader';

const FALLBACK_PAYMENT_LINK = 'https://buy.stripe.com/4gM3coh0P3IWdi6dGfg7e00';
const SUPPORT_WHATSAPP = 'https://wa.me/5583981131352?text=Quero+assinar+o+Brisoft+Portaria';

const FEATURES = [
  { icon: Building2, title: 'Unidades do local', desc: 'Blocos, apartamentos e destinos da portaria' },
  { icon: Smartphone, title: 'Autorização por WhatsApp', desc: 'O morador aprova ou recusa pelo celular' },
  { icon: Users, title: 'Até 15 usuários', desc: 'Porteiros, supervisores e administrador' },
  { icon: Package, title: 'Encomendas', desc: 'Código de retirada para cada pacote' },
  { icon: BarChart3, title: 'Relatórios', desc: 'Histórico dos acessos da empresa' },
  { icon: Bell, title: 'Avisos na portaria', desc: 'Alerta quando o morador responde' },
];

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('pt-BR');
}

export const SubscriptionScreen: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { user, refreshSubscription } = useAuth();
  const sub = user?.subscription;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOpeningPayment, setIsOpeningPayment] = useState(false);
  const [history, setHistory] = useState<Array<{ id: string; paidAt: string; periodEnd: string; source: string; label: string; amount: number }>>([]);

  const isActive = sub?.status === 'ACTIVE';
  const isTrialActive = sub?.status === 'TRIAL' && (sub?.daysRemaining ?? 0) > 0;
  const isLate = sub?.status === 'LATE';
  const paymentDue = !isActive && !isTrialActive;

  const isSuspended = sub?.status === 'SUSPENDED';
  const isCancelled = sub?.status === 'CANCELLED';

  const statusLabel = isActive
    ? 'Plano ativo'
    : isTrialActive
    ? 'Teste grátis'
    : isLate
    ? 'Em atraso'
    : isSuspended
    ? 'Suspensa'
    : isCancelled
    ? 'Cancelada'
    : 'Teste encerrado';

  const statusHint = isActive
    ? sub?.currentPeriodEnd
      ? sub?.daysRemaining === 1
        ? `Vence amanhã (${formatDate(sub.currentPeriodEnd)}). Renove para liberar mais 30 dias.`
        : `Válido até ${formatDate(sub.currentPeriodEnd)}`
      : 'Pagamento confirmado'
    : isTrialActive
    ? `Restam ${sub?.daysRemaining ?? 0} dias — antecipe o pagamento para não perder o acesso`
    : isLate
    ? `Venceu. Você tem ${sub?.daysRemaining ?? 0} dia(s) de carência antes da suspensão`
    : isSuspended
    ? 'Acesso suspenso após 2 dias sem pagamento. Regularize para reativar'
    : 'A portaria fica bloqueada para novas ações até o pagamento';

  const companyName = user?.organizationName || 'Sua empresa';

  useEffect(() => {
    api.get('/subscriptions/current')
      .then((response) => {
        const list = response.data?.data?.paymentHistory;
        setHistory(Array.isArray(list) ? list : []);
      })
      .catch(() => setHistory([]));
  }, [sub?.status, sub?.currentPeriodEnd]);

  const openExternal = async (url: string) => {
    await Linking.openURL(url);
  };

  const handleSubscribe = async () => {
    try {
      setIsOpeningPayment(true);
      const response = await api.get('/subscriptions/payment-link');
      const url = response.data?.paymentUrl || FALLBACK_PAYMENT_LINK;
      await openExternal(url);
    } catch {
      const params = [];
      if (user?.organizationId) params.push(`client_reference_id=${user.organizationId}`);
      if (user?.email) params.push(`prefilled_email=${encodeURIComponent(user.email)}`);
      const url = params.length ? `${FALLBACK_PAYMENT_LINK}?${params.join('&')}` : FALLBACK_PAYMENT_LINK;
      try {
        await openExternal(url);
      } catch {
        Alert.alert('Erro', 'Não foi possível abrir o pagamento.');
      }
    } finally {
      setIsOpeningPayment(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      const response = await api.get('/subscriptions/current');
      const info = response.data?.data;
      setHistory(Array.isArray(info?.paymentHistory) ? info.paymentHistory : []);
      await refreshSubscription();
      if (info?.status === 'ACTIVE' && info?.isBlocked !== true) {
        Alert.alert('Pagamento encontrado', `O plano de ${companyName} está ativo.`);
        return;
      }
      Alert.alert(
        'Pagamento não encontrado',
        'Nenhum pagamento confirmado chegou da Stripe. O plano não foi ativado.'
      );
    } catch {
      Alert.alert('Não foi possível verificar', 'Confira a internet e tente novamente.');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Assinatura" subtitle={companyName} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.statusCard}>
          <View style={[styles.statusPill, isActive ? styles.pillActive : isTrialActive ? styles.pillTrial : isLate ? styles.pillLate : styles.pillBlocked]}>
            <Text style={[styles.statusPillText, isActive ? styles.pillTextActive : isTrialActive ? styles.pillTextTrial : isLate ? styles.pillTextLate : styles.pillTextBlocked]}>
              {statusLabel}
            </Text>
          </View>
          <Text style={styles.companyName}>{companyName}</Text>
          <Text style={styles.price}>R$ 99,90</Text>
          <Text style={styles.period}>por mês, para esta empresa</Text>
          <Text style={styles.hint}>{statusHint}</Text>
        </View>

        <View style={styles.planCard}>
          <Text style={styles.sectionTitle}>O que está incluso</Text>
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <View key={feature.title} style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Icon size={18} color={colors.primary} />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDesc}>{feature.desc}</Text>
                </View>
                <Check size={16} color={colors.statusAuthorized} />
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, !paymentDue && styles.buttonDisabled]}
          onPress={handleSubscribe}
          disabled={!paymentDue || isOpeningPayment}
          activeOpacity={0.85}
        >
          {isOpeningPayment ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <CreditCard size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>
                {paymentDue ? 'Renovar plano — R$ 99,90' : 'Plano em dia'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, !paymentDue && styles.buttonDisabled]}
          onPress={handleRefresh}
          disabled={!paymentDue || isRefreshing}
          activeOpacity={0.85}
        >
          {isRefreshing ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <RefreshCw size={16} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>Já paguei, atualizar status</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.planCard}>
          <Text style={styles.sectionTitle}>Histórico de pagamentos</Text>
          {history.length === 0 ? (
            <Text style={styles.emptyHistory}>Nenhum pagamento registrado para {companyName}.</Text>
          ) : (
            history.map((item) => (
              <View key={item.id} style={styles.historyRow}>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{item.label}</Text>
                  <Text style={styles.featureDesc}>
                    {formatDate(item.paidAt)}
                    {item.periodEnd ? ` · válido até ${formatDate(item.periodEnd)}` : ''}
                  </Text>
                </View>
                <Text style={styles.historyAmount}>
                  {item.source === 'COMPLIMENTARY' ? 'R$ 0,00' : 'R$ 99,90'}
                </Text>
              </View>
            ))
          )}
        </View>

        <TouchableOpacity
          style={styles.supportButton}
          onPress={() => {
            Linking.openURL(SUPPORT_WHATSAPP).catch(() => {
              Alert.alert('Erro', 'Não foi possível abrir o WhatsApp.');
            });
          }}
          activeOpacity={0.85}
        >
          <MessageCircle size={16} color={colors.primary} />
          <Text style={styles.supportButtonText}>Falar com o suporte</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  statusCard: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 14,
  },
  pillActive: { backgroundColor: '#DCFCE7' },
  pillTrial: { backgroundColor: '#FEF3C7' },
  pillLate: { backgroundColor: '#FFEDD5' },
  pillBlocked: { backgroundColor: '#FEE2E2' },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  pillTextActive: { color: '#166534' },
  pillTextTrial: { color: '#92400E' },
  pillTextLate: { color: '#9A3412' },
  pillTextBlocked: { color: '#991B1B' },
  price: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
  },
  companyName: {
    color: '#D1FAE5',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  period: {
    color: '#D1FAE5',
    fontSize: 14,
    marginBottom: 10,
  },
  hint: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  planCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureText: { flex: 1, marginRight: 8 },
  featureTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  featureDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.primarySoftBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  supportButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  supportButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  historyAmount: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyHistory: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
