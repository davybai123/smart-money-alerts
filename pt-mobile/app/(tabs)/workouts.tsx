import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { SessionCard } from '@/components/workouts/SessionCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { generateWorkout } from '@/lib/claude';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { WorkoutType } from '@/types';
import { format } from 'date-fns';

const WORKOUT_TYPES: { type: WorkoutType; label: string; icon: string; desc: string }[] = [
  { type: 'strength', label: 'Strength', icon: '🏋️', desc: 'Heavy compound lifts' },
  { type: 'cardio', label: 'Cardio', icon: '🏃', desc: 'Aerobic conditioning' },
  { type: 'rugby', label: 'Rugby', icon: '🏉', desc: 'Sport-specific session' },
  { type: 'hiit', label: 'HIIT', icon: '⚡', desc: 'High intensity intervals' },
  { type: 'recovery', label: 'Recovery', icon: '🧘', desc: 'Active recovery' },
  { type: 'mobility', label: 'Mobility', icon: '🤸', desc: 'Flexibility & movement' },
];

const DURATIONS = [30, 45, 60, 75, 90];

export default function WorkoutsScreen() {
  const { user, profile } = useAuthStore();
  const { sessions, fetchSessions, createSession, deleteSession, isLoading } = useWorkoutStore();

  const [refreshing, setRefreshing] = useState(false);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<WorkoutType>('strength');
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [generating, setGenerating] = useState(false);
  const [aiResult, setAiResult] = useState('');

  const loadSessions = useCallback(async () => {
    if (user) await fetchSessions(user.id);
  }, [user]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  };

  const handleGenerateWorkout = async () => {
    if (!profile) return;
    setGenerating(true);
    setAiResult('');
    try {
      const result = await generateWorkout(profile, selectedType, selectedDuration);
      setAiResult(result);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to generate workout. Check your API key.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveWorkout = async () => {
    if (!user || !aiResult) return;
    const session = await createSession({
      user_id: user.id,
      date: format(new Date(), 'yyyy-MM-dd'),
      title: `AI ${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} Session`,
      type: selectedType,
      duration_minutes: selectedDuration,
      notes: aiResult,
      ai_generated: true,
    });
    if (session) {
      setAiModalVisible(false);
      setAiResult('');
      Alert.alert('Saved!', 'Workout saved to your log.');
    }
  };

  const handleDeleteSession = (id: string) => {
    Alert.alert('Delete Workout', 'Are you sure you want to delete this session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteSession(id),
      },
    ]);
  };

  const handleQuickStart = async () => {
    if (!user) return;
    const session = await createSession({
      user_id: user.id,
      date: format(new Date(), 'yyyy-MM-dd'),
      title: 'Quick Workout',
      type: 'strength',
      duration_minutes: 60,
      ai_generated: false,
    });
    if (session) {
      Alert.alert('Started!', 'Workout session created. Add exercises as you go.');
    }
  };

  const totalWorkouts = sessions.length;
  const totalMinutes = sessions.reduce((acc, s) => acc + s.duration_minutes, 0);
  const thisWeekSessions = sessions.filter((s) => {
    const sessionDate = new Date(s.date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return sessionDate >= weekAgo;
  }).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Workouts</Text>
        <TouchableOpacity
          style={styles.aiBtn}
          onPress={() => setAiModalVisible(true)}
        >
          <Ionicons name="flash" size={18} color={Colors.purple} />
          <Text style={styles.aiBtnText}>AI Generate</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
      >
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{totalWorkouts}</Text>
            <Text style={styles.statLabel}>Total Sessions</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.info }]}>{thisWeekSessions}</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.warning }]}>
              {Math.round(totalMinutes / 60)}h
            </Text>
            <Text style={styles.statLabel}>Total Time</Text>
          </Card>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Button
            label="Start Workout"
            onPress={handleQuickStart}
            fullWidth
            icon={<Ionicons name="play" size={18} color={Colors.black} />}
          />
          <TouchableOpacity
            style={styles.aiGenerateCard}
            onPress={() => setAiModalVisible(true)}
            activeOpacity={0.85}
          >
            <View style={styles.aiGenerateLeft}>
              <View style={styles.aiGenerateIcon}>
                <Ionicons name="flash" size={22} color={Colors.purple} />
              </View>
              <View>
                <Text style={styles.aiGenerateTitle}>Generate AI Workout</Text>
                <Text style={styles.aiGenerateDesc}>
                  Let your coach design the perfect session
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Session History */}
        <Text style={styles.sectionTitle}>Workout History</Text>

        {isLoading ? (
          <ActivityIndicator color={Colors.accent} style={styles.loader} />
        ) : sessions.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="barbell-outline" size={40} color={Colors.textDim} />
            <Text style={styles.emptyTitle}>No workouts yet</Text>
            <Text style={styles.emptyDesc}>
              Start your first session or generate one with AI
            </Text>
          </Card>
        ) : (
          <View style={styles.sessionList}>
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onDelete={handleDeleteSession}
              />
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* AI Generate Modal */}
      <Modal
        visible={aiModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAiModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <Ionicons name="flash" size={22} color={Colors.purple} />
              <Text style={styles.modalTitle}>AI Workout Generator</Text>
            </View>
            <TouchableOpacity onPress={() => { setAiModalVisible(false); setAiResult(''); }}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.flex} contentContainerStyle={styles.modalContent}>
            {!aiResult ? (
              <>
                <Text style={styles.modalSectionLabel}>Workout Type</Text>
                <View style={styles.typeGrid}>
                  {WORKOUT_TYPES.map((w) => (
                    <TouchableOpacity
                      key={w.type}
                      style={[
                        styles.typeCard,
                        selectedType === w.type && styles.typeCardSelected,
                      ]}
                      onPress={() => setSelectedType(w.type)}
                    >
                      <Text style={styles.typeIcon}>{w.icon}</Text>
                      <Text style={[
                        styles.typeLabel,
                        selectedType === w.type && styles.typeLabelSelected,
                      ]}>
                        {w.label}
                      </Text>
                      <Text style={styles.typeDesc}>{w.desc}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.modalSectionLabel}>Duration</Text>
                <View style={styles.durationRow}>
                  {DURATIONS.map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.durationBtn,
                        selectedDuration === d && styles.durationBtnSelected,
                      ]}
                      onPress={() => setSelectedDuration(d)}
                    >
                      <Text style={[
                        styles.durationText,
                        selectedDuration === d && styles.durationTextSelected,
                      ]}>
                        {d}m
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Button
                  label={generating ? 'Generating...' : 'Generate Workout'}
                  onPress={handleGenerateWorkout}
                  loading={generating}
                  fullWidth
                  size="lg"
                  icon={<Ionicons name="flash" size={18} color={Colors.black} />}
                />
              </>
            ) : (
              <View style={styles.resultContainer}>
                <View style={styles.resultHeader}>
                  <View style={styles.resultBadge}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.accent} />
                    <Text style={styles.resultBadgeText}>Workout Generated</Text>
                  </View>
                </View>
                <Card style={styles.resultCard}>
                  <Text style={styles.resultText}>{aiResult}</Text>
                </Card>
                <View style={styles.resultActions}>
                  <Button
                    label="Save to Log"
                    onPress={handleSaveWorkout}
                    fullWidth
                    size="lg"
                    icon={<Ionicons name="save-outline" size={18} color={Colors.black} />}
                  />
                  <Button
                    label="Regenerate"
                    onPress={() => { setAiResult(''); handleGenerateWorkout(); }}
                    fullWidth
                    variant="outline"
                    size="md"
                  />
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitle: { fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: Colors.text },
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.purpleMuted,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.purple,
  },
  aiBtnText: { fontSize: FontSize.sm, color: Colors.purple, fontWeight: FontWeight.semibold },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: { flex: 1, alignItems: 'center', padding: Spacing.md, gap: 4 },
  statValue: { fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: Colors.accent },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
  quickActions: { gap: Spacing.md },
  aiGenerateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.purple,
    padding: Spacing.lg,
  },
  aiGenerateLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  aiGenerateIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.purpleMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiGenerateTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text },
  aiGenerateDesc: { fontSize: FontSize.xs, color: Colors.textMuted },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  loader: { marginTop: Spacing['3xl'] },
  emptyCard: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing['4xl'],
  },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.textMuted },
  emptyDesc: { fontSize: FontSize.sm, color: Colors.textDim, textAlign: 'center' },
  sessionList: { gap: Spacing.md },
  // Modal
  modalSafe: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
  modalContent: { padding: Spacing.lg, gap: Spacing.xl },
  modalSectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  typeCard: {
    width: '47%',
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    gap: Spacing.xs,
  },
  typeCardSelected: {
    borderColor: Colors.purple,
    backgroundColor: Colors.purpleMuted,
  },
  typeIcon: { fontSize: 22 },
  typeLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
  },
  typeLabelSelected: { color: Colors.purple },
  typeDesc: { fontSize: FontSize.xs, color: Colors.textDim },
  durationRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  durationBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  durationBtnSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentMuted,
  },
  durationText: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.medium },
  durationTextSelected: { color: Colors.accent },
  resultContainer: { gap: Spacing.lg },
  resultHeader: { alignItems: 'center' },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.accentMuted,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  resultBadgeText: { fontSize: FontSize.sm, color: Colors.accent, fontWeight: FontWeight.semibold },
  resultCard: { padding: Spacing.lg },
  resultText: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 22 },
  resultActions: { gap: Spacing.md },
});
