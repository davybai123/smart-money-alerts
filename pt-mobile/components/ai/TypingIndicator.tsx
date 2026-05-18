import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Colors, BorderRadius, Spacing } from '@/constants/theme';

export function TypingIndicator() {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  const animateDot = (sv: Animated.SharedValue<number>, delay: number) => {
    sv.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 300, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) })
        ),
        -1,
        false
      )
    );
  };

  useEffect(() => {
    animateDot(dot1, 0);
    animateDot(dot2, 150);
    animateDot(dot3, 300);
  }, []);

  const dot1Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot1.value }] }));
  const dot2Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot2.value }] }));
  const dot3Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot3.value }] }));

  return (
    <View style={styles.container}>
      <View style={styles.bubble}>
        <Animated.View style={[styles.dot, dot1Style]} />
        <Animated.View style={[styles.dot, dot2Style]} />
        <Animated.View style={[styles.dot, dot3Style]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderBottomLeftRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    height: 44,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent,
  },
});
