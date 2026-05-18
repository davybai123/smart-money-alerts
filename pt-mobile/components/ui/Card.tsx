import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, BorderRadius, Spacing, Shadow } from '@/constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  elevated?: boolean;
  noPadding?: boolean;
  glowAccent?: boolean;
}

export function Card({ children, style, elevated = false, noPadding = false, glowAccent = false }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        elevated && styles.elevated,
        !noPadding && styles.padding,
        glowAccent && styles.glowAccent,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  elevated: {
    backgroundColor: Colors.cardElevated,
    ...Shadow.md,
  },
  padding: {
    padding: Spacing.lg,
  },
  glowAccent: {
    borderColor: Colors.accent,
    borderWidth: 1,
    ...Shadow.green,
  },
});
