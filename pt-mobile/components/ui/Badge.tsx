import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, FontSize, FontWeight, BorderRadius, Spacing } from '@/constants/theme';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'muted';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

const variantConfig: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: Colors.accentMuted, text: Colors.accent },
  warning: { bg: Colors.warningMuted, text: Colors.warning },
  danger: { bg: Colors.dangerMuted, text: Colors.danger },
  info: { bg: Colors.infoMuted, text: Colors.info },
  purple: { bg: Colors.purpleMuted, text: Colors.purple },
  muted: { bg: Colors.border, text: Colors.textMuted },
};

export function Badge({ label, variant = 'muted', style }: BadgeProps) {
  const config = variantConfig[variant];
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, style]}>
      <Text style={[styles.text, { color: config.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
