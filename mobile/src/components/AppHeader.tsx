import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { colors } from '../theme/colors';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: number;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  onBack,
  rightAction,
  icon,
  badge,
}) => {
  return (
    <View style={styles.header}>
      {/* Decoração Ondulada em Menta (Idêntica ao modal de Nova Solicitação) */}
      <View style={styles.headerWaveDecoration} />

      <View style={styles.contentRow}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
            <ArrowLeft size={20} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        )}

        {icon && <View style={styles.iconCircle}>{icon}</View>}

        <View style={{ flex: 1, marginLeft: (icon || onBack) ? 10 : 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {badge !== undefined && badge > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ) : null}
          </View>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>

        {rightAction ? <View style={styles.rightAction}>{rightAction}</View> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#165337',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
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
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    color: '#A7F3D0',
    fontWeight: '600',
    marginTop: 1,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  rightAction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    zIndex: 2,
  },
});
