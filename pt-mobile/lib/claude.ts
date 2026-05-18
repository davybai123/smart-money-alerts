import { Profile } from '@/types';

const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
const CLAUDE_MODEL = 'claude-sonnet-4-6';
const API_URL = 'https://api.anthropic.com/v1/messages';

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

function buildSystemPrompt(profile?: Profile | null): string {
  const goalMap: Record<string, string> = {
    weight_loss: 'weight loss and caloric deficit',
    muscle_gain: 'muscle hypertrophy and progressive overload',
    strength: 'maximal strength development',
    athletic_performance: 'athletic performance and sport-specific training',
    general_fitness: 'general health and fitness improvement',
    fat_loss: 'body recomposition and fat loss',
  };

  const basePrompt = `You are an elite AI fitness and nutrition coach embedded in the PT App — a premium coaching platform for rugby players and athletes worldwide. You are a specialist in:
- Performance nutrition and meal planning
- Strength & conditioning programming
- Sport-specific training (especially rugby)
- Recovery and injury prevention
- Body composition optimization

Your communication style is:
- Motivating but data-driven
- Concise and actionable
- Expert but approachable
- Results-focused

Always provide specific, personalized, actionable advice. When generating meal plans or workouts, format them clearly with emojis for readability.`;

  if (!profile) return basePrompt;

  return `${basePrompt}

ATHLETE PROFILE:
- Name: ${profile.full_name}
- Goal: ${goalMap[profile.goal] || profile.goal}
- Age: ${profile.age}
- Height: ${profile.height_cm}cm
- Weight: ${profile.weight_kg}kg
- Sport: ${profile.sport || 'General fitness'}
- Position: ${profile.position || 'N/A'}
- Daily calorie target: ${profile.daily_calorie_target} kcal
- Protein target: ${profile.protein_target}g
- Carbs target: ${profile.carbs_target}g
- Fat target: ${profile.fat_target}g

Always tailor your recommendations to this athlete's specific profile, goals, and sport.`;
}

export async function sendMessage(
  messages: ClaudeMessage[],
  profile?: Profile | null,
  onChunk?: (chunk: string) => void
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('EXPO_PUBLIC_ANTHROPIC_API_KEY is not configured. Add it to your .env file.');
  }

  const useStreaming = !!onChunk;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: buildSystemPrompt(profile),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: useStreaming,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  if (useStreaming && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullText += parsed.delta.text;
              onChunk(parsed.delta.text);
            }
          } catch {
            // ignore malformed SSE chunks
          }
        }
      }
    }
    return fullText;
  }

  const data = await response.json();
  return data.content[0].text;
}

export async function generateMealPlan(profile: Profile): Promise<string> {
  const prompt = `Generate a complete daily meal plan for me based on my profile. Format it with:
- Breakfast, Lunch, Dinner, Snacks, Pre/Post workout meals
- Exact portions and macros for each meal
- Total daily macros at the end
- Practical, easy-to-prepare meals
- Options suitable for my goal: ${profile.goal}

Make it specific, realistic, and delicious. Use emojis for each meal.`;

  return sendMessage([{ role: 'user', content: prompt }], profile);
}

export async function generateWorkout(
  profile: Profile,
  type: string,
  duration: number
): Promise<string> {
  const prompt = `Generate a complete ${type} workout session for me. Duration: ${duration} minutes.

Format it as:
- Warm-up (5-10 min)
- Main workout with exact sets, reps, and weights
- Cool-down
- RPE targets
- Rest periods
- Coaching notes

Make it progressive and appropriate for my goal: ${profile.goal}.`;

  return sendMessage([{ role: 'user', content: prompt }], profile);
}

export async function analyzeNutrition(
  foodLogs: Array<{ name: string; calories: number; protein: number; carbs: number; fat: number }>,
  goals: { calories: number; protein: number; carbs: number; fat: number },
  profile: Profile
): Promise<string> {
  const logged = foodLogs.reduce(
    (acc, f) => ({
      calories: acc.calories + f.calories,
      protein: acc.protein + f.protein,
      carbs: acc.carbs + f.carbs,
      fat: acc.fat + f.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const prompt = `Analyze my nutrition today and give me specific feedback:

Today's intake:
- Calories: ${Math.round(logged.calories)} / ${goals.calories} kcal
- Protein: ${Math.round(logged.protein)}g / ${goals.protein}g
- Carbs: ${Math.round(logged.carbs)}g / ${goals.carbs}g
- Fat: ${Math.round(logged.fat)}g / ${goals.fat}g

Foods eaten: ${foodLogs.map((f) => f.name).join(', ')}

Give me:
1. Quick assessment (1-2 sentences)
2. What I'm doing well
3. What needs improvement
4. 2-3 specific food suggestions to hit my remaining targets
5. One coaching tip for tomorrow`;

  return sendMessage([{ role: 'user', content: prompt }], profile);
}
