# FacelessYT — Complete Project Audit

**Date:** 2026-06-12
**Auditor:** Engineering Audit (Claude claude-sonnet-4-6)
**Scope:** Full codebase at `/home/user/smart-money-alerts`

---

## 1. Folder Structure

```
smart-money-alerts/
├── scraper.js                    # Congressional trade monitor (UNRELATED to FacelessYT)
├── telegram.js                   # Telegram alert helper (shared, reusable for FacelessYT alerts)
├── trades.json                   # Scraped trades data (UNRELATED)
├── package.json                  # Root package: axios, cheerio, node-cron, dotenv
├── node_modules/
├── docs/                         # Strategy documents (new)
└── PT-App/                       # Next.js 16 / React 19 application
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx              # Dashboard home
    │   ├── api/
    │   │   └── generate/
    │   │       └── route.ts      # Anthropic API proxy endpoint
    │   ├── content/page.tsx
    │   ├── faceless/
    │   │   ├── page.tsx
    │   │   └── FacelessDashboard.tsx
    │   ├── pipeline/page.tsx
    │   ├── scheduler/page.tsx
    │   ├── sessions/page.tsx
    │   ├── supplements/page.tsx
    │   ├── nutrition/page.tsx
    │   ├── recipes/page.tsx
    │   ├── journal/page.tsx
    │   └── skittles/page.tsx
    ├── components/
    │   ├── Sidebar.tsx
    │   ├── Dashboard.tsx
    │   ├── ContentGeneratorClient.tsx
    │   ├── PipelineClient.tsx
    │   ├── SchedulerClient.tsx
    │   ├── SessionsClient.tsx
    │   ├── SupplementsClient.tsx
    │   ├── NutritionClient.tsx
    │   ├── RecipesClient.tsx
    │   ├── JournalClient.tsx
    │   └── SkittlesClient.tsx
    ├── lib/
    │   └── store.ts              # localStorage helpers + all TypeScript types
    ├── next.config.ts
    ├── tsconfig.json
    ├── tailwindcss (v4)
    └── package.json
```

---

## 2. Technologies Detected

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Frontend framework | Next.js | 16.2.6 | App Router |
| UI library | React | 19.2.4 | Stable |
| Styling | Tailwind CSS | v4 | PostCSS plugin |
| Charts | Recharts | ^3.8.1 | Used in analytics UI |
| Icons | Lucide React | ^1.16.0 | |
| Date utilities | date-fns | ^4.1.0 | |
| ID generation | uuid | ^14.0.0 | |
| Language | TypeScript | ^5 | |
| AI API | Anthropic Messages API | 2023-06-01 | claude-sonnet-4-6 |
| Root scraper | Node.js + axios + cheerio + node-cron | — | Unrelated to FacelessYT |
| Alerts | Telegram Bot API | — | telegram.js |
| Data storage | Browser localStorage | — | **Critical limitation** |

---

## 3. Entry Points

| Entry Point | Path | Purpose |
|---|---|---|
| Next.js dev server | `PT-App/` via `npm run dev` | Dashboard UI |
| API content generation | `POST /api/generate` | Anthropic proxy |
| Root scraper | `node scraper.js` | Congressional trades (unrelated) |
| Dashboard home | `GET /` | PT-App landing page |
| Faceless dashboard | `GET /faceless` | FacelessYT UI |
| Content generator | `GET /content` | Script/content generation UI |
| Pipeline kanban | `GET /pipeline` | Content pipeline board |
| Scheduler | `GET /scheduler` | Post scheduling calendar |

---

## 4. Environment Variables

### Found (Root `.env` — for scraper)
```
BOT_TOKEN=<telegram bot token>
CHAT_ID=<telegram chat id>
```

### Found (Concept Only — referenced in code but NOT in `.env.local`)
```
ANTHROPIC_API_KEY    # Referenced in PT-App/app/api/generate/route.ts
                     # No .env.local file detected in PT-App/
```

### Missing — Required for FacelessYT Engine
```
YOUTUBE_API_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
ELEVENLABS_API_KEY
REPLICATE_API_TOKEN
SUPABASE_URL
SUPABASE_KEY
DATABASE_URL
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
S3_BUCKET_NAME
OPENAI_API_KEY
REDIS_URL
```

### Status: No `.env.local` exists in `PT-App/`
The application will return HTTP 500 on any `/api/generate` call because `ANTHROPIC_API_KEY` is undefined. The error is handled gracefully in route.ts (returns JSON error), but this is a deployment blocker.

---

## 5. APIs Detected

| API | Location | Status |
|---|---|---|
| Anthropic Messages API | `PT-App/app/api/generate/route.ts` | Configured in code, key missing from env |
| Telegram Bot API | `telegram.js` (root) | Configured and used by scraper |
| Capitol Trades (web scrape) | `scraper.js` (root) | Working, unrelated to FacelessYT |

### APIs Required but Not Yet Implemented
- YouTube Data API v3 (upload, search, playlists, thumbnails)
- YouTube Analytics API v2 (performance metrics)
- ElevenLabs TTS API (voice generation)
- Replicate API (image/video generation via SDXL)
- OpenAI Whisper API (subtitle generation)
- Supabase REST API (database)
- Google OAuth 2.0 (YouTube authentication)
- Reddit API (trend discovery)
- News API (headline monitoring)

---

## 6. Dead Code and Unrelated Files

### Unrelated to FacelessYT (do not delete — separate concern)
| File | Reason |
|---|---|
| `scraper.js` | Congressional trades monitor. Different product entirely. Keep as-is. |
| `telegram.js` | Used by scraper. However, the Telegram alert pattern is reusable for FacelessYT engine notifications. |
| `trades.json` | Scraper output data. Not relevant. |
| `package.json` (root) | Only serves the scraper. Has no overlap with PT-App. |

### PT-App Pages With No FacelessYT Relevance
The following pages are Personal Trainer app features unrelated to the YouTube content business. They are not dead code — they represent a dual-purpose app — but they add surface area and cognitive overhead:

| Page | Content |
|---|---|
| `/sessions` | Workout session tracker |
| `/supplements` | Supplement logging |
| `/nutrition` | Macro/calorie tracking |
| `/recipes` | Recipe storage |
| `/journal` | Personal journal |
| `/skittles` | Unknown (Skittles game/challenge tracker) |

**Recommendation:** These pages should remain untouched. The FacelessYT engine is being built as a separate `engine/` directory. The `/faceless`, `/content`, `/pipeline`, and `/scheduler` pages are the relevant surface for FacelessYT.

---

## 7. Scaling Risks

### Critical: localStorage as Sole Data Store
**File:** `PT-App/lib/store.ts`

All application data — content pieces, scheduled posts, sessions, nutrition logs — lives in `window.localStorage`. This is the single largest architectural risk:

- **Data loss:** localStorage is cleared when user clears browser data
- **No multi-device sync:** data is device-local
- **5-10 MB browser limit:** will hit cap quickly with video metadata and analytics
- **No server-side access:** the `engine/` backend cannot read or write localStorage
- **No querying:** no filtering, sorting, or aggregation possible
- **No relational integrity:** no foreign keys or joins

**Required fix:** Migrate to Supabase (Postgres). All types defined in `store.ts` map cleanly to database tables.

### Medium: No Job Queue
There is currently no asynchronous job processing system. Content generation is synchronous HTTP — the browser waits for the Anthropic API to respond. For a video pipeline that involves multiple sequential API calls (script → voice → visuals → FFmpeg assembly → upload), this will:
- Time out in serverless environments (Vercel/Netlify have 60s function limits)
- Block the UI completely during generation
- Provide no retry capability on failure

**Required fix:** BullMQ + Redis for async job processing.

### Low-Medium: No Authentication
There is zero authentication on the application. Any user who can reach the URL has full read/write access to all data. The `/api/generate` endpoint is callable by anyone with network access.

**Required fix:** NextAuth.js or Supabase Auth (Google OAuth sufficient for single-owner use case).

---

## 8. Performance Bottlenecks

### Synchronous AI Generation
`POST /api/generate` makes a blocking fetch to Anthropic with up to 2048 output tokens. At typical generation speeds (50-80 tokens/second), this is a 25-40 second blocking call with no streaming, no progress indication, and no timeout.

**Fix:** Implement streaming via `ReadableStream` in the route handler, forward SSE to client.

### No Caching Layer
Every content generation request hits the Anthropic API cold. There is no prompt-level caching, no semantic deduplication, and no result caching. At scale (3 videos/day × multiple script revisions), costs compound rapidly.

**Fix:** Anthropic prompt caching on system prompts + Redis cache for repeated topic research.

### No Image/Asset Optimization
The dashboard currently has no media assets to optimize, but when video thumbnails and B-roll previews are introduced, Next.js Image optimization must be configured. The current `next.config.ts` is minimal.

---

## 9. Security Issues

### API Key Exposure Risk
`ANTHROPIC_API_KEY` is read via `process.env` in a Next.js route handler — this is correct and safe. However, if a developer accidentally references it in a `"use client"` component (which would bundle it into client-side JavaScript), it would be exposed publicly.

**Risk:** Medium. The current implementation is safe, but there are no ESLint rules or CI checks preventing accidental client-side exposure.

**Fix:** Add `eslint-plugin-no-process-env` rule for client components. Add `NEXT_PUBLIC_` prefix convention documentation.

### No Rate Limiting
`POST /api/generate` has no rate limiting. It proxies directly to the Anthropic API. A single malicious request loop could exhaust the API key's credits.

**Fix:** Implement rate limiting middleware (e.g., `@upstash/ratelimit` with Redis).

### No Input Validation
The `generate` route accepts `{ prompt }` from the request body with no validation, sanitization, or length limits. Any string up to memory limits is passed directly to the Anthropic API.

**Fix:** Add Zod schema validation on all API route inputs.

---

## 10. Hardcoded Values Found

| File | Value | Risk |
|---|---|---|
| `PT-App/app/api/generate/route.ts` | `model: "claude-sonnet-4-6"` | Model name hardcoded — won't auto-upgrade |
| `PT-App/app/api/generate/route.ts` | `max_tokens: 2048` | Arbitrary limit, too low for 8-10 min video scripts (~1600+ words) |
| `PT-App/app/api/generate/route.ts` | `anthropic-version: "2023-06-01"` | API version hardcoded |
| `PT-App/components/PipelineClient.tsx` | Status labels, color hex codes | Should be a shared config constant |
| `scraper.js` | `url: "https://www.capitoltrades.com/trades"` | Target URL hardcoded |

**Recommendation:** Extract all configurable values to `PT-App/lib/config.ts` and root `.env`.

---

## 11. Missing Infrastructure (FacelessYT Engine)

The following infrastructure does not exist yet and must be built:

| Component | Status | Priority |
|---|---|---|
| `engine/` directory | Missing | P0 |
| BullMQ + Redis job queue | Missing | P0 |
| Supabase database schema | Missing | P0 |
| YouTube API integration | Missing | P0 |
| ElevenLabs voice pipeline | Missing | P0 |
| Replicate visual generation | Missing | P0 |
| FFmpeg video assembly | Missing | P0 |
| Cron scheduler (autonomous daily run) | Missing | P0 |
| Trend discovery module | Missing | P1 |
| Analytics collection module | Missing | P1 |
| Learning/feedback engine | Missing | P1 |
| Docker + docker-compose | Missing | P1 |
| CI/CD pipeline | Missing | P2 |
| Monitoring + alerting | Missing | P2 |

---

## 12. Summary Risk Register

| Risk | Severity | Impact | Fix |
|---|---|---|---|
| localStorage as sole data store | Critical | Data loss, no backend access | Migrate to Supabase |
| No job queue | High | Pipeline will fail at scale | Add BullMQ + Redis |
| No authentication | High | Open API, data exposure | Add NextAuth/Supabase Auth |
| No rate limiting on `/api/generate` | Medium | Credit exhaustion | Add Upstash rate limiter |
| ANTHROPIC_API_KEY not in .env.local | Blocker | App returns 500 | Create .env.local |
| max_tokens: 2048 too low for scripts | Medium | Scripts get truncated | Increase to 8192 |
| No streaming on generate route | Medium | UI freezes for 30-40s | Implement SSE streaming |
| No input validation on API routes | Medium | Injection/abuse risk | Add Zod validation |
| Hardcoded model name | Low | No auto-upgrade path | Move to env var |
