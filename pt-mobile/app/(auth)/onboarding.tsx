import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { calculateTDEE, calculateTargets } from '@/lib/nutrition';
import { Goal, ActivityLevel } from '@/types';

const GOALS: { key: Goal; label: string; icon: string; desc: string }[] = [
  { key: 'weight_loss', label: 'Lose Weight', icon: '📉', desc: 'Caloric deficit + cardio' },
  { key: 'muscle_gain', label: 'Build Muscle', icon: '💪', desc: 'Hyperthrophy + progressive overload' },
  { key: 'strength', label: 'Get Stronger', icon: '🏋️', desc: 'Maximal strength focus' },
  { key: 'athletic_performance', label: 'Athletic Performance', icon: '⚡', desc: 'Sport-specific training' },
  { key: 'fat_loss', label: 'Body Recomp', icon: '🔥', desc: 'Lose fat, keep muscle' },
  { key: 'general_fitness', label: 'General Fitness', icon: '🏃', desc: 'All-round health improvement' },
];

const ACTIVITY_LEVELS: { key: ActivityLevel; label: string; desc: string }[] = [
  { key: 'sedentary', label: 'Sedentary', desc: 'Desk job, little exercise' },
  { key: 'lightly_active', label: 'Lightly Active', desc: '1-3 days/week' },
  { key: 'moderately_active', label: 'Moderately Active', desc: '3-5 days/week' },
  { key: 'very_active', label: 'Very Active', desc: '6-7 days/week' },
  { key: 'extremely_active', label: 'Extreme', desc: 'Athlete / 2x day training' },
];

type Step = 'personal' | 'body' | 'goals' | 'activity' | 'sport';

export default function OnboardingScreen() {
  const { user, setProfile } = useAuthStore();
  const [step, setStep] = useState<Step>('personal');
  const [loading, setLoading] = useState(false);

  // Form state
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [username, setUsername] = useState('');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [goal, setGoal] = useState<Goal>('athletic_performance');
  const [activity, setActivity] = useState<ActivityLevel>('moderately_active');
  const [sport, setSport] = useState('');
  const [position, setPosition] = useState('');

  const steps: Step[] = ['personal', 'body', 'goals', 'activity', 'sport'];
  const stepIndex = steps.indexOf(step);
  const progress = (stepIndex + 1) / steps.length;

  const goNext = () => {
    const nextStep = steps[stepIndex + 1];
    if (nextStep) setStep(nextStep);
  };

  const goBack = () => {
    const prevStep = steps[stepIndex - 1];
    if (prevStep) setStep(prevStep);
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const weightKg = parseFloat(weight);
      const heightCm = parseFloat(height);
      const ageNum = parseInt(age, 10);

      const tdee = calculateTDEE(weightKg, heightCm, ageNum, activity, gender === 'male');
      const targets = calculateTargets(tdee, goal, weightKg);

      const profileData = {
        id: user.id,
        username: username.trim().toLowerCase() || user.email?.split('@')[0] || 'athlete',
        full_name: fullName.trim(),
        age: ageNum,
        height_cm: heightCm,
        weight_kg: weightKg,
        goal,
        activity_level: activity,
        daily_calorie_target: targets.calories,
        protein_target: targets.protein,
        carbs_target: targets.carbs,
        fat_target: targets.fat,
        sport: sport.trim() || null,
        position: position.trim() || null,
        avatar_url: null,
      };

      const { data, error } = await supabase
        .from('profiles')
        .upsert(profileData)
        .select()
        .single();

      if (error) throw error;

      setProfile(data as any);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'personal':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>About you</Text>
            <Text style={styles.stepDesc}>Let's personalize your experience</Text>
            <View style={styles.fields}>
              <Input
                label="Full Name"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your full name"
                autoCapitalize="words"
                icon="person-outline"
              />
              <Input
                label="Username"
                value={username}
                onChangeText={setUsername}
                placeholder="@username"
                autoCapitalize="none"
                autoCorrect={false}
                icon="at-outline"
              />
              <View>
                <Text style={styles.fieldLabel}>Gender</Text>
                <View style={styles.genderRow}>
                  {(['male', 'female'] as const).map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.genderBtn, gender === g && styles.genderBtnSelected]}
                      onPress={() => setGender(g)}
                    >
                      <Text style={[styles.genderText, gender === g && styles.genderTextSelected]}>
                        {g === 'male' ? '♂ Male' : '♀ Female'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <Button
              label="Continue"
              onPress={goNext}
              fullWidth
              size="lg"
              disabled={!fullName.trim()}
            />
          </View>
        );

      case 'body':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Body stats</Text>
            <Text style={styles.stepDesc}>Used to calculate your nutrition targets</Text>
            <View style={styles.fields}>
              <Input
                label="Age"
                value={age}
                onChangeText={setAge}
                placeholder="25"
                keyboardType="number-pad"
                icon="calendar-outline"
                hint="Years old"
              />
              <Input
                label="Height (cm)"
                value={height}
                onChangeText={setHeight}
                placeholder="180"
                keyboardType="decimal-pad"
                icon="resize-outline"
                hint="In centimetres"
              />
              <Input
                label="Weight (kg)"
                value={weight}
                onChangeText={setWeight}
                placeholder="85"
                keyboardType="decimal-pad"
                icon="scale-outline"
                hint="Current bodyweight in kg"
              />
            </View>
            <Button
              label="Continue"
              onPress={goNext}
              fullWidth
              size="lg"
              disabled={!age || !height || !weight}
            />
          </View>
        );

      case 'goals':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Your goal</Text>
            <Text style={styles.stepDesc}>What are you training for?</Text>
            <View style={styles.goalGrid}>
              {GOALS.map((g) => (
                <TouchableOpacity
                  key={g.key}
                  style={[styles.goalCard, goal === g.key && styles.goalCardSelected]}
                  onPress={() => setGoal(g.key)}
                >
                  <Text style={styles.goalIcon}>{g.icon}</Text>
                  <Text style={[styles.goalLabel, goal === g.key && styles.goalLabelSelected]}>
                    {g.label}
                  </Text>
                  <Text style={styles.goalDesc}>{g.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button label="Continue" onPress={goNext} fullWidth size="lg" />
          </View>
        );

      case 'activity':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Activity level</Text>
            <Text style={styles.stepDesc}>How active are you day-to-day?</Text>
            <View style={styles.activityList}>
              {ACTIVITY_LEVELS.map((a) => (
                <TouchableOpacity
                  key={a.key}
                  style={[styles.activityCard, activity === a.key && styles.activityCardSelected]}
                  onPress={() => setActivity(a.key)}
                >
                  <View style={styles.activityCheck}>
                    {activity === a.key && (
                      <Ionicons name="checkmark" size={16} color={Colors.black} />
                    )}
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={[styles.activityLabel, activity === a.key && styles.activityLabelSelected]}>
                      {a.label}
                    </Text>
                    <Text style={styles.activityDesc}>{a.desc}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <Button label="Continue" onPress={goNext} fullWidth size="lg" />
          </View>
        );

      case 'sport':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Sport & Position</Text>
            <Text style={styles.stepDesc}>Optional — helps us tailor training programs</Text>
            <View style={styles.fields}>
              <Input
                label="Sport"
                value={sport}
                onChangeText={setSport}
                placeholder="e.g. Rugby, Football, MMA"
                icon="american-football-outline"
              />
              <Input
                label="Position / Role"
                value={position}
                onChangeText={setPosition}
                placeholder="e.g. Flanker, Striker, Coach"
                icon="person-outline"
              />
            </View>
            <View style={styles.skipRow}>
              <Button
                label="Complete Setup"
                onPress={handleSubmit}
                loading={loading}
                fullWidth
                size="lg"
              />
              <TouchableOpacity onPress={handleSubmit} style={styles.skipBtn}>
                <Text style={styles.skipText}>Skip for now</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>
            Step {stepIndex + 1} of {steps.length}
          </Text>
        </View>

        {/* Back button */}
        {stepIndex > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={goBack}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
        )}

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderStep()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  progressContainer: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.full,
  },
  progressText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    alignSelf: 'flex-end',
  },
  backBtn: {
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing['2xl'],
    paddingTop: Spacing.lg,
  },
  stepContent: {
    flex: 1,
    gap: Spacing['2xl'],
  },
  stepTitle: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  stepDesc: {
    fontSize: FontSize.base,
    color: Colors.textMuted,
    marginTop: -Spacing.lg,
  },
  fields: {
    gap: Spacing.lg,
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  genderRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  genderBtn: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: 'center',
  },
  genderBtnSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentMuted,
  },
  genderText: {
    fontSize: FontSize.base,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  genderTextSelected: {
    color: Colors.accent,
  },
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  goalCard: {
    width: '47%',
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    gap: Spacing.xs,
  },
  goalCardSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentMuted,
  },
  goalIcon: {
    fontSize: 24,
  },
  goalLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
  },
  goalLabelSelected: {
    color: Colors.accent,
  },
  goalDesc: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
  },
  activityList: {
    gap: Spacing.sm,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  activityCardSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentMuted,
  },
  activityCheck: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: {
    flex: 1,
    gap: 2,
  },
  activityLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
  },
  activityLabelSelected: {
    color: Colors.text,
  },
  activityDesc: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
  },
  skipRow: {
    gap: Spacing.md,
    alignItems: 'center',
  },
  skipBtn: {
    padding: Spacing.sm,
  },
  skipText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
});
