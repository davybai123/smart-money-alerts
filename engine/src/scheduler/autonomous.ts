import cron from 'node-cron';
import { createLogger } from '../lib/logger';
import { sendAlert, sendDailyReport, DailyReport } from '../notifications/telegram';
import { collectAllActiveVideos, generatePerformanceReport } from '../analytics/collector';
import { analyzePerformance, updateScoringWeights, concludeThumbnailTests } from '../feedback/analyzer';
import { scheduleUpload } from '../youtube/scheduler';
import { createClient } from '@supabase/supabase-js';

const log = createLogger('scheduler/autonomous');

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduledTask {
  name: string;
  task: cron.ScheduledTask;
}

// ─── State ─────────────────────────────────────────────────────────────────

const registeredTasks: ScheduledTask[] = [];
let isPaused = false;

// ─── Supabase helper ─────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_KEY must be set');
  return createClient(url, key);
}

// ─── Phase runner wrapper ─────────────────────────────────────────────────────

async function runPhase(name: string, fn: () => Promise<void>): Promise<void> {
  if (isPaused) {
    log.info(`Scheduler paused — skipping phase "${name}"`);
    return;
  }

  const start = Date.now();
  log.info(`Phase "${name}" starting`);

  try {
    await fn();
    const durationMs = Date.now() - start;
    log.info(`Phase "${name}" completed`, { durationMs });
  } catch (err) {
    const durationMs = Date.now() - start;
    const message =
      err instanceof Error ? err.message : String(err);

    log.error(`Phase "${name}" failed`, { durationMs, error: message });

    try {
      await sendAlert('error', `Phase "${name}" failed: ${message}`);
    } catch (alertErr) {
      log.warn('Failed to send Telegram alert', {
        error: alertErr instanceof Error ? alertErr.message : String(alertErr),
      });
    }
  }
}

// ─── Phase implementations ────────────────────────────────────────────────────

/**
 * 06:00 UTC — Discover trends, score, and select top 3 topics.
 *
 * These imports are lazy so the engine starts even if upstream modules
 * haven't finished their init (reduces circular dependency risk at startup).
 */
async function discoverAndScore(): Promise<void> {
  // Dynamic import to avoid circular module deps at startup
  const { discoverOpportunities } = await import('../discovery/index');
  const supabase = getSupabase();

  const opportunities = await discoverOpportunities();
  if (opportunities.length === 0) {
    log.info('No opportunities discovered this cycle');
    return;
  }

  // Select top 3 by opportunity_score and mark as 'selected'
  const top3 = [...opportunities]
    .sort((a, b) => b.opportunity_score - a.opportunity_score)
    .slice(0, 3);

  for (const opp of top3) {
    const { error } = await supabase
      .from('content_opportunities')
      .update({ status: 'selected' })
      .eq('id', opp.id);

    if (error) {
      log.warn(`Failed to mark opportunity ${opp.id} as selected`, {
        error: error.message,
      });
    } else {
      log.info(`Selected opportunity: ${opp.topic}`, {
        id: opp.id,
        score: opp.opportunity_score,
      });
    }
  }

  log.info(`Discovered ${opportunities.length} opportunities, selected top ${top3.length}`);
}

/**
 * 07:00 UTC — Research each selected opportunity (calls discovery enrichment).
 */
async function researchPhase(): Promise<void> {
  const supabase = getSupabase();
  const { data: selected, error } = await supabase
    .from('content_opportunities')
    .select('*')
    .eq('status', 'selected');

  if (error) throw new Error(`Failed to fetch selected opportunities: ${error.message}`);
  if (!selected || selected.length === 0) {
    log.info('No selected opportunities to research');
    return;
  }

  log.info(`Researching ${selected.length} selected opportunities`);
  // Research is handled inline during discoverAndScore via the discovery module.
  // This phase ensures we log and can extend with additional enrichment steps.
  for (const opp of selected) {
    log.info(`Research confirmed for: ${opp.topic}`, { id: opp.id });
  }
}

/**
 * 08:00 UTC — Generate scripts for selected opportunities.
 */
async function scriptPhase(): Promise<void> {
  const { produceScript } = await import('../scripts/index');
  const supabase = getSupabase();

  const { data: selected, error } = await supabase
    .from('content_opportunities')
    .select('*')
    .eq('status', 'selected');

  if (error) throw new Error(`Failed to fetch selected opportunities: ${error.message}`);
  if (!selected || selected.length === 0) {
    log.info('No opportunities ready for scripting');
    return;
  }

  log.info(`Generating scripts for ${selected.length} opportunity(s)`);

  for (const opp of selected) {
    try {
      await produceScript(opp.id);
      await supabase
        .from('content_opportunities')
        .update({ status: 'scripted' })
        .eq('id', opp.id);
      log.info(`Script produced for opportunity: ${opp.topic}`, { id: opp.id });
    } catch (err) {
      log.error(`Failed to produce script for ${opp.topic}`, {
        id: opp.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * 09:00 UTC — Queue video production for scripted content.
 */
async function assetPhase(): Promise<void> {
  const { produceVideo } = await import('../video/pipeline');
  const supabase = getSupabase();

  // Get scripts associated with 'scripted' opportunities
  const { data: opportunities, error: oppErr } = await supabase
    .from('content_opportunities')
    .select('id')
    .eq('status', 'scripted');

  if (oppErr) throw new Error(`Failed to fetch scripted opportunities: ${oppErr.message}`);
  if (!opportunities || opportunities.length === 0) {
    log.info('No scripted opportunities ready for video production');
    return;
  }

  const opportunityIds = opportunities.map((o: { id: string }) => o.id);

  const { data: scripts, error: scriptErr } = await supabase
    .from('scripts')
    .select('*')
    .in('opportunity_id', opportunityIds)
    .eq('status', 'approved');

  if (scriptErr) throw new Error(`Failed to fetch scripts: ${scriptErr.message}`);
  if (!scripts || scripts.length === 0) {
    log.info('No approved scripts ready for video production');
    return;
  }

  log.info(`Queuing video production for ${scripts.length} script(s)`);

  for (const script of scripts) {
    try {
      await produceVideo(script.id);
      await supabase
        .from('scripts')
        .update({ status: 'producing' })
        .eq('id', script.id);
      log.info(`Video production queued for script`, { scriptId: script.id });
    } catch (err) {
      log.error(`Failed to queue video production for script ${script.id}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * 13:00 UTC — Upload ready videos to YouTube with scheduling.
 */
async function uploadPhase(): Promise<void> {
  const { generateSEO } = await import('../seo/optimizer');
  const supabase = getSupabase();

  const { data: readyVideos, error } = await supabase
    .from('videos')
    .select('*')
    .eq('status', 'ready');

  if (error) throw new Error(`Failed to fetch ready videos: ${error.message}`);
  if (!readyVideos || readyVideos.length === 0) {
    log.info('No videos ready for upload');
    return;
  }

  log.info(`Uploading ${readyVideos.length} ready video(s)`);

  for (const video of readyVideos) {
    try {
      await supabase
        .from('videos')
        .update({ status: 'uploading' })
        .eq('id', video.id);

      const seo = await generateSEO(video.opportunity_id);
      await scheduleUpload(video, seo);

      log.info(`Video scheduled for upload`, {
        videoId: video.id,
        title: video.title,
      });
    } catch (err) {
      log.error(`Failed to upload video ${video.id}`, {
        error: err instanceof Error ? err.message : String(err),
      });

      // Revert status on failure
      await supabase
        .from('videos')
        .update({ status: 'failed' })
        .eq('id', video.id);
    }
  }
}

/**
 * 14:00 UTC — Collect analytics for all active videos.
 */
async function analyticsPhase(): Promise<void> {
  await collectAllActiveVideos();
}

/**
 * 14:30 UTC — Run the learning engine.
 */
async function feedbackPhase(): Promise<void> {
  const insights = await analyzePerformance();
  await updateScoringWeights(insights);
  await concludeThumbnailTests();
}

/**
 * 15:00 UTC — Generate and send Telegram daily report.
 */
async function reportPhase(): Promise<void> {
  const supabase = getSupabase();
  const today = new Date().toISOString().slice(0, 10);

  // Count videos produced today
  const { count: producedCount } = await supabase
    .from('videos')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${today}T00:00:00Z`);

  // Count videos uploaded/scheduled today
  const { count: uploadedCount } = await supabase
    .from('videos')
    .select('id', { count: 'exact', head: true })
    .in('status', ['scheduled', 'published'])
    .gte('created_at', `${today}T00:00:00Z`);

  // Latest metrics aggregation
  const report = await generatePerformanceReport();

  const { data: nextOpp } = await supabase
    .from('content_opportunities')
    .select('topic')
    .eq('status', 'selected')
    .order('opportunity_score', { ascending: false })
    .limit(1)
    .maybeSingle();

  const bestPerformer =
    report.topVideos.length > 0
      ? { title: report.topVideos[0].title, ctr: report.topVideos[0].ctr }
      : null;

  const dailyReport: DailyReport = {
    date: today,
    videosProduced: producedCount ?? 0,
    videosUploaded: uploadedCount ?? 0,
    totalViews: report.totalViews,
    estimatedRevenue: report.totalRevenue,
    bestPerformer,
    topOpportunity: nextOpp?.topic ?? 'TBD',
  };

  await sendDailyReport(dailyReport);
}

// ─── Scheduler registration ────────────────────────────────────────────────────

export function startAutonomousScheduler(): void {
  log.info('Starting FacelessYT autonomous scheduler');

  const schedule = [
    { cron: '0 6 * * *',  name: 'discover-and-score', fn: discoverAndScore },
    { cron: '0 7 * * *',  name: 'research-phase',      fn: researchPhase },
    { cron: '0 8 * * *',  name: 'script-phase',        fn: scriptPhase },
    { cron: '0 9 * * *',  name: 'asset-phase',         fn: assetPhase },
    { cron: '0 13 * * *', name: 'upload-phase',        fn: uploadPhase },
    { cron: '0 14 * * *', name: 'analytics-phase',     fn: analyticsPhase },
    { cron: '30 14 * * *',name: 'feedback-phase',      fn: feedbackPhase },
    { cron: '0 15 * * *', name: 'report-phase',        fn: reportPhase },
  ];

  for (const entry of schedule) {
    const task = cron.schedule(entry.cron, () => {
      void runPhase(entry.name, entry.fn);
    });

    registeredTasks.push({ name: entry.name, task });
    log.info(`Cron registered: "${entry.name}" at "${entry.cron}"`);
  }

  // Graceful shutdown handlers
  process.on('SIGTERM', () => {
    log.info('SIGTERM received — stopping scheduler');
    pauseScheduler();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    log.info('SIGINT received — stopping scheduler');
    pauseScheduler();
    process.exit(0);
  });

  log.info(`Autonomous scheduler started with ${registeredTasks.length} cron jobs`);
}

// ─── Control functions ────────────────────────────────────────────────────────

export function pauseScheduler(): void {
  log.info('Pausing scheduler');
  isPaused = true;
  for (const { name, task } of registeredTasks) {
    task.stop();
    log.debug(`Task stopped: ${name}`);
  }
}

export function resumeScheduler(): void {
  log.info('Resuming scheduler');
  isPaused = false;
  for (const { name, task } of registeredTasks) {
    task.start();
    log.debug(`Task resumed: ${name}`);
  }
}

const phaseMap: Record<string, () => Promise<void>> = {
  'discover-and-score': discoverAndScore,
  'research-phase': researchPhase,
  'script-phase': scriptPhase,
  'asset-phase': assetPhase,
  'upload-phase': uploadPhase,
  'analytics-phase': analyticsPhase,
  'feedback-phase': feedbackPhase,
  'report-phase': reportPhase,
};

export async function runPhaseNow(phase: string): Promise<void> {
  const fn = phaseMap[phase];
  if (!fn) {
    const available = Object.keys(phaseMap).join(', ');
    throw new Error(`Unknown phase "${phase}". Available: ${available}`);
  }
  await runPhase(phase, fn);
}
