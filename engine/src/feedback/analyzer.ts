import { createClient } from '@supabase/supabase-js';
import { createLogger } from '../lib/logger';
import { generateJSON } from '../lib/claude';
import { getVideoMetrics, updateThumbnailVariant } from '../db/client';
import { Video, VideoMetrics, Script, ContentOpportunity, ThumbnailVariant } from '../db/schema';

const log = createLogger('feedback/analyzer');

// ─── Types ─────────────────────────────────────────────────────────────────

export interface VideoPerformanceData {
  video: Video;
  metrics: VideoMetrics[];
  script: Script;
  opportunity: ContentOpportunity;
  thumbnailWinner: ThumbnailVariant | null;
}

export interface LearningInsights {
  winningHooks: string[];
  winningTopics: string[];
  winningThumbnailStyles: string[];
  optimalLength: number;        // seconds
  optimalUploadHour: number;    // 0-23 UTC
  topKeywords: string[];
}

// ─── Supabase helper ────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_KEY must be set');
  return createClient(url, key);
}

// ─── Performance analysis ───────────────────────────────────────────────────

export async function analyzePerformance(): Promise<LearningInsights> {
  log.info('Starting performance analysis');
  const supabase = getSupabase();

  // Fetch all published videos with their latest metrics, scripts, and opportunities
  const { data: videos, error: vErr } = await supabase
    .from('videos')
    .select('*')
    .eq('status', 'published');

  if (vErr) throw new Error(`Failed to fetch videos: ${vErr.message}`);
  if (!videos || videos.length === 0) {
    log.warn('No published videos to analyze — returning default insights');
    return defaultInsights();
  }

  log.info(`Analyzing ${videos.length} published video(s)`);

  // Build full performance data for each video
  const performanceData: VideoPerformanceData[] = [];

  for (const video of videos as Video[]) {
    try {
      // Metrics
      const metrics = await getVideoMetrics(video.id);
      if (metrics.length === 0) continue; // no data yet

      // Script
      const { data: scriptData } = await supabase
        .from('scripts')
        .select('*')
        .eq('id', video.script_id)
        .single();

      // Opportunity
      const { data: oppData } = await supabase
        .from('content_opportunities')
        .select('*')
        .eq('id', video.opportunity_id)
        .single();

      // Thumbnail winner
      const { data: thumbData } = await supabase
        .from('thumbnail_variants')
        .select('*')
        .eq('video_id', video.id)
        .eq('winner', true)
        .maybeSingle();

      if (!scriptData || !oppData) continue;

      performanceData.push({
        video: video as Video,
        metrics: metrics as VideoMetrics[],
        script: scriptData as Script,
        opportunity: oppData as ContentOpportunity,
        thumbnailWinner: thumbData as ThumbnailVariant | null,
      });
    } catch (err) {
      log.warn('Failed to gather data for video', {
        videoId: video.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (performanceData.length === 0) {
    log.warn('No videos with complete data — returning default insights');
    return defaultInsights();
  }

  // Compute latest metrics snapshot per video
  const withLatestMetrics = performanceData.map((pd) => {
    const latest = pd.metrics.reduce(
      (best, m) => (m.measured_at > best.measured_at ? m : best),
      pd.metrics[0]
    );
    return { ...pd, latestMetrics: latest };
  });

  // Split into top performers and underperformers
  // Criteria: CTR > 6% AND avg_view_duration > 50% of video length
  const topPerformers = withLatestMetrics.filter((pd) => {
    const ctr = pd.latestMetrics.ctr ?? 0;
    const avd = pd.latestMetrics.avg_view_duration_seconds ?? 0;
    const duration = pd.script.estimated_duration_seconds ?? 1;
    return ctr > 6 && avd / duration > 0.5;
  });

  log.info('Performance split', {
    total: withLatestMetrics.length,
    topPerformers: topPerformers.length,
    underperformers: withLatestMetrics.length - topPerformers.length,
  });

  if (topPerformers.length === 0) {
    log.info('No top performers yet — analyzing all videos for patterns');
  }

  const source = topPerformers.length > 0 ? topPerformers : withLatestMetrics;

  // Build context for Claude
  const videoSummaries = source.map((pd) => ({
    title: pd.video.title,
    hook: pd.script.hook,
    topic: pd.opportunity.topic,
    tags: pd.video.tags,
    durationSeconds: pd.script.estimated_duration_seconds,
    publishedHour: pd.video.published_at
      ? new Date(pd.video.published_at).getUTCHours()
      : null,
    thumbnailStyle: pd.thumbnailWinner?.variant ?? 'unknown',
    ctr: pd.latestMetrics.ctr,
    avgViewDurationSeconds: pd.latestMetrics.avg_view_duration_seconds,
    views: pd.latestMetrics.views,
  }));

  const prompt = `You are a YouTube growth analyst specializing in sports and soccer content.

Analyze these top-performing YouTube videos about soccer/World Cup content and identify winning patterns:

${JSON.stringify(videoSummaries, null, 2)}

Based on these videos, identify what makes content perform well. Focus on:
1. What types of hooks grab attention
2. What topics/angles get the most views
3. Thumbnail styles that convert best (A, B, or C variant patterns)
4. Optimal video length in seconds
5. Best upload hour (UTC) for this audience
6. Keywords that appear in top-performing content

Return a JSON object with these patterns.`;

  const schema = `{
  "winningHooks": ["array of hook patterns/phrases that work well"],
  "winningTopics": ["array of topic types that perform well"],
  "winningThumbnailStyles": ["array of thumbnail style descriptions"],
  "optimalLength": 480,
  "optimalUploadHour": 14,
  "topKeywords": ["array of effective keywords"]
}`;

  const insights = await generateJSON<LearningInsights>(prompt, schema);

  log.info('Learning insights generated', {
    hooksCount: insights.winningHooks.length,
    topicsCount: insights.winningTopics.length,
    optimalLength: insights.optimalLength,
    optimalUploadHour: insights.optimalUploadHour,
  });

  return insights;
}

// ─── Update scoring weights ─────────────────────────────────────────────────

export async function updateScoringWeights(insights: LearningInsights): Promise<void> {
  log.info('Saving learning insights to Supabase config');
  const supabase = getSupabase();

  const payload = {
    key: 'scoring_weights',
    value: JSON.stringify(insights),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('engine_config')
    .upsert(payload, { onConflict: 'key' });

  if (error) {
    log.error('Failed to save scoring weights', { error: error.message });
    throw new Error(`Failed to save scoring weights: ${error.message}`);
  }

  log.info('Scoring weights updated successfully');
}

// ─── Thumbnail A/B test conclusion ─────────────────────────────────────────

export async function concludeThumbnailTests(): Promise<void> {
  log.info('Evaluating thumbnail A/B tests');
  const supabase = getSupabase();

  // Fetch all non-concluded thumbnail variants grouped by video
  const { data: variants, error } = await supabase
    .from('thumbnail_variants')
    .select('*')
    .eq('winner', false);

  if (error) throw new Error(`Failed to fetch thumbnail variants: ${error.message}`);
  if (!variants || variants.length === 0) {
    log.info('No open thumbnail tests found');
    return;
  }

  // Group by video_id
  const byVideo = new Map<string, ThumbnailVariant[]>();
  for (const v of variants as ThumbnailVariant[]) {
    const group = byVideo.get(v.video_id) ?? [];
    group.push(v);
    byVideo.set(v.video_id, group);
  }

  let concluded = 0;

  for (const [videoId, variantList] of byVideo.entries()) {
    // Only conclude tests where ALL variants have > 500 impressions
    const allReady = variantList.every((v) => (v.impressions ?? 0) >= 500);
    if (!allReady) {
      log.debug('Not enough data yet for thumbnail test', {
        videoId,
        variants: variantList.map((v) => ({
          variant: v.variant,
          impressions: v.impressions,
        })),
      });
      continue;
    }

    // Find the winner: highest CTR
    const winner = variantList.reduce(
      (best, v) => ((v.ctr ?? 0) > (best.ctr ?? 0) ? v : best),
      variantList[0]
    );

    log.info('Declaring thumbnail winner', {
      videoId,
      winnerVariant: winner.variant,
      winnerCTR: winner.ctr,
    });

    await updateThumbnailVariant(winner.id, { winner: true });
    concluded++;
  }

  log.info(`Concluded ${concluded} thumbnail test(s)`);
}

// ─── Default insights fallback ──────────────────────────────────────────────

function defaultInsights(): LearningInsights {
  return {
    winningHooks: [
      'This is why {team} will win the World Cup...',
      '{player} just changed everything with this move',
      'Nobody is talking about this World Cup dark horse',
    ],
    winningTopics: [
      'match previews',
      'team analysis',
      'player spotlights',
      'tournament predictions',
    ],
    winningThumbnailStyles: [
      'Player action shot with bold text overlay',
      'Team crest with dramatic background',
      'Match scoreboard dramatic moment',
    ],
    optimalLength: 480,
    optimalUploadHour: 14,
    topKeywords: [
      'World Cup 2026',
      'FIFA',
      'soccer predictions',
      'football analysis',
      'match preview',
    ],
  };
}
