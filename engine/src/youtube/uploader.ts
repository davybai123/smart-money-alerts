import fs from 'fs';
import path from 'path';
import { youtube_v3 } from 'googleapis';
import { createLogger } from '../lib/logger';
import { withRetry } from '../lib/retry';
import { getYouTubeClient, refreshTokenIfNeeded, getOAuth2Client } from './auth';

const log = createLogger('youtube/uploader');

// ─── Types ─────────────────────────────────────────────────────────────────

export interface UploadInput {
  videoPath: string;
  title: string;
  description: string;
  tags: string[];
  thumbnailPath: string;
  scheduledAt?: Date;
}

export interface UploadResult {
  youtubeId: string;
  youtubeUrl: string;
  status: string;
}

// ─── Core upload ────────────────────────────────────────────────────────────

export async function uploadVideo(input: UploadInput): Promise<UploadResult> {
  const { videoPath, title, description, tags, thumbnailPath, scheduledAt } = input;

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  const oauth2Client = getOAuth2Client();
  await refreshTokenIfNeeded(oauth2Client);
  const youtube = getYouTubeClient();

  log.info('Starting YouTube upload', { title, scheduledAt });

  const fileSize = fs.statSync(videoPath).size;
  const privacyStatus = scheduledAt ? 'private' : 'public';

  const requestBody: youtube_v3.Schema$Video = {
    snippet: {
      title,
      description,
      tags,
      categoryId: '17',           // Sports
      defaultLanguage: 'en',
    },
    status: {
      privacyStatus,
      ...(scheduledAt && { publishAt: scheduledAt.toISOString() }),
      selfDeclaredMadeForKids: false,
    },
  };

  let lastLoggedPercent = -10;

  const response = await withRetry(
    async () => {
      return new Promise<youtube_v3.Schema$Video>((resolve, reject) => {
        const req = youtube.videos.insert(
          {
            part: ['snippet', 'status'],
            requestBody,
            media: {
              mimeType: 'video/mp4',
              body: fs.createReadStream(videoPath),
            },
          },
          (err, res) => {
            if (err) return reject(err);
            if (!res?.data) return reject(new Error('Empty response from YouTube'));
            resolve(res.data);
          }
        );

        // Track upload progress
        const reqAny = req as unknown as { on?: (e: string, h: (evt: { bytesRead?: number }) => void) => void };
        if (typeof reqAny?.on === 'function') {
          reqAny.on('progress', (evt: { bytesRead?: number }) => {
            if (fileSize > 0 && evt.bytesRead) {
              const pct = Math.floor((evt.bytesRead / fileSize) * 100);
              if (pct >= lastLoggedPercent + 10) {
                log.info(`Upload progress: ${pct}%`, { title });
                lastLoggedPercent = pct;
              }
            }
          });
        }
      });
    },
    { maxAttempts: 3, delayMs: 5000, backoff: true, label: 'youtube.upload' }
  );

  const videoId = response.id;
  if (!videoId) {
    throw new Error('YouTube did not return a video ID after upload');
  }

  log.info('Video uploaded successfully', { videoId, title });

  // Set custom thumbnail
  try {
    await setThumbnail(youtube, videoId, thumbnailPath);
  } catch (err) {
    log.warn('Failed to set thumbnail — continuing without it', {
      videoId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Add to World Cup 2026 playlist
  try {
    const playlistId = await getOrCreatePlaylist(youtube, 'World Cup 2026');
    await youtube.playlistItems.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          playlistId,
          resourceId: {
            kind: 'youtube#video',
            videoId,
          },
        },
      },
    });
    log.info('Video added to playlist', { videoId, playlistId });
  } catch (err) {
    log.warn('Failed to add video to playlist — continuing', {
      videoId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    youtubeId: videoId,
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    status: scheduledAt ? 'scheduled' : 'published',
  };
}

// ─── Playlist helpers ────────────────────────────────────────────────────────

export async function getOrCreatePlaylist(
  youtube: youtube_v3.Youtube,
  title: string
): Promise<string> {
  // Search existing playlists
  const listRes = await youtube.playlists.list({
    part: ['snippet'],
    mine: true,
    maxResults: 50,
  });

  const existing = listRes.data.items?.find(
    (p) => p.snippet?.title?.toLowerCase() === title.toLowerCase()
  );

  if (existing?.id) {
    log.debug('Using existing playlist', { title, id: existing.id });
    return existing.id;
  }

  // Create new playlist
  const createRes = await youtube.playlists.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: { title, defaultLanguage: 'en' },
      status: { privacyStatus: 'public' },
    },
  });

  const newId = createRes.data.id;
  if (!newId) {
    throw new Error(`Failed to create playlist: ${title}`);
  }

  log.info('Created new YouTube playlist', { title, id: newId });
  return newId;
}

export async function setThumbnail(
  youtube: youtube_v3.Youtube,
  videoId: string,
  thumbnailPath: string
): Promise<void> {
  if (!fs.existsSync(thumbnailPath)) {
    throw new Error(`Thumbnail file not found: ${thumbnailPath}`);
  }

  const ext = path.extname(thumbnailPath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

  await youtube.thumbnails.set({
    videoId,
    media: {
      mimeType,
      body: fs.createReadStream(thumbnailPath),
    },
  });

  log.info('Thumbnail set successfully', { videoId, thumbnailPath });
}
