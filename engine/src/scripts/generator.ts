import { createLogger } from '../lib/logger';
import { generateJSON, generateContent } from '../lib/claude';
import { ResearchOutput } from '../research/researcher';
import { ScriptScene, ScriptSegment } from '../db/schema';
import { ContentOpportunityInput } from '../discovery/scorer';

const log = createLogger('scripts/generator');

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ScriptGeneratorInput {
  opportunity: ContentOpportunityInput;
  research: ResearchOutput;
  targetDurationSeconds?: number;  // default 480 (8 minutes)
  style?: 'dramatic' | 'analytical' | 'storytelling';
}

export interface GeneratedScript {
  title: string;
  hook: string;
  scenes: ScriptScene[];
  wordCount: number;
  estimatedDurationSeconds: number;
  hookVariants: string[];
}

// ─── Schema ────────────────────────────────────────────────────────────────

const SCRIPT_SCHEMA = `{
  "title": "string",
  "hook": "string",
  "scenes": [
    {
      "scene_number": 1,
      "segment": "hook|open_loop|problem|story|value|twist|payoff|cta",
      "narration": "string",
      "broll_cue": "string",
      "tone": "string",
      "duration_seconds": 30
    }
  ]
}`;

// ─── Segment duration targets (seconds) ────────────────────────────────────

const SEGMENT_DURATIONS: Record<ScriptSegment, number> = {
  hook: 30,
  open_loop: 45,
  problem: 60,
  story: 120,
  value: 90,
  twist: 60,
  payoff: 60,
  cta: 30,
};

// ─── Generator ─────────────────────────────────────────────────────────────

/**
 * Generate a complete 8-segment YouTube script from research data.
 */
export async function generateScript(
  input: ScriptGeneratorInput
): Promise<GeneratedScript> {
  const {
    opportunity,
    research,
    targetDurationSeconds = 480,
    style = 'dramatic',
  } = input;

  const { topic, teams } = opportunity;

  log.info('Generating script', { topic, teams, targetDurationSeconds, style });

  const styleGuide = {
    dramatic: 'emotional, high-stakes, with vivid storytelling and tension-building',
    analytical: 'data-driven, insightful, with expert breakdown and tactical depth',
    storytelling: 'narrative-focused, character-driven, immersive and cinematic',
  }[style];

  const keyFactsSummary = research.keyFacts.slice(0, 5).join('\n- ');
  const statsSummary = research.statistics.slice(0, 5).join('\n- ');
  const storylinesSummary = research.storylines.slice(0, 4).join('\n- ');
  const controversiesSummary = research.controversies.slice(0, 3).join('\n- ');
  const historicalSummary = research.historicalContext.slice(0, 3).join('\n- ');
  const quotesSummary = research.expertQuotes.slice(0, 3).join('\n- ');

  const prompt = `You are a professional YouTube scriptwriter specializing in viral soccer/football content.

Write a complete, engaging YouTube video script about:
Topic: ${topic}
Teams/Players: ${teams}

Style: ${styleGuide}
Target Duration: ~${targetDurationSeconds} seconds total

RESEARCH MATERIAL:
Key Facts:
- ${keyFactsSummary}

Statistics:
- ${statsSummary}

Storylines:
- ${storylinesSummary}

Controversies:
- ${controversiesSummary}

Historical Context:
- ${historicalSummary}

Expert Quotes/Opinions:
- ${quotesSummary}

Write exactly 8 scenes using these segments IN ORDER:
1. HOOK (30s) — Grab attention in the first 3 seconds. Start with the most shocking fact or question. No "Hey guys welcome back".
2. OPEN_LOOP (45s) — Tease what's coming, build anticipation. "By the end of this video, you'll understand why..."
3. PROBLEM (60s) — Set up the central tension or conflict. What's at stake?
4. STORY (120s) — The main narrative. Use the key facts, stats, and storylines. Be specific.
5. VALUE (90s) — Deep insights, analysis, lesser-known facts. This is the "meat" of the video.
6. TWIST (60s) — The surprise or revelation. Something viewers don't expect.
7. PAYOFF (60s) — Resolution and impact. Why does this matter? Emotional resonance.
8. CTA (30s) — Call to action. Ask viewers to subscribe/comment on a specific question.

For each scene provide:
- narration: Exact words the narrator speaks (conversational, not formal)
- broll_cue: Specific video footage description for editors (e.g. "slow motion goal replay", "aerial shot of stadium")
- tone: One word describing the emotional tone (e.g. "tense", "triumphant", "mysterious")
- duration_seconds: Target seconds for this scene

Also provide:
- title: A click-worthy YouTube title (60 chars max, includes numbers or power words)
- hook: The single most compelling hook sentence (used as thumbnail text or description preview)`;

  interface RawScript {
    title: string;
    hook: string;
    scenes: ScriptScene[];
  }

  const raw = await generateJSON<RawScript>(prompt, SCRIPT_SCHEMA, {
    maxTokens: 6000,
  });

  // Ensure scene numbers are correct and segments are valid
  const validSegments: ScriptSegment[] = [
    'hook', 'open_loop', 'problem', 'story', 'value', 'twist', 'payoff', 'cta',
  ];

  const scenes: ScriptScene[] = raw.scenes.map((scene, idx) => ({
    scene_number: idx + 1,
    segment: validSegments[idx] ?? scene.segment,
    narration: scene.narration ?? '',
    broll_cue: scene.broll_cue ?? '',
    tone: scene.tone ?? 'neutral',
    duration_seconds:
      scene.duration_seconds > 0
        ? scene.duration_seconds
        : SEGMENT_DURATIONS[validSegments[idx] ?? scene.segment],
  }));

  const wordCount = scenes.reduce((sum, s) => {
    return sum + s.narration.split(/\s+/).filter(Boolean).length;
  }, 0);

  const estimatedDurationSeconds = scenes.reduce(
    (sum, s) => sum + s.duration_seconds,
    0
  );

  // Generate hook variants for A/B testing thumbnails
  const hookVariants = await generateHookVariants(topic, research.keyFacts);

  const result: GeneratedScript = {
    title: raw.title,
    hook: raw.hook,
    scenes,
    wordCount,
    estimatedDurationSeconds,
    hookVariants,
  };

  log.info('Script generated', {
    topic,
    title: result.title,
    wordCount: result.wordCount,
    estimatedDurationSeconds: result.estimatedDurationSeconds,
    sceneCount: result.scenes.length,
  });

  return result;
}

/**
 * Generate 3 alternative hook sentences for A/B testing.
 */
export async function generateHookVariants(
  topic: string,
  keyFacts: string[]
): Promise<string[]> {
  log.debug('Generating hook variants', { topic });

  const factsForPrompt = keyFacts.slice(0, 4).join('\n- ');

  const prompt = `Generate exactly 3 different YouTube hook sentences for a video about: "${topic}"

Key facts to draw from:
- ${factsForPrompt}

Rules:
- Each hook must be a single sentence (max 15 words)
- Each must be a different style: (1) shocking stat, (2) provocative question, (3) bold claim
- No "hey guys" or greetings
- Designed to hook viewers in the first 3 seconds

Return ONLY a JSON array of 3 strings: ["hook1", "hook2", "hook3"]`;

  const raw = await generateContent(prompt, { maxTokens: 512 });

  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as string[];
    if (Array.isArray(parsed) && parsed.length >= 1) {
      return parsed.slice(0, 3);
    }
  } catch {
    log.warn('Could not parse hook variants JSON, falling back to empty array');
  }

  return [];
}
