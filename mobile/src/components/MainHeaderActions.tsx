import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Bell, HelpCircle, Settings } from 'lucide-react-native';

type MainHeaderActionsProps = {
  onNotifications: () => void;
  onSettings: () => void;
  onHelp?: () => void;
  showHelp?: boolean;
  showNotificationDot?: boolean;
  /** light = cabeçalho menta da Início; onPrimary = cabeçalho verde do AppHeader */
  variant?: 'light' | 'onPrimary';
};

export function MainHeaderActions({
  onNotifications,
  onSettings,
  onHelp,
  showHelp = false,
  showNotificationDot = false,
  variant = 'onPrimary',
}: MainHeaderActionsProps) {
  const isLight = variant === 'light';
  const iconColor = isLight ? '#0F172A' : '#FFFFFF';

  return (
    <View style={styles.row}>
      {showHelp && onHelp ? (
        <TouchableOpacity
          style={[styles.button, isLight ? styles.buttonLight : styles.buttonOnPrimary]}
          onPress={onHelp}
          activeOpacity={0.75}
        >
          <HelpCircle size={20} color={iconColor} />
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={[
          styles.button,
          isLight ? styles.buttonLight : styles.buttonOnPrimary,
          showHelp && onHelp ? styles.spaced : null,
        ]}
        onPress={onNotifications}
        activeOpacity={0.75}
      >
        <Bell size={20} color={iconColor} />
        {showNotificationDot ? <View style={styles.dot} /> : null}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, isLight ? styles.buttonLight : styles.buttonOnPrimary, styles.spaced]}
        onPress={onSettings}
        activeOpacity={0.75}
      >
        <Settings size={20} color={iconColor} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLight: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  buttonOnPrimary: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  spaced: {
    marginLeft: 8,
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
});
