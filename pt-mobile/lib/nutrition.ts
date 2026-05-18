import { ActivityLevel, Goal } from '@/types';

export function calculateTDEE(
  weightKg: number,
  heightCm: number,
  age: number,
  activityLevel: ActivityLevel,
  isMale = true
): number {
  // Mifflin-St Jeor BMR
  const bmr = isMale
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  const multipliers: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    extremely_active: 1.9,
  };

  return Math.round(bmr * multipliers[activityLevel]);
}

export function calculateTargets(
  tdee: number,
  goal: Goal,
  weightKg: number
): { calories: number; protein: number; carbs: number; fat: number } {
  const adjustments: Record<Goal, number> = {
    weight_loss: -500,
    fat_loss: -400,
    muscle_gain: 300,
    strength: 200,
    athletic_performance: 0,
    general_fitness: 0,
  };

  const calories = Math.round(tdee + adjustments[goal]);

  // Protein: 2g per kg for performance, 1.6g for general
  const proteinMultiplier = ['athletic_performance', 'strength', 'muscle_gain'].includes(goal)
    ? 2.2
    : ['weight_loss', 'fat_loss'].includes(goal)
      ? 2.0
      : 1.6;
  const protein = Math.round(weightKg * proteinMultiplier);

  // Fat: 25-30% of calories
  const fat = Math.round((calories * 0.27) / 9);

  // Carbs: remaining calories
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

  return { calories, protein, carbs: Math.max(0, carbs), fat };
}

export function getMacroColor(macro: 'calories' | 'protein' | 'carbs' | 'fat'): string {
  const colors = {
    calories: '#f59e0b',
    protein: '#22c55e',
    carbs: '#60a5fa',
    fat: '#f87171',
  };
  return colors[macro];
}

export function getProgressPercent(current: number, target: number): number {
  return Math.min(100, Math.round((current / target) * 100));
}

export function formatMacro(value: number, unit = 'g'): string {
  return `${Math.round(value)}${unit}`;
}

export function getRemainingCalories(current: number, target: number): number {
  return Math.max(0, target - current);
}

export function getMacroPercentage(
  macro: 'protein' | 'carbs' | 'fat',
  totals: { protein: number; carbs: number; fat: number }
): number {
  const totalCalories = totals.protein * 4 + totals.carbs * 4 + totals.fat * 9;
  if (totalCalories === 0) return 0;
  const macroCalories =
    macro === 'fat' ? totals[macro] * 9 : totals[macro] * 4;
  return Math.round((macroCalories / totalCalories) * 100);
}
