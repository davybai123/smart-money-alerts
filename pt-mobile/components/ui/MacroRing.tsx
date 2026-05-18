import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors, FontSize, FontWeight } from '@/constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface MacroRingProps {
  current: number;
  target: number;
  label: string;
  unit?: string;
  color?: string;
  size?: number;
  strokeWidth?: number;
  showPercentage?: boolean;
}

export function MacroRing({
  current,
  target,
  label,
  unit = 'g',
  color = Colors.accent,
  size = 80,
  strokeWidth = 8,
  showPercentage = false,
}: MacroRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useSharedValue(0);

  const percentage = Math.min(100, target > 0 ? (current / target) * 100 : 0);

  useEffect(() => {
    progress.value = withTiming(percentage / 100, {
      duration: 1000,
      easing: Easing.out(Easing.cubic),
    });
  }, [percentage]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const isOver = current > target;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} style={styles.svg}>
        {/* Background track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={Colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={isOver ? Colors.warning : color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={[styles.center, { width: size, height: size }]}>
        {showPercentage ? (
          <Text style={[styles.value, { color: isOver ? Colors.warning : color }]}>
            {Math.round(percentage)}%
          </Text>
        ) : (
          <Text style={[styles.value, { color: isOver ? Colors.warning : Colors.text }]}>
            {Math.round(current)}
          </Text>
        )}
        <Text style={styles.unit}>{unit}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.target}>
        / {target}{unit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 2,
  },
  svg: {
    position: 'absolute',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  unit: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text,
    marginTop: 84,
  },
  target: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
