import { createLogger } from '../lib/logger';
import { TrendingVideo } from './trends';
import { RedditPost } from './reddit';

const log = createLogger('discovery/scorer');

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DemandSignals {
  youtubeTrendingVideos: TrendingVideo[];
  redditPosts: RedditPost[];
  searchVolumeProxy?: number; // normalised 0-100
}

export interface CompetitionSignals {
  topVideoAvgViews: number;  // average views of top 10 results
  resultCount: number;       // total search result count proxy
}

export interface ContentOpportunityInput {
  topic: string;
  teams: string;
  matchDate: string;
  demandSignals: DemandSignals;
  competitionSignals: CompetitionSignals;
}

export interface OpportunityScore {
  topic: string;
  teams: string;
  matchDate: string;
  demandScore: number;        // 0-100
  competitionScore: number;   // 0-100
  opportunityScore: number;   // 0-100
  predictedCtr: number;       // e.g. 0.06 = 6%
  predictedRpm: number;       // USD
  input: ContentOpportunityInput;
}

// ─── Scoring functions ─────────────────────────────────────────────────────

const EMOTIONAL_KEYWORDS = [
  'shocking', 'insane', 'incredible', 'unbelievable', 'ranked',
  'goat', 'best', 'worst', 'exposed', 'secret', 'hidden', 'truth',
  'revealed', 'destroyed', 'dominated', 'humiliated', 'comeback',
];

const NUMBER_PATTERN = /\b\d+\b/;

const WORLD_CUP_KEYWORDS = [
  'world cup', 'fifa', 'wc 2026', 'wc2026', 'worldcup',
];

/**
 * Score a single content opportunity based on demand and competition signals.
 */
export function scoreOpportunity(input: ContentOpportunityInput): OpportunityScore {
  const { topic, teams, matchDate, demandSignals, competitionSignals } = input;

  // ── Demand Score ───────────────────────────────────────────────────────
  // YouTube trending velocity contribution (40%)
  const totalViews = demandSignals.youtubeTrendingVideos.reduce(
    (sum, v) => sum + v.viewCount, 0
  );
  const avgVelocity =
    demandSignals.youtubeTrendingVideos.length > 0
      ? totalViews / demandSignals.youtubeTrendingVideos.length
      : 0;
  // Normalize: 1M views/video = 100 points
  const youtubeScore = Math.min(100, (avgVelocity / 1_000_000) * 100);

  // Reddit score contribution (30%)
  const redditTotal = demandSignals.redditPosts.reduce(
    (sum, p) => sum + p.score + p.numComments, 0
  );
  // Normalize: 10,000 total engagement = 100 points
  const redditScore = Math.min(100, (redditTotal / 10_000) * 100);

  // Search volume proxy (30%)
  const searchScore = demandSignals.searchVolumeProxy ?? 50;

  const demandScore = Math.round(
    youtubeScore * 0.4 + redditScore * 0.3 + searchScore * 0.3
  );

  // ── Competition Score ──────────────────────────────────────────────────
  // Based on top 10 video avg views + result count
  // Higher = more competition
  const viewsScore = Math.min(100, (competitionSignals.topVideoAvgViews / 5_000_000) * 100);
  const resultScore = Math.min(100, (competitionSignals.resultCount / 100_000) * 100);
  const competitionScore = Math.round(viewsScore * 0.6 + resultScore * 0.4);

  // ── Opportunity Score ──────────────────────────────────────────────────
  const opportunityScore = Math.round(demandScore * (100 - competitionScore) / 100);

  // ── Predicted CTR ──────────────────────────────────────────────────────
  const lowerTopic = topic.toLowerCase();
  const hasEmotionalKeyword = EMOTIONAL_KEYWORDS.some((kw) =>
    lowerTopic.includes(kw)
  );
  const hasNumber = NUMBER_PATTERN.test(topic);
  const hasControversy = ['vs', 'versus', 'controversy', 'beef', 'drama'].some(
    (kw) => lowerTopic.includes(kw)
  );

  let predictedCtr = 0.04; // base 4%
  if (hasEmotionalKeyword) predictedCtr += 0.015;
  if (hasNumber) predictedCtr += 0.01;
  if (hasControversy) predictedCtr += 0.008;

  // ── Predicted RPM ──────────────────────────────────────────────────────
  const isWorldCup = WORLD_CUP_KEYWORDS.some((kw) =>
    lowerTopic.includes(kw) || teams.toLowerCase().includes(kw)
  );
  let predictedRpm = 3.0; // base $3
  if (isWorldCup) {
    // World Cup content commands premium RPM ($5–$12 range)
    predictedRpm = 5.0 + Math.min(7, (demandScore / 100) * 7);
  }

  const score: OpportunityScore = {
    topic,
    teams,
    matchDate,
    demandScore,
    competitionScore,
    opportunityScore,
    predictedCtr,
    predictedRpm,
    input,
  };

  log.debug('Scored opportunity', {
    topic,
    demandScore,
    competitionScore,
    opportunityScore,
  });

  return score;
}

/**
 * Sort opportunities by opportunityScore descending and return the top N.
 */
export function rankOpportunities(
  opportunities: OpportunityScore[],
  topN: number = 10
): OpportunityScore[] {
  return [...opportunities]
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, topN);
}
