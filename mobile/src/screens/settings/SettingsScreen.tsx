import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import {
  User,
  Users,
  Building2,
  Building,
  MessageSquare,
  ShieldCheck,
  CreditCard,
  ChevronRight,
  LogOut,
  Sparkles,
  Wifi,
  WifiOff,
  UserCheck,
  Shield,
  HelpCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../config/api';
import { colors } from '../../theme/colors';

interface SettingsScreenProps {
  onNavigate: (
    screen:
      | 'profile'
      | 'org_profile'
      | 'users_mgmt'
      | 'clients_mgmt'
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
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onNavigate,
  orgProfile,
  bottomInset,
}) => {
  const { user, signOut, refreshSubscription } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<
    'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'LOADING'
  >('LOADING');
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';
  const isSupervisor = user?.role === 'SUPERVISOR';
  const isConcierge = user?.role === 'CONCIERGE';

  const sub = user?.subscription;
  const isTrial = sub?.status === 'TRIAL';
  const isPro = sub?.status === 'ACTIVE';
  const trialDays = sub?.daysRemaining ?? 7;

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
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 80 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#2563EB"
          colors={['#2563EB']}
        />
      }
    >
      {/* 1. CARD HERO DO USUÁRIO & ESTABELECIMENTO */}
      <View style={styles.profileCard}>
        <View style={styles.profileTopRow}>
          {/* Avatar com iniciais */}
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{userInitials}</Text>
          </View>

          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={styles.nameRow}>
              <Text style={styles.userName} numberOfLines={1}>
                {user?.name || 'Usuário'}
              </Text>
            </View>

            <Text style={styles.userEmail} numberOfLines={1}>
              {user?.email || 'Acesso à Portaria'}
            </Text>

            {/* Badge do Cargo */}
            <View style={[styles.roleBadge, { backgroundColor: roleInfo.bgColor }]}>
              <RoleIcon size={12} color={roleInfo.textColor} />
              <Text style={[styles.roleBadgeText, { color: roleInfo.textColor }]}>
                {roleInfo.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Linha da Organização / Estabelecimento */}
        <View style={styles.orgDivider} />
        <View style={styles.orgRow}>
          <Building size={16} color="#64748B" />
          <Text style={styles.orgText} numberOfLines={1}>
            {orgProfile.companyName || 'Portaria Principal'}
          </Text>
          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={() => onNavigate('profile')}
            activeOpacity={0.7}
          >
            <Text style={styles.editProfileBtnText}>Meu Perfil</Text>
            <ChevronRight size={14} color="#2563EB" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. LIVE STATUS CARDS (Visão Geral em Tempo Real) */}
      <View style={styles.statusRow}>
        {/* WhatsApp Card */}
        {isAdmin && (
          <TouchableOpacity
            style={styles.statusCard}
            onPress={() => onNavigate('whatsapp')}
            activeOpacity={0.8}
          >
            <View style={styles.statusCardHeader}>
              <View
                style={[
                  styles.statusIconWrap,
                  {
                    backgroundColor:
                      whatsappStatus === 'CONNECTED' ? '#DCFCE7' : '#FEE2E2',
                  },
                ]}
              >
                {whatsappStatus === 'CONNECTED' ? (
                  <Wifi size={16} color="#16A34A" />
                ) : (
                  <WifiOff size={16} color="#DC2626" />
                )}
              </View>
              <View
                style={[
                  styles.liveIndicatorDot,
                  {
                    backgroundColor:
                      whatsappStatus === 'CONNECTED' ? '#22C55E' : '#EF4444',
                  },
                ]}
              />
            </View>
            <Text style={styles.statusCardTitle}>WhatsApp</Text>
            <Text
              style={[
                styles.statusCardSubtitle,
                {
                  color:
                    whatsappStatus === 'CONNECTED' ? '#15803D' : '#B91C1C',
                },
              ]}
              numberOfLines={1}
            >
              {whatsappStatus === 'CONNECTED'
                ? connectedPhone || 'Conectado'
                : whatsappStatus === 'LOADING'
                ? 'Verificando...'
                : 'Desconectado'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Subscription / Plano Card */}
        {isAdmin && (
          <TouchableOpacity
            style={styles.statusCard}
            onPress={() => onNavigate('subscription')}
            activeOpacity={0.8}
          >
            <View style={styles.statusCardHeader}>
              <View
                style={[
                  styles.statusIconWrap,
                  { backgroundColor: isPro ? '#F3E8FF' : '#FEF3C7' },
                ]}
              >
                <Sparkles size={16} color={isPro ? '#9333EA' : '#D97706'} />
              </View>
              <Text
                style={[
                  styles.planPillText,
                  { color: isPro ? '#7E22CE' : '#B45309' },
                ]}
              >
                {isPro ? 'PRO' : 'TRIAL'}
              </Text>
            </View>
            <Text style={styles.statusCardTitle}>Assinatura</Text>
            <Text style={styles.statusCardSubtitle} numberOfLines={1}>
              {isPro
                ? 'Plano Ativo'
                : isTrial
                ? `${trialDays} dias restantes`
                : 'Regularizar'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 3. SEÇÃO: OPERAÇÃO & CADASTROS */}
      {(isAdmin || isSupervisor) && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>CADASTROS DA PORTARIA</Text>
          <Text style={styles.sectionDescription}>
            Gerenciamento de moradores, unidades e equipe de atendimento
          </Text>

          {/* Moradores & Unidades */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => onNavigate('clients_mgmt')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#DCFCE7' }]}>
              <Building2 size={22} color="#16A34A" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>
                {orgProfile.clientLabel
                  ? `${orgProfile.clientLabel}s & Unidades`
                  : 'Moradores & Unidades'}
              </Text>
              <Text style={styles.menuSubtitle}>
                Cadastre residentes, números de WhatsApp e apartamentos
              </Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          {/* Equipe / Porteiros */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => onNavigate('users_mgmt')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#EFF6FF' }]}>
              <UserCheck size={22} color="#2563EB" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Equipe de Porteiros</Text>
              <Text style={styles.menuSubtitle}>
                Cadastrar operadores, redefinir senhas e gerenciar acessos
              </Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      )}

      {/* 4. SEÇÃO: COMUNICAÇÃO & INTEGRAÇÕES */}
      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>COMUNICAÇÃO & ROBÔ</Text>
          <Text style={styles.sectionDescription}>
            Integração com WhatsApp para avisos e autorizações automáticas
          </Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => onNavigate('whatsapp')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#DCFCE7' }]}>
              <MessageSquare size={22} color="#15803D" />
            </View>
            <View style={styles.menuContent}>
              <View style={styles.menuTitleRow}>
                <Text style={styles.menuTitle}>Robô do WhatsApp (Baileys)</Text>
                {whatsappStatus === 'CONNECTED' ? (
                  <View style={styles.connectedBadge}>
                    <Text style={styles.connectedBadgeText}>ONLINE</Text>
                  </View>
                ) : (
                  <View style={styles.disconnectedBadge}>
                    <Text style={styles.disconnectedBadgeText}>OFFLINE</Text>
                  </View>
                )}
              </View>
              <Text style={styles.menuSubtitle}>
                {whatsappStatus === 'CONNECTED'
                  ? `Conectado ao telefone ${connectedPhone || ''}`
                  : 'Escanear QR Code para ativar envio de mensagens'}
              </Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      )}

      {/* 5. SEÇÃO: EMPRESA & SISTEMA */}
      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>EMPRESA & ASSINATURA</Text>
          <Text style={styles.sectionDescription}>
            Personalização do estabelecimento e gestão do plano
          </Text>

          {/* Perfil do Estabelecimento */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => onNavigate('org_profile')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#FEF3C7' }]}>
              <Building size={22} color="#D97706" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Perfil do Estabelecimento</Text>
              <Text style={styles.menuSubtitle}>
                {orgProfile.companyName
                  ? `${orgProfile.companyName} (${orgProfile.type || 'Personalizado'})`
                  : 'Defina o segmento: Residencial, Comercial, Clínica, etc.'}
              </Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          {/* Plano & Assinatura */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => onNavigate('subscription')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: '#F3E8FF' }]}>
              <CreditCard size={22} color="#9333EA" />
            </View>
            <View style={styles.menuContent}>
              <View style={styles.menuTitleRow}>
                <Text style={styles.menuTitle}>Minha Assinatura & Plano</Text>
                <View
                  style={[
                    styles.planBadge,
                    { backgroundColor: isPro ? '#F3E8FF' : '#FEF3C7' },
                  ]}
                >
                  <Text
                    style={[
                      styles.planBadgeText,
                      { color: isPro ? '#7E22CE' : '#B45309' },
                    ]}
                  >
                    {isPro ? 'PLANO ATIVO' : `${trialDays}D RESTANTES`}
                  </Text>
                </View>
              </View>
              <Text style={styles.menuSubtitle}>
                {isPro
                  ? 'Plano Profissional ativo. Recursos ilimitados liberados.'
                  : 'Período de testes. Assine para garantir o funcionamento contínuo.'}
              </Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      )}

      {/* 6. SEÇÃO: MINHA CONTA */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>MINHA CONTA</Text>
        <Text style={styles.sectionDescription}>
          Segurança e credenciais de acesso deste operador
        </Text>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => onNavigate('profile')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconBox, { backgroundColor: '#F1F5F9' }]}>
            <User size={22} color="#475569" />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>Meu Perfil & Senha</Text>
            <Text style={styles.menuSubtitle}>
              Alterar seu nome de operador e redefinir sua senha
            </Text>
          </View>
          <ChevronRight size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* 7. BOTÃO LOGOUT / SAIR */}
      <TouchableOpacity
        style={styles.logoutCard}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <LogOut size={20} color="#DC2626" />
        <Text style={styles.logoutText}>Sair da Conta</Text>
      </TouchableOpacity>

      {/* 8. RODAPÉ DE VERSÃO */}
      <View style={styles.footer}>
        <Text style={styles.footerTitle}>Combate Portaria Inteligente</Text>
        <Text style={styles.footerSubtitle}>
          Versão 1.2.0 • SaaS Multi-Condomínio & Empresas
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
    paddingTop: 12,
  },

  // Perfil Hero Card
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#1E3A8A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  userEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
    gap: 4,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  orgDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  orgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orgText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
    marginLeft: 8,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  editProfileBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
    marginRight: 2,
  },

  // Quick Status Row
  statusRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  statusCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  statusCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statusIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  planPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusCardTitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  statusCardSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },

  // Sections
  section: {
    marginBottom: 18,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  sectionDescription: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  menuIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  menuTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  connectedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  connectedBadgeText: {
    color: '#15803D',
    fontSize: 10,
    fontWeight: '800',
  },
  disconnectedBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  disconnectedBadgeText: {
    color: '#B91C1C',
    fontSize: 10,
    fontWeight: '800',
  },
  planBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },

  // Logout Button
  logoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 6,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 8,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },

  // Rodapé
  footer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  footerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  footerSubtitle: {
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 2,
  },
});
