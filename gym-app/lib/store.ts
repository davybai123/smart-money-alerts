// Client-side localStorage helpers for all data modules

export function getItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function setItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export type Exercise = {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  unit: "kg" | "lbs";
  notes: string;
};

export type Session = {
  id: string;
  date: string;
  title: string;
  type: string;
  duration: number;
  exercises: Exercise[];
  notes: string;
  rpe: number;
};

export type Supplement = {
  id: string;
  name: string;
  dosage: string;
  timing: string;
  category: string;
  notes: string;
};

export type SupplementLog = {
  id: string;
  date: string;
  supplementId: string;
  supplementName: string;
  taken: boolean;
  time: string;
};

export type FoodEntry = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  quantity: number;
  unit: string;
  meal: "breakfast" | "lunch" | "dinner" | "snack" | "pre-workout" | "post-workout";
};

export type NutritionDay = {
  id: string;
  date: string;
  entries: FoodEntry[];
  waterLitres: number;
  notes: string;
};

export type Recipe = {
  id: string;
  title: string;
  category: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string[];
  instructions: string[];
  tags: string[];
  createdAt: string;
};

export type JournalEntry = {
  id: string;
  date: string;
  title: string;
  content: string;
  mood: number;
  energy: number;
  tags: string[];
  createdAt: string;
};

export type Message = {
  id: string;
  from: "pt" | "athlete";
  fromName: string;
  content: string;
  timestamp: string;
  read: boolean;
};

export type Conversation = {
  id: string;
  athleteName: string;
  athleteRole: string;
  avatar: string;
  lastMessage: string;
  lastTime: string;
  unread: number;
  messages: Message[];
};
