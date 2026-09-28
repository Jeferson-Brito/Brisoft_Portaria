import React from 'react';
import { TouchableOpacity, StyleSheet, Platform, ViewStyle } from 'react-native';
import { ChevronUp } from 'lucide-react-native';

interface ScrollToTopButtonProps {
  visible: boolean;
  onPress: () => void;
  bottom?: number;
  right?: number;
  style?: ViewStyle;
}

export const ScrollToTopButton: React.FC<ScrollToTopButtonProps> = ({
  visible,
  onPress,
  bottom = 24,
  right = 16,
  style,
}) => {
  if (!visible) return null;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { bottom, right },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityLabel="Voltar ao topo"
    >
      <ChevronUp size={22} color="#FFFFFF" strokeWidth={2.5} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#165337',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    borderWidth: 1.5,
    borderColor: '#23734C',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 4.5,
      },
      android: {
        elevation: 6,
      },
    }),
  },
});
