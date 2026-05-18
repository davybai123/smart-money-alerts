import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useAuthStore } from '@/store/authStore';
import { useNutritionStore } from '@/store/nutritionStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { Card } from '@/components/ui/Card';
import { MacroRing } from '@/components/ui/MacroRing';
import { MacroBar } from '@/components/ui/MacroBar';
import { getMacroColor } from '@/lib/nutrition';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

export default function DashboardScreen() {
  const router = useRouter();
  const { profile, user } = useAuthStore();
  const { logs, selectedDate, fetchLogs, waterLitres, setWater, getTotals } = useNutritionStore();
  const { sessions, fetchSessions } = useWorkoutStore();
  const [refreshing, setRefreshing] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  const totals = getTotals();

  const calorieGoal = profile?.daily_calorie_target || 2500;
  const proteinGoal = profile?.protein_target || 180;
  const carbsGoal = profile?.carbs_target || 250;
  const fatGoal = profile?.fat_target || 80;

  const loadData = useCallback(async () => {
    if (!user) return;
    await Promise.all([
      fetchLogs(user.id, today),
      fetchSessions(user.id),
    ]);
  }, [user, today]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const recentSessions = sessions.slice(0, 3);
  const remainingCalories = Math.max(0, calorieGoal - totals.calories);
  const caloriePercent = Math.min(100, Math.round((totals.calories / calorieGoal) * 100));

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.name}>{profile?.full_name?.split(' ')[0] || 'Athlete'} 💪</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={22} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Date */}
        <Text style={styles.dateLabel}>{format(new Date(), 'EEEE, MMMM d')}</Text>

        {/* Calorie Overview */}
        <Card style={styles.calorieCard} glowAccent>
          <View style={styles.calorieHeader}>
            <View>
              <Text style={styles.cardTitle}>Today's Calories</Text>
              <View style={styles.calorieNumbers}>
                <Text style={styles.calorieConsumed}>{Math.round(totals.calories)}</Text>
                <Text style={styles.calorieDivider}> / </Text>
                <Text style={styles.calorieTarget}>{calorieGoal} kcal</Text>
              </View>
            </View>
            <View style={styles.ringContainer}>
              <MacroRing
                current={totals.calories}
                target={calorieGoal}
                label="kcal"
                unit=""
                color={Colors.warning}
                size={90}
                strokeWidth={9}
              />
            </View>
          </View>
          <View style={styles.remainingRow}>
            <View style={styles.remainingItem}>
              <Text style={styles.remainingLabel}>Remaining</Text>
              <Text style={[styles.remainingValue, { color: Colors.accent }]}>
                {remainingCalories} kcal
              </Text>
            </View>
            <View style={styles.remainingDivider} />
            <View style={styles.remainingItem}>
              <Text style={styles.remainingLabel}>Progress</Text>
              <Text style={[styles.remainingValue, { color: Colors.warning }]}>
                {caloriePercent}%
              </Text>
            </View>
            <View style={styles.remainingDivider} />
            <View style={styles.remainingItem}>
              <Text style={styles.remainingLabel}>Foods logged</Text>
              <Text style={[styles.remainingValue, { color: Colors.info }]}>
                {logs.length}
              </Text>
            </View>
          </View>
        </Card>

        {/* Macro Rings Row */}
        <Card>
          <Text style={styles.cardTitle}>Macronutrients</Text>
          <View style={styles.macroRingsRow}>
            <MacroRing
              current={totals.protein}
              target={proteinGoal}
              label="Protein"
              color={getMacroColor('protein')}
              size={80}
            />
            <MacroRing
              current={totals.carbs}
              target={carbsGoal}
              label="Carbs"
              color={getMacroColor('carbs')}
              size={80}
            />
            <MacroRing
              current={totals.fat}
              target={fatGoal}
              label="Fat"
              color={getMacroColor('fat')}
              size={80}
            />
          </View>
        </Card>

        {/* Water Tracker */}
        <Card>
          <View style={styles.waterHeader}>
            <View style={styles.waterLeft}>
              <Text style={styles.cardTitle}>💧 Water Intake</Text>
              <Text style={styles.waterValue}>{waterLitres.toFixed(1)} / 3.0 L</Text>
            </View>
            <View style={styles.waterBtns}>
              {[0.25, 0.5].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={styles.waterBtn}
                  onPress={() => setWater(Math.min(5, waterLitres + amount))}
                >
                  <Text style={styles.waterBtnText}>+{amount}L</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.waterTrack}>
            <View
              style={[
                styles.waterFill,
                { width: `${Math.min(100, (waterLitres / 3) * 100)}%` },
              ]}
            />
          </View>
          <TouchableOpacity onPress={() => setWater(0)}>
            <Text style={styles.resetWater}>Reset</Text>
          </TouchableOpacity>
        </Card>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={() => router.push('/(tabs)/nutrition')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: Colors.accentMuted }]}>
              <Ionicons name="add-circle" size={24} color={Colors.accent} />
            </View>
            <Text style={styles.quickActionLabel}>Log Food</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={() => router.push('/scan')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: Colors.infoMuted }]}>
              <Ionicons name="scan" size={24} color={Colors.info} />
            </View>
            <Text style={styles.quickActionLabel}>Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={() => router.push('/(tabs)/workouts')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: Colors.warningMuted }]}>
              <Ionicons name="barbell" size={24} color={Colors.warning} />
            </View>
            <Text style={styles.quickActionLabel}>Workout</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={() => router.push('/(tabs)/ai-coach')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: Colors.purpleMuted }]}>
              <Ionicons name="flash" size={24} color={Colors.purple} />
            </View>
            <Text style={styles.quickActionLabel}>AI Coach</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Workouts */}
        {recentSessions.length > 0 && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Workouts</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/workouts')}>
                <Text style={styles.sectionLink}>View all</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.workoutList}>
              {recentSessions.map((session) => (
                <Card key={session.id} style={styles.workoutCard}>
                  <View style={styles.workoutRow}>
                    <View style={styles.workoutIcon}>
                      <Ionicons name="barbell-outline" size={20} color={Colors.accent} />
                    </View>
                    <View style={styles.workoutInfo}>
                      <Text style={styles.workoutTitle}>{session.title}</Text>
                      <Text style={styles.workoutMeta}>
                        {format(new Date(session.date), 'MMM d')} · {session.duration_minutes} min · {session.exercises.length} exercises
                      </Text>
                    </View>
                    {session.rpe && (
                      <View style={styles.rpeBadge}>
                        <Text style={styles.rpeText}>RPE {session.rpe}</Text>
                      </View>
                    )}
                  </View>
                </Card>
              ))}
            </View>
          </View>
        )}

        {/* AI Insight Teaser */}
        <TouchableOpacity
          style={styles.aiCard}
          onPress={() => router.push('/(tabs)/ai-coach')}
          activeOpacity={0.85}
        >
          <View style={styles.aiCardLeft}>
            <View style={styles.aiIcon}>
              <Ionicons name="flash" size={20} color={Colors.purple} />
            </View>
            <View style={styles.aiText}>
              <Text style={styles.aiTitle}>AI Coach Insight</Text>
              <Text style={styles.aiDesc}>
                Tap to get personalized advice based on today's data
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  greeting: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  name: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateLabel: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: -Spacing.xs,
  },
  calorieCard: { gap: Spacing.lg },
  calorieHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  calorieNumbers: { flexDirection: 'row', alignItems: 'baseline' },
  calorieConsumed: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  calorieDivider: { fontSize: FontSize.lg, color: Colors.textMuted },
  calorieTarget: { fontSize: FontSize.md, color: Colors.textMuted },
  ringContainer: { alignItems: 'center' },
  remainingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  remainingItem: { flex: 1, alignItems: 'center', gap: 4 },
  remainingDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  remainingLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  remainingValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  macroRingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  waterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  waterLeft: { gap: 2 },
  waterValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.info,
  },
  waterBtns: { flexDirection: 'row', gap: Spacing.sm },
  waterBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.infoMuted,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.info,
  },
  waterBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.info,
  },
  waterTrack: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginTop: Spacing.md,
  },
  waterFill: {
    height: '100%',
    backgroundColor: Colors.info,
    borderRadius: BorderRadius.full,
  },
  resetWater: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    alignSelf: 'flex-end',
    marginTop: Spacing.sm,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionBtn: {
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.textMuted,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  sectionLink: {
    fontSize: FontSize.sm,
    color: Colors.accent,
    fontWeight: FontWeight.medium,
  },
  workoutList: { gap: Spacing.sm },
  workoutCard: { padding: Spacing.md },
  workoutRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  workoutIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutInfo: { flex: 1, gap: 2 },
  workoutTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  workoutMeta: { fontSize: FontSize.xs, color: Colors.textMuted },
  rpeBadge: {
    backgroundColor: Colors.warningMuted,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  rpeText: {
    fontSize: FontSize.xs,
    color: Colors.warning,
    fontWeight: FontWeight.semibold,
  },
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.purple,
    padding: Spacing.lg,
  },
  aiCardLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  aiIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.purpleMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiText: { flex: 1, gap: 2 },
  aiTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  aiDesc: { fontSize: FontSize.xs, color: Colors.textMuted },
});
