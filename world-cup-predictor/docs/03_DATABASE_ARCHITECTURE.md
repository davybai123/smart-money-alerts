# Database Architecture
## World Cup Betting Predictor — Supabase / PostgreSQL

**Version:** 1.0  
**Date:** 2026-06-02

---

## Design Principles

1. **Immutability of predictions** — Once published, predictions are append-only. Updates create new records with version numbers.
2. **Audit trail** — All odds, ratings, and predictions carry timestamps.
3. **Separation of model data from presentation data** — Raw model outputs stored separately from user-facing predictions.
4. **Denormalisation for read performance** — Key values duplicated onto prediction rows to avoid expensive joins on match day traffic.

---

## Schema

### Table: `teams`

```sql
CREATE TABLE teams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fifa_code       VARCHAR(3) UNIQUE NOT NULL,   -- e.g. 'BRA', 'ENG'
  name            VARCHAR(100) NOT NULL,
  full_name       VARCHAR(150),
  confederation   VARCHAR(10),                  -- UEFA, CONMEBOL, etc.
  flag_url        TEXT,
  group_letter    CHAR(1),                      -- A–L for 2026 (48-team format)
  seeded          BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `players`

```sql
CREATE TABLE players (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID REFERENCES teams(id),
  name            VARCHAR(100) NOT NULL,
  position        VARCHAR(20),                  -- GK, DEF, MID, FWD
  shirt_number    INT,
  club            VARCHAR(100),
  age             INT,
  caps            INT DEFAULT 0,
  goals           INT DEFAULT 0,
  is_key_player   BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `player_availability`

```sql
CREATE TABLE player_availability (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID REFERENCES players(id),
  match_id        UUID REFERENCES matches(id),
  status          VARCHAR(20) NOT NULL,          -- available, doubtful, injured, suspended, confirmed_out
  confidence      VARCHAR(20),                   -- confirmed, rumoured, assumed
  impact_score    NUMERIC(3,2),                  -- 0.00–1.00, how much this player affects team rating
  notes           TEXT,
  source_url      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `matches`

```sql
CREATE TABLE matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_number    INT UNIQUE,                   -- Official FIFA match number
  stage           VARCHAR(30) NOT NULL,          -- group, round_of_32, round_of_16, qf, sf, 3rd_place, final
  group_letter    CHAR(1),                       -- NULL for knockout
  home_team_id    UUID REFERENCES teams(id),
  away_team_id    UUID REFERENCES teams(id),
  venue           VARCHAR(100),
  city            VARCHAR(100),
  country         VARCHAR(50),
  kickoff_utc     TIMESTAMPTZ NOT NULL,
  status          VARCHAR(20) DEFAULT 'scheduled', -- scheduled, live, completed, postponed, cancelled
  home_score      INT,
  away_score      INT,
  home_score_et   INT,                           -- extra time
  away_score_et   INT,
  home_score_pen  INT,                           -- penalties
  away_score_pen  INT,
  attendance      INT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_matches_kickoff ON matches(kickoff_utc);
CREATE INDEX idx_matches_stage ON matches(stage);
CREATE INDEX idx_matches_teams ON matches(home_team_id, away_team_id);
```

### Table: `team_ratings`

Stores our model's strength estimates, versioned by date.

```sql
CREATE TABLE team_ratings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID REFERENCES teams(id),
  rating_date     DATE NOT NULL,
  elo_rating      NUMERIC(7,2) NOT NULL,         -- e.g. 2014.50
  attack_strength NUMERIC(5,4),                  -- xG-based attack multiplier
  defence_strength NUMERIC(5,4),                 -- xGA-based defence multiplier
  form_score      NUMERIC(5,4),                  -- last 5 match weighted form
  avg_xg_scored   NUMERIC(5,3),                  -- rolling 10-match average
  avg_xg_conceded NUMERIC(5,3),
  data_source     VARCHAR(50),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, rating_date)
);

CREATE INDEX idx_ratings_team_date ON team_ratings(team_id, rating_date DESC);
```

### Table: `match_predictions`

The core prediction table. Append-only — never UPDATE, only INSERT new versions.

```sql
CREATE TABLE match_predictions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id                UUID REFERENCES matches(id) NOT NULL,
  version                 INT NOT NULL DEFAULT 1,
  is_published            BOOLEAN DEFAULT FALSE,
  published_at            TIMESTAMPTZ,
  is_locked               BOOLEAN DEFAULT FALSE,   -- locked at kickoff, no further changes
  locked_at               TIMESTAMPTZ,

  -- Model inputs snapshot (frozen at prediction time)
  home_elo                NUMERIC(7,2),
  away_elo                NUMERIC(7,2),
  home_attack_str         NUMERIC(5,4),
  home_defence_str        NUMERIC(5,4),
  away_attack_str         NUMERIC(5,4),
  away_defence_str        NUMERIC(5,4),
  home_form               NUMERIC(5,4),
  away_form               NUMERIC(5,4),
  h2h_home_wins           INT,
  h2h_draws               INT,
  h2h_away_wins           INT,

  -- 1X2 market
  prob_home_win           NUMERIC(5,4) NOT NULL,   -- e.g. 0.4521
  prob_draw               NUMERIC(5,4) NOT NULL,
  prob_away_win           NUMERIC(5,4) NOT NULL,
  fair_odds_home          NUMERIC(6,3),            -- 1 / prob
  fair_odds_draw          NUMERIC(6,3),
  fair_odds_away          NUMERIC(6,3),

  -- Goals markets
  expected_goals_home     NUMERIC(5,3),            -- projected xG for home team
  expected_goals_away     NUMERIC(5,3),
  prob_over_15            NUMERIC(5,4),
  prob_over_25            NUMERIC(5,4),
  prob_over_35            NUMERIC(5,4),
  prob_under_15           NUMERIC(5,4),
  prob_under_25           NUMERIC(5,4),
  prob_under_35           NUMERIC(5,4),
  prob_btts_yes           NUMERIC(5,4),
  prob_btts_no            NUMERIC(5,4),
  fair_odds_over_25       NUMERIC(6,3),
  fair_odds_under_25      NUMERIC(6,3),
  fair_odds_btts_yes      NUMERIC(6,3),
  fair_odds_btts_no       NUMERIC(6,3),

  -- Confidence
  confidence_score        NUMERIC(5,2),            -- 0–100
  confidence_factors      JSONB,                   -- breakdown of what drives confidence
  data_quality_score      NUMERIC(5,2),            -- 0–100, data completeness
  model_agreement_score   NUMERIC(5,2),            -- agreement between model variants

  -- Narrative
  summary_text            TEXT,                    -- AI-generated plain English summary
  key_factors             JSONB,                   -- array of factor strings

  created_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, version)
);

CREATE INDEX idx_predictions_match ON match_predictions(match_id);
CREATE INDEX idx_predictions_published ON match_predictions(is_published, published_at DESC);
CREATE INDEX idx_predictions_locked ON match_predictions(is_locked);
```

### Table: `bookmaker_odds`

Stores point-in-time odds snapshots from bookmakers.

```sql
CREATE TABLE bookmaker_odds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        UUID REFERENCES matches(id) NOT NULL,
  bookmaker       VARCHAR(50) NOT NULL,            -- 'bet365', 'betfair', 'pinnacle', 'user_input', etc.
  market          VARCHAR(30) NOT NULL,            -- '1x2', 'over_25', 'under_25', 'btts_yes', etc.
  selection       VARCHAR(30) NOT NULL,            -- 'home', 'draw', 'away', 'yes', 'no'
  decimal_odds    NUMERIC(8,3) NOT NULL,
  implied_prob    NUMERIC(5,4) GENERATED ALWAYS AS (1.0 / decimal_odds) STORED,
  is_best_odds    BOOLEAN DEFAULT FALSE,           -- best available for this market/selection
  odds_timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_odds_match_market ON bookmaker_odds(match_id, market, selection);
CREATE INDEX idx_odds_timestamp ON bookmaker_odds(odds_timestamp DESC);
CREATE INDEX idx_odds_bookmaker ON bookmaker_odds(bookmaker, match_id);
```

### Table: `value_bets`

Materialised view of EV+ opportunities. Recalculated on odds refresh.

```sql
CREATE TABLE value_bets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id            UUID REFERENCES matches(id) NOT NULL,
  prediction_id       UUID REFERENCES match_predictions(id) NOT NULL,
  odds_id             UUID REFERENCES bookmaker_odds(id) NOT NULL,
  market              VARCHAR(30) NOT NULL,
  selection           VARCHAR(30) NOT NULL,
  bookmaker           VARCHAR(50) NOT NULL,
  our_probability     NUMERIC(5,4) NOT NULL,
  market_probability  NUMERIC(5,4) NOT NULL,
  decimal_odds        NUMERIC(8,3) NOT NULL,
  ev_percentage       NUMERIC(6,3) NOT NULL,       -- EV as % of stake
  edge_percentage     NUMERIC(6,3) NOT NULL,        -- our_prob - market_prob as %
  confidence_score    NUMERIC(5,2),
  kelly_fraction      NUMERIC(5,4),                -- full Kelly
  half_kelly_fraction NUMERIC(5,4),                -- recommended stake as fraction of bankroll
  rank_by_ev          INT,                         -- rank among current active value bets
  is_active           BOOLEAN DEFAULT TRUE,        -- false after match kicks off
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_value_bets_ev ON value_bets(ev_percentage DESC) WHERE is_active = TRUE;
CREATE INDEX idx_value_bets_match ON value_bets(match_id, is_active);
```

### Table: `prediction_results`

Records actual outcome against prediction for performance tracking.

```sql
CREATE TABLE prediction_results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id       UUID REFERENCES match_predictions(id) NOT NULL UNIQUE,
  match_id            UUID REFERENCES matches(id) NOT NULL,

  -- Actual result
  actual_home_score   INT NOT NULL,
  actual_away_score   INT NOT NULL,
  actual_outcome      VARCHAR(10) NOT NULL,         -- 'home', 'draw', 'away'
  actual_over_25      BOOLEAN,
  actual_btts         BOOLEAN,

  -- Prediction accuracy
  prob_assigned_outcome NUMERIC(5,4),               -- what probability we gave to what actually happened
  log_loss_1x2        NUMERIC(10,8),
  brier_score_1x2     NUMERIC(10,8),
  was_value_bet_winner BOOLEAN,                     -- did recommended value bets win?

  -- Unit staking P&L (if user had bet 1 unit at our recommended odds)
  pnl_home_1unit      NUMERIC(8,3),
  pnl_over25_1unit    NUMERIC(8,3),
  pnl_btts_1unit      NUMERIC(8,3),

  recorded_at         TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `tournament_simulations`

Stores latest Monte Carlo simulation results for group/knockout probabilities.

```sql
CREATE TABLE tournament_simulations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_run_at     TIMESTAMPTZ NOT NULL,
  iterations            INT NOT NULL DEFAULT 100000,
  team_id               UUID REFERENCES teams(id) NOT NULL,
  prob_qualify_groups   NUMERIC(5,4),              -- probability of exiting group stage
  prob_reach_r16        NUMERIC(5,4),
  prob_reach_qf         NUMERIC(5,4),
  prob_reach_sf         NUMERIC(5,4),
  prob_reach_final      NUMERIC(5,4),
  prob_win_tournament   NUMERIC(5,4),
  expected_goals_scored NUMERIC(5,2),              -- expected over tournament
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sims_latest ON tournament_simulations(simulation_run_at DESC);
```

### Table: `users` (extends Supabase auth.users)

```sql
CREATE TABLE user_profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username        VARCHAR(50) UNIQUE,
  display_name    VARCHAR(100),
  subscription    VARCHAR(20) DEFAULT 'free',       -- 'free', 'premium', 'pro'
  subscription_end TIMESTAMPTZ,
  timezone        VARCHAR(50) DEFAULT 'UTC',
  odds_format     VARCHAR(10) DEFAULT 'decimal',    -- 'decimal', 'fractional', 'american'
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `saved_bets`

User's personal bet tracker.

```sql
CREATE TABLE saved_bets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  match_id        UUID REFERENCES matches(id),
  market          VARCHAR(30) NOT NULL,
  selection       VARCHAR(30) NOT NULL,
  bookmaker       VARCHAR(50),
  decimal_odds    NUMERIC(8,3),
  stake           NUMERIC(10,2),
  potential_return NUMERIC(10,2) GENERATED ALWAYS AS (stake * decimal_odds) STORED,
  status          VARCHAR(20) DEFAULT 'open',       -- 'open', 'won', 'lost', 'void', 'cashed_out'
  profit_loss     NUMERIC(10,2),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  settled_at      TIMESTAMPTZ
);

CREATE INDEX idx_saved_bets_user ON saved_bets(user_id, status);
```

### Table: `head_to_head`

Pre-computed H2H records.

```sql
CREATE TABLE head_to_head (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_a_id       UUID REFERENCES teams(id),
  team_b_id       UUID REFERENCES teams(id),
  match_date      DATE NOT NULL,
  competition     VARCHAR(100),
  team_a_score    INT NOT NULL,
  team_b_score    INT NOT NULL,
  venue_type      VARCHAR(20),                      -- neutral, team_a_home, team_b_home
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_h2h_teams ON head_to_head(team_a_id, team_b_id, match_date DESC);
```

---

## Row Level Security (RLS) Policies

```sql
-- Predictions: public read, service-role write
ALTER TABLE match_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read predictions" ON match_predictions
  FOR SELECT USING (is_published = TRUE);

-- Value bets: public read active ones
ALTER TABLE value_bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read value bets" ON value_bets
  FOR SELECT USING (is_active = TRUE);

-- Saved bets: users see only their own
ALTER TABLE saved_bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own bets" ON saved_bets
  USING (auth.uid() = user_id);

-- Bookmaker odds: public read
ALTER TABLE bookmaker_odds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read odds" ON bookmaker_odds
  FOR SELECT USING (TRUE);
```

---

## Database Functions (Supabase Edge Functions triggers)

```sql
-- Auto-lock predictions at kickoff
CREATE OR REPLACE FUNCTION lock_predictions_at_kickoff()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE match_predictions
  SET is_locked = TRUE, locked_at = NOW()
  WHERE match_id = NEW.id
    AND is_published = TRUE
    AND is_locked = FALSE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lock_on_kickoff
  AFTER UPDATE OF status ON matches
  FOR EACH ROW
  WHEN (NEW.status = 'live')
  EXECUTE FUNCTION lock_predictions_at_kickoff();

-- Calculate Kelly fraction on value_bets insert
CREATE OR REPLACE FUNCTION calc_kelly()
RETURNS TRIGGER AS $$
BEGIN
  NEW.kelly_fraction = GREATEST(0,
    (NEW.decimal_odds - 1) * NEW.our_probability - (1 - NEW.our_probability)
  ) / (NEW.decimal_odds - 1);
  NEW.half_kelly_fraction = NEW.kelly_fraction / 2;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_kelly
  BEFORE INSERT OR UPDATE ON value_bets
  FOR EACH ROW EXECUTE FUNCTION calc_kelly();
```

---

## Indexes Summary

| Table | Index | Purpose |
|---|---|---|
| matches | kickoff_utc | Match schedule queries |
| team_ratings | team_id + rating_date | Latest rating lookup |
| match_predictions | match_id | Prediction by match |
| match_predictions | is_published | Published feed |
| bookmaker_odds | match_id + market + selection | Odds comparison |
| value_bets | ev_percentage (active only) | Value bets ranking |
| tournament_simulations | simulation_run_at | Latest simulation |
| saved_bets | user_id + status | User bet history |
