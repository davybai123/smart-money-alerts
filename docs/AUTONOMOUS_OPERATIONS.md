# FacelessYT — Daily Autonomous Operations Schedule

**Date:** 2026-06-12
**Module:** `engine/cron/scheduler.ts`, `engine/index.ts`
**Runtime:** Node.js, node-cron, BullMQ

---

## 1. Overview

The autonomous operations schedule is the master orchestrator that runs the entire FacelessYT pipeline every day without human intervention. It is a time-based cron sequence that triggers jobs in the correct order, manages dependencies between phases, handles failures gracefully, and notifies the operator of results.

The schedule is designed with deliberate spacing between phases to account for API latency, rate limits, and variable processing times. Each phase has a defined timeout, retry budget, and fallback behavior. The system is designed to always complete *something* even if individual components fail — producing one video is better than producing zero because one component hit an error.

---

## 2. Daily Schedule (UTC)

```
06:00 ─── TREND SCAN
06:30 ─── OPPORTUNITY SCORING
07:00 ─── RESEARCH PHASE
08:00 ─── SCRIPT GENERATION
09:00 ─── FACT CHECK (runs immediately after scripts)
09:30 ─── ASSET GENERATION (voice + visuals, parallel per video)
11:00 ─── VIDEO ASSEMBLY
12:00 ─── THUMBNAIL GENERATION
12:30 ─── SEO OPTIMIZATION
13:00 ─── YOUTUBE UPLOAD
13:30 ─── SCHEDULING
14:00 ─── ANALYTICS COLLECTION
14:30 ─── LEARNING ENGINE UPDATE
15:00 ─── DAILY TELEGRAM REPORT
```

---

## 3. Phase Specifications

### 06:00 UTC — Trend Scan

```typescript
cron.schedule('0 6 * * *', async () => {
  logger.info('[06:00] Starting daily trend scan');

  const job = await trendQueue.add('daily-trend-scan', {
    date: format(new Date(), 'yyyy-MM-dd'),
    sources: ['youtube', 'reddit', 'newsapi', 'google_trends', 'competitors'],
  }, {
    attempts: 2,
    timeout: 10 * 60 * 1000, // 10 minute timeout
  });

  await job.waitUntilFinished(trendQueue.events, 15 * 60 * 1000);
  logger.info('[06:00] Trend scan complete');
});
```

**Expected duration:** 5-8 minutes
**Failure behavior:** If trend scan fails, use cached results from yesterday + notify via Telegram. Pipeline continues — yesterday's topics are better than no topics.
**Output:** Supabase `opportunities` table populated with 5-10 scored topics.

---

### 06:30 UTC — Opportunity Scoring & Topic Selection

```typescript
cron.schedule('30 6 * * *', async () => {
  logger.info('[06:30] Scoring opportunities and selecting topics');

  const opportunities = await supabase
    .from('opportunities')
    .select('*')
    .eq('used', false)
    .order('opportunity_score', { ascending: false })
    .limit(10);

  // Remove topics similar to content produced in last 14 days
  const deduplicated = await deduplicateAgainstHistory(opportunities.data ?? []);

  // Select top 3
  const selected = deduplicated.slice(0, MAX_VIDEOS_PER_DAY);

  // Mark as selected
  await supabase.from('opportunities')
    .update({ used: true, selected_at: new Date().toISOString() })
    .in('id', selected.map(o => o.id));

  // Create video records
  for (const opp of selected) {
    await supabase.from('videos').insert({
      topic: opp.topic,
      status: 'researching',
      opportunity_score: opp.opportunity_score,
    });
  }

  logger.info(`[06:30] Selected ${selected.length} topics: ${selected.map(o => o.topic).join(', ')}`);
});
```

**Expected duration:** 2-3 minutes
**Failure behavior:** If deduplication API (Claude) fails, skip deduplication and select top 3 by score only.
**Output:** 3 new rows in `videos` table with `status = 'researching'`.

---

### 07:00 UTC — Research Phase

```typescript
cron.schedule('0 7 * * *', async () => {
  logger.info('[07:00] Starting research phase');

  const pendingVideos = await supabase
    .from('videos')
    .select('id, topic')
    .eq('status', 'researching');

  // Research all 3 videos in parallel
  await Promise.allSettled(
    pendingVideos.data!.map(video =>
      researchQueue.add(`research-${video.id}`, { videoId: video.id, topic: video.topic }, {
        attempts: 3,
        timeout: 5 * 60 * 1000, // 5 min per topic
      })
    )
  );

  logger.info('[07:00] Research jobs enqueued');
});
```

**Expected duration:** 3-5 minutes (parallel Claude calls per topic)
**Failure behavior:** If research fails for a topic, script generation proceeds with minimal research context (topic + hook angle only). Note in job log.
**Output:** `videos.research_json` populated for all 3 videos.

---

### 08:00 UTC — Script Generation

```typescript
cron.schedule('0 8 * * *', async () => {
  logger.info('[08:00] Starting script generation');

  const researchedVideos = await supabase
    .from('videos')
    .select('id, topic, research_json')
    .eq('status', 'researching')
    .not('research_json', 'is', null);

  for (const video of researchedVideos.data ?? []) {
    await scriptQueue.add(`script-${video.id}`, {
      videoId: video.id,
      topic: video.topic,
      research: video.research_json,
    }, {
      attempts: 3,
      timeout: 3 * 60 * 1000, // 3 min per script
    });
  }

  await supabase.from('videos')
    .update({ status: 'scripting' })
    .in('id', researchedVideos.data!.map(v => v.id));
});
```

**Expected duration:** 3-7 minutes (Claude generation + quality check + fact check)
**Failure behavior:** If script fails quality check after 3 regeneration attempts, mark video as `status = 'failed'` and continue with remaining videos. Telegram alert.
**Output:** `videos.script_json` populated. `status = 'scripted'`.

---

### 09:30 UTC — Asset Generation (Voice + Visuals, Parallel)

```typescript
cron.schedule('30 9 * * *', async () => {
  logger.info('[09:30] Starting parallel asset generation');

  const scriptedVideos = await supabase
    .from('videos')
    .select('id, script_json')
    .eq('status', 'scripted');

  for (const video of scriptedVideos.data ?? []) {
    // Enqueue voice and visual generation simultaneously
    const [voiceJob, visualJob] = await Promise.all([
      voiceQueue.add(`voice-${video.id}`, { videoId: video.id, script: video.script_json }),
      visualQueue.add(`visual-${video.id}`, { videoId: video.id, script: video.script_json }, {
        // Visual generation is slow — higher timeout
        timeout: 20 * 60 * 1000,
      }),
    ]);

    // Track both jobs for the assembly step
    await supabase.from('job_logs').insert([
      { video_id: video.id, job_type: 'voice', bull_job_id: voiceJob.id, status: 'pending' },
      { video_id: video.id, job_type: 'visual', bull_job_id: visualJob.id, status: 'pending' },
    ]);
  }

  await supabase.from('videos')
    .update({ status: 'generating_assets' })
    .in('id', scriptedVideos.data!.map(v => v.id));
});
```

**Expected duration:** 10-18 minutes (voice: ~5 min, visuals: ~15 min, parallel)
**Failure behavior:**
- Voice failure → retry 3x → if still failing, use Coqui TTS open-source fallback
- Visual failure → retry 3x → use Pexels/Unsplash stock footage fallback
- Both failures → mark video as `status = 'failed'`

**Output:** MP3 in S3 `/audio/`, images/clips in S3 `/images/` and `/clips/`.

---

### 11:00 UTC — Video Assembly

```typescript
cron.schedule('0 11 * * *', async () => {
  logger.info('[11:00] Starting video assembly');

  // Only assemble videos where BOTH voice and visuals are complete
  const readyVideos = await supabase
    .from('videos')
    .select('id')
    .eq('status', 'generating_assets')
    .eq('voice_complete', true)
    .eq('visuals_complete', true);

  for (const video of readyVideos.data ?? []) {
    await assemblyQueue.add(`assembly-${video.id}`, { videoId: video.id }, {
      attempts: 2,
      timeout: 15 * 60 * 1000, // 15 min for FFmpeg
    });
  }
});
```

**Expected duration:** 5-10 minutes per video (sequential per video, parallel across videos)
**Failure behavior:** FFmpeg assembly failure → retry with lower quality settings (CRF 22 instead of 18). If second attempt fails, mark `status = 'failed'`, Telegram alert.
**Output:** Final MP4 in S3 `/videos/`, subtitles SRT in S3 `/subtitles/`. `status = 'assembled'`.

---

### 12:00 UTC — Thumbnail Generation

**Expected duration:** 10-15 minutes (3 variants × 3 videos = 9 SDXL generations)
**Output:** 9 thumbnails in S3 `/thumbs/`. All 3 variants saved to `thumbnail_variants` table.

---

### 12:30 UTC — SEO Optimization

**Expected duration:** 3-5 minutes (Claude calls for titles + descriptions + tags per video)
**Output:** `videos.seo_data` JSON with titles, descriptions, tags, chapters.

---

### 13:00 UTC — YouTube Upload

```typescript
cron.schedule('0 13 * * *', async () => {
  logger.info('[13:00] Starting YouTube uploads');

  const readyToUpload = await supabase
    .from('videos')
    .select('*')
    .eq('status', 'assembled')
    .not('seo_data', 'is', null);

  // Upload sequentially to manage quota carefully
  for (const video of readyToUpload.data ?? []) {
    try {
      const youtubeId = await uploadVideo(video);
      logger.info(`Uploaded ${video.id} → YouTube ID ${youtubeId}`);
    } catch (error) {
      if (error instanceof QuotaExhaustedError) {
        logger.error('YouTube quota exhausted — halting further uploads');
        await sendTelegramAlert('❌ YouTube quota exhausted during upload phase. Remaining videos deferred to tomorrow.');
        break; // Stop uploading, don't fail remaining pipeline steps
      }
      logger.error(`Failed to upload ${video.id}: ${error.message}`);
      await supabase.from('videos').update({ status: 'upload_failed' }).eq('id', video.id);
    }
  }
});
```

**Expected duration:** 5-15 minutes per video depending on file size and connection speed
**Failure behavior:** Quota exhaustion → stop, defer to next day. Network failure → retry 5x with exponential backoff.

---

### 13:30 UTC — Scheduling

**Expected duration:** 2-3 minutes
**Output:** Videos scheduled to publish at optimal times (Tue/Wed/Thu 2-4pm EST range). `status = 'scheduled'`.

---

### 14:00 UTC — Analytics Collection

```typescript
cron.schedule('0 14 * * *', async () => {
  logger.info('[14:00] Starting analytics collection');

  const liveVideos = await supabase
    .from('videos')
    .select('id, youtube_id, created_at')
    .eq('status', 'live');

  const today = format(new Date(), 'yyyy-MM-dd');

  for (const video of liveVideos.data ?? []) {
    const videoAge = differenceInHours(new Date(), new Date(video.created_at));

    // Collect metrics for all live videos
    await analyticsQueue.add(`analytics-${video.id}-${today}`, {
      videoId: video.id,
      youtubeId: video.youtube_id,
      date: today,
    });

    // Check alert thresholds
    await analyticsQueue.add(`alerts-${video.id}`, { videoId: video.id });

    // Collect final 7-day data for mature videos
    if (videoAge >= 168 && videoAge < 192) { // 7-8 days old
      await analyticsQueue.add(`finalize-${video.id}`, { videoId: video.id, type: '7_day' });
    }
  }
});
```

---

### 14:30 UTC — Learning Engine Update

```typescript
cron.schedule('30 14 * * *', async () => {
  logger.info('[14:30] Running learning engine update');

  await collectFinalMetrics();          // 7-day finalization
  await concludeABTests();              // Declare thumbnail winners
  await updateThumbnailStylePreferences();
  await updateOptimalUploadTimes();

  // Monthly full recalibration (first of month only)
  if (new Date().getDate() === 1) {
    await runMonthlyRecalibration();
  }
});
```

---

### 15:00 UTC — Daily Telegram Report

```typescript
cron.schedule('0 15 * * *', async () => {
  const report = await compileDailyReport();

  await sendTelegramMessage(`
🎬 FacelessYT Daily Report — ${format(new Date(), 'dd MMM yyyy')}

TODAY'S PIPELINE:
✅ Videos produced: ${report.videosProduced}/3
✅ Videos uploaded: ${report.videosUploaded}
📅 Scheduled for: ${report.scheduledTimes.join(', ')}

YESTERDAY'S PERFORMANCE:
📊 Views: ${report.yesterdayViews.toLocaleString()}
💰 Revenue: $${report.yesterdayRevenue.toFixed(2)}
📈 Best video: "${report.bestVideo.title}" (${report.bestVideo.views.toLocaleString()} views)
🎯 Avg CTR: ${(report.avgCTR * 100).toFixed(1)}%
⏱ Avg AVD: ${(report.avgAVD * 100).toFixed(1)}%

CHANNEL TOTALS:
👥 Subscribers: ${report.totalSubscribers.toLocaleString()} (+${report.subsGainedToday})
📹 Total videos: ${report.totalVideos}
💵 All-time revenue: $${report.lifetimeRevenue.toFixed(2)}

${report.alerts.length > 0 ? '⚠️ ALERTS:\n' + report.alerts.join('\n') : '✅ No alerts'}

${report.failedVideos.length > 0 ? '❌ FAILURES:\n' + report.failedVideos.map(v => `- ${v.topic}: ${v.failReason}`).join('\n') : ''}
  `);
});
```

---

## 4. Human Override System

The autonomous engine exposes a REST API for human intervention:

### 4.1 Engine Control Endpoints

```typescript
// POST /engine/pause
// Pauses the daily pipeline at the next checkpoint
app.post('/engine/pause', requireAuth, async (req, res) => {
  await saveChannelConfig('engine_paused', { paused: true, reason: req.body.reason });
  await pauseAllQueues();
  res.json({ status: 'paused' });
});

// POST /engine/resume
app.post('/engine/resume', requireAuth, async (req, res) => {
  await saveChannelConfig('engine_paused', { paused: false });
  await resumeAllQueues();
  res.json({ status: 'resumed' });
});

// POST /engine/emergency-stop
// Immediately halts everything, clears all queues
app.post('/engine/emergency-stop', requireAuth, async (req, res) => {
  await drainAllQueues();
  await saveChannelConfig('engine_paused', { paused: true, reason: 'emergency_stop' });
  await sendTelegramAlert('🛑 Emergency stop activated by operator');
  res.json({ status: 'stopped' });
});

// POST /engine/inject-topic
// Adds a specific topic to tomorrow's pipeline with maximum priority
app.post('/engine/inject-topic', requireAuth, async (req, res) => {
  const { topic, angle, priority } = req.body;
  await supabase.from('opportunities').insert({
    topic,
    suggested_angle: angle,
    opportunity_score: priority === 'high' ? 999 : 100, // Guarantees selection
    source: 'manual_injection',
  });
  res.json({ status: 'topic_injected', topic });
});

// GET /engine/status
app.get('/engine/status', requireAuth, async (req, res) => {
  const queueStats = await getQueueStats();
  const todayVideos = await getTodayVideoStatus();
  const paused = await getChannelConfig('engine_paused');

  res.json({ paused: paused.paused, queueStats, todayVideos });
});
```

### 4.2 Manual Topic Override via Telegram

The operator can also inject topics via Telegram message:

```typescript
// telegram bot listens for messages from the owner's CHAT_ID
bot.on('message', async (msg) => {
  if (msg.chat.id.toString() !== process.env.CHAT_ID) return;

  if (msg.text?.startsWith('/inject ')) {
    const topic = msg.text.replace('/inject ', '');
    await injectTopic(topic);
    bot.sendMessage(msg.chat.id, `✅ Topic injected: "${topic}"\nWill be included in tomorrow's pipeline.`);
  }

  if (msg.text === '/pause') {
    await pauseEngine('telegram command');
    bot.sendMessage(msg.chat.id, '⏸ Engine paused.');
  }

  if (msg.text === '/resume') {
    await resumeEngine();
    bot.sendMessage(msg.chat.id, '▶️ Engine resumed.');
  }

  if (msg.text === '/status') {
    const status = await getEngineStatus();
    bot.sendMessage(msg.chat.id, formatStatusMessage(status));
  }
});
```

---

## 5. Graceful Failure Architecture

### 5.1 Per-Phase Failure Handling

Every phase follows this contract:

```typescript
async function runPhase(
  phaseName: string,
  phaseFn: () => Promise<void>,
  options: PhaseOptions = {}
): Promise<PhaseResult> {
  const {
    maxAttempts = 3,
    timeoutMs = 5 * 60 * 1000,
    fallbackFn,
    continueOnFailure = true,
  } = options;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await withTimeout(phaseFn(), timeoutMs);
      return { success: true, phase: phaseName };
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts - 1;

      logger.error(`Phase ${phaseName} failed (attempt ${attempt + 1}/${maxAttempts}): ${error.message}`);

      if (isLastAttempt) {
        await sendTelegramAlert(`⚠️ Phase "${phaseName}" failed after ${maxAttempts} attempts: ${error.message}`);

        if (fallbackFn) {
          try {
            await fallbackFn();
            return { success: false, phase: phaseName, usedFallback: true };
          } catch (fallbackError) {
            logger.error(`Fallback for ${phaseName} also failed: ${fallbackError.message}`);
          }
        }

        if (!continueOnFailure) {
          throw error; // Bubble up for critical phases
        }

        return { success: false, phase: phaseName, error: error.message };
      }

      // Exponential backoff between attempts
      await sleep(Math.pow(2, attempt) * 10_000);
    }
  }

  return { success: false, phase: phaseName };
}
```

### 5.2 Failure Impact Matrix

| Phase Failure | Impact | Recovery Strategy |
|---|---|---|
| Trend scan | Use cached topics from yesterday | Auto-fallback |
| Research | Scripts use minimal context | Auto-fallback |
| Script generation | Skip this video, continue others | Auto-skip + alert |
| Voice generation | Retry × 3, then open-source TTS | Auto-fallback |
| Visual generation | Retry × 3, then stock footage | Auto-fallback |
| Video assembly | Retry with lower quality settings | Auto-retry |
| YouTube upload | Defer to next day if quota; retry otherwise | Queue defer |
| Analytics collection | Skip, retry next collection cycle | Auto-skip |
| Learning engine | Skip, retry tomorrow | Auto-skip |

### 5.3 Health Check Endpoint

```typescript
app.get('/health', async (req, res) => {
  const checks = {
    redis: await checkRedisConnection(),
    supabase: await checkSupabaseConnection(),
    queues: await getQueueHealthSummary(),
    lastRunAt: await getLastSuccessfulRunTime(),
    enginePaused: await getEnginePausedState(),
  };

  const healthy = Object.values(checks).every(c =>
    typeof c === 'boolean' ? c : c.healthy !== false
  );

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});
```

---

## 6. Cron Job Registry

| Job | Expression | UTC Time | Description |
|---|---|---|---|
| `daily-trend-scan` | `0 6 * * *` | 06:00 | Full trend scan |
| `opportunity-scoring` | `30 6 * * *` | 06:30 | Score + select topics |
| `research-phase` | `0 7 * * *` | 07:00 | Claude research per topic |
| `script-generation` | `0 8 * * *` | 08:00 | Script gen + quality check |
| `asset-generation` | `30 9 * * *` | 09:30 | Voice + visuals (parallel) |
| `video-assembly` | `0 11 * * *` | 11:00 | FFmpeg assembly |
| `thumbnail-generation` | `0 12 * * *` | 12:00 | 3 variants per video |
| `seo-optimization` | `30 12 * * *` | 12:30 | Titles, descriptions, tags |
| `youtube-upload` | `0 13 * * *` | 13:00 | Upload + thumbnail set |
| `scheduling` | `30 13 * * *` | 13:30 | Set publishAt times |
| `analytics-collection` | `0 14 * * *` | 14:00 | Pull YouTube metrics |
| `learning-update` | `30 14 * * *` | 14:30 | Update scoring weights |
| `daily-report` | `0 15 * * *` | 15:00 | Telegram summary |
| `hourly-analytics` | `0 * * * *` | Every hour | Metrics for videos < 48h |
| `monthly-recalibration` | `0 12 1 * *` | 12:00 on 1st | Full pattern re-analysis |
