import axios from 'axios';
import { createLogger } from '../lib/logger';

const log = createLogger('discovery/trends');

// ─── Types ─────────────────────────────────────────────────────────────────

export interface TrendingVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  viewCount: number;
  publishedAt: string;
  description: string;
}

export interface VideoStats {
  videoId: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  duration: string;
}

// ─── YouTube Data API v3 ───────────────────────────────────────────────────

/**
 * Fetch trending YouTube videos for a given search query published in the last
 * 7 days, sorted by view count.
 */
export async function fetchYouTubeTrending(
  apiKey: string,
  query: string,
  maxResults: number = 10
): Promise<TrendingVideo[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const publishedAfter = sevenDaysAgo.toISOString();

  log.debug('Fetching YouTube trending', { query, maxResults });

  const url = 'https://www.googleapis.com/youtube/v3/search';
  const params = {
    key: apiKey,
    q: query,
    part: 'snippet',
    type: 'video',
    order: 'viewCount',
    publishedAfter,
    maxResults: String(maxResults),
    relevanceLanguage: 'en',
  };

  const response = await axios.get<{
    items: Array<{
      id: { videoId: string };
      snippet: {
        title: string;
        channelTitle: string;
        publishedAt: string;
        description: string;
      };
    }>;
  }>(url, { params });

  const items = response.data.items ?? [];
  log.info(`Fetched ${items.length} trending videos for "${query}"`);

  // Fetch view counts for the returned video IDs
  const videoIds = items.map((i) => i.id.videoId).filter(Boolean);
  const statsMap = await fetchVideoStatsMap(apiKey, videoIds);

  return items.map((item) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    viewCount: statsMap[item.id.videoId]?.viewCount ?? 0,
    publishedAt: item.snippet.publishedAt,
    description: item.snippet.description,
  }));
}

/**
 * Fetch statistics for a list of YouTube video IDs.
 */
export async function fetchYouTubeVideoStats(
  apiKey: string,
  videoIds: string[]
): Promise<VideoStats[]> {
  if (videoIds.length === 0) return [];

  log.debug('Fetching video stats', { count: videoIds.length });

  const url = 'https://www.googleapis.com/youtube/v3/videos';
  const params = {
    key: apiKey,
    id: videoIds.join(','),
    part: 'statistics,contentDetails',
  };

  const response = await axios.get<{
    items: Array<{
      id: string;
      statistics: {
        viewCount?: string;
        likeCount?: string;
        commentCount?: string;
      };
      contentDetails: { duration: string };
    }>;
  }>(url, { params });

  const items = response.data.items ?? [];
  log.info(`Fetched stats for ${items.length} videos`);

  return items.map((item) => ({
    videoId: item.id,
    viewCount: parseInt(item.statistics.viewCount ?? '0', 10),
    likeCount: parseInt(item.statistics.likeCount ?? '0', 10),
    commentCount: parseInt(item.statistics.commentCount ?? '0', 10),
    duration: item.contentDetails.duration,
  }));
}

/**
 * Helper that returns a map of videoId -> VideoStats.
 */
async function fetchVideoStatsMap(
  apiKey: string,
  videoIds: string[]
): Promise<Record<string, VideoStats>> {
  const stats = await fetchYouTubeVideoStats(apiKey, videoIds);
  return Object.fromEntries(stats.map((s) => [s.videoId, s]));
}

/**
 * Calculate approximate views per hour since the video was published.
 */
export function calculateViewVelocity(
  viewCount: number,
  publishedAt: string
): number {
  const publishedMs = new Date(publishedAt).getTime();
  const nowMs = Date.now();
  const hoursSincePublish = Math.max(1, (nowMs - publishedMs) / (1000 * 60 * 60));
  return viewCount / hoursSincePublish;
}
