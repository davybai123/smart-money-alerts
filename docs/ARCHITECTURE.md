# FacelessYT — Production System Architecture

**Date:** 2026-06-12
**Version:** 1.0
**Scope:** Full production architecture for the autonomous YouTube content business targeting World Cup 2026

---

## 1. High-Level System Overview

FacelessYT consists of two primary services — a human-facing Next.js dashboard and an autonomous Node.js engine — communicating via a shared Supabase database and Redis job queue.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FACELESSYT PRODUCTION SYSTEM                       │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────┐         ┌──────────────────────────────────────────┐
  │   HUMAN OPERATOR     │         │           EXTERNAL SIGNAL SOURCES         │
  │                      │         │                                            │
  │  Browser / Mobile    │         │  YouTube Trending  Reddit  NewsAPI         │
  │  Dashboard UI        │         │  Google Trends     Twitter Competitor RSS  │
  └──────────┬───────────┘         └──────────────────┬───────────────────────┘
             │ HTTPS                                   │ HTTP polling (cron)
             ▼                                         ▼
  ┌──────────────────────┐         ┌──────────────────────────────────────────┐
  │   NEXT.JS DASHBOARD  │         │          ENGINE SERVICE (Node.js)         │
  │   (PT-App/)          │         │          (engine/)                        │
  │                      │         │                                            │
  │  /faceless           │◄───────►│  Trend Discovery Module                   │
  │  /content            │  REST   │  Content Opportunity Scorer               │
  │  /pipeline           │  API    │  Script Generation (Claude)               │
  │  /scheduler          │         │  Voice Pipeline (ElevenLabs)              │
  │  /analytics (new)    │         │  Visual Pipeline (Replicate)              │
  │                      │         │  Video Assembly (FFmpeg)                  │
  │  Port: 3000          │         │  Thumbnail Generator                      │
  └──────────┬───────────┘         │  SEO Optimizer                            │
             │                     │  YouTube Uploader                         │
             │                     │  Analytics Collector                      │
             │                     │  Learning Engine                          │
             │                     │                                            │
             │                     │  Port: 3001                               │
             │                     └──────────────┬───────────────────────────┘
             │                                    │
             │         ┌──────────────────────────┼──────────────────────┐
             │         │                          │                      │
             ▼         ▼                          ▼                      ▼
  ┌──────────────────────┐    ┌──────────────┐   ┌────────────────┐   ┌──────────────────┐
  │    SUPABASE          │    │   REDIS      │   │   AWS S3       │   │  TELEGRAM        │
  │    (Postgres + RLS)  │    │   (BullMQ)   │   │   (Assets)     │   │  (Alerts)        │
  │                      │    │              │   │                │   │                  │
  │  videos              │    │  scriptQueue │   │  /videos/*.mp4 │   │  Daily reports   │
  │  daily_metrics       │    │  voiceQueue  │   │  /audio/*.mp3  │   │  Error alerts    │
  │  thumbnail_variants  │    │  visualQueue │   │  /images/*.png │   │  Pipeline status │
  │  opportunities       │    │  assemblyQ   │   │  /thumbs/*.jpg │   │                  │
  │  learning_data       │    │  uploadQueue │   │                │   │                  │
  │  job_logs            │    │  analyticsQ  │   │  CDN-backed    │   │                  │
  │  channel_config      │    │              │   │  pre-signed    │   │                  │
  │                      │    │  Dead letter │   │  URLs          │   │                  │
  └──────────────────────┘    └──────────────┘   └────────────────┘   └──────────────────┘
             │
             ▼
  ┌──────────────────────────────────────────────────────────────────────────────────┐
  │                           EXTERNAL AI & PLATFORM APIs                             │
  │                                                                                    │
  │   ┌───────────────┐  ┌─────────────────┐  ┌───────────────┐  ┌────────────────┐  │
  │   │  ANTHROPIC    │  │   ELEVENLABS    │  │  REPLICATE    │  │  OPENAI        │  │
  │   │  (Claude      │  │   (TTS Voice    │  │  (SDXL Image  │  │  (Whisper      │  │
  │   │  claude-sonnet│  │   Generation)   │  │  SVD Video)   │  │  Subtitles)    │  │
  │   │  -4-6)        │  │                 │  │               │  │                │  │
  │   └───────────────┘  └─────────────────┘  └───────────────┘  └────────────────┘  │
  │                                                                                    │
  │   ┌───────────────────────────────────┐    ┌──────────────────────────────────┐   │
  │   │  YOUTUBE DATA API v3              │    │  YOUTUBE ANALYTICS API v2        │   │
  │   │  (upload, search, playlists,      │    │  (views, CTR, watchTime,         │   │
  │   │   thumbnails, end screens,        │    │   revenue, impressions,          │   │
  │   │   community posts, scheduling)    │    │   subscribersGained)             │   │
  │   └───────────────────────────────────┘    └──────────────────────────────────┘   │
  └──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Full Autonomous Workflow

```
                        DAILY AUTONOMOUS PIPELINE
                        ═══════════════════════════

  06:00 UTC ──► TREND DISCOVERY
                │
                │  YouTube Data API: search trending "world cup 2026"
                │  Reddit API: hot posts from r/soccer, r/worldcup
                │  NewsAPI: top soccer headlines last 24h
                │  Competitor channel scan: upload velocity check
                │
                ▼
  06:30 UTC ──► TOPIC VALIDATION & OPPORTUNITY SCORING
                │
                │  For each candidate topic:
                │    demand_score = search_volume × trend_velocity × reddit_upvotes
                │    competition_score = avg_views_top10 / total_results
                │    ctr_prediction = score(emotional_words, numbers, controversy)
                │    rpm_estimate = lookup_by_niche(soccer_analysis=$5, world_cup=$8)
                │    opportunity_score = demand × (1/competition) × ctr × rpm
                │
                │  → Select top 3 topics → Save to Supabase opportunities table
                │
                ▼
  07:00 UTC ──► RESEARCH PHASE
                │
                │  For each topic: Claude deep research prompt
                │    - Key facts, statistics, controversy angles
                │    - Historical context, player/team data
                │    - Emotional hooks, narrative threads
                │    - Sources for credibility
                │  → Store research JSON in Supabase
                │
                ▼
  08:00 UTC ──► SCRIPT GENERATION
                │
                │  Claude claude-sonnet-4-6 → 8-part script structure
                │    HOOK → OPEN LOOP → PROBLEM → STORY →
                │    VALUE → TWIST → PAYOFF → CTA
                │  → Store script JSON with scene markers, B-roll cues
                │  → Quality check: word count, readability, no fillers
                │
                ▼
  09:00 UTC ──► FACT CHECK
                │
                │  Second Claude call: verify all stats/claims in script
                │  → Flag uncertain claims for human review
                │  → Auto-remove or soften unverifiable statements
                │
                ▼
  09:30 UTC ──► ASSET GENERATION (Parallel)
                │
                │  ┌─────────────────────┐   ┌─────────────────────┐
                │  │  VOICE (ElevenLabs) │   │  VISUALS (Replicate) │
                │  │                     │   │                      │
                │  │  TTS narration MP3  │   │  SDXL: 8-12 images   │
                │  │  Rachel/Josh voice  │   │  SVD: 3-5 video clips│
                │  │  → S3 /audio/      │   │  → S3 /images/       │
                │  └─────────────────────┘   └─────────────────────┘
                │
                ▼
  11:00 UTC ──► VIDEO ASSEMBLY (FFmpeg)
                │
                │  1. Concat video clips (matched to scene timing)
                │  2. Mix narration audio (primary) + background music
                │  3. Whisper → SRT subtitle file
                │  4. Burn subtitles (white text, black outline)
                │  5. Apply LUT color grade
                │  6. Render 1920×1080 H.264 MP4 @ 24fps
                │  → Upload to S3 /videos/
                │
                ▼
  12:00 UTC ──► THUMBNAIL GENERATION
                │
                │  Replicate SDXL → 3 variants per video
                │  Text overlay via sharp/canvas
                │  CTR scoring → rank variants
                │  → Upload to S3 /thumbs/
                │
                ▼
  12:30 UTC ──► SEO OPTIMIZATION
                │
                │  Claude: 5 title variants → CTR score → select best
                │  Auto-generate description (template + keywords)
                │  Tag generation: 10 exact + 10 broad + 5 channel
                │  Chapter timestamps from script segments
                │
                ▼
  13:00 UTC ──► YOUTUBE UPLOAD
                │
                │  OAuth 2.0 refresh token → access token
                │  videos.insert (resumable upload from S3)
                │  thumbnails.set
                │  Assign to "World Cup 2026" playlist
                │  Status: private (pending schedule)
                │
                ▼
  13:30 UTC ──► SCHEDULING
                │
                │  Set publishAt: next optimal slot
                │  (Tue/Wed/Thu 2-4pm EST, rotating)
                │  Update Supabase: status = "scheduled"
                │
                ▼
  14:00 UTC ──► ANALYTICS COLLECTION (previous videos)
                │
                │  YouTube Analytics API: pull metrics for all live videos
                │  Hourly for videos < 48h old
                │  Daily for videos > 48h old
                │  Store in Supabase daily_metrics
                │
                ▼
  14:30 UTC ──► LEARNING ENGINE UPDATE
                │
                │  Pull 7-day final metrics for videos > 7 days old
                │  Cluster top/bottom performers
                │  Update scoring weights in Supabase channel_config
                │  A/B test conclusions: declare thumbnail winners
                │
                ▼
  15:00 UTC ──► DAILY TELEGRAM REPORT
                │
                │  Summary: videos produced, uploaded, scheduled
                │  Performance: top video yesterday, revenue estimate
                │  Alerts: any pipeline failures, quota warnings
                │  Next 24h: queued topics
                │
                ▼
                DONE — CYCLE REPEATS AT 06:00 UTC
```

---

## 3. Component Architecture

### 3.1 Next.js Dashboard (`PT-App/`)

```
PT-App/
├── app/
│   ├── api/
│   │   ├── generate/route.ts       # Claude proxy
│   │   ├── videos/route.ts         # (new) Video CRUD from Supabase
│   │   ├── analytics/route.ts      # (new) Analytics data proxy
│   │   ├── pipeline/route.ts       # (new) Engine pipeline control
│   │   └── health/route.ts         # (new) Health check endpoint
│   ├── analytics/                  # (new) Analytics dashboard page
│   └── [existing pages...]
└── lib/
    ├── store.ts                    # Migrate to Supabase client calls
    └── supabase.ts                 # (new) Supabase client singleton
```

### 3.2 Engine Service (`engine/`)

```
engine/
├── index.ts                        # Express server + BullMQ worker bootstrap
├── cron/
│   └── scheduler.ts                # node-cron: triggers daily pipeline at 06:00 UTC
├── modules/
│   ├── discovery/
│   │   ├── youtube-trends.ts       # YouTube Data API trending search
│   │   ├── reddit-signals.ts       # Reddit API hot post monitor
│   │   ├── news-signals.ts         # NewsAPI headline monitor
│   │   └── opportunity-scorer.ts   # Composite scoring algorithm
│   ├── research/
│   │   └── researcher.ts           # Claude deep research per topic
│   ├── script/
│   │   ├── generator.ts            # 8-part script generation (Claude)
│   │   ├── fact-checker.ts         # Fact verification pass (Claude)
│   │   └── quality-checker.ts      # Word count, readability checks
│   ├── voice/
│   │   └── elevenlabs.ts           # TTS generation + S3 upload
│   ├── visuals/
│   │   ├── replicate.ts            # SDXL image + SVD video generation
│   │   └── prompt-builder.ts       # Scene → visual prompt converter
│   ├── assembly/
│   │   ├── ffmpeg-assembler.ts     # Full FFmpeg pipeline
│   │   ├── subtitle-generator.ts   # Whisper → SRT
│   │   └── music-mixer.ts          # Background music layer
│   ├── thumbnail/
│   │   ├── generator.ts            # Replicate SDXL thumbnails
│   │   └── text-overlay.ts         # sharp/canvas text overlay
│   ├── seo/
│   │   ├── title-generator.ts      # Claude title variants + scoring
│   │   ├── description-builder.ts  # Template-based description
│   │   └── tag-generator.ts        # Tag + hashtag automation
│   ├── youtube/
│   │   ├── auth.ts                 # OAuth 2.0 refresh token flow
│   │   ├── uploader.ts             # Resumable video upload
│   │   ├── scheduler.ts            # publishAt + optimal timing
│   │   └── analytics.ts            # YouTube Analytics API collector
│   ├── analytics/
│   │   └── collector.ts            # Scheduled metrics collection
│   └── learning/
│       ├── pattern-extractor.ts    # Cluster analysis of video performance
│       └── weight-updater.ts       # Update scoring model weights
├── queues/
│   ├── index.ts                    # BullMQ queue definitions
│   └── workers/
│       ├── script.worker.ts
│       ├── voice.worker.ts
│       ├── visual.worker.ts
│       ├── assembly.worker.ts
│       ├── upload.worker.ts
│       └── analytics.worker.ts
├── db/
│   ├── supabase.ts                 # Supabase service client
│   └── schema.sql                  # Database schema definitions
├── storage/
│   └── s3.ts                       # AWS S3 upload/download helpers
├── notifications/
│   └── telegram.ts                 # Alert system (reuse telegram.js pattern)
├── scripts/
│   └── youtube-auth.js             # One-time OAuth setup script
└── utils/
    ├── retry.ts                    # Exponential backoff retry wrapper
    ├── logger.ts                   # Winston JSON logger
    └── config.ts                   # Env var validation + config object
```

---

## 4. Database Architecture (Supabase)

```sql
-- Core video tracking
videos (
  id UUID PRIMARY KEY,
  topic TEXT,
  title TEXT,
  description TEXT,
  tags TEXT[],
  youtube_id TEXT,
  s3_video_key TEXT,
  s3_audio_key TEXT,
  status TEXT,                -- draft|assembling|uploaded|scheduled|live|failed
  script_json JSONB,
  seo_data JSONB,
  opportunity_score FLOAT,
  publish_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)

-- Daily performance metrics per video
daily_metrics (
  id UUID PRIMARY KEY,
  video_id UUID REFERENCES videos(id),
  date DATE,
  views INT,
  watch_time_minutes FLOAT,
  avg_view_duration_seconds FLOAT,
  impressions INT,
  ctr FLOAT,
  subscribers_gained INT,
  estimated_revenue_usd FLOAT,
  collected_at TIMESTAMPTZ
)

-- Thumbnail A/B test variants
thumbnail_variants (
  id UUID PRIMARY KEY,
  video_id UUID REFERENCES videos(id),
  s3_key TEXT,
  style TEXT,               -- shock_face|comparison|number_reveal|fire|countdown
  impressions INT,
  ctr FLOAT,
  is_winner BOOLEAN,
  created_at TIMESTAMPTZ
)

-- Content opportunity queue
opportunities (
  id UUID PRIMARY KEY,
  topic TEXT,
  source TEXT,              -- youtube_trending|reddit|news|competitor
  demand_score FLOAT,
  competition_score FLOAT,
  ctr_prediction FLOAT,
  rpm_estimate FLOAT,
  opportunity_score FLOAT,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ
)

-- Engine job execution log
job_logs (
  id UUID PRIMARY KEY,
  video_id UUID REFERENCES videos(id),
  job_type TEXT,
  status TEXT,              -- pending|running|completed|failed
  attempts INT DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
)

-- Adaptive scoring configuration
channel_config (
  id UUID PRIMARY KEY,
  config_key TEXT UNIQUE,
  config_value JSONB,
  updated_at TIMESTAMPTZ
)
```

---

## 5. Queue Architecture (BullMQ + Redis)

```
Redis Queues:
├── facelessyt:script      → ScriptWorker    (concurrency: 3)
├── facelessyt:voice       → VoiceWorker     (concurrency: 3)
├── facelessyt:visual      → VisualWorker    (concurrency: 5, GPU-bound)
├── facelessyt:assembly    → AssemblyWorker  (concurrency: 1, CPU-bound)
├── facelessyt:upload      → UploadWorker    (concurrency: 2)
├── facelessyt:analytics   → AnalyticsWorker (concurrency: 2)
└── facelessyt:dead-letter → Dead letter queue (manual review)

Job Flow per Video:
  script job → [onComplete] → voice job + visual job (parallel)
  voice job + visual job → [both complete] → assembly job
  assembly job → [onComplete] → thumbnail job + upload job (parallel)
  upload job → [onComplete] → analytics job (hourly repeat)
```

---

## 6. Deployment Topology

```
PRODUCTION ENVIRONMENT

  ┌────────────────────────────────┐
  │  Railway / Render              │
  │                                │
  │  ┌──────────────┐              │
  │  │  dashboard   │ Port 3000    │
  │  │  (Next.js)   │◄─── HTTPS   │◄── User browser
  │  └──────────────┘              │
  │                                │
  │  ┌──────────────┐              │
  │  │  engine      │ Port 3001    │
  │  │  (Node.js)   │◄─── Internal│◄── Dashboard API calls
  │  └──────────────┘              │
  │                                │
  │  ┌──────────────┐              │
  │  │  redis       │ Port 6379    │
  │  │  (BullMQ)    │              │
  │  └──────────────┘              │
  └────────────────────────────────┘
          │              │
          ▼              ▼
   Supabase (cloud)   AWS S3 (cloud)
```

---

## 7. Error Handling Strategy

Every module in the engine follows a consistent error handling contract:

```typescript
// Retry policy per job type
const retryPolicies = {
  script:    { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
  voice:     { attempts: 3, backoff: { type: 'exponential', delay: 10000 } },
  visual:    { attempts: 3, backoff: { type: 'fixed', delay: 30000 } },
  assembly:  { attempts: 2, backoff: { type: 'fixed', delay: 60000 } },
  upload:    { attempts: 5, backoff: { type: 'exponential', delay: 15000 } },
  analytics: { attempts: 3, backoff: { type: 'fixed', delay: 60000 } },
};

// On final failure: move to dead letter queue + Telegram alert
// On quota exceeded: pause queue + alert + resume after reset window
// On partial failure: store completed artifacts, resume from checkpoint
```
