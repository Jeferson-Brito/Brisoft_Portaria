import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { CircleCheck, CircleX, Bell, X, ShieldAlert, Sparkles } from 'lucide-react-native';
import { useRealtime } from '../contexts/RealtimeContext';
import { colors } from '../theme/colors';

export const RealtimeAlertBanner: React.FC = () => {
  const { activeAlert, dismissAlert } = useRealtime();

  if (!activeAlert) return null;

  const isAuth = activeAlert.type === 'AUTHORIZED';
  const isDeny = activeAlert.type === 'DENIED';

  // Configuração de Cores Premium de Alto Contraste (Nunca branco no branco)
  const bannerBg = isAuth
    ? '#064E3B' // Verde Esmeralda Profundo
    : isDeny
    ? '#7F1D1D' // Vermelho Rubi Escuro
    : '#165337';

  const borderColor = isAuth
    ? '#10B981'
    : isDeny
    ? '#EF4444'
    : '#34D399';

  const iconColor = isAuth
    ? '#34D399'
    : isDeny
    ? '#F87171'
    : '#6EE7B7';

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={[styles.banner, { backgroundColor: bannerBg, borderColor }]}>
        {/* Ícone de Destaque */}
        <View style={[styles.iconCircle, { backgroundColor: 'rgba(255, 255, 255, 0.12)' }]}>
          {isAuth && <CircleCheck size={26} color={iconColor} />}
          {isDeny && <CircleX size={26} color={iconColor} />}
          {!isAuth && !isDeny && <Bell size={24} color={iconColor} />}
        </View>

        {/* Conteúdo com Tipografia Nítida e Alto Contraste */}
        <View style={styles.contentColumn}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{activeAlert.title}</Text>
            <View style={[styles.badge, { backgroundColor: borderColor }]}>
              <Text style={styles.badgeText}>
                {isAuth ? 'LIBERADO' : isDeny ? 'RECUSADO' : 'NOTIFICAÇÃO'}
              </Text>
            </View>
          </View>

          <Text style={styles.message} numberOfLines={2}>
            {activeAlert.message}
          </Text>

          {activeAlert.destinationName && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Destino: </Text>
              <Text style={styles.metaValue}>{activeAlert.destinationName}</Text>
            </View>
          )}
        </View>

        {/* Botão Fechar Alerta */}
        <TouchableOpacity
          onPress={dismissAlert}
          style={styles.closeButton}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 36,
    left: 14,
    right: 14,
    zIndex: 99999,
    elevation: 20,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contentColumn: {
    flex: 1,
    paddingRight: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  message: {
    fontSize: 12,
    color: '#F1F5F9',
    lineHeight: 16,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  metaLabel: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    marginLeft: 4,
  },
});
