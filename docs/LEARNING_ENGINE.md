# FacelessYT — Autonomous Learning & Continuous Improvement Engine

**Date:** 2026-06-12
**Module:** `engine/modules/learning/`
**Schedule:** Daily at 14:30 UTC + Monthly full recalibration

---

## 1. Overview

The learning engine is what separates FacelessYT from a static content automation system and makes it genuinely autonomous. Every video that goes live generates performance data. Every piece of performance data is a signal. The learning engine aggregates those signals, identifies patterns, and updates the parameters that drive every other module — opportunity scoring weights, script prompt templates, thumbnail style preferences, SEO keyword banks, and optimal upload timing.

Over time, the system develops an evidence-based model of exactly what this channel's audience responds to. Without this feedback loop, the channel produces content of consistent but static quality. With it, each month's content should outperform the previous month's on key metrics.

---

## 2. Data Pipeline

### 2.1 Final Metrics Collection Trigger

After a video has been live for 7 days, its performance is considered "settled" for learning purposes. Early-viral videos plateau within 48-72 hours. Long-tail SEO videos take longer, but the 7-day snapshot captures enough data for pattern extraction.

```typescript
async function collectFinalMetrics(): Promise<void> {
  // Find videos that are 7-8 days old and haven't been finalized
  const matureVideos = await supabase
    .from('videos')
    .select('id, youtube_id, script_json, seo_data, created_at')
    .eq('status', 'live')
    .gte('created_at', eightDaysAgo)
    .lte('created_at', sevenDaysAgo)
    .is('learning_finalized_at', null);

  for (const video of matureVideos.data ?? []) {
    // Pull complete metrics for full video lifetime so far
    const metrics = await fetchVideoMetrics(
      video.youtube_id,
      format(new Date(video.created_at), 'yyyy-MM-dd'),
      format(new Date(), 'yyyy-MM-dd')
    );

    // Save final 7-day snapshot
    await supabase.from('learning_data').insert({
      video_id: video.id,
      snapshot_type: '7_day',
      metrics,
      script_features: extractScriptFeatures(video.script_json),
      seo_features: extractSEOFeatures(video.seo_data),
      thumbnail_winner_style: await getThumbnailWinner(video.id),
      performance_class: classifyPerformance(metrics),
    });

    await supabase.from('videos').update({
      learning_finalized_at: new Date().toISOString(),
    }).eq('id', video.id);
  }
}
```

### 2.2 Feature Extraction

Every video is converted into a feature vector that describes its observable characteristics:

```typescript
interface VideoFeatures {
  // Content features
  topicCluster: string;          // 'world_cup_preview' | 'player_biography' | etc.
  hookType: string;              // 'shocking_stat' | 'bold_claim' | etc.
  scriptWordCount: number;
  avgSceneLength: number;        // seconds
  openLoopCount: number;
  patternInterruptCount: number;
  readabilityScore: number;
  videoLengthSeconds: number;

  // SEO features
  titleHasNumber: boolean;
  titleHasQuestion: boolean;
  titleHasEmotionalWord: boolean;
  titleLength: number;
  tagCount: number;
  hashtagCount: number;

  // Production features
  thumbnailStyle: string;
  hasMotionClips: boolean;       // SDXL stills only vs. SVD motion clips
  voiceType: string;             // 'josh' | 'rachel'

  // Timing features
  uploadDayOfWeek: number;       // 0=Monday
  uploadHourUTC: number;
  hoursAfterTrendBreak: number;  // How soon after trend detected did we publish

  // Performance targets (the "Y" in supervised learning)
  ctr7d: number;
  avdPercentage7d: number;
  views7d: number;
  revenue7d: number;
  performanceClass: 'top' | 'average' | 'low';
}
```

---

## 3. Pattern Extraction

### 3.1 Top vs. Bottom Performer Analysis

The core learning mechanism: compare the top 20% performing videos against the bottom 20% and identify which features statistically differentiate them.

```typescript
interface WinningSignals {
  ctrThreshold: number;          // CTR > X% = "winning"
  avdThreshold: number;          // AVD > X% = "winning"
  viewsThreshold: number;        // Views > X in 7d = "winning"
}

const WINNING_SIGNALS: WinningSignals = {
  ctrThreshold: 0.08,    // CTR > 8%
  avdThreshold: 0.55,    // AVD > 55%
  viewsThreshold: 10_000, // 10k views in 7 days
};

async function extractWinningPatterns(): Promise<PatternReport> {
  const allLearningData = await supabase
    .from('learning_data')
    .select('*')
    .eq('snapshot_type', '7_day')
    .order('created_at', { ascending: false })
    .limit(100); // Use last 100 finalized videos

  const topPerformers = allLearningData.data?.filter(v =>
    v.metrics.ctr > WINNING_SIGNALS.ctrThreshold ||
    v.metrics.avgViewPercentage > WINNING_SIGNALS.avdThreshold ||
    v.metrics.views > WINNING_SIGNALS.viewsThreshold
  );

  const lowPerformers = allLearningData.data?.filter(v =>
    v.metrics.ctr < 0.03 &&
    v.metrics.views < 500
  );

  // Claude analysis: what distinguishes top from bottom?
  const claudeAnalysis = await claude(`
You are analyzing YouTube video performance data.

TOP PERFORMERS (${topPerformers?.length} videos):
${JSON.stringify(topPerformers?.map(v => v.script_features), null, 2)}

LOW PERFORMERS (${lowPerformers?.length} videos):
${JSON.stringify(lowPerformers?.map(v => v.script_features), null, 2)}

Identify the 5 most statistically significant differences between top and low performers.
For each difference, provide:
1. The feature name
2. The value in top performers vs low performers
3. Your confidence level (high/medium/low)
4. Recommended action to bias future content toward top-performer patterns

Output as JSON array of findings.
  `);

  return {
    topPerformers: topPerformers?.length ?? 0,
    lowPerformers: lowPerformers?.length ?? 0,
    findings: JSON.parse(claudeAnalysis),
    generatedAt: new Date().toISOString(),
  };
}
```

---

## 4. Feedback Injection

The learning engine closes the loop by updating the parameters of every upstream module based on extracted patterns.

### 4.1 Opportunity Scorer Weight Updates

```typescript
async function updateOpportunityScoringWeights(patterns: PatternReport): Promise<void> {
  const currentWeights = await supabase
    .from('channel_config')
    .select('config_value')
    .eq('config_key', 'opportunity_scoring_weights')
    .single();

  const weights = currentWeights.data?.config_value ?? DEFAULT_WEIGHTS;

  // Adjust weights based on findings
  for (const finding of patterns.findings) {
    if (finding.feature === 'topicCluster' && finding.confidence === 'high') {
      // If tactical analysis videos consistently outperform news videos,
      // increase the demand_score weight for tactical content
      weights.topicMultipliers[finding.topPerformerValue] =
        (weights.topicMultipliers[finding.topPerformerValue] ?? 1.0) * 1.1;
    }
    if (finding.feature === 'hoursAfterTrendBreak' && finding.topPerformerAvg < 6) {
      // Publishing within 6 hours of trend detection predicts success
      weights.timelinessBonus = Math.min(weights.timelinessBonus * 1.1, 2.0);
    }
  }

  await supabase.from('channel_config').upsert({
    config_key: 'opportunity_scoring_weights',
    config_value: weights,
    updated_at: new Date().toISOString(),
  });

  logger.info('Updated opportunity scoring weights based on learning engine analysis');
}
```

### 4.2 Script Prompt Updates

```typescript
async function updateScriptPromptParameters(patterns: PatternReport): Promise<void> {
  const currentParams = await getChannelConfig('script_prompt_params');

  for (const finding of patterns.findings) {
    // Hook type performance
    if (finding.feature === 'hookType') {
      const hookPerformance = await measureHookTypePerformance();
      // If 'shocking_stat' hooks have 40% higher CTR, increase their probability
      currentParams.hookTypeWeights = normalizeWeights({
        ...currentParams.hookTypeWeights,
        [hookPerformance.bestHook]: currentParams.hookTypeWeights[hookPerformance.bestHook] * 1.2,
      });
    }

    // Optimal video length
    if (finding.feature === 'videoLengthSeconds' && finding.confidence !== 'low') {
      currentParams.targetDurationRange = {
        min: finding.topPerformerAvg - 60,
        max: finding.topPerformerAvg + 60,
      };
    }

    // Pattern interrupt frequency
    if (finding.feature === 'patternInterruptCount') {
      currentParams.minPatternInterrupts = Math.max(
        currentParams.minPatternInterrupts,
        Math.ceil(finding.topPerformerAvg)
      );
    }
  }

  await saveChannelConfig('script_prompt_params', currentParams);
  logger.info('Updated script prompt parameters');
}
```

### 4.3 Thumbnail Style Updates

```typescript
async function updateThumbnailStylePreferences(): Promise<void> {
  // Aggregate CTR by thumbnail style across all A/B test winners
  const stylePerformance = await supabase
    .from('thumbnail_variants')
    .select('style, ctr')
    .eq('is_winner', true)
    .gt('impressions', 500);

  const styleAvgCTR: Record<string, number> = {};
  stylePerformance.data?.forEach(v => {
    styleAvgCTR[v.style] = (styleAvgCTR[v.style] ?? 0) + v.ctr;
  });

  // Normalize to probability weights
  const total = Object.values(styleAvgCTR).reduce((sum, ctr) => sum + ctr, 0);
  const styleWeights: Record<string, number> = {};
  Object.entries(styleAvgCTR).forEach(([style, ctr]) => {
    styleWeights[style] = ctr / total;
  });

  await saveChannelConfig('thumbnail_style_weights', styleWeights);
  logger.info('Updated thumbnail style weights:', styleWeights);
}
```

### 4.4 Upload Timing Updates

```typescript
async function updateOptimalUploadTimes(): Promise<void> {
  // Find which day/hour combinations correlate with highest early view velocity
  const timingData = await supabase
    .from('learning_data')
    .select('seo_features->upload_day_of_week, seo_features->upload_hour_utc, metrics->views_first_24h')
    .not('metrics->views_first_24h', 'is', null);

  const timingMatrix: Record<string, Record<number, number[]>> = {};

  timingData.data?.forEach(row => {
    const day = row['upload_day_of_week'] as string;
    const hour = row['upload_hour_utc'] as number;
    if (!timingMatrix[day]) timingMatrix[day] = {};
    if (!timingMatrix[day][hour]) timingMatrix[day][hour] = [];
    timingMatrix[day][hour].push(row['views_first_24h'] as number);
  });

  // Calculate average views for each day/hour slot
  const bestSlots = Object.entries(timingMatrix)
    .flatMap(([day, hours]) =>
      Object.entries(hours).map(([hour, viewCounts]) => ({
        day,
        hour: parseInt(hour),
        avgViews: viewCounts.reduce((sum, v) => sum + v, 0) / viewCounts.length,
        sampleSize: viewCounts.length,
      }))
    )
    .filter(slot => slot.sampleSize >= 3) // Minimum 3 videos for statistical significance
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 10); // Top 10 upload slots

  await saveChannelConfig('optimal_upload_slots', bestSlots);
  logger.info(`Updated optimal upload timing: top slot is ${bestSlots[0]?.day} at ${bestSlots[0]?.hour}:00 UTC`);
}
```

---

## 5. A/B Test Conclusion Engine

```typescript
async function concludeABTests(): Promise<void> {
  // Find thumbnail variants with sufficient impressions
  const readyToConclide = await supabase
    .from('thumbnail_variants')
    .select('video_id, id, style, impressions, ctr')
    .gte('impressions', 500)
    .is('is_winner', false)
    .is('declared_winner_at', null);

  // Group by video
  const byVideo = groupBy(readyToConclide.data ?? [], 'video_id');

  for (const [videoId, variants] of Object.entries(byVideo)) {
    if (variants.length < 2) continue; // Need at least 2 variants to compare

    // Check statistical significance (simplified: require 20% CTR difference)
    const sorted = [...variants].sort((a, b) => b.ctr - a.ctr);
    const winner = sorted[0];
    const runnerUp = sorted[1];

    if (winner.ctr > runnerUp.ctr * 1.20) {
      // Significant difference — declare winner
      await supabase.from('thumbnail_variants').update({
        is_winner: true,
        declared_winner_at: new Date().toISOString(),
      }).eq('id', winner.id);

      // Set as the active YouTube thumbnail
      const video = await getVideoRecord(videoId);
      await setThumbnail(video.youtubeId, winner.s3_key);

      logger.info(`A/B test winner for ${videoId}: style ${winner.style} with ${(winner.ctr * 100).toFixed(1)}% CTR`);

      // Record in learning data
      await recordThumbnailWin(winner.style, winner.ctr);
    }
  }
}
```

---

## 6. Monthly Full Recalibration

On the first of each month, a comprehensive re-analysis runs:

```typescript
async function runMonthlyRecalibration(): Promise<RecalibrationReport> {
  logger.info('Starting monthly full recalibration');

  // 1. Collect all video performance for full channel history
  const allVideos = await getAllFinalizedVideos();

  // 2. Run comprehensive Claude analysis
  const fullAnalysis = await claude(`
You are analyzing the performance of a YouTube channel focused on World Cup 2026 content.

CHANNEL STATISTICS:
- Total videos: ${allVideos.length}
- Average CTR: ${calcAvg(allVideos, 'ctr')}%
- Average AVD: ${calcAvg(allVideos, 'avgViewPercentage')}%
- Total revenue: $${calcSum(allVideos, 'revenue').toFixed(2)}
- Total views: ${calcSum(allVideos, 'views').toLocaleString()}

TOP 20 VIDEOS (by views):
${JSON.stringify(allVideos.sort((a,b) => b.views7d - a.views7d).slice(0, 20), null, 2)}

BOTTOM 20 VIDEOS (by views):
${JSON.stringify(allVideos.sort((a,b) => a.views7d - b.views7d).slice(0, 20), null, 2)}

Provide:
1. The top 3 topic clusters that consistently outperform
2. The top 3 topic clusters that consistently underperform (should we stop making these?)
3. Which hook type (shocking_stat, bold_claim, question, before_after) has the best CTR?
4. Which thumbnail style has the best real-world CTR?
5. Has there been a trend in improving performance month-over-month? If not, why?
6. Specific recommendations to improve average CTR from ${calcAvg(allVideos, 'ctr')}% to 7%
7. Specific recommendations to improve average AVD from ${calcAvg(allVideos, 'avgViewPercentage')}% to 55%

Output: structured JSON with findings and recommendations.
  `);

  const report = JSON.parse(fullAnalysis);

  // 3. Apply all recommended updates
  await applyAllWeightUpdates(report);

  // 4. Archive current weights before updating (for rollback if needed)
  await archiveCurrentConfig();

  // 5. Save report
  await supabase.from('monthly_reports').insert({
    month: format(new Date(), 'yyyy-MM'),
    report,
    created_at: new Date().toISOString(),
  });

  // 6. Telegram summary to operator
  await sendTelegramAlert(`
📊 Monthly Recalibration Complete

Top topic cluster: ${report.topClusters[0]}
Best hook type: ${report.bestHookType}
Best thumbnail style: ${report.bestThumbnailStyle}
New CTR target: 7%
New AVD target: 55%

Full report saved to database.
  `);

  return report;
}
```

---

## 7. Learning Data Schema

```sql
CREATE TABLE learning_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id),
  snapshot_type TEXT NOT NULL,        -- '7_day' | '30_day' | 'final'
  metrics JSONB NOT NULL,             -- CTR, AVD, views, revenue
  script_features JSONB NOT NULL,     -- Hook type, length, structure
  seo_features JSONB NOT NULL,        -- Title patterns, tags
  thumbnail_winner_style TEXT,
  performance_class TEXT NOT NULL,    -- 'top' | 'average' | 'low'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT UNIQUE NOT NULL,         -- 'yyyy-MM'
  report JSONB NOT NULL,
  config_snapshot JSONB,              -- What weights were in effect
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Rolling weight history for rollback capability
CREATE TABLE config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL,
  config_value JSONB NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 8. Rollback Capability

If a recalibration update causes performance to decrease, the operator can roll back weights:

```typescript
async function rollbackWeights(configKey: string, stepsBack: number = 1): Promise<void> {
  const history = await supabase
    .from('config_history')
    .select('*')
    .eq('config_key', configKey)
    .order('created_at', { ascending: false })
    .limit(stepsBack + 1);

  const targetVersion = history.data?.[stepsBack];
  if (!targetVersion) throw new Error('No historical version available');

  await saveChannelConfig(configKey, targetVersion.config_value, `Rollback to ${targetVersion.created_at}`);
  await sendTelegramAlert(`⚙️ Rolled back ${configKey} to version from ${targetVersion.created_at}`);
}
```
