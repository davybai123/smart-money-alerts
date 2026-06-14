import { createLogger } from '../lib/logger';
import { generateJSON } from '../lib/claude';
import { ScriptScene } from '../db/schema';
import { GeneratedScript } from './generator';

const log = createLogger('scripts/optimizer');

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RetentionAnalysis {
  overallScore: number;          // 0-100
  hookStrength: number;          // 0-100
  paceScore: number;             // 0-100
  engagementScore: number;       // 0-100
  dropOffRisks: string[];        // segments/moments with retention risk
  strengths: string[];
}

export interface QualityIssue {
  type: 'filler_words' | 'weak_hook' | 'missing_cta' | 'too_short' | 'too_long'
      | 'low_energy' | 'vague_broll' | 'no_controversy' | 'repetitive';
  severity: 'low' | 'medium' | 'high';
  description: string;
  location?: string;  // scene or segment name
}

export interface QualityReport {
  passed: boolean;
  overallScore: number;  // 0-100
  issues: QualityIssue[];
}

// ─── Filler phrase detection ────────────────────────────────────────────────

const FILLER_PHRASES = [
  'basically',
  'you know',
  'um',
  'uh',
  'like i said',
  'as i mentioned',
  'at the end of the day',
  'to be honest',
  'literally',
  'obviously',
  'clearly',
  'simply put',
  'in other words',
  'so yeah',
  'right so',
];

// ─── Quality check thresholds ───────────────────────────────────────────────

const MIN_WORD_COUNT = 800;
const MAX_WORD_COUNT = 2000;
const MIN_DURATION_SECONDS = 300;
const MAX_DURATION_SECONDS = 720;
const PASSING_SCORE = 70;

// ─── Implementation ─────────────────────────────────────────────────────────

/**
 * Analyze a script's retention potential using heuristics and Claude.
 */
export async function analyzeRetention(
  script: GeneratedScript
): Promise<RetentionAnalysis> {
  log.info('Analyzing retention', { title: script.title });

  const hookScene = script.scenes.find((s) => s.segment === 'hook');
  const fullNarration = script.scenes.map((s) => s.narration).join('\n\n');

  const prompt = `You are a YouTube analytics expert specializing in audience retention.

Analyze this YouTube video script for retention potential:

TITLE: ${script.title}
HOOK: ${script.hook}

FULL SCRIPT:
${script.scenes.map((s) => `[${s.segment.toUpperCase()} - ${s.duration_seconds}s]:\n${s.narration}`).join('\n\n')}

Analyze and return a JSON retention report with:
- overallScore (0-100): Overall predicted retention rate score
- hookStrength (0-100): How compelling the first 30 seconds are
- paceScore (0-100): Whether the pacing keeps viewers engaged throughout
- engagementScore (0-100): How much the content drives comments/engagement
- dropOffRisks (array of strings): 2-4 specific moments/segments where viewers might leave
- strengths (array of strings): 2-4 strongest elements of the script`;

  const schema = `{
  "overallScore": 75,
  "hookStrength": 80,
  "paceScore": 70,
  "engagementScore": 75,
  "dropOffRisks": ["string"],
  "strengths": ["string"]
}`;

  const analysis = await generateJSON<RetentionAnalysis>(prompt, schema, {
    maxTokens: 1024,
  });

  // Clamp all scores to 0-100
  analysis.overallScore = clamp(analysis.overallScore, 0, 100);
  analysis.hookStrength = clamp(analysis.hookStrength, 0, 100);
  analysis.paceScore = clamp(analysis.paceScore, 0, 100);
  analysis.engagementScore = clamp(analysis.engagementScore, 0, 100);

  log.info('Retention analysis complete', {
    title: script.title,
    overallScore: analysis.overallScore,
    hookStrength: analysis.hookStrength,
  });

  return analysis;
}

/**
 * Run quality checks on a generated script without calling the AI.
 * Returns a QualityReport with issues and an overall score.
 */
export function checkQuality(script: GeneratedScript): QualityReport {
  log.debug('Running quality checks', { title: script.title });

  const issues: QualityIssue[] = [];

  // ── Word count check ──────────────────────────────────────────────────
  if (script.wordCount < MIN_WORD_COUNT) {
    issues.push({
      type: 'too_short',
      severity: 'high',
      description: `Script is only ${script.wordCount} words (minimum ${MIN_WORD_COUNT})`,
    });
  } else if (script.wordCount > MAX_WORD_COUNT) {
    issues.push({
      type: 'too_long',
      severity: 'medium',
      description: `Script is ${script.wordCount} words (maximum ${MAX_WORD_COUNT})`,
    });
  }

  // ── Duration check ────────────────────────────────────────────────────
  if (script.estimatedDurationSeconds < MIN_DURATION_SECONDS) {
    issues.push({
      type: 'too_short',
      severity: 'high',
      description: `Estimated duration ${script.estimatedDurationSeconds}s is below minimum ${MIN_DURATION_SECONDS}s`,
    });
  } else if (script.estimatedDurationSeconds > MAX_DURATION_SECONDS) {
    issues.push({
      type: 'too_long',
      severity: 'low',
      description: `Estimated duration ${script.estimatedDurationSeconds}s exceeds recommended ${MAX_DURATION_SECONDS}s`,
    });
  }

  // ── Hook strength ─────────────────────────────────────────────────────
  const hookScene = script.scenes.find((s) => s.segment === 'hook');
  if (!hookScene || hookScene.narration.trim().length < 50) {
    issues.push({
      type: 'weak_hook',
      severity: 'high',
      description: 'Hook scene is missing or too short',
      location: 'hook',
    });
  }

  // Detect greeting clichés in hook
  if (hookScene) {
    const hookLower = hookScene.narration.toLowerCase();
    const badStarts = ['hey guys', 'what is up', 'welcome back', 'hello everyone', 'hi guys'];
    if (badStarts.some((s) => hookLower.startsWith(s))) {
      issues.push({
        type: 'weak_hook',
        severity: 'high',
        description: 'Hook starts with a greeting instead of value',
        location: 'hook',
      });
    }
  }

  // ── CTA check ─────────────────────────────────────────────────────────
  const ctaScene = script.scenes.find((s) => s.segment === 'cta');
  if (!ctaScene || ctaScene.narration.trim().length < 30) {
    issues.push({
      type: 'missing_cta',
      severity: 'medium',
      description: 'CTA scene is missing or too short',
      location: 'cta',
    });
  }

  // ── Filler word detection ─────────────────────────────────────────────
  const fullNarration = script.scenes
    .map((s) => s.narration)
    .join(' ')
    .toLowerCase();

  const foundFillers = FILLER_PHRASES.filter((phrase) =>
    fullNarration.includes(phrase)
  );

  if (foundFillers.length > 3) {
    issues.push({
      type: 'filler_words',
      severity: 'medium',
      description: `Found ${foundFillers.length} filler phrases: ${foundFillers.slice(0, 5).join(', ')}`,
    });
  }

  // ── Vague b-roll cues ─────────────────────────────────────────────────
  const vagueScenes = script.scenes.filter((s) => {
    const broll = s.broll_cue?.trim() ?? '';
    return broll.length < 10 || broll.toLowerCase() === 'generic footage';
  });

  if (vagueScenes.length > 2) {
    issues.push({
      type: 'vague_broll',
      severity: 'low',
      description: `${vagueScenes.length} scenes have vague b-roll cues`,
      location: vagueScenes.map((s) => s.segment).join(', '),
    });
  }

  // ── Low energy scenes ─────────────────────────────────────────────────
  const lowEnergyTones = ['boring', 'flat', 'dull', 'plain', 'neutral'];
  const lowEnergyScenes = script.scenes.filter((s) =>
    lowEnergyTones.some((t) => s.tone?.toLowerCase().includes(t))
  );

  if (lowEnergyScenes.length > 1) {
    issues.push({
      type: 'low_energy',
      severity: 'low',
      description: `${lowEnergyScenes.length} scenes have low-energy tone descriptors`,
      location: lowEnergyScenes.map((s) => s.segment).join(', '),
    });
  }

  // ── Scene count check ─────────────────────────────────────────────────
  if (script.scenes.length < 6) {
    issues.push({
      type: 'too_short',
      severity: 'high',
      description: `Script only has ${script.scenes.length} scenes (expected 8)`,
    });
  }

  // ── Score calculation ─────────────────────────────────────────────────
  const highIssues = issues.filter((i) => i.severity === 'high').length;
  const mediumIssues = issues.filter((i) => i.severity === 'medium').length;
  const lowIssues = issues.filter((i) => i.severity === 'low').length;

  const penalty = highIssues * 20 + mediumIssues * 10 + lowIssues * 5;
  const overallScore = Math.max(0, 100 - penalty);
  const passed = overallScore >= PASSING_SCORE && highIssues === 0;

  log.info('Quality check complete', {
    title: script.title,
    overallScore,
    passed,
    issueCount: issues.length,
    highIssues,
  });

  return { passed, overallScore, issues };
}

/**
 * Use Claude to improve a script based on specific quality issues.
 */
export async function improveScript(
  script: GeneratedScript,
  issues: QualityIssue[]
): Promise<GeneratedScript> {
  log.info('Improving script', {
    title: script.title,
    issueCount: issues.length,
  });

  const issueList = issues
    .map((i) => `- [${i.severity.toUpperCase()}] ${i.type}: ${i.description}${i.location ? ` (location: ${i.location})` : ''}`)
    .join('\n');

  const currentScript = script.scenes
    .map(
      (s) =>
        `[${s.segment.toUpperCase()} - ${s.duration_seconds}s]:\nNarration: ${s.narration}\nB-Roll: ${s.broll_cue}\nTone: ${s.tone}`
    )
    .join('\n\n');

  const schema = `{
  "title": "string",
  "hook": "string",
  "scenes": [
    {
      "scene_number": 1,
      "segment": "hook",
      "narration": "string",
      "broll_cue": "string",
      "tone": "string",
      "duration_seconds": 30
    }
  ]
}`;

  const prompt = `You are a professional YouTube scriptwriter. Improve the following script to fix these quality issues:

ISSUES TO FIX:
${issueList}

CURRENT SCRIPT:
Title: ${script.title}
Hook: ${script.hook}

${currentScript}

Instructions:
- Fix all listed issues while preserving the core content and research
- Remove ALL filler phrases (basically, you know, like I said, as I mentioned)
- If the hook is weak, rewrite it to start with a shocking fact or question
- Ensure all 8 segments are present: hook, open_loop, problem, story, value, twist, payoff, cta
- Make b-roll cues specific and actionable
- Keep narration conversational and energetic
- Return the complete improved script in the same JSON format`;

  interface RawScript {
    title: string;
    hook: string;
    scenes: ScriptScene[];
  }

  const improved = await generateJSON<RawScript>(prompt, schema, {
    maxTokens: 6000,
  });

  // Recalculate word count and duration
  const wordCount = improved.scenes.reduce((sum, s) => {
    return sum + (s.narration ?? '').split(/\s+/).filter(Boolean).length;
  }, 0);

  const estimatedDurationSeconds = improved.scenes.reduce(
    (sum, s) => sum + (s.duration_seconds ?? 0),
    0
  );

  const result: GeneratedScript = {
    ...script,
    title: improved.title ?? script.title,
    hook: improved.hook ?? script.hook,
    scenes: improved.scenes,
    wordCount,
    estimatedDurationSeconds,
  };

  log.info('Script improvement complete', {
    title: result.title,
    wordCount: result.wordCount,
    estimatedDurationSeconds: result.estimatedDurationSeconds,
  });

  return result;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
