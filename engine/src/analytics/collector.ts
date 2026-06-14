import { google } from 'googleapis';
import { createLogger } from '../lib/logger';
import { withRetry } from '../lib/retry';
import { getOAuth2Client, refreshTokenIfNeeded } from '../youtube/auth';
import { insertMetrics, getVideoMetrics } from '../db/client';
import { createClient } from '@supabase/supabase-js';
import { Video } from '../db/schema';

const log = createLogger('analytics/collector');

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AnalyticsQuery {
  youtubeId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface AnalyticsData {
  views: number;
  watchTimeMinutes: number;
  avgViewDurationSeconds: number;
  impressions: number;
  ctr: number;
  likes: number;
  comments: number;
  subscribersGained: number;
  estimatedRevenue: number;
}

export interface PerformanceReport {
  period: string;
  totalViews: number;
  totalRevenue: number;
  avgCTR: number;
  avgAVD: number;
  topVideos: Array<{
    youtubeId: string;
    title: string;
    views: number;
    ctr: number;
    estimatedRevenue: number;
  }>;
}

// ─── Internal helpers ───────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_KEY must be set');
  return createClient(url, key);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// ─── Main collection function ───────────────────────────────────────────────

export async function collectVideoAnalytics(youtubeId: string): Promise<AnalyticsData> {
  const oauth2Client = getOAuth2Client();
  await refreshTokenIfNeeded(oauth2Client);

  const startDate = daysAgoStr(30);
  const endDate = todayStr();

  log.info('Collecting analytics', { youtubeId, startDate, endDate });

  // ── YouTube Analytics API v2 ──────────────────────────────────────────────
  const youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth: oauth2Client });

  const analyticsResponse = await withRetry(
    () =>
      youtubeAnalytics.reports.query({
        ids: 'channel==MINE',
        startDate,
        endDate,
        metrics: [
          'views',
          'estimatedMinutesWatched',
          'averageViewDuration',
          'subscribersGained',
          'estimatedRevenue',
          'likes',
          'comments',
        ].join(','),
        dimensions: 'video',
        filters: `video==${youtubeId}`,
      }),
    { maxAttempts: 3, delayMs: 2000, backoff: true, label: 'analytics.query' }
  );

  const rows = analyticsResponse.data.rows ?? [];
  // Row columns match the order of metrics: views, estimatedMinutesWatched,
  // averageViewDuration, subscribersGained, estimatedRevenue, likes, comments
  const row = rows[0] ?? [0, 0, 0, 0, 0, 0, 0];

  const views = Number(row[0]) || 0;
  const watchTimeMinutes = Number(row[1]) || 0;
  const avgViewDurationSeconds = Number(row[2]) || 0;
  const subscribersGained = Number(row[3]) || 0;
  const estimatedRevenue = Number(row[4]) || 0;
  const likes = Number(row[5]) || 0;
  const comments = Number(row[6]) || 0;

  // ── Impressions + CTR from YouTube Data API ───────────────────────────────
  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

  const videoResponse = await withRetry(
    () =>
      youtube.videos.list({
        part: ['statistics'],
        id: [youtubeId],
      }),
    { maxAttempts: 3, delayMs: 2000, backoff: true, label: 'youtube.videos.list' }
  );

  const stats = videoResponse.data.items?.[0]?.statistics ?? {};

  // Impressions and CTR are only available via YouTube Analytics API
  // The Data API exposes view counts; we approximate impressions as 10× views
  // when the analytics row doesn't include them.
  const impressions = 0; // populated by Analytics API if quota allows
  const ctr = 0;         // same — set by Analytics API

  // Fetch impressions separately if available
  let analyticsImpressions = 0;
  let analyticsCTR = 0;
  try {
    const impressionRes = await youtubeAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'impressions,impressionsClickThroughRate',
      dimensions: 'video',
      filters: `video==${youtubeId}`,
    });
    const iRow = impressionRes.data.rows?.[0] ?? [0, 0];
    analyticsImpressions = Number(iRow[0]) || 0;
    analyticsCTR = Number(iRow[1]) || 0;
  } catch (err) {
    log.warn('Could not fetch impressions/CTR from Analytics API', {
      youtubeId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const result: AnalyticsData = {
    views,
    watchTimeMinutes,
    avgViewDurationSeconds,
    impressions: analyticsImpressions || impressions,
    ctr: analyticsCTR || ctr,
    likes,
    comments,
    subscribersGained,
    estimatedRevenue,
  };

  log.info('Analytics collected', { youtubeId, views, ctr: result.ctr });
  return result;
}

// ─── Collect all active videos ────────────────────────────────────────────

export async function collectAllActiveVideos(): Promise<void> {
  const supabase = getSupabase();
  const { data: videos, error } = await supabase
    .from('videos')
    .select('*')
    .eq('status', 'published');

  if (error) {
    throw new Error(`Failed to fetch published videos: ${error.message}`);
  }

  if (!videos || videos.length === 0) {
    log.info('No published videos to collect analytics for');
    return;
  }

  log.info(`Collecting analytics for ${videos.length} published video(s)`);

  const now = Date.now();
  const fortyEightHoursMs = 48 * 60 * 60 * 1000;

  for (const video of videos as Video[]) {
    if (!video.youtube_id) continue;

    const publishedAt = video.published_at ? new Date(video.published_at).getTime() : 0;
    const ageMs = now - publishedAt;
    const isRecent = ageMs < fortyEightHoursMs;

    if (isRecent) {
      log.debug('Video < 48h old — collecting hourly', { youtubeId: video.youtube_id });
    } else {
      log.debug('Video > 48h old — collecting daily', { youtubeId: video.youtube_id });
    }

    try {
      const analytics = await collectVideoAnalytics(video.youtube_id);
      await insertMetrics({
        video_id: video.id,
        youtube_id: video.youtube_id,
        measured_at: new Date().toISOString(),
        views: analytics.views,
        watch_time_minutes: analytics.watchTimeMinutes,
        avg_view_duration_seconds: analytics.avgViewDurationSeconds,
        impressions: analytics.impressions,
        ctr: analytics.ctr,
        likes: analytics.likes,
        comments: analytics.comments,
        subscribers_gained: analytics.subscribersGained,
        estimated_revenue: analytics.estimatedRevenue,
      });
      log.info('Saved metrics', { youtubeId: video.youtube_id, views: analytics.views });
    } catch (err) {
      log.error('Failed to collect analytics for video', {
        youtubeId: video.youtube_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  log.info('Analytics collection complete');
}

// ─── Performance report ───────────────────────────────────────────────────

export async function generatePerformanceReport(): Promise<PerformanceReport> {
  const supabase = getSupabase();
  const sevenDaysAgo = daysAgoStr(7);

  // Get all video_metrics entries from the last 7 days
  const { data: metrics, error: metricsError } = await supabase
    .from('video_metrics')
    .select('*, videos(title, youtube_id)')
    .gte('measured_at', sevenDaysAgo)
    .order('measured_at', { ascending: false });

  if (metricsError) {
    throw new Error(`Failed to fetch metrics: ${metricsError.message}`);
  }

  if (!metrics || metrics.length === 0) {
    log.warn('No metrics found for the last 7 days');
    return {
      period: `${sevenDaysAgo} to ${todayStr()}`,
      totalViews: 0,
      totalRevenue: 0,
      avgCTR: 0,
      avgAVD: 0,
      topVideos: [],
    };
  }

  // Aggregate by youtube_id (take the latest snapshot per video)
  const byVideo = new Map<string, typeof metrics[0]>();
  for (const m of metrics) {
    const existing = byVideo.get(m.youtube_id);
    if (!existing || m.measured_at > existing.measured_at) {
      byVideo.set(m.youtube_id, m);
    }
  }

  const snapshots = Array.from(byVideo.values());

  const totalViews = snapshots.reduce((s, m) => s + (m.views ?? 0), 0);
  const totalRevenue = snapshots.reduce((s, m) => s + (m.estimated_revenue ?? 0), 0);
  const avgCTR =
    snapshots.length > 0
      ? snapshots.reduce((s, m) => s + (m.ctr ?? 0), 0) / snapshots.length
      : 0;
  const avgAVD =
    snapshots.length > 0
      ? snapshots.reduce((s, m) => s + (m.avg_view_duration_seconds ?? 0), 0) /
        snapshots.length
      : 0;

  // Top 3 by views
  const sorted = [...snapshots].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
  const topVideos = sorted.slice(0, 3).map((m) => ({
    youtubeId: m.youtube_id,
    title: (m as Record<string, unknown> & { videos?: { title?: string } }).videos?.title ?? 'Unknown',
    views: m.views ?? 0,
    ctr: m.ctr ?? 0,
    estimatedRevenue: m.estimated_revenue ?? 0,
  }));

  const report: PerformanceReport = {
    period: `${sevenDaysAgo} to ${todayStr()}`,
    totalViews,
    totalRevenue,
    avgCTR: Math.round(avgCTR * 100) / 100,
    avgAVD: Math.round(avgAVD),
    topVideos,
  };

  log.info('Performance report generated', {
    period: report.period,
    totalViews,
    totalRevenue,
  });

  return report;
}
