# API Architecture
## World Cup Betting Predictor

**Version:** 1.0  
**Date:** 2026-06-02

---

## API Strategy

The system uses **Supabase auto-generated REST/GraphQL APIs** as the primary data layer. Custom logic lives in **Supabase Edge Functions** (Deno/TypeScript). The frontend (Lovable/React) calls Supabase directly via the `@supabase/supabase-js` client.

No custom Express/Node.js server required for MVP. Edge Functions handle all compute.

---

## Internal API — Supabase Auto-REST

Supabase generates REST endpoints for every table automatically.
All table endpoints available at: `https://{project}.supabase.co/rest/v1/{table}`

### Key Read Endpoints (Frontend Uses)

```
GET /rest/v1/matches
  ?select=*,home_team:teams!home_team_id(*),away_team:teams!away_team_id(*)
  &status=eq.scheduled
  &kickoff_utc=gt.{now}
  &order=kickoff_utc.asc
  → Returns upcoming matches with team details

GET /rest/v1/match_predictions
  ?select=*
  &match_id=eq.{match_id}
  &is_published=eq.true
  &order=version.desc
  &limit=1
  → Latest published prediction for a match

GET /rest/v1/value_bets
  ?select=*,match:matches(*),prediction:match_predictions(*)
  &is_active=eq.true
  &order=ev_percentage.desc
  → All active value bets, ranked by EV

GET /rest/v1/tournament_simulations
  ?select=*,team:teams(*)
  &simulation_run_at=eq.{latest_run_at}
  &order=prob_win_tournament.desc
  → Latest tournament winner probabilities

GET /rest/v1/prediction_results
  ?select=*,prediction:match_predictions(*),match:matches(*)
  &order=recorded_at.desc
  → Performance tracking history
```

---

## Edge Functions (Custom API Endpoints)

All edge functions deployed at: `https://{project}.supabase.co/functions/v1/{function-name}`

### Public Endpoints

#### `POST /functions/v1/calculate-ev`
Calculates EV for a user-provided odds input (no auth required).

**Request:**
```json
{
  "match_id": "uuid",
  "market": "1x2",
  "selection": "home",
  "decimal_odds": 2.40,
  "odds_format": "decimal"
}
```

**Response:**
```json
{
  "our_probability": 0.52,
  "market_implied_probability": 0.4167,
  "de_vigged_market_probability": 0.4012,
  "edge": 0.1188,
  "ev_percentage": 13.24,
  "fair_odds": 1.923,
  "kelly_fraction": 0.2376,
  "half_kelly_fraction": 0.1188,
  "quarter_kelly_fraction": 0.0594,
  "confidence_score": 74,
  "verdict": "strong_value",
  "verdict_label": "Strong +EV"
}
```

#### `POST /functions/v1/convert-odds`
Converts between decimal, fractional, American formats.

**Request:**
```json
{ "value": "-110", "from_format": "american", "to_format": "decimal" }
```

**Response:**
```json
{ "decimal": 1.909, "fractional": "10/11", "american": "-110", "implied_prob": 0.5238 }
```

#### `GET /functions/v1/match-analysis/{match_id}`
Returns complete analysis for a match (aggregates prediction + odds + value bets + narrative).

**Response:**
```json
{
  "match": { ... },
  "home_team": { "ratings": { ... }, "form": [ ... ] },
  "away_team": { "ratings": { ... }, "form": [ ... ] },
  "prediction": {
    "prob_home_win": 0.48,
    "prob_draw": 0.27,
    "prob_away_win": 0.25,
    "expected_goals_home": 1.62,
    "expected_goals_away": 1.14,
    "confidence_score": 71,
    "summary_text": "England enter this fixture...",
    "fair_odds": { "home": 2.08, "draw": 3.70, "away": 4.00 }
  },
  "best_odds": {
    "home": { "decimal": 2.30, "bookmaker": "Pinnacle", "ev": 0.104 },
    "draw": { "decimal": 3.25, "bookmaker": "Bet365", "ev": -0.122 },
    "away": { "decimal": 4.50, "bookmaker": "Betway", "ev": 0.125 }
  },
  "value_bets": [ ... ],
  "h2h": { "home_wins": 4, "draws": 2, "away_wins": 1, "last_5": [ ... ] }
}
```

#### `GET /functions/v1/tournament-standings`
Returns live group standings + simulation probabilities.

---

### Admin Endpoints (Service Role Auth Required)

#### `POST /functions/v1/admin/trigger-pipeline`
Manually triggers data ingestion + prediction generation.

**Request:**
```json
{
  "pipeline": "generate-predictions",
  "match_ids": ["uuid1", "uuid2"]  // optional: specific matches only
}
```

#### `POST /functions/v1/admin/publish-prediction`
Publishes a specific prediction version.

**Request:**
```json
{ "prediction_id": "uuid", "force": false }
```

#### `POST /functions/v1/admin/record-result`
Manually records match result (fallback if webhook fails).

---

### Authenticated Endpoints (User Auth Required)

#### `POST /functions/v1/bets/save`
Save a bet to user's tracker.

**Request:**
```json
{
  "match_id": "uuid",
  "market": "1x2",
  "selection": "away",
  "bookmaker": "bet365",
  "decimal_odds": 4.50,
  "stake": 25.00
}
```

#### `GET /functions/v1/bets/portfolio`
Returns user's full bet history with P&L stats.

#### `PUT /functions/v1/bets/{bet_id}/settle`
Records result of a saved bet.

---

## External API Integrations

### API-Football (api-football.com)

```typescript
// Base config
const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io'
const headers = { 'x-apisports-key': process.env.API_FOOTBALL_KEY }

// Key endpoints used
GET /fixtures?league=1&season=2026           // All World Cup matches
GET /fixtures/{id}                            // Single match with lineups, events
GET /injuries?fixture={id}                   // Injury report for match
GET /players/squads?team={team_id}            // Full squad list
GET /odds?fixture={id}&bookmaker=6            // Odds (bookmaker 6 = Bet365)
```

### The Odds API (the-odds-api.com)

```typescript
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4'
const params = { apiKey: process.env.ODDS_API_KEY }

// Key endpoints
GET /sports/soccer_fifa_world_cup/odds
  ?regions=uk,eu,us
  &markets=h2h,totals
  &oddsFormat=decimal
  &bookmakers=pinnacle,bet365,betway,betfair
```

### Claude API (Anthropic)

```typescript
import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const message = await client.messages.create({
  model: 'claude-opus-4-8',
  max_tokens: 400,
  messages: [{ role: 'user', content: narrativePrompt }]
})
```

---

## Authentication & Authorization

| Route Type | Auth | Method |
|---|---|---|
| Public predictions/odds data | None required | Supabase anon key |
| User bet tracker | Supabase Auth JWT | Bearer token |
| Admin pipeline triggers | Service role key | Secret header |
| Rate-limited public endpoints | None (fair use) | Rate limit by IP |

**Rate limits (Edge Function middleware):**
- Public endpoints: 60 requests/minute per IP
- Authenticated: 120 requests/minute per user
- Admin: No limit (trusted service role)

---

## Caching Strategy

| Data Type | Cache TTL | Cache Layer |
|---|---|---|
| Match schedule | 24 hours | Supabase cache + CDN |
| Team ratings | 6 hours | Supabase cache |
| Published predictions | Until kickoff (immutable) | CDN aggressive |
| Bookmaker odds | 30 minutes | Supabase cache |
| Value bets | 30 minutes | Supabase cache |
| Tournament sim | 1 hour | Supabase cache |
| AI narratives | Until prediction update | DB storage |
| EV calculation | No cache (real-time) | None |

Lovable/Next.js frontend uses SWR (stale-while-revalidate) with appropriate TTLs matching above.

---

## API Error Handling

All Edge Functions return consistent error envelope:

```json
{
  "error": true,
  "code": "PREDICTION_NOT_FOUND",
  "message": "No published prediction found for this match.",
  "retry": false,
  "timestamp": "2026-06-09T15:30:00Z"
}
```

**Standard error codes:**
- `PREDICTION_NOT_FOUND` — No prediction published yet
- `ODDS_STALE` — Odds data older than 4 hours
- `MATCH_LOCKED` — Match has started, no live updates
- `INVALID_ODDS_FORMAT` — Bad odds input
- `EV_INSUFFICIENT_DATA` — Cannot calculate EV, missing probabilities
- `RATE_LIMITED` — Too many requests
- `PIPELINE_ERROR` — Internal ingestion failure (admin only)
