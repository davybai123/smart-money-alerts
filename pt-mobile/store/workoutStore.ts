import { create } from 'zustand';
import { WorkoutSession } from '@/types';
import { supabase } from '@/lib/supabase';

interface WorkoutState {
  sessions: WorkoutSession[];
  activeSession: WorkoutSession | null;
  isLoading: boolean;
  fetchSessions: (userId: string) => Promise<void>;
  createSession: (
    session: Omit<WorkoutSession, 'id' | 'created_at' | 'exercises'>
  ) => Promise<WorkoutSession | null>;
  updateSession: (id: string, updates: Partial<WorkoutSession>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  setActiveSession: (session: WorkoutSession | null) => void;
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  sessions: [],
  activeSession: null,
  isLoading: false,

  fetchSessions: async (userId) => {
    set({ isLoading: true });
    const { data: sessionData, error } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (!error && sessionData) {
      const sessionsWithExercises = await Promise.all(
        sessionData.map(async (s) => {
          const { data: exercises } = await supabase
            .from('workout_exercises')
            .select('*')
            .eq('session_id', s.id)
            .order('order_index');
          return { ...s, exercises: exercises || [] } as WorkoutSession;
        })
      );
      set({ sessions: sessionsWithExercises });
    }
    set({ isLoading: false });
  },

  createSession: async (sessionData) => {
    const { data, error } = await supabase
      .from('workout_sessions')
      .insert({ ...sessionData, ai_generated: sessionData.ai_generated ?? false })
      .select()
      .single();

    if (error || !data) return null;

    const session = { ...data, exercises: [] } as WorkoutSession;
    set((state) => ({ sessions: [session, ...state.sessions] }));
    return session;
  },

  updateSession: async (id, updates) => {
    await supabase.from('workout_sessions').update(updates).eq('id', id);
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
  },

  deleteSession: async (id) => {
    await supabase.from('workout_sessions').delete().eq('id', id);
    set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) }));
  },

  setActiveSession: (session) => set({ activeSession: session }),
}));
