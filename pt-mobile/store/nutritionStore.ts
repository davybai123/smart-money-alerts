import { create } from 'zustand';
import { FoodLog, MacroTotals } from '@/types';
import { supabase } from '@/lib/supabase';

interface NutritionState {
  logs: FoodLog[];
  selectedDate: string;
  waterLitres: number;
  isLoading: boolean;
  setDate: (date: string) => void;
  fetchLogs: (userId: string, date: string) => Promise<void>;
  addLog: (log: Omit<FoodLog, 'id' | 'created_at'>) => Promise<void>;
  deleteLog: (id: string) => Promise<void>;
  setWater: (litres: number) => void;
  getTotals: () => MacroTotals;
}

const today = () => new Date().toISOString().split('T')[0];

export const useNutritionStore = create<NutritionState>((set, get) => ({
  logs: [],
  selectedDate: today(),
  waterLitres: 0,
  isLoading: false,

  setDate: (date) => {
    set({ selectedDate: date });
  },

  fetchLogs: async (userId, date) => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('created_at', { ascending: true });

    if (!error) set({ logs: (data as FoodLog[]) || [] });
    set({ isLoading: false });
  },

  addLog: async (log) => {
    const { data, error } = await supabase
      .from('food_logs')
      .insert(log)
      .select()
      .single();

    if (!error && data) {
      set((state) => ({ logs: [...state.logs, data as FoodLog] }));
    }
  },

  deleteLog: async (id) => {
    await supabase.from('food_logs').delete().eq('id', id);
    set((state) => ({ logs: state.logs.filter((l) => l.id !== id) }));
  },

  setWater: (litres) => set({ waterLitres: litres }),

  getTotals: () => {
    const { logs } = get();
    return logs.reduce(
      (acc, log) => ({
        calories: acc.calories + log.calories,
        protein: acc.protein + log.protein,
        carbs: acc.carbs + log.carbs,
        fat: acc.fat + log.fat,
        fiber: acc.fiber + (log.fiber || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    );
  },
}));
