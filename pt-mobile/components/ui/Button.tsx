import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, FontSize, FontWeight, BorderRadius, Spacing, Shadow } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  label: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  label,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  onPress,
  style,
  disabled,
  ...rest
}: ButtonProps) {
  const handlePress = async (e: any) => {
    if (disabled || loading) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  };

  const containerStyle: ViewStyle[] = [
    styles.base,
    styles[`size_${size}`],
    styles[`variant_${variant}`],
    fullWidth && styles.fullWidth,
    (disabled || loading) && styles.disabled,
    style as ViewStyle,
  ].filter(Boolean) as ViewStyle[];

  const textStyle: TextStyle[] = [
    styles.text,
    styles[`text_${size}`],
    styles[`text_variant_${variant}`],
    (disabled || loading) && styles.textDisabled,
  ].filter(Boolean) as TextStyle[];

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? Colors.black : Colors.accent}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          <Text style={textStyle}>{label}</Text>
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  // Sizes
  size_sm: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  size_md: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  size_lg: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
  },
  // Variants
  variant_primary: {
    backgroundColor: Colors.accent,
    ...Shadow.green,
  },
  variant_secondary: {
    backgroundColor: Colors.cardElevated,
  },
  variant_outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  variant_ghost: {
    backgroundColor: 'transparent',
  },
  variant_danger: {
    backgroundColor: Colors.danger,
  },
  // Text
  text: {
    fontWeight: FontWeight.semibold,
  },
  text_sm: {
    fontSize: FontSize.sm,
  },
  text_md: {
    fontSize: FontSize.base,
  },
  text_lg: {
    fontSize: FontSize.md,
  },
  text_variant_primary: {
    color: Colors.black,
  },
  text_variant_secondary: {
    color: Colors.text,
  },
  text_variant_outline: {
    color: Colors.accent,
  },
  text_variant_ghost: {
    color: Colors.text,
  },
  text_variant_danger: {
    color: Colors.white,
  },
  textDisabled: {
    opacity: 0.7,
  },
});
