import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { FoodLog } from '@/types';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import * as Haptics from 'expo-haptics';

interface FoodLogItemProps {
  log: FoodLog;
  onDelete: (id: string) => void;
}

export function FoodLogItem({ log, onDelete }: FoodLogItemProps) {
  const translateX = useSharedValue(0);
  const SWIPE_THRESHOLD = -80;

  const handleDelete = () => {
    Alert.alert('Delete Food', `Remove ${log.food_name} from your log?`, [
      { text: 'Cancel', style: 'cancel', onPress: () => { translateX.value = withTiming(0); } },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          onDelete(log.id);
        },
      },
    ]);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      translateX.value = Math.max(SWIPE_THRESHOLD * 1.5, Math.min(0, e.translationX));
    })
    .onEnd((e) => {
      if (e.translationX < SWIPE_THRESHOLD) {
        translateX.value = withTiming(SWIPE_THRESHOLD);
      } else {
        translateX.value = withTiming(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteOpacity = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(translateX.value) / Math.abs(SWIPE_THRESHOLD)),
  }));

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.deleteAction, deleteOpacity]}>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={20} color={Colors.white} />
        </TouchableOpacity>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.container, animatedStyle]}>
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>{log.food_name}</Text>
            {log.brand && <Text style={styles.brand}>{log.brand}</Text>}
            <Text style={styles.serving}>
              {log.quantity}{log.serving_unit}
            </Text>
          </View>
          <View style={styles.macros}>
            <Text style={styles.calories}>{Math.round(log.calories)} kcal</Text>
            <View style={styles.macroRow}>
              <MacroChip label="P" value={log.protein} color={Colors.accent} />
              <MacroChip label="C" value={log.carbs} color={Colors.info} />
              <MacroChip label="F" value={log.fat} color={Colors.danger} />
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function MacroChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: `${color}20` }]}>
      <Text style={[styles.chipLabel, { color }]}>{label}</Text>
      <Text style={[styles.chipValue, { color }]}>{Math.round(value)}g</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: BorderRadius.lg,
    marginVertical: 2,
  },
  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: Colors.danger,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    padding: Spacing.md,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.text,
  },
  brand: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  serving: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
  },
  macros: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  calories: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.warning,
  },
  macroRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
  },
  chipLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  chipValue: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
});
