# FacelessYT — Analytics Collection & Performance Tracking Engine

**Date:** 2026-06-12
**Module:** `engine/modules/analytics/`, `engine/modules/youtube/analytics.ts`
**APIs:** YouTube Analytics API v2, YouTube Data API v3

---

## 1. Overview

The analytics engine is the feedback loop that turns raw video performance data into actionable intelligence. It collects metrics on a schedule optimized for YouTube's data freshness (hourly for new videos, daily for established ones), stores everything in Supabase, computes KPIs, fires alerts when performance falls below thresholds, and feeds structured data to the learning engine for model recalibration.

Without analytics, the FacelessYT system is blind — it would keep producing content with no understanding of what works. With robust analytics, it becomes a self-improving machine that compounds performance week over week.

---

## 2. Collection Schedule

YouTube Analytics data has a 24-48 hour reporting lag for revenue data, but views and engagement metrics are near-real-time. The collection schedule reflects this:

```typescript
const COLLECTION_SCHEDULE = {
  // New videos: hourly for first 48 hours (critical early-velocity window)
  fresh: {
    condition: (video: VideoRecord) => video.ageHours < 48,
    cronExpression: '0 * * * *',    // Every hour
    metrics: ['views', 'impressions', 'ctr', 'watchTime', 'likes', 'comments'],
  },
  // Established videos: daily collection
  established: {
    condition: (video: VideoRecord) => video.ageHours >= 48,
    cronExpression: '0 14 * * *',   // 14:00 UTC daily
    metrics: ['views', 'impressions', 'ctr', 'watchTime', 'estimatedRevenue', 'subscribersGained'],
  },
  // Revenue data: 48-hour delay minimum, collect every 48 hours
  revenue: {
    condition: (video: VideoRecord) => video.ageHours >= 48,
    cronExpression: '0 10 */2 * *', // Every 2 days at 10:00 UTC
    metrics: ['estimatedRevenue', 'estimatedAdRevenue', 'grossRevenue', 'rpm'],
  },
};
```

---

## 3. YouTube Analytics API Integration

**File:** `engine/modules/youtube/analytics.ts`

### 3.1 Core Metrics Query

```typescript
interface VideoMetrics {
  youtubeId: string;
  date: string;
  views: number;
  watchTimeMinutes: number;
  avgViewDurationSeconds: number;
  avgViewPercentage: number;       // AVD% — most important retention metric
  impressions: number;
  impressionCTR: number;           // Click-through rate
  likes: number;
  comments: number;
  shares: number;
  subscribersGained: number;
  subscribersLost: number;
  estimatedRevenueMicros: number;  // Divide by 1,000,000 for USD
  estimatedAdRevenueMicros: number;
  rpm: number;                     // Revenue per 1000 impressions
}

async function fetchVideoMetrics(
  youtubeId: string,
  startDate: string,
  endDate: string
): Promise<VideoMetrics> {

  const accessToken = await getValidAccessToken();

  const response = await fetch(
    `https://youtubeanalytics.googleapis.com/v2/reports?` +
    `ids=channel==MINE&` +
    `startDate=${startDate}&` +
    `endDate=${endDate}&` +
    `metrics=views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,` +
    `impressions,impressionsClickThroughRate,likes,comments,shares,` +
    `subscribersGained,subscribersLost,estimatedRevenue,estimatedAdRevenue,` +
    `grossRevenue&` +
    `dimensions=video&` +
    `filters=video==${youtubeId}&` +
    `sort=-views`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }
  );

  const data = await response.json();
  return mapRowToMetrics(data.rows?.[0], youtubeId, endDate);
}
```

### 3.2 Channel-Level Metrics

```typescript
async function fetchChannelMetrics(date: string): Promise<ChannelMetrics> {
  // Channel-level: subscriber count, total views, total watch time
  const response = await fetch(
    `https://youtubeanalytics.googleapis.com/v2/reports?` +
    `ids=channel==MINE&` +
    `startDate=${date}&` +
    `endDate=${date}&` +
    `metrics=views,estimatedMinutesWatched,subscribersGained,subscribersLost,` +
    `estimatedRevenue,annotationClickThroughRate&` +
    `dimensions=day`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  return mapChannelMetrics(await response.json());
}
```

---

## 4. Supabase Database Schema

### 4.1 Core Tables

```sql
-- Daily metrics per video
CREATE TABLE daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  youtube_id TEXT NOT NULL,
  date DATE NOT NULL,
  
  -- Engagement
  views INT DEFAULT 0,
  watch_time_minutes FLOAT DEFAULT 0,
  avg_view_duration_seconds FLOAT DEFAULT 0,
  avg_view_percentage FLOAT DEFAULT 0,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  
  -- Discovery
  impressions INT DEFAULT 0,
  impression_ctr FLOAT DEFAULT 0,         -- as decimal: 0.065 = 6.5%
  
  -- Revenue
  subscribers_gained INT DEFAULT 0,
  subscribers_lost INT DEFAULT 0,
  estimated_revenue_usd FLOAT DEFAULT 0,
  estimated_ad_revenue_usd FLOAT DEFAULT 0,
  rpm FLOAT DEFAULT 0,
  
  -- Metadata
  collected_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(video_id, date)
);

-- Channel-level daily summary
CREATE TABLE channel_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  total_views INT DEFAULT 0,
  total_watch_time_minutes FLOAT DEFAULT 0,
  subscribers_gained INT DEFAULT 0,
  subscribers_lost INT DEFAULT 0,
  net_subscriber_change INT GENERATED ALWAYS AS (subscribers_gained - subscribers_lost) STORED,
  total_revenue_usd FLOAT DEFAULT 0,
  total_impressions INT DEFAULT 0,
  avg_ctr FLOAT DEFAULT 0,
  videos_published INT DEFAULT 0,
  collected_at TIMESTAMPTZ DEFAULT now()
);

-- Thumbnail A/B test variants
CREATE TABLE thumbnail_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  youtube_id TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  style TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  impressions INT DEFAULT 0,
  ctr FLOAT DEFAULT 0,
  is_winner BOOLEAN DEFAULT FALSE,
  declared_winner_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Aggregated performance snapshot per video (materialized view alternative)
CREATE TABLE video_performance_summary (
  video_id UUID PRIMARY KEY REFERENCES videos(id),
  youtube_id TEXT NOT NULL,
  total_views INT DEFAULT 0,
  total_watch_time_minutes FLOAT DEFAULT 0,
  total_revenue_usd FLOAT DEFAULT 0,
  best_day_views INT DEFAULT 0,
  peak_ctr FLOAT DEFAULT 0,
  avg_ctr_7d FLOAT DEFAULT 0,
  avg_avd_percentage_7d FLOAT DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now()
);
```

---

## 5. KPI Dashboard

The analytics engine populates a KPI dashboard accessible via the Next.js UI at `/analytics`. Key metrics surfaced:

### 5.1 Channel Health KPIs

| KPI | Formula | Target | Current State |
|---|---|---|---|
| Daily Views | SUM(views) for today | > 1,000/day by month 3 | Tracked in `channel_daily` |
| CTR | impressions_ctr average | > 5% | Per video in `daily_metrics` |
| AVD% | avg_view_percentage average | > 50% | Per video in `daily_metrics` |
| Revenue/Day | SUM(estimated_revenue_usd) | > $10/day | Tracked in `channel_daily` |
| Sub Growth Rate | subscribers_gained - subscribers_lost | > 50/day by month 3 | From `channel_daily` |
| Revenue/Video | estimated_revenue_usd after 30 days | > $50/video | Aggregated in summary table |

### 5.2 Dashboard Queries

```typescript
// Top performing videos this week
const topVideos = await supabase
  .from('daily_metrics')
  .select('video_id, videos(title), sum(views), avg(impression_ctr)')
  .gte('date', sevenDaysAgo)
  .order('sum(views)', { ascending: false })
  .limit(10);

// Revenue trend (last 30 days)
const revenueTrend = await supabase
  .from('channel_daily')
  .select('date, total_revenue_usd')
  .gte('date', thirtyDaysAgo)
  .order('date');

// CTR by thumbnail style (for learning engine)
const ctrByStyle = await supabase
  .from('thumbnail_variants')
  .select('style, avg(ctr), count()')
  .gt('impressions', 500)
  .group('style')
  .order('avg(ctr)', { ascending: false });
```

---

## 6. Alert Thresholds

The analytics engine fires Telegram alerts when performance falls outside expected ranges:

```typescript
const ALERT_THRESHOLDS = {
  ctr_low: {
    condition: (metrics: VideoMetrics) => metrics.impressionCTR < 0.03 && metrics.impressions > 200,
    message: (video: VideoRecord) =>
      `🔴 LOW CTR ALERT: "${video.title}"\nCTR: ${(video.ctr * 100).toFixed(1)}% (target: 5%+)\nImpressions: ${video.impressions}\nAction: Review thumbnail — consider A/B variant B or C`,
    action: 'flag_thumbnail',
  },
  avd_low: {
    condition: (metrics: VideoMetrics) => metrics.avgViewPercentage < 0.40 && metrics.views > 100,
    message: (video: VideoRecord) =>
      `🟡 LOW RETENTION: "${video.title}"\nAVD: ${(video.avgViewPercentage * 100).toFixed(1)}% (target: 50%+)\nAction: Analyze script — likely hook or first 2 minutes losing viewers`,
    action: 'flag_script',
  },
  views_low: {
    condition: (metrics: VideoMetrics) => metrics.views < 100 && videoAgeHours(metrics) > 24,
    message: (video: VideoRecord) =>
      `🔴 LOW VIEWS: "${video.title}"\n${video.views} views in 24h (target: 500+)\nAction: Review SEO — check title, tags, and whether topic had sufficient demand`,
    action: 'flag_topic',
  },
  strong_performer: {
    condition: (metrics: VideoMetrics) => metrics.views > 5000 && videoAgeHours(metrics) < 48,
    message: (video: VideoRecord) =>
      `🟢 STRONG PERFORMER: "${video.title}"\n${video.views} views in 48h!\nCTR: ${(video.impressionCTR * 100).toFixed(1)}%\nAction: Create follow-up video on same topic cluster ASAP`,
    action: 'promote_topic_cluster',
  },
  revenue_milestone: {
    condition: (metrics: VideoMetrics) => Math.floor(metrics.estimatedRevenueMicros / 1e6) > 0 && metrics.estimatedRevenueMicros < 2e6,
    message: () => `💰 FIRST DOLLAR EARNED! First monetized video revenue confirmed.`,
    action: 'celebrate',
  },
};

async function runAlertChecks(videoId: string): Promise<void> {
  const metrics = await getLatestMetrics(videoId);
  const video = await getVideoRecord(videoId);

  for (const [alertName, threshold] of Object.entries(ALERT_THRESHOLDS)) {
    if (threshold.condition(metrics)) {
      await sendTelegramAlert(threshold.message(video));
      await supabase.from('videos').update({
        [`flags.${threshold.action}`]: true,
      }).eq('id', videoId);
    }
  }
}
```

---

## 7. Revenue Tracking

### 7.1 Revenue by Video

```typescript
async function calculateVideoRevenue(videoId: string): Promise<RevenueReport> {
  const metrics = await supabase
    .from('daily_metrics')
    .select('date, estimated_revenue_usd, views, impressions, rpm')
    .eq('video_id', videoId)
    .order('date');

  const lifetimeRevenue = metrics.data?.reduce((sum, m) => sum + m.estimated_revenue_usd, 0) ?? 0;
  const lifetimeViews = metrics.data?.reduce((sum, m) => sum + m.views, 0) ?? 0;
  const avgRPM = lifetimeViews > 0 ? (lifetimeRevenue / lifetimeViews) * 1000 : 0;

  return { lifetimeRevenue, lifetimeViews, avgRPM, dailyBreakdown: metrics.data };
}
```

### 7.2 Monthly Projection

```typescript
async function projectMonthlyRevenue(): Promise<RevenueProjection> {
  // Last 7 days average daily revenue
  const last7DaysRevenue = await supabase
    .from('channel_daily')
    .select('total_revenue_usd')
    .gte('date', sevenDaysAgo)
    .order('date');

  const avgDailyRevenue = last7DaysRevenue.data?.reduce((sum, d) => sum + d.total_revenue_usd, 0) / 7;
  const projectedMonthly = avgDailyRevenue * 30;

  return {
    avgDailyRevenue,
    projectedMonthly,
    projectedAnnual: projectedMonthly * 12,
    confidenceLevel: last7DaysRevenue.data?.length >= 7 ? 'medium' : 'low',
  };
}
```

---

## 8. Cohort Analysis

Cohort analysis groups videos by shared characteristics and compares performance, revealing which factors consistently predict success:

```typescript
const COHORT_DIMENSIONS = [
  'topic_cluster',    // world_cup_preview, player_analysis, tactical_breakdown, etc.
  'upload_day',       // monday, tuesday, ... sunday
  'upload_hour',      // 0-23 UTC
  'thumbnail_style',  // shock_face, comparison, number_reveal, fire, countdown
  'hook_type',        // shocking_stat, bold_claim, question, before_after
  'video_length',     // short (< 6min), medium (6-10min), long (> 10min)
];

async function runCohortAnalysis(dimension: string): Promise<CohortAnalysis> {
  const query = `
    SELECT
      v.seo_data->>'${dimension}' AS cohort,
      COUNT(*) AS video_count,
      AVG(vps.avg_ctr_7d) AS avg_ctr,
      AVG(vps.avg_avd_percentage_7d) AS avg_avd,
      AVG(vps.total_revenue_usd) AS avg_revenue,
      SUM(vps.total_views) AS total_views
    FROM videos v
    JOIN video_performance_summary vps ON v.id = vps.video_id
    WHERE vps.last_updated > NOW() - INTERVAL '30 days'
    GROUP BY cohort
    ORDER BY avg_ctr DESC
  `;

  const result = await supabase.rpc('run_cohort_analysis', { sql: query });
  return result.data;
}
```

---

## 9. Data Retention

| Table | Retention Policy | Notes |
|---|---|---|
| `daily_metrics` | Forever | Small row size, valuable historical data |
| `channel_daily` | Forever | Channel-level history |
| `thumbnail_variants` | 1 year | Old losers can be purged |
| `video_performance_summary` | Forever | Aggregated, low storage |
| `job_logs` | 90 days | Operational logs only |
| `opportunities` | 30 days for unused, forever for used | Used opportunities drive learning |

---

## 10. Analytics API Dashboard Endpoint

```typescript
// PT-App/app/api/analytics/route.ts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const view = searchParams.get('view') ?? 'overview';

  switch (view) {
    case 'overview':
      return NextResponse.json(await getChannelOverview());
    case 'videos':
      return NextResponse.json(await getVideoPerformanceTable());
    case 'revenue':
      return NextResponse.json(await getRevenueAnalytics());
    case 'cohorts':
      return NextResponse.json(await getCohortAnalysis());
    default:
      return NextResponse.json({ error: 'Unknown view' }, { status: 400 });
  }
}
```
