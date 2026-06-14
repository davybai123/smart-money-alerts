# FacelessYT — Production Deployment Guide

**Date:** 2026-06-12
**Target Platform:** Railway (primary) / Render (alternative) / VPS
**Services:** dashboard (Next.js), engine (Node.js), redis

---

## 1. Overview

FacelessYT runs as two containerized services plus a managed Redis instance. The dashboard is a stateless Next.js application. The engine is a long-running Node.js process with cron jobs and BullMQ workers. Both services share a Supabase database (managed externally) and an S3 bucket (AWS, managed externally).

This guide covers local development setup, Docker containerization, CI/CD via GitHub Actions, and production deployment to Railway with monitoring and backup.

---

## 2. Repository Structure

```
smart-money-alerts/
├── PT-App/                     # Next.js dashboard (service: dashboard)
├── engine/                     # Autonomous backend (service: engine)
├── docker-compose.yml          # Full stack local development
├── docker-compose.prod.yml     # Production overrides
├── .github/
│   └── workflows/
│       ├── deploy.yml          # Main CI/CD pipeline
│       └── test.yml            # PR test runner
└── docs/                       # This directory
```

---

## 3. Docker Setup

### 3.1 Dashboard Dockerfile (`PT-App/Dockerfile`)

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --frozen-lockfile

COPY . .
RUN npm run build

# Stage 2: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
```

### 3.2 Engine Dockerfile (`engine/Dockerfile`)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

# Install FFmpeg
RUN apk add --no-cache ffmpeg

COPY package*.json ./
RUN npm ci --frozen-lockfile

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

# FFmpeg must be in runtime image
RUN apk add --no-cache ffmpeg

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Music library
COPY music/ ./music/

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

### 3.3 docker-compose.yml (Local Development)

```yaml
version: '3.9'

services:
  dashboard:
    build:
      context: ./PT-App
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - ENGINE_API_URL=http://engine:3001
      - ENGINE_API_SECRET=${ENGINE_API_SECRET}
    depends_on:
      - redis
    volumes:
      - ./PT-App:/app
      - /app/node_modules
      - /app/.next

  engine:
    build:
      context: ./engine
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - REPLICATE_API_TOKEN=${REPLICATE_API_TOKEN}
      - ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY}
      - ELEVENLABS_VOICE_ID=${ELEVENLABS_VOICE_ID}
      - YOUTUBE_API_KEY=${YOUTUBE_API_KEY}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - GOOGLE_REFRESH_TOKEN=${GOOGLE_REFRESH_TOKEN}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - DATABASE_URL=${DATABASE_URL}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - S3_BUCKET_NAME=${S3_BUCKET_NAME}
      - S3_REGION=${S3_REGION}
      - REDIS_URL=redis://redis:6379
      - BOT_TOKEN=${BOT_TOKEN}
      - CHAT_ID=${CHAT_ID}
      - NEWSAPI_KEY=${NEWSAPI_KEY}
      - REDDIT_CLIENT_ID=${REDDIT_CLIENT_ID}
      - REDDIT_CLIENT_SECRET=${REDDIT_CLIENT_SECRET}
      - PORT=3001
      - WORKER_CONCURRENCY=${WORKER_CONCURRENCY:-2}
      - MAX_VIDEOS_PER_DAY=${MAX_VIDEOS_PER_DAY:-3}
    depends_on:
      - redis
    volumes:
      - ./engine:/app
      - /app/node_modules
      - /app/dist

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

volumes:
  redis_data:
```

---

## 4. Environment Variables — Complete Reference

### Dashboard (`PT-App/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for content generation |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (safe to expose) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (safe to expose, RLS enforces security) |
| `ENGINE_API_URL` | Yes | URL of engine service (`http://engine:3001` in Docker, `https://engine.yourdomain.com` in prod) |
| `ENGINE_API_SECRET` | Yes | Shared secret for dashboard → engine API calls |
| `NEXTAUTH_URL` | Optional | If using NextAuth for dashboard auth |
| `NEXTAUTH_SECRET` | Optional | NextAuth secret key |

### Engine (`engine/.env`)

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API for scripts, research, SEO |
| `OPENAI_API_KEY` | Yes | Whisper for subtitles |
| `REPLICATE_API_TOKEN` | Yes | SDXL + SVD for visuals and thumbnails |
| `ELEVENLABS_API_KEY` | Yes | TTS voice generation |
| `ELEVENLABS_VOICE_ID` | Yes | Target voice model ID |
| `YOUTUBE_API_KEY` | Yes | YouTube Data API v3 |
| `GOOGLE_CLIENT_ID` | Yes | OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth 2.0 client secret |
| `GOOGLE_REFRESH_TOKEN` | Yes | Long-lived OAuth refresh token |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Service role key (full DB access) |
| `DATABASE_URL` | Yes | Direct Postgres connection string |
| `AWS_ACCESS_KEY_ID` | Yes | S3 IAM access key |
| `AWS_SECRET_ACCESS_KEY` | Yes | S3 IAM secret |
| `S3_BUCKET_NAME` | Yes | S3 bucket for video assets |
| `S3_REGION` | Yes | AWS region (e.g., `us-east-1`) |
| `REDIS_URL` | Yes | Redis connection string |
| `BOT_TOKEN` | Yes | Telegram bot token |
| `CHAT_ID` | Yes | Telegram owner chat ID |
| `NEWSAPI_KEY` | Yes | newsapi.org key |
| `REDDIT_CLIENT_ID` | Yes | Reddit OAuth app client ID |
| `REDDIT_CLIENT_SECRET` | Yes | Reddit OAuth app secret |
| `GEMINI_API_KEY` | No | Optional fallback LLM |
| `PEXELS_API_KEY` | No | Stock footage fallback |
| `PORT` | Yes | Engine HTTP port (default: 3001) |
| `NODE_ENV` | Yes | `production` or `development` |
| `LOG_LEVEL` | Yes | `info` or `debug` |
| `WORKER_CONCURRENCY` | Yes | BullMQ worker concurrency (default: 2) |
| `MAX_VIDEOS_PER_DAY` | Yes | Maximum videos to produce daily (default: 3) |
| `ENGINE_API_SECRET` | Yes | Shared auth secret with dashboard |

---

## 5. GitHub Actions CI/CD

### `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: PT-App/package-lock.json

      - name: Install dashboard dependencies
        run: cd PT-App && npm ci

      - name: Type check dashboard
        run: cd PT-App && npx tsc --noEmit

      - name: Lint dashboard
        run: cd PT-App && npm run lint

      - name: Install engine dependencies
        run: cd engine && npm ci

      - name: Type check engine
        run: cd engine && npx tsc --noEmit

      - name: Run engine unit tests
        run: cd engine && npm test

  deploy-dashboard:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy dashboard to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: dashboard

  deploy-engine:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy engine to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: engine

  health-check:
    needs: [deploy-dashboard, deploy-engine]
    runs-on: ubuntu-latest
    steps:
      - name: Wait for services to start
        run: sleep 30

      - name: Check dashboard health
        run: |
          curl --fail --silent --max-time 30 \
            https://facelessyt.railway.app/api/health || exit 1

      - name: Check engine health
        run: |
          curl --fail --silent --max-time 30 \
            https://engine.facelessyt.railway.app/health || exit 1

      - name: Notify deployment success
        if: success()
        run: |
          curl -X POST "https://api.telegram.org/bot${{ secrets.BOT_TOKEN }}/sendMessage" \
            -d "chat_id=${{ secrets.CHAT_ID }}" \
            -d "text=✅ Deployment successful: ${GITHUB_SHA:0:7}"
```

---

## 6. Health Check Endpoints

### Dashboard (`PT-App/app/api/health/route.ts`)

```typescript
export async function GET() {
  const checks = {
    status: 'ok',
    service: 'dashboard',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? 'unknown',
    supabase: 'checking',
  };

  try {
    await supabase.from('videos').select('id').limit(1);
    checks.supabase = 'ok';
  } catch {
    checks.supabase = 'error';
  }

  const healthy = checks.supabase === 'ok';
  return NextResponse.json(checks, { status: healthy ? 200 : 503 });
}
```

### Engine (`engine/routes/health.ts`)

```typescript
app.get('/health', async (req, res) => {
  const checks = {
    status: 'ok',
    service: 'engine',
    timestamp: new Date().toISOString(),
    redis: 'checking',
    supabase: 'checking',
    queues: {} as Record<string, number>,
    enginePaused: false,
  };

  try {
    await redis.ping();
    checks.redis = 'ok';
  } catch { checks.redis = 'error'; }

  try {
    await supabase.from('videos').select('id').limit(1);
    checks.supabase = 'ok';
  } catch { checks.supabase = 'error'; }

  for (const [name, queue] of Object.entries(queues)) {
    checks.queues[name] = await queue.count();
  }

  checks.enginePaused = (await getChannelConfig('engine_paused'))?.paused ?? false;

  const healthy = checks.redis === 'ok' && checks.supabase === 'ok';
  res.status(healthy ? 200 : 503).json(checks);
});
```

---

## 7. Logging

Winston JSON logging to stdout, aggregated by Railway/Render log collection:

```typescript
// engine/utils/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
  ],
  defaultMeta: {
    service: 'facelessyt-engine',
    version: process.env.npm_package_version,
  },
});

// Log format (each line is a valid JSON object):
// {"level":"info","message":"Video assembled","videoId":"abc123","duration":347,"timestamp":"2026-06-12T11:04:23.000Z","service":"facelessyt-engine"}
```

All structured logs include:
- `level`: info / warn / error
- `message`: human-readable description
- `videoId`: if applicable
- `phase`: pipeline phase name
- `duration`: execution time in ms
- `timestamp`: ISO 8601
- `service`: always `facelessyt-engine` or `facelessyt-dashboard`

---

## 8. Monitoring

### 8.1 Uptime Monitoring

Simple HTTP ping every 5 minutes via UptimeRobot (free tier):

```
Monitor 1: https://facelessyt.railway.app/api/health
Monitor 2: https://engine.facelessyt.railway.app/health
Alert: Telegram message on downtime > 2 minutes
```

### 8.2 Queue Depth Monitoring

A cron job checks BullMQ queue depths every 15 minutes and alerts if jobs are backing up:

```typescript
cron.schedule('*/15 * * * *', async () => {
  for (const [name, queue] of Object.entries(queues)) {
    const waiting = await queue.getWaitingCount();
    const failed = await queue.getFailedCount();

    if (waiting > 20) {
      await sendTelegramAlert(`⚠️ Queue "${name}" has ${waiting} waiting jobs — possible slowdown`);
    }
    if (failed > 5) {
      await sendTelegramAlert(`🔴 Queue "${name}" has ${failed} failed jobs — check dead letter queue`);
    }
  }
});
```

---

## 9. Database Backup

Supabase Pro includes daily automated backups with 7-day retention. For additional safety:

```bash
# Daily backup script (run as cron on the engine service)
# Triggers at 03:00 UTC (before pipeline starts)
cron.schedule('0 3 * * *', async () => {
  // Supabase provides pg_dump access via connection string
  exec(
    `pg_dump "${process.env.DATABASE_URL}" --format=custom --no-acl --no-owner | ` +
    `gzip | aws s3 cp - s3://${process.env.S3_BUCKET_NAME}/backups/db-$(date +%Y%m%d).dump.gz`,
    (error) => {
      if (error) logger.error('Backup failed:', error);
      else logger.info('Daily database backup completed');
    }
  );
});
```

Retention policy: 30 daily backups, then purge.

---

## 10. Cost Estimate

### Monthly Infrastructure Costs

| Service | Plan | Monthly Cost |
|---|---|---|
| Railway (dashboard + engine) | Hobby: $5/month per service | $10 |
| Railway (Redis) | Managed Redis: $10/month | $10 |
| Supabase | Pro: $25/month (includes backups) | $25 |
| AWS S3 (~45GB assets) | $0.023/GB + requests | ~$5 |
| UptimeRobot | Free tier | $0 |
| **Infrastructure subtotal** | | **~$50/month** |

### Monthly API Costs Per Video

| API | Usage per video | Cost per video |
|---|---|---|
| ElevenLabs (TTS) | ~8,000 characters | ~$0.88 |
| Replicate SDXL (images) | 10 images | ~$0.02 |
| Replicate SVD (video clips) | 4 clips | ~$0.36 |
| OpenAI Whisper (subtitles) | 10 minutes | ~$0.06 |
| Anthropic Claude (script + research + SEO) | ~40,000 tokens | ~$0.45 |
| **API cost per video** | | **~$1.77** |

**At 3 videos/day × 30 days = 90 videos/month:**
- API costs: 90 × $1.77 = **~$159/month**
- Infrastructure: **~$50/month**
- **Total: ~$209/month**

### Revenue Projection to Break Even

At $5 RPM average, break-even occurs at:
- 209 / 0.005 = 41,800 views/month
- With 90 videos averaging 500+ views in first 30 days: 45,000 views/month
- Break-even is achievable by month 2-3 with consistent publishing

### Scaling Costs

| Videos/Month | API Costs | Infrastructure | Total |
|---|---|---|---|
| 90 (3/day) | $159 | $50 | **$209** |
| 180 (6/day) | $318 | $75 | **$393** |
| 300 (10/day) | $531 | $100 | **$631** |

Scaling the engine is linear in API cost but sublinear in infrastructure — adding `WORKER_CONCURRENCY=4` on the same server doubles throughput at no extra infrastructure cost.

---

## 11. Railway Deployment Steps

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Link project
railway link

# 4. Create services
railway add --service dashboard
railway add --service engine
railway add --plugin redis

# 5. Set environment variables (via Railway UI or CLI)
railway variables set ANTHROPIC_API_KEY=<value> --service dashboard
railway variables set ANTHROPIC_API_KEY=<value> --service engine
# ... repeat for all variables

# 6. Deploy
git push origin main
# GitHub Actions handles the rest

# 7. Run database migrations
railway run --service engine npm run db:migrate

# 8. Run one-time YouTube OAuth setup
railway run --service engine node scripts/youtube-auth.js
# Copy the refresh token into GOOGLE_REFRESH_TOKEN env variable
```
