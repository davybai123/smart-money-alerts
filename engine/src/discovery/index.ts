import { createLogger } from '../lib/logger';
import { withRetry } from '../lib/retry';
import { fetchYouTubeTrending, calculateViewVelocity } from './trends';
import { fetchRedditHot, searchReddit, SOCCER_SUBREDDITS } from './reddit';
import {
  scoreOpportunity,
  rankOpportunities,
  ContentOpportunityInput,
  OpportunityScore,
} from './scorer';

const log = createLogger('discovery/index');

// ─── World Cup 2026 discovery queries ──────────────────────────────────────

export const WORLD_CUP_QUERIES = [
  'World Cup 2026',
  'FIFA World Cup 2026',
  'FIFA 2026',
  'soccer highlights 2026',
  'football prediction 2026',
  'World Cup qualifier',
  'World Cup group stage',
  'World Cup knockout round',
  'USA Mexico Canada World Cup',
  'Messi World Cup 2026',
  'Ronaldo World Cup 2026',
  'World Cup final prediction',
  'World Cup shocking upset',
  'World Cup goal of the tournament',
  'soccer World Cup drama',
];

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DiscoveryOptions {
  queries: string[];
  limit: number;
  youtubeApiKey?: string;
}

// ─── Main discovery orchestrator ───────────────────────────────────────────

/**
 * Discover content opportunities by combining YouTube trending data and
 * Reddit signals, then scoring and ranking them.
 */
export async function discoverOpportunities(
  options: DiscoveryOptions
): Promise<ContentOpportunityInput[]> {
  const { queries, limit } = options;
  const youtubeApiKey = options.youtubeApiKey ?? process.env.YOUTUBE_API_KEY ?? '';

  log.info('Starting opportunity discovery', { queries: queries.length, limit });

  const scored: OpportunityScore[] = [];

  for (const query of queries) {
    log.info(`Processing query: "${query}"`);

    // ── YouTube signals ──────────────────────────────────────────────────
    let trendingVideos = [];
    try {
      trendingVideos = await withRetry(
        () => fetchYouTubeTrending(youtubeApiKey, query, 10),
        {
          maxAttempts: 3,
          delayMs: 1500,
          backoff: true,
          label: `youtube.trending(${query})`,
        }
      );
    } catch (err) {
      log.warn(`YouTube fetch failed for "${query}"`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // ── Reddit signals ───────────────────────────────────────────────────
    let redditPosts = [];
    try {
      redditPosts = await withRetry(
        () => searchReddit(query, SOCCER_SUBREDDITS),
        {
          maxAttempts: 3,
          delayMs: 1000,
          backoff: false,
          label: `reddit.search(${query})`,
        }
      );
    } catch (err) {
      log.warn(`Reddit search failed for "${query}"`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // ── Build competition signals from YouTube results ───────────────────
    const topVideoAvgViews =
      trendingVideos.length > 0
        ? trendingVideos.reduce((s, v) => s + v.viewCount, 0) / trendingVideos.length
        : 0;

    const competitionSignals = {
      topVideoAvgViews,
      resultCount: trendingVideos.length * 1000, // rough proxy
    };

    // ── Search volume proxy from Reddit engagement ───────────────────────
    const totalRedditEngagement = redditPosts.reduce(
      (s, p) => s + p.score + p.numComments,
      0
    );
    const searchVolumeProxy = Math.min(100, (totalRedditEngagement / 5000) * 100);

    // ── Velocity-enrich YouTube data ─────────────────────────────────────
    const enrichedVideos = trendingVideos.map((v) => ({
      ...v,
      viewVelocity: calculateViewVelocity(v.viewCount, v.publishedAt),
    }));

    const opportunityInput: ContentOpportunityInput = {
      topic: query,
      teams: extractTeamsFromQuery(query),
      matchDate: new Date().toISOString().split('T')[0],
      demandSignals: {
        youtubeTrendingVideos: enrichedVideos,
        redditPosts,
        searchVolumeProxy,
      },
      competitionSignals,
    };

    const score = scoreOpportunity(opportunityInput);
    scored.push(score);

    log.debug(`Scored "${query}"`, { score: score.opportunityScore });
  }

  // ── Also fetch Reddit hot posts for global context ────────────────────
  try {
    const hotPosts = await withRetry(
      () => fetchRedditHot('soccer', 25),
      {
        maxAttempts: 2,
        delayMs: 1000,
        backoff: false,
        label: 'reddit.hot(soccer)',
      }
    );
    log.info(`Fetched ${hotPosts.length} hot posts from r/soccer for context`);
  } catch (err) {
    log.warn('Could not fetch hot posts from Reddit', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const ranked = rankOpportunities(scored, limit);
  log.info(`Discovery complete: ranked ${ranked.length} opportunities`);

  return ranked.map((r) => r.input);
}

/**
 * Attempt to extract team names from a query string.
 */
function extractTeamsFromQuery(query: string): string {
  // Look for "X vs Y" or "X vs. Y" patterns
  const vsMatch = query.match(/(.+?)\s+vs\.?\s+(.+)/i);
  if (vsMatch) {
    return `${vsMatch[1].trim()} vs ${vsMatch[2].trim()}`;
  }
  // Return the full query as teams if no vs pattern found
  return query;
}
