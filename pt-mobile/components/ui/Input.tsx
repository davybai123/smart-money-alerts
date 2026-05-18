import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, BorderRadius, Spacing } from '@/constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  onIconRightPress?: () => void;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
}

export function Input({
  label,
  error,
  hint,
  icon,
  iconRight,
  onIconRightPress,
  containerStyle,
  isPassword,
  style,
  ...rest
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);

  const isPasswordField = isPassword;
  const secureTextEntry = isPasswordField ? !showPassword : rest.secureTextEntry;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.container,
          focused && styles.focused,
          !!error && styles.errorBorder,
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? Colors.accent : Colors.textMuted}
            style={styles.iconLeft}
          />
        )}
        <TextInput
          style={[
            styles.input,
            icon && styles.inputWithIcon,
            (iconRight || isPasswordField) && styles.inputWithIconRight,
            style,
          ]}
          placeholderTextColor={Colors.textDim}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={secureTextEntry}
          {...rest}
        />
        {isPasswordField && (
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            style={styles.iconRight}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={Colors.textMuted}
            />
          </TouchableOpacity>
        )}
        {iconRight && !isPasswordField && (
          <TouchableOpacity onPress={onIconRightPress} style={styles.iconRight}>
            <Ionicons name={iconRight} size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    minHeight: 48,
  },
  focused: {
    borderColor: Colors.accent,
  },
  errorBorder: {
    borderColor: Colors.danger,
  },
  input: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.text,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  inputWithIcon: {
    paddingLeft: Spacing.sm,
  },
  inputWithIconRight: {
    paddingRight: Spacing.sm,
  },
  iconLeft: {
    marginLeft: Spacing.md,
  },
  iconRight: {
    paddingRight: Spacing.md,
    padding: Spacing.xs,
  },
  error: {
    fontSize: FontSize.xs,
    color: Colors.danger,
  },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
