# FacelessYT — API Requirements & Credentials Registry

**Date:** 2026-06-12
**Purpose:** Complete inventory of all external services, credentials, and API keys required to operate the FacelessYT autonomous content engine.

> **Security Notice:** This document lists variable NAMES only. Never commit actual secret values to version control. Store all secrets in `.env.local` (Next.js dashboard) and `.env` (engine service), both of which must be listed in `.gitignore`.

---

## 1. Master API Requirements Table

| SERVICE | PURPOSE | FOUND IN CODEBASE | REQUIRED FOR | MISSING / ACTION NEEDED |
|---|---|---|---|---|
| `ANTHROPIC_API_KEY` | Primary LLM for script generation, research, SEO, fact-checking | Referenced in `PT-App/app/api/generate/route.ts` — key itself NOT in any `.env` file | Script engine, research engine, SEO system, learning engine | **Create `PT-App/.env.local` and add key. Obtain from console.anthropic.com** |
| `YOUTUBE_API_KEY` | YouTube Data API v3: video search, trending topics, competitor analysis, upload, thumbnail set, playlist management | Not found anywhere | Content discovery, SEO, upload automation | **Obtain from Google Cloud Console → Credentials → API Key. Enable YouTube Data API v3.** |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID for YouTube channel authorization (upload permission) | Not found anywhere | YouTube upload, scheduling, channel management | **Google Cloud Console → OAuth 2.0 → Create Web Client. Add redirect URI for engine callback.** |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret for YouTube authorization code flow | Not found anywhere | YouTube upload, scheduling, channel management | **Paired with `GOOGLE_CLIENT_ID`. Never expose in frontend.** |
| `GOOGLE_REFRESH_TOKEN` | Long-lived refresh token after first OAuth consent | Not found anywhere | YouTube automation (headless, no user interaction after setup) | **Run one-time OAuth flow → exchange code → store refresh token securely in Supabase or env.** |
| `ELEVENLABS_API_KEY` | TTS voice generation: narration audio for all videos (Rachel/Josh voice) | Not found anywhere | Voice pipeline in video production engine | **Obtain from elevenlabs.io → Profile → API Keys** |
| `ELEVENLABS_VOICE_ID` | Specific voice model ID within ElevenLabs (e.g., Rachel = `21m00Tcm4TlvDq8ikWAM`) | Not found anywhere | Voice pipeline | **Select voice in ElevenLabs dashboard, copy Voice ID from URL or API** |
| `REPLICATE_API_TOKEN` | Image generation (SDXL), video generation (Stable Video Diffusion), upscaling | Not found anywhere | Visual asset generation, thumbnail generation | **Obtain from replicate.com → Account → API Tokens** |
| `OPENAI_API_KEY` | Whisper API for subtitle/SRT generation from MP3 voiceover files | Not found anywhere | Subtitle generation step in video pipeline | **Obtain from platform.openai.com → API Keys** |
| `GEMINI_API_KEY` | Optional secondary LLM: fallback for script generation if Anthropic quota exceeded, or for Google Search grounding | Not found anywhere | Optional — fallback LLM, trend research with Google Search grounding | **Obtain from aistudio.google.com → API Key. Not required for MVP.** |
| `SUPABASE_URL` | Supabase project endpoint: `https://<project-id>.supabase.co` | Not found anywhere | All persistent data: videos, metrics, jobs, thumbnails, learning data | **Create project at supabase.com → Settings → API** |
| `SUPABASE_KEY` | Supabase anon public key (row-level security enforced) or service role key (engine only) | Not found anywhere | Dashboard read access (anon key), engine write access (service role key) | **Two separate keys: `SUPABASE_ANON_KEY` for frontend, `SUPABASE_SERVICE_KEY` for engine** |
| `DATABASE_URL` | Direct Postgres connection string for Supabase (used by Prisma/migrations) | Not found anywhere | Database migrations, direct SQL queries from engine | **Supabase → Settings → Database → Connection string (Transaction pooler for serverless)** |
| `AWS_ACCESS_KEY_ID` | AWS IAM credential for S3 bucket access | Not found anywhere | Storing rendered video files, audio files, image assets before YouTube upload | **AWS Console → IAM → Create User with S3 policy → Access Keys** |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret for S3 | Not found anywhere | S3 video asset storage | **Paired with `AWS_ACCESS_KEY_ID`. Store in Secrets Manager or env only.** |
| `S3_BUCKET_NAME` | Name of the S3 bucket where video assets are stored | Not found anywhere | Video pipeline output, CDN delivery of thumbnails | **Create S3 bucket in `us-east-1` (lowest latency for YouTube upload servers). Enable versioning.** |
| `S3_REGION` | AWS region for S3 bucket (e.g., `us-east-1`) | Not found anywhere | S3 SDK configuration | **Match region to bucket creation region** |
| `REDIS_URL` | Redis connection string for BullMQ job queue | Not found anywhere | Async job processing: script generation, video assembly, upload, analytics collection | **Use Railway Redis, Upstash, or self-hosted. Format: `redis://:<password>@<host>:<port>`** |
| `BOT_TOKEN` | Telegram bot token for operation alerts | Found in root `.env`, used by `telegram.js` | Daily operation reports, error alerts, pipeline status notifications | **Already configured for scraper. Create a second bot or reuse for FacelessYT alerts.** |
| `CHAT_ID` | Telegram chat/channel ID for alert delivery | Found in root `.env`, used by `telegram.js` | Same as above | **Already configured. Verify chat ID works for FacelessYT channel or DM.** |
| `NEWSAPI_KEY` | News API (newsapi.org) for trending soccer/World Cup headlines | Not found anywhere | Content discovery: news signal for topic scoring | **Obtain from newsapi.org → Free tier: 100 requests/day. Paid for production.** |
| `REDDIT_CLIENT_ID` | Reddit API OAuth client ID for subreddit monitoring | Not found anywhere | Content discovery: Reddit signal from r/soccer, r/worldcup, r/football | **Create app at reddit.com/prefs/apps → script type** |
| `REDDIT_CLIENT_SECRET` | Reddit API OAuth secret | Not found anywhere | Content discovery | **Paired with `REDDIT_CLIENT_ID`** |
| `CANVA_API_KEY` | Canva Connect API for template-based thumbnail generation (optional alternative to SDXL) | Not found anywhere | Thumbnail generation (alternative pipeline) | **Optional. Obtain from canva.com/developers. Not required if using Replicate SDXL.** |

---

## 2. Credentials by Service Priority

### Tier 1 — MVP Blockers (nothing works without these)
```
ANTHROPIC_API_KEY
YOUTUBE_API_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REFRESH_TOKEN
ELEVENLABS_API_KEY
REPLICATE_API_TOKEN
SUPABASE_URL
SUPABASE_KEY (service role)
DATABASE_URL
REDIS_URL
```

### Tier 2 — Full Pipeline (required for complete autonomous operation)
```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
S3_BUCKET_NAME
S3_REGION
OPENAI_API_KEY
BOT_TOKEN
CHAT_ID
```

### Tier 3 — Enhanced Discovery & Monitoring
```
NEWSAPI_KEY
REDDIT_CLIENT_ID
REDDIT_CLIENT_SECRET
GEMINI_API_KEY (optional)
CANVA_API_KEY (optional)
ELEVENLABS_VOICE_ID
```

---

## 3. Environment File Templates

### `PT-App/.env.local` (Next.js Dashboard)
```bash
# AI Generation
ANTHROPIC_API_KEY=

# Database (anon key for frontend — RLS enforced)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Engine API (internal communication)
ENGINE_API_URL=http://localhost:3001
ENGINE_API_SECRET=
```

### `engine/.env` (Autonomous Backend)
```bash
# AI Services
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
REPLICATE_API_TOKEN=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# YouTube / Google
YOUTUBE_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=

# Database
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
DATABASE_URL=

# Storage
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=facelessyt-assets
S3_REGION=us-east-1

# Queue
REDIS_URL=redis://localhost:6379

# Notifications
BOT_TOKEN=
CHAT_ID=

# Discovery
NEWSAPI_KEY=
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=

# Engine Config
PORT=3001
WORKER_CONCURRENCY=2
NODE_ENV=production
LOG_LEVEL=info
MAX_VIDEOS_PER_DAY=3
```

---

## 4. API Quota Reference

| Service | Free Tier | Production Limit | Cost Notes |
|---|---|---|---|
| YouTube Data API v3 | 10,000 units/day | Quota increase request via Google | Upload costs 1,600 units. Search costs 100 units. |
| YouTube Analytics API v2 | Included with Data API quota | — | Queries cost ~1-10 units each |
| ElevenLabs | 10,000 chars/month (free) | $22/month for 100k chars | ~8-10 min video = ~8,000 chars narration |
| Replicate (SDXL) | Pay per prediction | ~$0.0023/image | 10 images/video = ~$0.02/video |
| Replicate (SVD) | Pay per prediction | ~$0.09/video clip | 5 clips/video = ~$0.45/video |
| OpenAI Whisper | Pay per minute | ~$0.006/minute | 10 min video = $0.06/video |
| Anthropic claude-sonnet-4-6 | Pay per token | ~$3/M input, $15/M output | ~$0.30-0.50/full script |
| Supabase | 500MB DB + 1GB storage (free) | $25/month Pro | Sufficient for <50k rows |
| AWS S3 | 5GB + 20k GET + 2k PUT (12 months) | ~$0.023/GB/month | 3 videos/day × 500MB = ~45GB/month = ~$1/month |
| Redis (Upstash) | 10k commands/day (free) | $0.20/100k commands | Minimal cost for job queue |
| News API | 100 requests/day (free) | $449/month Business | Developer plan: $199/month for 500k requests |
| Reddit API | 60 requests/minute (free tier) | OAuth2 App: standard rate | Free for read-only use case |

---

## 5. OAuth 2.0 Setup — YouTube (Step-by-Step)

YouTube upload requires a user OAuth consent, not just an API key. This is a one-time setup:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project: `FacelessYT`
3. Enable APIs: `YouTube Data API v3` and `YouTube Analytics API v2`
4. Go to **Credentials → OAuth 2.0 Client IDs → Create**
5. Application type: **Web application**
6. Authorized redirect URI: `http://localhost:3001/auth/callback` (for initial setup)
7. Copy `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `engine/.env`
8. Run the one-time auth flow:
   ```bash
   node engine/scripts/youtube-auth.js
   # Opens browser → Authorize → Copies refresh token to console
   ```
9. Copy the printed `refresh_token` into `engine/.env` as `GOOGLE_REFRESH_TOKEN`
10. The engine uses this refresh token to generate short-lived access tokens automatically

---

## 6. Security Best Practices

- All `.env` and `.env.local` files must be in `.gitignore`
- Use separate Supabase keys: anon key for frontend (RLS protects data), service key for engine only
- Rotate API keys every 90 days
- Store production secrets in Railway/Render environment variables UI — never in committed files
- Add `NEXT_PUBLIC_` prefix ONLY to variables that must be accessible client-side (Supabase URL and anon key are intentionally public — security is via Row Level Security policies)
- Audit IAM: the AWS user for S3 should have `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` on the specific bucket only — not wildcard access
- Implement a secret rotation reminder in the monthly operations review
