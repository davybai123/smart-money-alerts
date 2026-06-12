import { createLogger } from '../lib/logger';
import { updateVideo } from '../db/client';
import { Video } from '../db/schema';
import { uploadVideo } from './uploader';

const log = createLogger('youtube/scheduler');

// ─── Types ────────────────────────────────────────────────────────────────

export interface SEOOutput {
  title: string;
  description: string;
  tags: string[];
  thumbnailPath: string;
}

// ─── World Cup 2026 known match schedule (UTC kickoff times) ─────────────
// Format: 'YYYY-MM-DD' -> ISO datetime string of kickoff
// This list will be extended as the schedule is confirmed.
const WORLD_CUP_MATCHES: Record<string, string> = {
  '2026-06-11': '2026-06-11T19:00:00Z',
  '2026-06-12': '2026-06-12T19:00:00Z',
  '2026-06-13': '2026-06-13T22:00:00Z',
  '2026-06-14': '2026-06-14T19:00:00Z',
  '2026-06-15': '2026-06-15T22:00:00Z',
  '2026-06-16': '2026-06-16T19:00:00Z',
  '2026-06-17': '2026-06-17T22:00:00Z',
  '2026-06-18': '2026-06-18T19:00:00Z',
  '2026-06-19': '2026-06-19T22:00:00Z',
  '2026-06-20': '2026-06-20T19:00:00Z',
};

/**
 * Determine the optimal publish time for a soccer/World Cup video.
 *
 * Strategy:
 * - Default publishing windows: Tue/Wed/Thu at 14:00 UTC
 * - If a World Cup match is scheduled on the target day, publish 2h before kickoff
 * - Apply ±30 min random jitter to avoid exact repetition
 */
export function getOptimalPublishTime(topic: string): Date {
  const now = new Date();
  // Find the next Tue/Wed/Thu (weekdays 2, 3, 4)
  const targetWeekdays = new Set([2, 3, 4]);
  let candidate = new Date(now);
  candidate.setUTCHours(14, 0, 0, 0);

  // If today is already past 14:00 UTC, start from tomorrow
  if (now.getTime() >= candidate.getTime()) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
    candidate.setUTCHours(14, 0, 0, 0);
  }

  // Walk forward until we land on a Tue/Wed/Thu
  for (let i = 0; i < 7; i++) {
    const day = candidate.getUTCDay();
    if (targetWeekdays.has(day)) break;
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }

  // Check if there's a World Cup match that day
  const dateKey = candidate.toISOString().slice(0, 10);
  const matchKickoff = WORLD_CUP_MATCHES[dateKey];
  if (matchKickoff) {
    const kickoffTime = new Date(matchKickoff);
    const twoHoursBefore = new Date(kickoffTime.getTime() - 2 * 60 * 60 * 1000);
    log.info('Match day detected — publishing 2h before kickoff', {
      topic,
      matchKickoff,
      publishAt: twoHoursBefore.toISOString(),
    });
    candidate = twoHoursBefore;
  }

  // Apply ±30 min jitter
  const jitterMs = (Math.random() * 60 - 30) * 60 * 1000;
  const final = new Date(candidate.getTime() + jitterMs);

  log.debug('Optimal publish time calculated', {
    topic,
    publishAt: final.toISOString(),
  });

  return final;
}

/**
 * Schedule a video for upload.
 * - Picks the optimal publish time
 * - Calls uploadVideo with scheduledAt
 * - Persists youtube_id, status, and scheduled_at to the DB
 */
export async function scheduleUpload(video: Video, seo: SEOOutput): Promise<void> {
  log.info('Scheduling video upload', { videoId: video.id, title: seo.title });

  if (!video.video_url) {
    throw new Error(`Video ${video.id} has no video_url — cannot upload`);
  }

  const scheduledAt = getOptimalPublishTime(video.title);

  const result = await uploadVideo({
    videoPath: video.video_url,
    title: seo.title,
    description: seo.description,
    tags: seo.tags,
    thumbnailPath: seo.thumbnailPath,
    scheduledAt,
  });

  await updateVideo(video.id, {
    youtube_id: result.youtubeId,
    status: 'scheduled',
    scheduled_at: scheduledAt.toISOString(),
    title: seo.title,
    description: seo.description,
    tags: seo.tags,
    thumbnail_url: seo.thumbnailPath,
  });

  log.info('Video scheduled successfully', {
    videoId: video.id,
    youtubeId: result.youtubeId,
    youtubeUrl: result.youtubeUrl,
    scheduledAt: scheduledAt.toISOString(),
  });
}
