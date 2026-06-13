import axios from 'axios';
import { createLogger } from '../lib/logger';

const log = createLogger('discovery/reddit');

export const SOCCER_SUBREDDITS = [
  'soccer',
  'worldcup',
  'football',
  'PremierLeague',
];

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RedditPost {
  title: string;
  score: number;
  numComments: number;
  url: string;
  created_utc: number;
  subreddit: string;
}

// ─── Reddit public JSON API ─────────────────────────────────────────────────

/**
 * Fetch hot posts from a single subreddit using Reddit's public JSON API
 * (no auth required for public subreddits).
 */
export async function fetchRedditHot(
  subreddit: string,
  limit: number = 25
): Promise<RedditPost[]> {
  log.debug(`Fetching Reddit hot posts from r/${subreddit}`, { limit });

  const url = `https://www.reddit.com/r/${subreddit}/hot.json`;
  const response = await axios.get<{
    data: {
      children: Array<{
        data: {
          title: string;
          score: number;
          num_comments: number;
          url: string;
          created_utc: number;
          subreddit: string;
        };
      }>;
    };
  }>(url, {
    params: { limit },
    headers: { 'User-Agent': 'FacelessYT-Bot/1.0' },
    timeout: 5000,
  });

  const posts = (response.data?.data?.children ?? []).map((child) => ({
    title: child.data.title,
    score: child.data.score,
    numComments: child.data.num_comments,
    url: child.data.url,
    created_utc: child.data.created_utc,
    subreddit: child.data.subreddit,
  }));

  log.info(`Fetched ${posts.length} posts from r/${subreddit}`);
  return posts;
}

/**
 * Search across multiple subreddits and return combined results sorted by
 * a combined relevance+score heuristic.
 */
export async function searchReddit(
  query: string,
  subreddits: string[] = SOCCER_SUBREDDITS
): Promise<RedditPost[]> {
  log.debug('Searching Reddit', { query, subreddits });

  const results: RedditPost[] = [];

  for (const subreddit of subreddits) {
    try {
      const url = `https://www.reddit.com/r/${subreddit}/search.json`;
      const response = await axios.get<{
        data: {
          children: Array<{
            data: {
              title: string;
              score: number;
              num_comments: number;
              url: string;
              created_utc: number;
              subreddit: string;
            };
          }>;
        };
      }>(url, {
        params: { q: query, restrict_sr: true, sort: 'relevance', t: 'week', limit: 10 },
        headers: { 'User-Agent': 'FacelessYT-Bot/1.0' },
        timeout: 5000,
      });

      const posts = (response.data?.data?.children ?? []).map((child) => ({
        title: child.data.title,
        score: child.data.score,
        numComments: child.data.num_comments,
        url: child.data.url,
        created_utc: child.data.created_utc,
        subreddit: child.data.subreddit,
      }));
      results.push(...posts);
    } catch (err) {
      log.warn(`Failed to search r/${subreddit}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  log.info(`Search returned ${results.length} posts across ${subreddits.length} subreddits`);
  return results;
}

/**
 * Extract unique topic keywords/phrases from post titles.
 * Filters out low-score posts (< 100 upvotes).
 */
export function extractTopics(posts: RedditPost[]): string[] {
  const eligible = posts.filter((p) => p.score >= 100);

  // Extract candidate phrases: player names, club names, etc.
  // Simple heuristic: words starting with uppercase or quoted phrases
  const topicSet = new Set<string>();

  for (const post of eligible) {
    // Remove common question words / stop words
    const cleaned = post.title
      .replace(/[^\w\s]/g, ' ')
      .replace(/\b(the|a|an|is|was|are|were|will|would|have|has|had|be|been|being|this|that|these|those|it|its|i|we|they|he|she|you)\b/gi, '')
      .trim();

    // Extract capitalised multi-word phrases (likely named entities)
    const namedEntityPattern = /([A-Z][a-z]+ (?:[A-Z][a-z]+ )*[A-Z][a-z]+|[A-Z][a-z]+)/g;
    const matches = cleaned.match(namedEntityPattern) ?? [];

    for (const match of matches) {
      const topic = match.trim();
      if (topic.length > 3) {
        topicSet.add(topic);
      }
    }

    // Also extract the post title itself as a topic if high-score
    if (post.score >= 500) {
      topicSet.add(post.title.slice(0, 80));
    }
  }

  return Array.from(topicSet).slice(0, 30);
}
