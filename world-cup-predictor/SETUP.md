# GoalEdge.io — Setup & Deployment Guide

World Cup 2026 betting prediction platform.  
Stack: Supabase (DB + Edge Functions) · Vercel (frontend) · Lovable (UI build)

---

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed (`npm i -g supabase`)
- [Deno](https://deno.land/) 1.40+ (for local Edge Function testing)
- Node 20+ and pnpm/npm
- Accounts: Supabase, Vercel, API-Football, The Odds API, Anthropic

---

## 1. Supabase Project Setup

### 1a. Create project

1. Go to [supabase.com](https://supabase.com) → New project
2. Note your **Project URL** and **anon key** (Settings → API)
3. Note your **service role key** (keep secret — server-side only)

### 1b. Run migrations

```bash
cd world-cup-predictor/supabase

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run all migrations in order
supabase db push
```

This runs:
- `001_initial_schema.sql` — all tables, views, triggers, RLS policies
- `002_seed_teams.sql` — 48 WC 2026 teams with Elo ratings
- `003_seed_fixtures.sql` — 72 group-stage matches

> **⚠️ Verify before launch:** Confirm group assignments and fixture kickoff times
> against the [official FIFA schedule](https://www.fifa.com/fifaplus/en/tournaments/mens/worldcup/canadamexicousa2026/articles/fifa-world-cup-2026-groups) before going live.

### 1c. Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy generate-predictions
supabase functions deploy calculate-ev
supabase functions deploy ingest-odds
supabase functions deploy refresh-value-bets
supabase functions deploy ingest-results
supabase functions deploy match-analysis
supabase functions deploy run-tournament-simulation
supabase functions deploy generate-narrative
```

### 1d. Set Edge Function secrets

```bash
supabase secrets set \
  ODDS_API_KEY="your-the-odds-api-key" \
  API_FOOTBALL_KEY="your-api-football-key" \
  ANTHROPIC_API_KEY="your-anthropic-api-key"
```

---

## 2. Environment Variables

### Supabase Edge Functions (set via `supabase secrets set`)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Auto-injected |
| `SUPABASE_ANON_KEY` | Auto-injected |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected |
| `ODDS_API_KEY` | [The Odds API](https://the-odds-api.com) — Starter plan |
| `API_FOOTBALL_KEY` | [API-Football](https://api-football.com) — Basic plan |
| `ANTHROPIC_API_KEY` | [Anthropic Console](https://console.anthropic.com) |

### Vercel / Frontend (set in Vercel dashboard)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (safe to expose) |
| `STRIPE_SECRET_KEY` | Stripe secret (server-side only) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | From Stripe webhook dashboard |

---

## 3. Scheduled Jobs (Cron)

Set up cron jobs in Supabase Dashboard → Database → pg_cron, or call via external scheduler.

| Function | Schedule | Description |
|---|---|---|
| `ingest-odds` | Every 30 min, 06:00–22:00 UTC | Fetch latest bookmaker odds |
| `refresh-value-bets` | After `ingest-odds` | Recalculate EV, update value feed |
| `ingest-results` | 22:00 UTC daily | Ingest match results, settle bets |
| `generate-predictions` | Daily 06:00 UTC | Generate predictions for next 3 days |
| `run-tournament-simulation` | Daily 07:00 UTC | 100k Monte Carlo iterations |

### Example pg_cron setup

```sql
-- Run ingest-odds every 30 minutes during active hours
SELECT cron.schedule(
  'ingest-odds',
  '*/30 6-22 * * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/ingest-odds',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}',
    body := '{}'
  )$$
);
```

---

## 4. Initial Data Pipeline Run

After migrations, bootstrap predictions:

```bash
# 1. Generate initial predictions for all upcoming matches
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/generate-predictions \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"auto_publish": true}'

# 2. Fetch first odds batch
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/ingest-odds \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{}'

# 3. Refresh value bets
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/refresh-value-bets \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{}'

# 4. Run tournament simulation
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/run-tournament-simulation \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{"iterations": 100000}'
```

---

## 5. Frontend (Lovable)

The frontend is built in [Lovable](https://lovable.dev). Use the prompts in
`docs/07_LOVABLE_BUILD_PLAN.md` to build each screen.

**Supabase connection in Lovable:**
1. Open Lovable project settings
2. Add Supabase integration
3. Paste `SUPABASE_URL` and `SUPABASE_ANON_KEY`

**Deploy to Vercel:**
1. Connect Lovable project to Vercel via GitHub export
2. Set environment variables listed in Section 2
3. Deploy

---

## 6. Stripe Subscription Setup

1. Create products in Stripe Dashboard:
   - **Monthly Premium**: £9.99/month recurring
   - **Tournament Pass**: £24.99 one-time

2. Set `price_id` values in your frontend config

3. Webhook endpoint: `https://yourapp.vercel.app/api/stripe-webhook`
   - Events to listen for: `checkout.session.completed`, `customer.subscription.deleted`

---

## 7. Monitoring

Key metrics to watch post-launch:

- **Brier Score** — target < 0.22 (check weekly after results ingestion)
- **Odds API quota** — Starter plan has 500 requests/month; ~480 used for 72 matches × 2/day
- **Edge Function invocations** — Supabase free tier: 500k/month
- **Database size** — `bookmaker_odds` grows ~5k rows/day; prune rows older than 7 days

```sql
-- Weekly cleanup job (add to pg_cron)
DELETE FROM bookmaker_odds WHERE fetched_at < NOW() - INTERVAL '7 days';
```

---

## 8. Local Development

```bash
cd world-cup-predictor

# Start Supabase locally
supabase start

# Serve a specific Edge Function
supabase functions serve match-analysis --env-file .env.local

# Test locally
curl http://localhost:54321/functions/v1/match-analysis?match_id=YOUR_MATCH_ID
```

Create `.env.local` with your secret keys for local testing (never commit this file).
