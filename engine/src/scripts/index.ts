import { createLogger } from '../lib/logger';
import { ContentOpportunityInput } from '../discovery/scorer';
import { researchTopic, validateResearch } from '../research/researcher';
import { generateScript } from './generator';
import { checkQuality, improveScript } from './optimizer';
import {
  insertScript,
  updateOpportunity,
} from '../db/client';
import { Script } from '../db/schema';

const log = createLogger('scripts/index');

// ─── Constants ──────────────────────────────────────────────────────────────

const QUALITY_THRESHOLD = 70;
const MAX_IMPROVE_ITERATIONS = 2;

// ─── Main orchestrator ──────────────────────────────────────────────────────

/**
 * Full pipeline: research → generate → optimize → save to DB.
 *
 * Given a ContentOpportunityInput (from the discovery phase), this function:
 * 1. Researches the topic using Claude
 * 2. Generates an 8-segment video script
 * 3. Checks script quality
 * 4. Runs improvement loops if quality < threshold (max 2 iterations)
 * 5. Saves the final script to the database
 * 6. Updates the opportunity status to 'scripted'
 *
 * Returns the persisted Script record.
 */
export async function produceScript(
  opportunity: ContentOpportunityInput,
  opportunityId: string
): Promise<Script> {
  const { topic, teams, matchDate } = opportunity;

  log.info('Starting script production pipeline', { topic, teams, opportunityId });

  // ── Step 1: Research ─────────────────────────────────────────────────
  log.info('Step 1/4: Researching topic', { topic });

  const research = await researchTopic({
    topic,
    teams,
    stage: extractStageFromTopic(topic),
    angle: extractAngleFromTopic(topic),
  });

  if (!validateResearch(research)) {
    log.warn('Research validation failed — proceeding with partial research', { topic });
  }

  // ── Step 2: Generate script ──────────────────────────────────────────
  log.info('Step 2/4: Generating script', { topic });

  let script = await generateScript({
    opportunity,
    research,
    targetDurationSeconds: 480,
    style: chooseStyle(topic),
  });

  // ── Step 3: Quality check + improvement loop ─────────────────────────
  log.info('Step 3/4: Quality check and optimization', { topic });

  let qualityReport = checkQuality(script);
  let iterations = 0;

  while (
    !qualityReport.passed &&
    qualityReport.overallScore < QUALITY_THRESHOLD &&
    iterations < MAX_IMPROVE_ITERATIONS
  ) {
    iterations++;
    log.info(`Improvement iteration ${iterations}/${MAX_IMPROVE_ITERATIONS}`, {
      topic,
      currentScore: qualityReport.overallScore,
      issueCount: qualityReport.issues.length,
    });

    script = await improveScript(script, qualityReport.issues);
    qualityReport = checkQuality(script);

    log.info(`Post-improvement quality score`, {
      topic,
      newScore: qualityReport.overallScore,
      passed: qualityReport.passed,
    });
  }

  if (!qualityReport.passed) {
    log.warn('Script did not reach quality threshold after improvements', {
      topic,
      finalScore: qualityReport.overallScore,
      iterations,
    });
  }

  // ── Step 4: Save to database ─────────────────────────────────────────
  log.info('Step 4/4: Saving script to database', { topic });

  const scriptRecord = await insertScript({
    opportunity_id: opportunityId,
    title: script.title,
    hook: script.hook,
    full_script: JSON.stringify(script.scenes),
    word_count: script.wordCount,
    estimated_duration_seconds: script.estimatedDurationSeconds,
    status: qualityReport.passed ? 'approved' : 'draft',
  });

  // Update the opportunity status
  await updateOpportunity(opportunityId, { status: 'scripted' });

  log.info('Script production pipeline complete', {
    topic,
    scriptId: scriptRecord.id,
    title: script.title,
    wordCount: script.wordCount,
    estimatedDurationSeconds: script.estimatedDurationSeconds,
    qualityScore: qualityReport.overallScore,
    improvementIterations: iterations,
  });

  return scriptRecord;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Attempt to extract a tournament stage from the topic string.
 */
function extractStageFromTopic(topic: string): string | undefined {
  const lower = topic.toLowerCase();
  const stages: Record<string, string> = {
    'group stage': 'group stage',
    'round of 16': 'round of 16',
    'quarter final': 'quarter-final',
    'semi final': 'semi-final',
    'final': 'final',
    'qualifier': 'qualifier',
    'knockout': 'knockout round',
  };

  for (const [key, value] of Object.entries(stages)) {
    if (lower.includes(key)) return value;
  }
  return undefined;
}

/**
 * Attempt to extract a content angle from the topic string.
 */
function extractAngleFromTopic(topic: string): string | undefined {
  const lower = topic.toLowerCase();

  if (lower.includes('prediction') || lower.includes('predict')) {
    return 'prediction and analysis';
  }
  if (lower.includes('upset') || lower.includes('shocking')) {
    return 'shocking upset or underdog story';
  }
  if (lower.includes('drama') || lower.includes('controversy')) {
    return 'dramatic controversy';
  }
  if (lower.includes('goal') || lower.includes('highlight')) {
    return 'highlight showcase';
  }
  if (lower.includes('messi') || lower.includes('ronaldo')) {
    return 'GOAT debate and legacy';
  }
  return undefined;
}

/**
 * Choose the appropriate script style based on the topic.
 */
function chooseStyle(
  topic: string
): 'dramatic' | 'analytical' | 'storytelling' {
  const lower = topic.toLowerCase();

  if (
    lower.includes('prediction') ||
    lower.includes('ranked') ||
    lower.includes('best') ||
    lower.includes('worst')
  ) {
    return 'analytical';
  }

  if (
    lower.includes('story') ||
    lower.includes('upset') ||
    lower.includes('comeback') ||
    lower.includes('underdog')
  ) {
    return 'storytelling';
  }

  return 'dramatic';
}
