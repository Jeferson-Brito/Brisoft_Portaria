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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';

// URL do seu link de pagamento (Stripe, Pix, etc.) - configure conforme necessário
const PAYMENT_LINK = 'https://combateportaria.com.br/assinar';
const SUPPORT_WHATSAPP = 'https://wa.me/5511999999999?text=Quero+assinar+o+Combate+Portaria';

const FEATURES = [
  { icon: '🏢', title: 'Multi-unidades', desc: 'Gerencie todos os destinos do estabelecimento' },
  { icon: '📱', title: 'Autorização por WhatsApp', desc: 'Morador aprova ou recusa pelo celular' },
  { icon: '👥', title: 'Equipe ilimitada', desc: 'Porteiros, supervisores e admin no mesmo plano' },
  { icon: '📦', title: 'Controle de encomendas', desc: 'Código de retirada seguro para cada pacote' },
  { icon: '📊', title: 'Relatórios completos', desc: 'Histórico e auditoria de todos os acessos' },
  { icon: '🔔', title: 'Notificações em tempo real', desc: 'Push e som quando o morador autoriza' },
];

export const SubscriptionScreen: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { user, signOut, refreshSubscription } = useAuth();
  const sub = user?.subscription;
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isActive = sub?.status === 'ACTIVE';
  const isTrialActive = sub?.status === 'TRIAL' && (sub?.daysRemaining ?? 0) > 0;
  const isExpiredTrial = sub?.status === 'TRIAL' && (sub?.daysRemaining ?? 0) <= 0;
  const isSuspended = sub?.status === 'SUSPENDED';
  const isCancelled = sub?.status === 'CANCELLED';

  const title = isActive
    ? 'Plano Ativo'
    : isTrialActive
    ? 'Período de Testes'
    : isSuspended
    ? 'Assinatura Suspensa'
    : isCancelled
    ? 'Assinatura Cancelada'
    : 'Período de Teste Expirado';

  const subtitle = isActive
    ? 'Seu plano profissional está ativo e liberado.'
    : isTrialActive
    ? `Você tem ${sub?.daysRemaining ?? 7} dias de teste gratuito.`
    : isSuspended
    ? 'Sua assinatura foi suspensa por falta de pagamento.'
    : isCancelled
    ? 'Sua assinatura foi cancelada. Renove para continuar usando.'
    : 'Seus 7 dias de teste gratuito chegaram ao fim.';

  const handleSubscribe = () => {
    Linking.openURL(PAYMENT_LINK).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o link de pagamento.');
    });
  };

  const handleWhatsApp = () => {
    Linking.openURL(SUPPORT_WHATSAPP).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o WhatsApp.');
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshSubscription();
    setIsRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Botão Voltar se acessado pelas configurações */}
      {onBack && (
        <View style={styles.topBackBar}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backBtnText}>‹ Voltar para Configurações</Text>
          </TouchableOpacity>
        </View>
      )}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.lockedHeader}>
          <View style={[styles.lockIcon, (isActive || isTrialActive) && { backgroundColor: '#1E3A8A' }]}>
            <Text style={styles.lockEmoji}>{isActive ? '💎' : isTrialActive ? '⏱️' : '🔒'}</Text>
          </View>
          <Text style={styles.lockTitle}>{title}</Text>
          <Text style={styles.lockSubtitle}>{subtitle}</Text>
        </View>

        {/* Card de plano */}
        <View style={styles.planCard}>
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>PLANO ÚNICO</Text>
          </View>
          <Text style={styles.planPrice}>R$ 149</Text>
          <Text style={styles.planPeriod}>/mês · Cancele quando quiser</Text>
          <Text style={styles.planName}>Combate Portaria Basic</Text>

          <View style={styles.divider} />

          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <View>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Botão de assinar */}
        <TouchableOpacity style={styles.ctaButton} onPress={handleSubscribe}>
          <Text style={styles.ctaButtonText}>Assinar Agora — R$149/mês</Text>
        </TouchableOpacity>

        {/* Botão suporte */}
        <TouchableOpacity style={styles.whatsappButton} onPress={handleWhatsApp}>
          <Text style={styles.whatsappButtonText}>💬 Falar com Suporte no WhatsApp</Text>
        </TouchableOpacity>

        {/* Verificar pagamento */}
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh} disabled={isRefreshing}>
          {isRefreshing ? (
            <ActivityIndicator color="#3B82F6" size="small" />
          ) : (
            <Text style={styles.refreshText}>Já paguei — verificar acesso</Text>
          )}
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1A30',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 48,
    alignItems: 'center',
  },
  lockedHeader: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 32,
  },
  lockIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  lockEmoji: {
    fontSize: 36,
  },
  lockTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  lockSubtitle: {
    color: '#94A3B8',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  planCard: {
    width: '100%',
    backgroundColor: '#132035',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
    marginBottom: 20,
  },
  planBadge: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  planBadgeText: {
    color: '#3B82F6',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  planPrice: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 48,
  },
  planPeriod: {
    color: '#64748B',
    fontSize: 13,
    marginBottom: 4,
  },
  planName: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#1E3A5F',
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 12,
  },
  featureIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
    marginTop: 2,
  },
  featureTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  featureDesc: {
    color: '#64748B',
    fontSize: 12,
  },
  ctaButton: {
    width: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  whatsappButton: {
    width: '100%',
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  whatsappButtonText: {
    color: '#22C55E',
    fontSize: 14,
    fontWeight: '700',
  },
  refreshButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  refreshText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  logoutButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  logoutText: {
    color: '#475569',
    fontSize: 13,
  },
  topBackBar: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
  },
  backBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#93C5FD',
    fontSize: 13,
    fontWeight: '700',
  },
});
