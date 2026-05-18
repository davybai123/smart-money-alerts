import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          full_name: string;
          avatar_url: string | null;
          age: number;
          height_cm: number;
          weight_kg: number;
          goal: string;
          activity_level: string;
          daily_calorie_target: number;
          protein_target: number;
          carbs_target: number;
          fat_target: number;
          sport: string | null;
          position: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      food_logs: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          meal: string;
          food_name: string;
          brand: string | null;
          barcode: string | null;
          calories: number;
          protein: number;
          carbs: number;
          fat: number;
          fiber: number | null;
          quantity: number;
          serving_unit: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['food_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['food_logs']['Insert']>;
      };
      workout_sessions: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          title: string;
          type: string;
          duration_minutes: number;
          notes: string | null;
          rpe: number | null;
          ai_generated: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['workout_sessions']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['workout_sessions']['Insert']>;
      };
      workout_exercises: {
        Row: {
          id: string;
          session_id: string;
          name: string;
          sets: number;
          reps: number;
          weight_kg: number;
          notes: string | null;
          rest_seconds: number | null;
          order_index: number;
        };
        Insert: Omit<Database['public']['Tables']['workout_exercises']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['workout_exercises']['Insert']>;
      };
      ai_messages: {
        Row: {
          id: string;
          user_id: string;
          role: string;
          content: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['ai_messages']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['ai_messages']['Insert']>;
      };
      body_metrics: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          weight_kg: number;
          body_fat_pct: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['body_metrics']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['body_metrics']['Insert']>;
      };
    };
  };
};
