# Data Pipeline Architecture
## World Cup Betting Predictor

**Version:** 1.0  
**Date:** 2026-06-02

---

## Data Sources

### Priority 1 — Required for MVP

| Source | Data | API | Cost | Notes |
|---|---|---|---|---|
| API-Football | Match results, lineups, injuries, live scores | REST | ~$10/mo | Most comprehensive football API |
| The Odds API | Bookmaker odds (20+ books) | REST | ~$50/mo | Best odds aggregator |
| FIFA Official | Official schedule, team lists | Web/RSS | Free | Backup for schedule data |

### Priority 2 — Enhances Model Quality

| Source | Data | API | Cost | Notes |
|---|---|---|---|---|
| Understat / FBref | xG data for European club players | Scrape | Free | Club xG informs national team ratings |
| StatsBomb | High-quality event data | Paid | ~$200+/mo | Only if budget allows |
| TransferMarkt | Player market values, injury history | Scrape | Free | Good injury/squad data |

### Priority 3 — Post-MVP

| Source | Data | API | Cost | Notes |
|---|---|---|---|---|
| Betfair Exchange | Market liquidity, sharp odds | REST | Free (with account) | Best signal for sharp money |
| Twitter/X API | Injury news, team announcements | REST | $100/mo | Real-time squad news |

---

## Pipeline Architecture

```
External APIs → Supabase Edge Functions (Ingestion) → PostgreSQL → Prediction Engine → DB → Frontend
```

### Ingestion Functions (Supabase Edge Functions)

#### 1. `ingest-match-schedule`
- **Trigger:** Manual run once + on demand
- **Source:** API-Football `/fixtures?league=1&season=2026`
- **Output:** Populate `matches` table
- **Frequency:** Once at tournament start, then after each draw for knockouts

#### 2. `ingest-team-data`
- **Trigger:** Manual run once + weekly
- **Source:** API-Football `/teams`, `/standings`
- **Output:** Populate/update `teams`, `team_ratings`
- **Frequency:** Weekly during tournament

#### 3. `ingest-player-data`
- **Trigger:** Daily at 09:00 UTC
- **Source:** API-Football `/players/squads`, `/injuries`
- **Output:** Update `players`, `player_availability`
- **Frequency:** Daily. Critical 48h before each match.

#### 4. `ingest-odds`
- **Trigger:** Cron every 30 minutes during 6:00–22:00 UTC
- **Source:** The Odds API `/sports/soccer_fifa_world_cup/odds`
- **Output:** Append to `bookmaker_odds`, refresh `value_bets`
- **Frequency:** Every 30 min active hours, every 2h off-peak

#### 5. `ingest-results`
- **Trigger:** Webhook from API-Football (live match events) OR cron every 5 min during live matches
- **Source:** API-Football `/fixtures/id/{fixture_id}`
- **Output:** Update `matches` with scores, trigger `record-prediction-results`
- **Frequency:** Every 5 min during live matches

---

## Processing Functions

#### 6. `calculate-team-ratings`
- **Trigger:** After `ingest-results` completes, after player availability update
- **Process:** 
  1. Pull latest match results for each team
  2. Recalculate Elo with K-factor
  3. Recalculate attack/defence strength from xG data
  4. Recalculate form score
  5. Upsert `team_ratings` with today's date
- **Runtime estimate:** < 5 seconds for 48 teams

#### 7. `generate-predictions`
- **Trigger:** After `calculate-team-ratings`, or manual admin trigger
- **Process:**
  1. For each upcoming match (kickoff > now, no locked prediction):
  2. Pull latest team ratings
  3. Run Dixon-Coles model
  4. Calculate all market probabilities
  5. Calculate fair odds
  6. Calculate confidence score
  7. Call Claude API for narrative (async, non-blocking)
  8. Insert new version into `match_predictions`
  9. If EV > threshold vs current odds → upsert `value_bets`
- **Frequency:** Run after every team rating update, minimum twice daily

#### 8. `refresh-value-bets`
- **Trigger:** After `ingest-odds` completes
- **Process:**
  1. For each active match prediction, compare our fair odds to latest bookmaker odds
  2. Calculate EV for all markets
  3. Delete stale value_bets for this match
  4. Insert new value_bets where EV ≥ 3%
  5. Rank all active value bets by EV
- **Frequency:** Every 30 min (same as odds ingestion)

#### 9. `run-tournament-simulation`
- **Trigger:** After each match result, after significant odds movement
- **Process:** Monte Carlo simulation (100k iterations), update `tournament_simulations`
- **Runtime estimate:** ~15 seconds for 100k iterations in Edge Function
- **Frequency:** After every result, maximum every 30 min otherwise

#### 10. `record-prediction-results`
- **Trigger:** After match status set to `completed`
- **Process:**
  1. Get final score
  2. Look up locked prediction for this match
  3. Calculate log loss, Brier score, P&L
  4. Insert into `prediction_results`
- **Frequency:** Once per completed match

---

## Data Refresh Schedule

```
00:00 UTC — Daily model recalibration run
06:00 UTC — Odds ingestion starts (every 30 min)
09:00 UTC — Player/injury data refresh
12:00 UTC — Midday prediction review + narrative refresh if needed
15:00 UTC — Pre-match odds check (most matches kick off 15:00–21:00 UTC)
18:00 UTC — Peak odds tracking (30 min intervals)
21:00 UTC — Post-match result recording
22:00 UTC — Odds ingestion ends (every 2h overnight)
```

Match day enrichment: 
- T-24h: Full prediction published
- T-6h: Injury update check, confidence score refresh
- T-2h: Final odds comparison, value bets ranked
- T-0: Predictions locked (trigger via match status → live)
- T+120m: Results recorded, performance stats updated

---

## Data Quality Controls

### Validation Rules

| Field | Rule | On Failure |
|---|---|---|
| Match probabilities | Sum to 1.0 ± 0.001 | Block publish, alert admin |
| Fair odds | Must be ≥ 1.0 | Block insert |
| Elo rating | Must be in range 1000–2500 | Clamp + alert |
| EV calculation | Must be in range -100% to +200% | Block if outside |
| Odds timestamp | Must be within last 4 hours for active value bet | Expire value bet |
| Player availability | Status must be enum value | Reject ingestion |

### Monitoring Alerts (Supabase/Webhook to Slack/Telegram)

- Any ingestion function failure → immediate alert
- No odds refresh in > 2h during active hours → alert
- Prediction not published for match with kickoff in < 20h → alert
- Probability sum deviates > 0.5% from 100% → alert
- Claude API error → fallback to template narrative, alert

---

## API Rate Limits Management

| API | Limit | Strategy |
|---|---|---|
| API-Football | 100 calls/day (free) / 1000/day (paid) | Cache all results, batch calls, upgrade to paid |
| The Odds API | 500/mo (free) / 10k/mo ($50) | Cache 30-min snapshots, only 3 bookmakers to save calls |
| Claude API | Token-based | Cache narratives, only regenerate on material change |
| OpenAI API | Token-based | Not used MVP (Claude only) |

---

## Failover & Resilience

**If API-Football fails:**
- Serve cached data (up to 6h stale acceptable for team ratings)
- Manual admin entry for match results
- Alert admin immediately

**If The Odds API fails:**
- Serve last cached odds with staleness warning
- Value bets feed shows "Odds data may be outdated" banner
- EV calculator still works with manual odds input

**If Claude API fails:**
- Use pre-written template narratives per match type
- Do NOT block prediction publish for narrative failure
- Queue narrative generation for retry

**If Supabase goes down:**
- Vercel serves static cached version of last known predictions
- No writes possible
- Status page updated
