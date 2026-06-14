# FacelessYT — YouTube Upload & Channel Management Automation

**Date:** 2026-06-12
**Module:** `engine/modules/youtube/`
**API:** YouTube Data API v3

---

## 1. Overview

This module handles the complete lifecycle of a video on YouTube: authentication, upload, metadata assignment, thumbnail setting, playlist management, scheduling, end screen configuration, and ongoing channel management. It is the final production step before a video reaches viewers.

YouTube upload is technically complex — large file sizes require resumable uploads, OAuth tokens expire, quota limits impose daily caps, and upload errors can occur mid-stream. This module is engineered for reliability, with retry logic, quota monitoring, and graceful degradation at every step.

---

## 2. Authentication — OAuth 2.0

**File:** `engine/modules/youtube/auth.ts`

YouTube uploads require a user-authorized OAuth 2.0 token. API key authentication is insufficient for write operations. The system uses the offline access pattern: a one-time consent flow generates a `refresh_token` that is stored permanently and used to generate short-lived `access_token`s automatically.

### 2.1 OAuth Setup (One-Time)

```typescript
// engine/scripts/youtube-auth.js — run once to set up credentials
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3001/auth/callback'
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',     // Offline = refresh token granted
  prompt: 'consent',          // Force consent screen to get new refresh token
  scope: [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
  ],
});

console.log('Visit this URL to authorize:', authUrl);
// After authorization: exchange code for tokens
// Save tokens.refresh_token to GOOGLE_REFRESH_TOKEN in .env
```

### 2.2 Runtime Token Management

```typescript
// engine/modules/youtube/auth.ts
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getValidAccessToken(): Promise<string> {
  // Return cached token if still valid (5-minute buffer before expiry)
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt - 300_000) {
    return cachedAccessToken.token;
  }

  // Refresh using stored refresh token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  });

  const { access_token, expires_in } = await response.json();

  cachedAccessToken = {
    token: access_token,
    expiresAt: Date.now() + (expires_in * 1000),
  };

  return access_token;
}
```

---

## 3. Video Upload (Resumable)

**File:** `engine/modules/youtube/uploader.ts`

Video files are 100-500MB. Standard HTTP uploads are unreliable at this size. YouTube's resumable upload protocol splits the upload into chunks, and if interrupted, resumes from the last successful chunk rather than starting over.

### 3.1 Upload Initiation

```typescript
async function initiateResumableUpload(metadata: VideoMetadata): Promise<string> {
  const accessToken = await getValidAccessToken();

  const initResponse = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status,recordingDetails',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'video/mp4',
        'X-Upload-Content-Length': metadata.fileSizeBytes.toString(),
      },
      body: JSON.stringify({
        snippet: {
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags,
          categoryId: '17',             // Sports
          defaultLanguage: 'en',
          defaultAudioLanguage: 'en',
        },
        status: {
          privacyStatus: 'private',     // Start private, publish via schedule
          selfDeclaredMadeForKids: false,
          embeddable: true,
          publicStatsViewable: true,
        },
      }),
    }
  );

  // The Location header contains the resumable upload URI
  const uploadUri = initResponse.headers.get('Location');
  if (!uploadUri) throw new Error('Failed to get resumable upload URI');
  return uploadUri;
}
```

### 3.2 Chunked Upload from S3

```typescript
const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB chunks (must be multiple of 256KB)

async function uploadVideoFromS3(uploadUri: string, s3Key: string): Promise<string> {
  const s3Stream = await getS3ReadStream(s3Key);
  const fileSize = await getS3FileSize(s3Key);
  let uploadedBytes = 0;

  for await (const chunk of createChunkIterator(s3Stream, CHUNK_SIZE)) {
    const startByte = uploadedBytes;
    const endByte = Math.min(uploadedBytes + chunk.length - 1, fileSize - 1);

    const response = await fetch(uploadUri, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes ${startByte}-${endByte}/${fileSize}`,
        'Content-Length': chunk.length.toString(),
      },
      body: chunk,
    });

    if (response.status === 200 || response.status === 201) {
      // Upload complete
      const videoData = await response.json();
      return videoData.id; // YouTube video ID
    } else if (response.status === 308) {
      // Incomplete, continue
      uploadedBytes += chunk.length;
    } else {
      throw new Error(`Upload failed at byte ${uploadedBytes}: ${response.status}`);
    }
  }

  throw new Error('Upload stream ended without completion');
}
```

---

## 4. Metadata Assignment

### 4.1 Thumbnail Upload

```typescript
async function setThumbnail(videoId: string, thumbnailS3Key: string): Promise<void> {
  const accessToken = await getValidAccessToken();
  const thumbnailBuffer = await downloadFromS3(thumbnailS3Key);

  await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'image/jpeg',
      'Content-Length': thumbnailBuffer.length.toString(),
    },
    body: thumbnailBuffer,
  });

  logger.info(`Thumbnail set for video ${videoId}`);
}
```

Note: YouTube allows up to 3 thumbnail uploads per video (for A/B testing). Subsequent `thumbnails.set` calls replace the current thumbnail.

### 4.2 Playlist Assignment

```typescript
async function addToPlaylist(videoId: string, playlistId: string): Promise<void> {
  const youtube = await getYouTubeClient();

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
}

// Playlists managed in channel_config:
// "World Cup 2026 Analysis" → playlistId from Supabase config
// "Daily Soccer News" → for news-type content
// "Tactics Breakdowns" → for analytical content
```

### 4.3 Category and Language

Category `17` (Sports) is always assigned. This is critical for ad targeting:
- Sports content attracts premium advertisers (sports betting, athletic brands, sports streaming services)
- Proper categorization improves suggested video placement alongside similar content

---

## 5. Scheduling

### 5.1 Optimal Publish Time Selection

Based on YouTube Analytics data from soccer channels with similar audiences, peak engagement windows are:

```typescript
const OPTIMAL_PUBLISH_WINDOWS = {
  monday:    ['14:00', '20:00'],  // Eastern Time
  tuesday:   ['14:00', '18:00'],  // Best day
  wednesday: ['15:00', '19:00'],  // Second best
  thursday:  ['14:00', '18:00'],
  friday:    ['15:00', '20:00'],
  saturday:  ['12:00', '18:00'],  // Weekend gaming/leisure window
  sunday:    ['13:00', '19:00'],
};

function selectPublishTime(existingSchedule: ScheduledVideo[]): Date {
  const now = new Date();
  const candidates: Date[] = [];

  // Generate candidate times for next 7 days
  for (let day = 0; day < 7; day++) {
    const date = addDays(now, day + 1);
    const dayName = format(date, 'EEEE').toLowerCase() as keyof typeof OPTIMAL_PUBLISH_WINDOWS;
    const windows = OPTIMAL_PUBLISH_WINDOWS[dayName];

    windows.forEach(time => {
      const candidate = parseISO(`${format(date, 'yyyy-MM-dd')}T${time}:00-05:00`);
      // Check no other video is scheduled within 4 hours of this slot
      const conflict = existingSchedule.some(v =>
        Math.abs(differenceInHours(v.publishAt, candidate)) < 4
      );
      if (!conflict) candidates.push(candidate);
    });
  }

  // Select earliest available slot (or slot with best historical performance from learning engine)
  return candidates.sort((a, b) => a.getTime() - b.getTime())[0];
}
```

### 5.2 Setting the Schedule

```typescript
async function scheduleVideo(videoId: string, publishAt: Date): Promise<void> {
  const youtube = await getYouTubeClient();

  await youtube.videos.update({
    part: ['status'],
    requestBody: {
      id: videoId,
      status: {
        privacyStatus: 'private',
        publishAt: publishAt.toISOString(),
      },
    },
  });

  logger.info(`Video ${videoId} scheduled for ${publishAt.toISOString()}`);
}
```

Note: `publishAt` only works when `privacyStatus` is `'private'` with a future publish time, not `'scheduled'` (that's the status after the publish time passes).

---

## 6. Quota Management

The YouTube Data API v3 provides 10,000 units per day. Each operation costs a different number of units:

| Operation | Units | Daily Budget Allocation |
|---|---|---|
| `videos.insert` | 1,600 | 3 videos × 1,600 = 4,800 |
| `thumbnails.set` | 50 | 9 thumbnails × 50 = 450 |
| `playlistItems.insert` | 50 | 3 × 50 = 150 |
| `videos.update` (schedule) | 50 | 3 × 50 = 150 |
| `search.list` (discovery) | 100 | 10 searches = 1,000 |
| `videos.list` (analytics) | 1 | ~50 videos = 50 |
| `channels.list` | 1 | 5 calls = 5 |
| **Daily total** | | **~6,605 / 10,000** |

Remaining ~3,395 units are reserved for analytics queries, competitor monitoring, and unexpected retries.

```typescript
class QuotaMonitor {
  private usedUnits = 0;
  private readonly dailyLimit = 10_000;
  private readonly warningThreshold = 8_000;

  async track(operation: string, units: number): Promise<void> {
    this.usedUnits += units;

    if (this.usedUnits > this.warningThreshold) {
      await sendTelegramAlert(
        `⚠️ YouTube API quota at ${this.usedUnits}/${this.dailyLimit} units. ${dailyLimit - this.usedUnits} remaining.`
      );
    }

    if (this.usedUnits > this.dailyLimit * 0.95) {
      throw new QuotaExhaustedError('YouTube API quota nearly exhausted. Halting uploads.');
    }
  }

  async requestQuotaIncrease(): Promise<void> {
    // Log reminder to apply for quota increase via Google Cloud Console
    // Typical increase request: 50,000 units/day (requires channel verification)
    logger.warn('QUOTA_WARNING: Apply for quota increase at console.cloud.google.com');
  }
}
```

---

## 7. Community Posts

For channels with 500+ subscribers, community posts can drive additional engagement. The engine auto-creates posts on upload day:

```typescript
async function createCommunityPost(videoId: string, topic: string): Promise<void> {
  // Community posts are created via YouTube Data API v3 (channel sections)
  // Or manually queued for the operator to post (simpler for MVP)

  const postText = await claude(`
Write a YouTube community post to announce a new video about: ${topic}
- Max 200 characters
- End with a question to drive comments
- Use 1-2 relevant emojis
- Reference World Cup 2026
  `);

  // For MVP: save to operator dashboard for manual posting
  await supabase.from('community_posts').insert({
    video_id: videoId,
    text: postText,
    status: 'pending_manual',
  });
}
```

---

## 8. End Screen Configuration

End screens are configured via YouTube Data API's `videoEndCards` (part of `videos.update`):

```typescript
async function addEndScreen(videoId: string, videoDuration: number): Promise<void> {
  const endScreenStartTime = Math.floor(videoDuration - 20); // Last 20 seconds

  // YouTube end screen elements are managed via YouTube Studio
  // The API supports setting watermarks; full end screen cards require YouTube Studio UI
  // For automation: use YouTube Partner API (requires YouTube partnership)
  // For MVP: standard end screen template set up once via Studio, applied automatically

  logger.info(`End screen window: ${endScreenStartTime}s to ${videoDuration}s`);
  // Note: Full end screen automation requires YouTube Partner API access
}
```

---

## 9. Error Handling

```typescript
const YOUTUBE_ERROR_CODES = {
  400: 'Bad request — check metadata format',
  401: 'Unauthorized — refresh token expired or invalid',
  403: {
    quotaExceeded: 'Daily quota exhausted — wait for reset',
    forbidden: 'Channel not authorized for this operation',
    uploadLimitExceeded: 'Daily upload limit reached',
  },
  429: 'Too many requests — implement exponential backoff',
  500: 'YouTube server error — retry after 60 seconds',
  503: 'YouTube service unavailable — retry after 5 minutes',
};

async function uploadWithRetry(
  uploadFn: () => Promise<string>,
  maxAttempts: number = 5
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await uploadFn();
    } catch (error) {
      if (error.code === 403 && error.reason === 'quotaExceeded') {
        // Don't retry — quota won't reset until midnight Pacific Time
        await sendTelegramAlert('❌ YouTube quota exhausted. Upload deferred to tomorrow.');
        throw error;
      }

      const delay = Math.pow(2, attempt) * 5_000; // Exponential backoff
      logger.warn(`Upload attempt ${attempt + 1} failed. Retrying in ${delay}ms`);
      await sleep(delay);
    }
  }
  throw new Error(`Upload failed after ${maxAttempts} attempts`);
}
```

---

## 10. Full Upload Sequence

```typescript
async function uploadVideo(video: VideoRecord): Promise<string> {
  logger.info(`Starting upload for video: ${video.id}`);

  // Step 1: Check quota before starting
  await quotaMonitor.check(1650);

  // Step 2: Initiate resumable upload
  const uploadUri = await initiateResumableUpload(video.seoPackage);

  // Step 3: Upload video file from S3
  const youtubeVideoId = await uploadVideoFromS3(uploadUri, video.s3VideoKey);
  await quotaMonitor.track('videos.insert', 1600);

  // Step 4: Set thumbnail (winner variant A as default)
  await setThumbnail(youtubeVideoId, video.thumbnailS3Key);
  await quotaMonitor.track('thumbnails.set', 50);

  // Step 5: Add to playlist
  await addToPlaylist(youtubeVideoId, WORLD_CUP_PLAYLIST_ID);
  await quotaMonitor.track('playlistItems.insert', 50);

  // Step 6: Schedule for optimal time
  const publishAt = selectPublishTime(await getExistingSchedule());
  await scheduleVideo(youtubeVideoId, publishAt);
  await quotaMonitor.track('videos.update', 50);

  // Step 7: Update Supabase
  await supabase.from('videos').update({
    youtube_id: youtubeVideoId,
    status: 'scheduled',
    publish_at: publishAt.toISOString(),
  }).eq('id', video.id);

  logger.info(`Video ${video.id} uploaded as YouTube ID ${youtubeVideoId}, scheduled for ${publishAt.toISOString()}`);
  return youtubeVideoId;
}
```
