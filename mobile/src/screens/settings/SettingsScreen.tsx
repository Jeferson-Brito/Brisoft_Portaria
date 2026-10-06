import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  Linking,
} from 'react-native';
import { ScrollToTopButton } from '../../components/ScrollToTopButton';
import {
  Users,
  Building,
  MessageSquare,
  ShieldCheck,
  ChevronRight,
  LogOut,
  Sparkles,
  Wifi,
  WifiOff,
  UserCheck,
  Shield,
  HelpCircle,
  Trees,
  AlertTriangle,
  Lock,
} from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../config/api';
import { colors } from '../../theme/colors';
import { usePlaceTerms } from '../../utils/placeTerms';

interface SettingsScreenProps {
  onNavigate: (
    screen:
      | 'profile'
      | 'org_profile'
      | 'users_mgmt'
      | 'clients_mgmt'
      | 'residents'
      | 'units'
      | 'restrictions'
      | 'amenities'
      | 'whatsapp'
      | 'subscription'
  ) => void;
  orgProfile: {
    companyName?: string;
    unitLabel?: string;
    clientLabel?: string;
    type?: string;
  };
  bottomInset: number;
  onOpenTutorial?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onNavigate,
  orgProfile,
  bottomInset,
  onOpenTutorial,
}) => {
  const { user, signOut, refreshSubscription, isSubscriptionBlocked } = useAuth();
  const terms = usePlaceTerms();
  const scrollRef = useRef<ScrollView>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<
    'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'LOADING'
  >('LOADING');
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdmin = user?.role === 'ADMIN' || isSuperAdmin;
  const isSupervisor = user?.role === 'SUPERVISOR';
  const isConcierge = user?.role === 'CONCIERGE';

  const sub = user?.subscription;
  const isTrial = sub?.status === 'TRIAL';
  const isPro = sub?.status === 'ACTIVE';
  const trialDays = sub?.daysRemaining ?? 7;

  const notifyBlocked = useCallback(() => {
    Alert.alert(
      'Assinatura pendente',
      'Regularize o pagamento em Assinatura para liberar cadastros, perfil e demais configurações.'
    );
  }, []);

  const navigateGuarded = useCallback(
    (screen: Parameters<SettingsScreenProps['onNavigate']>[0]) => {
      if (isSubscriptionBlocked && screen !== 'subscription') {
        notifyBlocked();
        return;
      }
      onNavigate(screen);
    },
    [isSubscriptionBlocked, notifyBlocked, onNavigate]
  );

  // Carrega status rápido do WhatsApp
  const checkWhatsApp = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await api.get('/whatsapp/status');
      const data = res.data?.data;
      if (data?.status === 'CONNECTED') {
        setWhatsappStatus('CONNECTED');
        setConnectedPhone(data.phoneConnected || null);
      } else {
        setWhatsappStatus('DISCONNECTED');
        setConnectedPhone(null);
      }
    } catch {
      setWhatsappStatus('DISCONNECTED');
    }
  }, [isAdmin]);

  useEffect(() => {
    checkWhatsApp();
  }, [checkWhatsApp]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([checkWhatsApp(), refreshSubscription()]);
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Sair da Conta',
      'Tem certeza que deseja desconectar deste aparelho? Você precisará entrar com e-mail e senha novamente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair da Conta',
          style: 'destructive',
          onPress: () => signOut(),
        },
      ]
    );
  };

  const getRoleBadge = () => {
    if (isAdmin) {
      return {
        label: 'Administrador',
        bgColor: '#FEF3C7',
        textColor: '#B45309',
        icon: ShieldCheck,
      };
    }
    if (isSupervisor) {
      return {
        label: 'Supervisor',
        bgColor: '#DBEAFE',
        textColor: '#1D4ED8',
        icon: Shield,
      };
    }
    return {
      label: 'Portaria / Operador',
      bgColor: '#DCFCE7',
      textColor: '#15803D',
      icon: UserCheck,
    };
  };

  const roleInfo = getRoleBadge();
  const RoleIcon = roleInfo.icon;

  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 80 }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 150)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2563EB"
            colors={['#2563EB']}
          />
        }
      >
      <View style={styles.identity}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitials}>{userInitials}</Text>
        </View>
        <View style={styles.identityText}>
          <Text style={styles.userName} numberOfLines={1}>{user?.name || 'Usuário'}</Text>
          <Text style={styles.userEmail} numberOfLines={1}>{user?.email || 'Acesso à portaria'}</Text>
          <View style={[styles.roleBadge, { backgroundColor: roleInfo.bgColor }]}>
            <RoleIcon size={12} color={roleInfo.textColor} />
            <Text style={[styles.roleBadgeText, { color: roleInfo.textColor }]}>{roleInfo.label}</Text>
          </View>
        </View>
      </View>

      {isSubscriptionBlocked ? (
        <TouchableOpacity
          style={styles.blockedBanner}
          onPress={() => onNavigate('subscription')}
          activeOpacity={0.85}
        >
          <AlertTriangle size={16} color="#B91C1C" />
          <Text style={styles.blockedBannerText}>
            Pagamento pendente. Cadastros, perfil e configurações estão bloqueados. Toque para regularizar.
          </Text>
          <ChevronRight size={16} color="#B91C1C" />
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={[styles.companyLine, isSubscriptionBlocked && styles.itemDisabled]}
        onPress={() => navigateGuarded('profile')}
        activeOpacity={0.7}
      >
        <Building size={16} color={isSubscriptionBlocked ? '#94A3B8' : colors.primary} />
        <Text style={[styles.orgText, isSubscriptionBlocked && styles.textDisabled]} numberOfLines={1}>
          {orgProfile.companyName || 'Portaria principal'}
        </Text>
        <Text style={[styles.link, isSubscriptionBlocked && styles.textDisabled]}>
          {isSubscriptionBlocked ? 'Bloqueado' : 'Meu perfil'}
        </Text>
        {isSubscriptionBlocked ? (
          <Lock size={14} color="#94A3B8" />
        ) : (
          <ChevronRight size={16} color="#94A3B8" />
        )}
      </TouchableOpacity>

      {isAdmin && (
        <View style={styles.statusRow}>
          <TouchableOpacity
            style={[styles.statusCard, isSubscriptionBlocked && styles.itemDisabled]}
            onPress={() => navigateGuarded('whatsapp')}
            activeOpacity={0.8}
          >
            {isSubscriptionBlocked ? (
              <Lock size={16} color="#94A3B8" />
            ) : whatsappStatus === 'CONNECTED' ? (
              <Wifi size={16} color="#16A34A" />
            ) : (
              <WifiOff size={16} color="#DC2626" />
            )}
            <Text style={[styles.statusCardTitle, isSubscriptionBlocked && styles.textDisabled]}>
              {isSuperAdmin ? 'WhatsApp da plataforma' : 'WhatsApp'}
            </Text>
            <Text
              style={[
                styles.statusCardSubtitle,
                {
                  color: isSubscriptionBlocked
                    ? '#94A3B8'
                    : whatsappStatus === 'CONNECTED'
                      ? '#15803D'
                      : '#B91C1C',
                },
              ]}
              numberOfLines={1}
            >
              {isSubscriptionBlocked
                ? 'Bloqueado'
                : whatsappStatus === 'CONNECTED'
                  ? connectedPhone || 'Conectado'
                  : whatsappStatus === 'LOADING'
                    ? 'Verificando...'
                    : isSuperAdmin
                      ? 'Ler QR Code'
                      : 'Desconectado'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statusCard} onPress={() => onNavigate('subscription')} activeOpacity={0.8}>
            <Sparkles size={16} color={isPro ? colors.primary : '#D97706'} />
            <Text style={styles.statusCardTitle}>Assinatura</Text>
            <Text style={styles.statusCardSubtitle} numberOfLines={1}>
              {isSubscriptionBlocked
                ? 'Regularizar'
                : isPro
                  ? 'Plano ativo'
                  : sub?.status === 'LATE'
                    ? 'Em atraso'
                    : isTrial
                      ? `${trialDays} dias`
                      : 'Regularizar'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {(isAdmin || isSupervisor) && (
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Cadastros</Text>
          <View style={[styles.groupBox, isSubscriptionBlocked && styles.groupBoxDisabled]}>
            <MenuRow
              icon={<Users size={18} color={isSubscriptionBlocked ? '#94A3B8' : colors.primary} />}
              iconBg={isSubscriptionBlocked ? '#F1F5F9' : colors.primarySoft}
              title={terms.clients}
              subtitle="Cadastro, busca e acesso ao aplicativo"
              onPress={() => navigateGuarded('residents')}
              disabled={isSubscriptionBlocked}
            />
            <MenuRow
              icon={<Building size={18} color={isSubscriptionBlocked ? '#94A3B8' : '#0F766E'} />}
              iconBg={isSubscriptionBlocked ? '#F1F5F9' : '#CCFBF1'}
              title={terms.units}
              subtitle="Cadastro, busca e edição"
              onPress={() => navigateGuarded('units')}
              disabled={isSubscriptionBlocked}
            />
            <MenuRow
              icon={<UserCheck size={18} color={isSubscriptionBlocked ? '#94A3B8' : '#1D4ED8'} />}
              iconBg={isSubscriptionBlocked ? '#F1F5F9' : '#EFF6FF'}
              title="Equipe da portaria"
              subtitle="Porteiros, supervisores e acessos"
              onPress={() => navigateGuarded('users_mgmt')}
              disabled={isSubscriptionBlocked}
            />
            <MenuRow
              icon={<Shield size={18} color={isSubscriptionBlocked ? '#94A3B8' : '#B91C1C'} />}
              iconBg={isSubscriptionBlocked ? '#F1F5F9' : '#FEE2E2'}
              title="Lista de restrição"
              subtitle="Pessoas com entrada bloqueada"
              onPress={() => navigateGuarded('restrictions')}
              last={!isAdmin}
              disabled={isSubscriptionBlocked}
            />
            {isAdmin && (
              <>
                <MenuRow
                  icon={<Building size={18} color={isSubscriptionBlocked ? '#94A3B8' : '#B45309'} />}
                  iconBg={isSubscriptionBlocked ? '#F1F5F9' : '#FEF3C7'}
                  title="Perfil do estabelecimento"
                  subtitle="Nome, endereço e tipo do local"
                  onPress={() => navigateGuarded('org_profile')}
                  disabled={isSubscriptionBlocked}
                />
                <MenuRow
                  icon={<Trees size={18} color={isSubscriptionBlocked ? '#94A3B8' : colors.primary} />}
                  iconBg={isSubscriptionBlocked ? '#F1F5F9' : colors.primarySoft}
                  title="Áreas comuns"
                  subtitle="Salão, churrasqueira e reservas"
                  onPress={() => navigateGuarded('amenities')}
                  last
                  disabled={isSubscriptionBlocked}
                />
              </>
            )}
          </View>
        </View>
      )}

      <View style={styles.group}>
        <Text style={styles.groupLabel}>Ajuda</Text>
        <View style={styles.groupBox}>
          <MenuRow
            icon={<HelpCircle size={18} color={colors.primary} />}
            iconBg={colors.primarySoft}
            title="Guia da portaria"
            onPress={() => onOpenTutorial && onOpenTutorial()}
          />
          <MenuRow
            icon={<MessageSquare size={18} color="#15803D" />}
            iconBg="#DCFCE7"
            title="Suporte"
            onPress={() => Linking.openURL('https://wa.me/5583981131352?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20no%20Brisoft%20Portaria')}
            last
          />
        </View>
      </View>

      <TouchableOpacity style={styles.logout} onPress={handleLogout} activeOpacity={0.8}>
        <LogOut size={18} color="#DC2626" />
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>

    </ScrollView>
    <ScrollToTopButton
      visible={showScrollTop}
      onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
      bottom={115}
    />
  </View>
  );
};

const MenuRow: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  last?: boolean;
  disabled?: boolean;
}> = ({ icon, iconBg, title, subtitle, onPress, last, disabled }) => (
  <TouchableOpacity
    style={[styles.row, !last && styles.rowDivider, disabled && styles.rowDisabled]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>{icon}</View>
    <View style={styles.rowText}>
      <Text style={[styles.rowTitle, disabled && styles.textDisabled]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.rowSub, disabled && styles.textDisabled]} numberOfLines={1}>
          {disabled ? 'Disponível após regularizar o pagamento' : subtitle}
        </Text>
      ) : null}
    </View>
    {disabled ? <Lock size={14} color="#94A3B8" /> : <ChevronRight size={16} color="#94A3B8" />}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 8 },
  identity: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  identityText: { flex: 1, marginLeft: 14 },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  userName: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  userEmail: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 8,
    gap: 4,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '700' },
  companyLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    minHeight: 48,
    marginBottom: 14,
  },
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  blockedBannerText: {
    flex: 1,
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  itemDisabled: {
    opacity: 0.72,
  },
  textDisabled: {
    color: '#94A3B8',
  },
  groupBoxDisabled: {
    opacity: 0.92,
  },
  rowDisabled: {
    opacity: 0.85,
  },
  orgText: { flex: 1, color: colors.textPrimary, fontWeight: '600' },
  link: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  statusRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  statusCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
  },
  statusCardTitle: { color: colors.textPrimary, fontWeight: '700' },
  statusCardSubtitle: { color: colors.textSecondary, fontSize: 12 },
  group: { marginTop: 18 },
  groupLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  groupBox: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  rowSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22, minHeight: 48 },
  logoutText: { color: '#DC2626', fontWeight: '700', fontSize: 15 },
});
