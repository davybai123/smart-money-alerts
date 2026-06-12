import { createLogger } from '../lib/logger';
import { generateJSON } from '../lib/claude';

const log = createLogger('research/researcher');

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ResearchInput {
  topic: string;
  teams: string;
  stage?: string;   // e.g. 'group stage', 'quarter final', 'final'
  angle?: string;   // e.g. 'historical upset', 'underdog story', 'tactical breakdown'
}

export interface ResearchOutput {
  keyFacts: string[];
  statistics: string[];
  storylines: string[];
  controversies: string[];
  historicalContext: string[];
  expertQuotes: string[];
  sources: string[];
}

// ─── JSON schema string for generateJSON ───────────────────────────────────

const RESEARCH_SCHEMA = `{
  "keyFacts": ["string"],
  "statistics": ["string"],
  "storylines": ["string"],
  "controversies": ["string"],
  "historicalContext": ["string"],
  "expertQuotes": ["string"],
  "sources": ["string"]
}`;

// ─── Implementation ─────────────────────────────────────────────────────────

/**
 * Research a topic deeply using Claude to extract facts, stats, storylines,
 * and context that will power a compelling YouTube video script.
 */
export async function researchTopic(
  input: ResearchInput
): Promise<ResearchOutput> {
  const { topic, teams, stage, angle } = input;

  log.info('Researching topic', { topic, teams, stage, angle });

  const stageClause = stage ? ` during the ${stage}` : '';
  const angleClause = angle ? ` Focus specifically on the angle: "${angle}".` : '';

  const prompt = `You are a sports content researcher specializing in soccer and FIFA World Cup content.

Research the following topic for a YouTube video about the FIFA World Cup 2026:

Topic: ${topic}
Teams: ${teams}${stageClause}${angleClause}

Provide comprehensive, factual research that will make a compelling video. Include:

1. KEY FACTS (5-8 specific, interesting, verifiable facts about this topic)
2. STATISTICS (5-8 compelling statistics, scores, records, rankings, or numbers)
3. STORYLINES (4-6 narrative threads that would engage a YouTube audience — drama, emotion, conflict, triumph)
4. CONTROVERSIES (2-4 controversial moments, disputed decisions, or heated debates)
5. HISTORICAL CONTEXT (3-5 relevant historical events, past matches, or World Cup history)
6. EXPERT QUOTES (3-5 realistic quotes from coaches, players, or analysts — paraphrase known opinions)
7. SOURCES (3-5 types of sources where this information could be verified, e.g. "FIFA official statistics", "BBC Sport match report", "UEFA rankings database")

Be specific and concrete. Avoid vague generalities. Each item should be genuinely interesting and usable in a script.`;

  const research = await generateJSON<ResearchOutput>(
    prompt,
    RESEARCH_SCHEMA,
    { maxTokens: 4096 }
  );

  log.info('Research complete', {
    topic,
    keyFactsCount: research.keyFacts.length,
    statisticsCount: research.statistics.length,
    storylinesCount: research.storylines.length,
  });

  return research;
}

/**
 * Validate that a ResearchOutput has sufficient content to proceed.
 * Returns true if the research meets minimum quality thresholds.
 */
export function validateResearch(research: ResearchOutput): boolean {
  const checks = [
    research.keyFacts.length >= 3,
    research.statistics.length >= 3,
    research.storylines.length >= 2,
    research.historicalContext.length >= 1,
    // Every array must exist (not null/undefined)
    Array.isArray(research.keyFacts),
    Array.isArray(research.statistics),
    Array.isArray(research.storylines),
    Array.isArray(research.controversies),
    Array.isArray(research.historicalContext),
    Array.isArray(research.expertQuotes),
    Array.isArray(research.sources),
    // Key facts must not be empty strings
    research.keyFacts.every((f) => typeof f === 'string' && f.trim().length > 10),
  ];

  const passed = checks.every(Boolean);

  if (!passed) {
    log.warn('Research validation failed', {
      keyFactsCount: research.keyFacts.length,
      statisticsCount: research.statistics.length,
      storylinesCount: research.storylines.length,
      historicalContextCount: research.historicalContext.length,
    });
  }

  return passed;
}
