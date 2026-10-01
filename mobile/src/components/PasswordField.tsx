import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

export function passwordStrength(value: string) {
  if (!value) return null;
  if (value.length < 8) return { label: 'Fraca', level: 1, color: '#DC2626' };
  let score = 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  if (score <= 1) return { label: 'Fraca', level: 1, color: '#DC2626' };
  if (score === 2) return { label: 'Razoável', level: 2, color: '#D97706' };
  if (score === 3) return { label: 'Boa', level: 3, color: '#65A30D' };
  return { label: 'Excelente', level: 4, color: '#15803D' };
}

export function PasswordStrength({ value }: { value: string }) {
  const strength = passwordStrength(value);
  if (!strength) return null;
  return (
    <View style={styles.meterWrap}>
      <View style={styles.meter}>
        {[1, 2, 3, 4].map((step) => (
          <View
            key={step}
            style={[styles.segment, { backgroundColor: step <= strength.level ? strength.color : '#E2E8F0' }]}
          />
        ))}
      </View>
      <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
    </View>
  );
}

type PasswordFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  showStrength?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  autoFocus?: boolean;
  editable?: boolean;
};

export function PasswordField({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor = '#94A3B8',
  showStrength = false,
  containerStyle,
  inputStyle,
  autoFocus,
  editable,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View>
      <View style={[styles.row, containerStyle]}>
        <TextInput
          style={[styles.input, inputStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
          editable={editable}
        />
        <TouchableOpacity onPress={() => setVisible((current) => !current)} hitSlop={8} style={styles.eye}>
          {visible ? <EyeOff size={18} color="#64748B" /> : <Eye size={18} color="#64748B" />}
        </TouchableOpacity>
      </View>
      {showStrength ? <PasswordStrength value={value} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    color: '#0F172A',
    fontSize: 15,
    paddingVertical: 0,
  },
  eye: {
    marginLeft: 8,
    padding: 4,
  },
  meterWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  meter: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 4,
  },
  strengthLabel: {
    width: 72,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
});
