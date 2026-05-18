import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { Colors, FontSize, FontWeight, BorderRadius, Spacing } from '@/constants/theme';

interface MacroBarProps {
  label: string;
  current: number;
  target: number;
  color: string;
  unit?: string;
}

export function MacroBar({ label, current, target, color, unit = 'g' }: MacroBarProps) {
  const percentage = Math.min(100, target > 0 ? (current / target) * 100 : 0);
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(percentage, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [percentage]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  const isOver = current > target;
  const remaining = Math.max(0, target - current);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.values}>
          <Text style={[styles.current, { color: isOver ? Colors.warning : Colors.text }]}>
            {Math.round(current)}{unit}
          </Text>
          <Text style={styles.target}> / {target}{unit}</Text>
        </View>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            { backgroundColor: isOver ? Colors.warning : color },
            animatedStyle,
          ]}
        />
      </View>
      <Text style={styles.remaining}>
        {isOver
          ? `${Math.round(current - target)}${unit} over target`
          : `${Math.round(remaining)}${unit} remaining`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textMuted,
    textTransform: 'capitalize',
  },
  values: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  current: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  target: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  track: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  remaining: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
  },
});
