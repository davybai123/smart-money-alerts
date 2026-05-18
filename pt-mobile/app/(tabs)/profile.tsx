import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useNutritionStore } from '@/store/nutritionStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { supabase } from '@/lib/supabase';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { format } from 'date-fns';

const GOAL_LABELS: Record<string, string> = {
  weight_loss: 'Weight Loss',
  muscle_gain: 'Muscle Gain',
  strength: 'Strength',
  athletic_performance: 'Athletic Performance',
  general_fitness: 'General Fitness',
  fat_loss: 'Fat Loss',
};

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentary',
  lightly_active: 'Lightly Active',
  moderately_active: 'Moderately Active',
  very_active: 'Very Active',
  extremely_active: 'Extremely Active',
};

export default function ProfileScreen() {
  const { profile, user, signOut, setProfile } = useAuthStore();
  const { sessions } = useWorkoutStore();
  const { logs } = useNutritionStore();

  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [newWeight, setNewWeight] = useState(String(profile?.weight_kg || ''));
  const [updatingWeight, setUpdatingWeight] = useState(false);

  const totalWorkouts = sessions.length;
  const totalMinutes = sessions.reduce((acc, s) => acc + s.duration_minutes, 0);
  const memberSince = user?.created_at
    ? format(new Date(user.created_at), 'MMMM yyyy')
    : 'N/A';

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: signOut,
      },
    ]);
  };

  const handleUpdateWeight = async () => {
    const weight = parseFloat(newWeight);
    if (isNaN(weight) || weight < 30 || weight > 300) {
      Alert.alert('Invalid weight', 'Please enter a weight between 30 and 300 kg');
      return;
    }

    if (!user || !profile) return;
    setUpdatingWeight(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ weight_kg: weight })
        .eq('id', user.id);

      if (error) throw error;

      // Also log body metric
      await supabase.from('body_metrics').insert({
        user_id: user.id,
        date: format(new Date(), 'yyyy-MM-dd'),
        weight_kg: weight,
      });

      setProfile({ ...profile, weight_kg: weight });
      setWeightModalVisible(false);
      Alert.alert('Updated!', 'Your weight has been recorded.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update weight.');
    } finally {
      setUpdatingWeight(false);
    }
  };

  if (!profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const initials = profile.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.fullName}>{profile.full_name}</Text>
          <Text style={styles.username}>@{profile.username}</Text>
          <View style={styles.badgeRow}>
            <Badge label={GOAL_LABELS[profile.goal] || profile.goal} variant="success" />
            {profile.sport && <Badge label={profile.sport} variant="info" />}
          </View>
          <Text style={styles.memberSince}>Member since {memberSince}</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.accent }]}>{profile.weight_kg}</Text>
            <Text style={styles.statUnit}>kg</Text>
            <Text style={styles.statLabel}>Weight</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.info }]}>{profile.height_cm}</Text>
            <Text style={styles.statUnit}>cm</Text>
            <Text style={styles.statLabel}>Height</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.warning }]}>{profile.age}</Text>
            <Text style={styles.statUnit}>yrs</Text>
            <Text style={styles.statLabel}>Age</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.purple }]}>{totalWorkouts}</Text>
            <Text style={styles.statUnit}>ses</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </Card>
        </View>

        {/* Nutrition Targets */}
        <Card>
          <Text style={styles.sectionTitle}>Daily Targets</Text>
          <View style={styles.targetsGrid}>
            <TargetItem label="Calories" value={profile.daily_calorie_target} unit="kcal" color={Colors.warning} />
            <TargetItem label="Protein" value={profile.protein_target} unit="g" color={Colors.accent} />
            <TargetItem label="Carbs" value={profile.carbs_target} unit="g" color={Colors.info} />
            <TargetItem label="Fat" value={profile.fat_target} unit="g" color={Colors.danger} />
          </View>
        </Card>

        {/* Training Info */}
        <Card>
          <Text style={styles.sectionTitle}>Training Profile</Text>
          <View style={styles.infoList}>
            <InfoRow
              icon="flag-outline"
              label="Goal"
              value={GOAL_LABELS[profile.goal] || profile.goal}
            />
            <InfoRow
              icon="pulse-outline"
              label="Activity Level"
              value={ACTIVITY_LABELS[profile.activity_level] || profile.activity_level}
            />
            {profile.sport && (
              <InfoRow icon="american-football-outline" label="Sport" value={profile.sport} />
            )}
            {profile.position && (
              <InfoRow icon="person-outline" label="Position" value={profile.position} />
            )}
            <InfoRow
              icon="time-outline"
              label="Total Training"
              value={`${Math.round(totalMinutes / 60)}h ${totalMinutes % 60}m`}
            />
          </View>
        </Card>

        {/* Account Actions */}
        <Card>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.actionList}>
            <ActionRow
              icon="scale-outline"
              label="Update Weight"
              onPress={() => {
                setNewWeight(String(profile.weight_kg));
                setWeightModalVisible(true);
              }}
            />
            <ActionRow
              icon="mail-outline"
              label="Email"
              value={user?.email}
              onPress={() => {}}
            />
            <ActionRow
              icon="notifications-outline"
              label="Notifications"
              onPress={() => Alert.alert('Coming soon', 'Push notification settings coming in next update.')}
            />
            <ActionRow
              icon="shield-outline"
              label="Privacy & Security"
              onPress={() => Alert.alert('Coming soon', 'Privacy settings coming soon.')}
            />
          </View>
        </Card>

        {/* Sign Out */}
        <Button
          label="Sign Out"
          onPress={handleSignOut}
          variant="danger"
          fullWidth
          size="lg"
          icon={<Ionicons name="log-out-outline" size={18} color={Colors.white} />}
        />

        <Text style={styles.version}>PT App v1.0.0 · Made for athletes</Text>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Weight Modal */}
      <Modal
        visible={weightModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setWeightModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Update Weight</Text>
            <TouchableOpacity onPress={() => setWeightModalVisible(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <Text style={styles.weightLabel}>Current weight (kg)</Text>
            <TextInput
              style={styles.weightInput}
              value={newWeight}
              onChangeText={setNewWeight}
              keyboardType="decimal-pad"
              placeholder="e.g. 85.5"
              placeholderTextColor={Colors.textDim}
              autoFocus
            />
            <Text style={styles.weightHint}>
              This will also log a body metric entry for today.
            </Text>
            <Button
              label="Update Weight"
              onPress={handleUpdateWeight}
              loading={updatingWeight}
              fullWidth
              size="lg"
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function TargetItem({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
}) {
  return (
    <View style={targetStyles.item}>
      <Text style={[targetStyles.value, { color }]}>{value}</Text>
      <Text style={targetStyles.unit}>{unit}</Text>
      <Text style={targetStyles.label}>{label}</Text>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={infoStyles.row}>
      <View style={infoStyles.iconContainer}>
        <Ionicons name={icon} size={16} color={Colors.accent} />
      </View>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={actionStyles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={actionStyles.left}>
        <View style={actionStyles.iconContainer}>
          <Ionicons name={icon} size={16} color={Colors.textMuted} />
        </View>
        <Text style={actionStyles.label}>{label}</Text>
      </View>
      <View style={actionStyles.right}>
        {value && <Text style={actionStyles.value} numberOfLines={1}>{value}</Text>}
        <Ionicons name="chevron-forward" size={16} color={Colors.textDim} />
      </View>
    </TouchableOpacity>
  );
}

const targetStyles = StyleSheet.create({
  item: { alignItems: 'center', flex: 1, gap: 2 },
  value: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  unit: { fontSize: FontSize.xs, color: Colors.textMuted },
  label: { fontSize: FontSize.xs, color: Colors.textDim },
});

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: FontSize.sm, color: Colors.textMuted, width: 110 },
  value: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.text, flex: 1, textAlign: 'right' },
});

const actionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  right: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: FontSize.base, color: Colors.text },
  value: { fontSize: FontSize.sm, color: Colors.textMuted, maxWidth: 150 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Colors.textMuted, fontSize: FontSize.base },
  profileHeader: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.accent,
  },
  avatarText: { fontSize: FontSize['3xl'], fontWeight: FontWeight.bold, color: Colors.accent },
  fullName: { fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: Colors.text },
  username: { fontSize: FontSize.base, color: Colors.textMuted },
  badgeRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  memberSince: { fontSize: FontSize.xs, color: Colors.textDim },
  statsGrid: { flexDirection: 'row', gap: Spacing.sm },
  statCard: { flex: 1, alignItems: 'center', padding: Spacing.md, gap: 1 },
  statValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  statUnit: { fontSize: FontSize.xs, color: Colors.textMuted },
  statLabel: { fontSize: FontSize.xs, color: Colors.textDim },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.md,
  },
  targetsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  infoList: { gap: 0 },
  actionList: { gap: 0 },
  version: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
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
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
  modalContent: { padding: Spacing.lg, gap: Spacing.lg },
  weightLabel: { fontSize: FontSize.base, fontWeight: FontWeight.medium, color: Colors.text },
  weightInput: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.bold,
    color: Colors.text,
    textAlign: 'center',
  },
  weightHint: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
});
