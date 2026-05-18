export type Goal = 'weight_loss' | 'muscle_gain' | 'strength' | 'athletic_performance' | 'general_fitness' | 'fat_loss';
export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_workout' | 'post_workout';
export type WorkoutType = 'strength' | 'cardio' | 'rugby' | 'hiit' | 'recovery' | 'mobility' | 'sport_specific';
export type MessageRole = 'user' | 'assistant';

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  age: number;
  height_cm: number;
  weight_kg: number;
  goal: Goal;
  activity_level: ActivityLevel;
  daily_calorie_target: number;
  protein_target: number;
  carbs_target: number;
  fat_target: number;
  sport?: string;
  position?: string;
  created_at: string;
}

export interface FoodItem {
  id?: string;
  name: string;
  brand?: string;
  barcode?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  salt?: number;
  serving_size: number;
  serving_unit: string;
}

export interface FoodLog {
  id: string;
  user_id: string;
  date: string;
  meal: MealType;
  food_name: string;
  brand?: string;
  barcode?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  quantity: number;
  serving_unit: string;
  created_at: string;
}

export interface DayNutrition {
  date: string;
  logs: FoodLog[];
  totals: MacroTotals;
  water_litres: number;
}

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface Exercise {
  id?: string;
  name: string;
  sets: number;
  reps: number;
  weight_kg: number;
  notes?: string;
  rest_seconds?: number;
  order_index: number;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  date: string;
  title: string;
  type: WorkoutType;
  duration_minutes: number;
  notes?: string;
  rpe?: number;
  ai_generated: boolean;
  exercises: Exercise[];
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
}

export interface BodyMetric {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number;
  body_fat_pct?: number;
  notes?: string;
}

export interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water_litres: number;
}

export interface OpenFoodFactsProduct {
  code: string;
  product: {
    product_name: string;
    brands?: string;
    nutriments: {
      'energy-kcal_100g': number;
      proteins_100g: number;
      carbohydrates_100g: number;
      fat_100g: number;
      fiber_100g?: number;
      sugars_100g?: number;
      salt_100g?: number;
    };
    serving_size?: string;
    serving_quantity?: number;
  };
  status: number;
}
