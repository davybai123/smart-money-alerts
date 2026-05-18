import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WorkoutSession, WorkoutType } from '@/types';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/constants/theme';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/Badge';

const TYPE_ICONS: Record<WorkoutType, keyof typeof Ionicons.glyphMap> = {
  strength: 'barbell-outline',
  cardio: 'heart-outline',
  rugby: 'american-football-outline',
  hiit: 'flash-outline',
  recovery: 'leaf-outline',
  mobility: 'body-outline',
  sport_specific: 'trophy-outline',
};

const TYPE_COLORS: Record<WorkoutType, 'success' | 'danger' | 'info' | 'warning' | 'purple' | 'muted'> = {
  strength: 'success',
  cardio: 'danger',
  rugby: 'info',
  hiit: 'warning',
  recovery: 'purple',
  mobility: 'muted',
  sport_specific: 'info',
};

interface SessionCardProps {
  session: WorkoutSession;
  onPress?: (session: WorkoutSession) => void;
  onDelete?: (id: string) => void;
}

export function SessionCard({ session, onPress, onDelete }: SessionCardProps) {
  const icon = TYPE_ICONS[session.type] || 'fitness-outline';
  const badgeVariant = TYPE_COLORS[session.type] || 'muted';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(session)}
      activeOpacity={0.85}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={24} color={Colors.accent} />
      </View>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={1}>{session.title}</Text>
          <Badge label={session.type.replace('_', ' ')} variant={badgeVariant} />
        </View>
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>
              {format(new Date(session.date), 'MMM d')}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{session.duration_minutes} min</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="list-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>
              {session.exercises.length} exercises
            </Text>
          </View>
          {session.rpe && (
            <View style={styles.metaItem}>
              <Ionicons name="speedometer-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.metaText}>RPE {session.rpe}</Text>
            </View>
          )}
        </View>
        {session.ai_generated && (
          <View style={styles.aiBadge}>
            <Ionicons name="flash" size={10} color={Colors.purple} />
            <Text style={styles.aiText}>AI Generated</Text>
          </View>
        )}
      </View>
      {onDelete && (
        <TouchableOpacity
          onPress={() => onDelete(session.id)}
          style={styles.deleteBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="ellipsis-vertical" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: Spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    flex: 1,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  aiText: {
    fontSize: FontSize.xs,
    color: Colors.purple,
    fontWeight: FontWeight.medium,
  },
  deleteBtn: {
    padding: Spacing.xs,
  },
});
