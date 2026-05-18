import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FoodLog, MealType } from '@/types';
import { FoodLogItem } from './FoodLogItem';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '🌅 Breakfast',
  lunch: '☀️ Lunch',
  dinner: '🌙 Dinner',
  snack: '🍎 Snacks',
  pre_workout: '⚡ Pre-Workout',
  post_workout: '💪 Post-Workout',
};

const MEAL_ORDER: MealType[] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'pre_workout',
  'post_workout',
];

interface MealSectionProps {
  meal: MealType;
  logs: FoodLog[];
  onDelete: (id: string) => void;
  onAdd: (meal: MealType) => void;
}

export function MealSection({ meal, logs, onDelete, onAdd }: MealSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  const totalCalories = logs.reduce((acc, l) => acc + l.calories, 0);
  const totalProtein = logs.reduce((acc, l) => acc + l.protein, 0);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setCollapsed((v) => !v)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.mealLabel}>{MEAL_LABELS[meal]}</Text>
          {logs.length > 0 && (
            <Text style={styles.summary}>
              {Math.round(totalCalories)} kcal · {Math.round(totalProtein)}g protein
            </Text>
          )}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => onAdd(meal)}
          >
            <Ionicons name="add" size={18} color={Colors.accent} />
          </TouchableOpacity>
          <Ionicons
            name={collapsed ? 'chevron-forward' : 'chevron-down'}
            size={16}
            color={Colors.textMuted}
          />
        </View>
      </TouchableOpacity>

      {!collapsed && (
        <View style={styles.items}>
          {logs.length === 0 ? (
            <TouchableOpacity style={styles.emptyState} onPress={() => onAdd(meal)}>
              <Ionicons name="add-circle-outline" size={20} color={Colors.textDim} />
              <Text style={styles.emptyText}>Add food</Text>
            </TouchableOpacity>
          ) : (
            logs.map((log) => (
              <FoodLogItem key={log.id} log={log} onDelete={onDelete} />
            ))
          )}
        </View>
      )}
    </View>
  );
}

export { MEAL_ORDER };

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  headerLeft: {
    gap: 2,
    flex: 1,
  },
  mealLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  summary: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  items: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.xs,
  },
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textDim,
  },
});
