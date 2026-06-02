-- ============================================================
-- GoalEdge.io — World Cup 2026 Betting Predictor
-- Migration 001: Initial Schema
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TEAMS
-- ============================================================
CREATE TABLE teams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fifa_code       VARCHAR(3)  UNIQUE NOT NULL,
  name            VARCHAR(100) NOT NULL,
  full_name       VARCHAR(150),
  confederation   VARCHAR(10) NOT NULL
    CHECK (confederation IN ('UEFA','CONMEBOL','CONCACAF','CAF','AFC','OFC')),
  flag_emoji      VARCHAR(10),
  group_letter    CHAR(1),
  is_host_nation  BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TEAM RATINGS  (versioned by date — never overwrite)
-- ============================================================
CREATE TABLE team_ratings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id          UUID NOT NULL REFERENCES teams(id),
  rating_date      DATE NOT NULL,
  elo_rating       NUMERIC(7,2) NOT NULL,
  attack_strength  NUMERIC(6,4) NOT NULL DEFAULT 1.0,
  defence_strength NUMERIC(6,4) NOT NULL DEFAULT 1.0,
  form_score       NUMERIC(6,4) NOT NULL DEFAULT 0.5,
  avg_xg_scored    NUMERIC(5,3),
  avg_xg_conceded  NUMERIC(5,3),
  matches_used     INT DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, rating_date)
);

CREATE INDEX idx_team_ratings_team_date ON team_ratings (team_id, rating_date DESC);

-- ============================================================
-- PLAYERS
-- ============================================================
CREATE TABLE players (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES teams(id),
  name            VARCHAR(100) NOT NULL,
  position        VARCHAR(5) CHECK (position IN ('GK','DEF','MID','FWD')),
  shirt_number    SMALLINT,
  club            VARCHAR(100),
  age             SMALLINT,
  caps            SMALLINT DEFAULT 0,
  int_goals       SMALLINT DEFAULT 0,
  is_key_player   BOOLEAN DEFAULT FALSE,
  impact_score    NUMERIC(4,3) DEFAULT 0.0
    CHECK (impact_score BETWEEN 0 AND 1),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_players_team ON players (team_id);

-- ============================================================
-- MATCHES
-- ============================================================
CREATE TABLE matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_number    SMALLINT UNIQUE,
  stage           VARCHAR(20) NOT NULL
    CHECK (stage IN ('group','round_of_32','round_of_16','quarter_final',
                     'semi_final','third_place','final')),
  group_letter    CHAR(1),
  home_team_id    UUID NOT NULL REFERENCES teams(id),
  away_team_id    UUID NOT NULL REFERENCES teams(id),
  CHECK (home_team_id <> away_team_id),
  venue           VARCHAR(120),
  city            VARCHAR(80),
  country         VARCHAR(60),
  kickoff_utc     TIMESTAMPTZ NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','live','completed','postponed','cancelled')),
  home_score      SMALLINT,
  away_score      SMALLINT,
  home_score_et   SMALLINT,
  away_score_et   SMALLINT,
  home_score_pen  SMALLINT,
  away_score_pen  SMALLINT,
  attendance      INT,
  api_fixture_id  INT,           -- API-Football fixture id for ingestion
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_matches_kickoff   ON matches (kickoff_utc);
CREATE INDEX idx_matches_status    ON matches (status);
CREATE INDEX idx_matches_stage     ON matches (stage);
CREATE INDEX idx_matches_teams     ON matches (home_team_id, away_team_id);

-- ============================================================
-- PLAYER AVAILABILITY
-- ============================================================
CREATE TABLE player_availability (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID NOT NULL REFERENCES players(id),
  match_id        UUID NOT NULL REFERENCES matches(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','doubtful','injured','suspended','confirmed_out')),
  confidence      VARCHAR(15) DEFAULT 'assumed'
    CHECK (confidence IN ('confirmed','rumoured','assumed')),
  impact_on_team  NUMERIC(4,3) DEFAULT 0.0,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (player_id, match_id)
);

-- ============================================================
-- HEAD TO HEAD
-- ============================================================
CREATE TABLE head_to_head (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_a_id       UUID NOT NULL REFERENCES teams(id),
  team_b_id       UUID NOT NULL REFERENCES teams(id),
  match_date      DATE NOT NULL,
  competition     VARCHAR(100),
  stage           VARCHAR(50),
  team_a_score    SMALLINT NOT NULL,
  team_b_score    SMALLINT NOT NULL,
  venue_type      VARCHAR(20) DEFAULT 'neutral'
    CHECK (venue_type IN ('neutral','team_a_home','team_b_home')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_h2h_teams_date ON head_to_head (team_a_id, team_b_id, match_date DESC);
CREATE INDEX idx_h2h_reverse    ON head_to_head (team_b_id, team_a_id, match_date DESC);

-- ============================================================
-- MATCH PREDICTIONS  (append-only, never UPDATE)
-- ============================================================
CREATE TABLE match_predictions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id                UUID NOT NULL REFERENCES matches(id),
  version                 SMALLINT NOT NULL DEFAULT 1,
  is_published            BOOLEAN DEFAULT FALSE,
  published_at            TIMESTAMPTZ,
  is_locked               BOOLEAN DEFAULT FALSE,
  locked_at               TIMESTAMPTZ,

  -- Model snapshot at prediction time
  home_elo                NUMERIC(7,2),
  away_elo                NUMERIC(7,2),
  home_attack             NUMERIC(6,4),
  home_defence            NUMERIC(6,4),
  away_attack             NUMERIC(6,4),
  away_defence            NUMERIC(6,4),
  home_form               NUMERIC(6,4),
  away_form               NUMERIC(6,4),
  lambda_home             NUMERIC(6,4),   -- Dixon-Coles expected goals home
  lambda_away             NUMERIC(6,4),   -- Dixon-Coles expected goals away
  rho                     NUMERIC(6,4) DEFAULT -0.13,

  -- 1X2
  prob_home_win           NUMERIC(7,6) NOT NULL CHECK (prob_home_win BETWEEN 0 AND 1),
  prob_draw               NUMERIC(7,6) NOT NULL CHECK (prob_draw BETWEEN 0 AND 1),
  prob_away_win           NUMERIC(7,6) NOT NULL CHECK (prob_away_win BETWEEN 0 AND 1),
  fair_odds_home          NUMERIC(7,3),
  fair_odds_draw          NUMERIC(7,3),
  fair_odds_away          NUMERIC(7,3),

  -- Goals
  expected_goals_home     NUMERIC(5,3),
  expected_goals_away     NUMERIC(5,3),
  prob_over_15            NUMERIC(7,6),
  prob_over_25            NUMERIC(7,6),
  prob_over_35            NUMERIC(7,6),
  prob_btts_yes           NUMERIC(7,6),
  fair_odds_over_25       NUMERIC(7,3),
  fair_odds_under_25      NUMERIC(7,3),
  fair_odds_btts_yes      NUMERIC(7,3),
  fair_odds_btts_no       NUMERIC(7,3),

  -- Confidence
  confidence_score        NUMERIC(5,2) CHECK (confidence_score BETWEEN 0 AND 100),
  confidence_factors      JSONB,
  data_quality_score      NUMERIC(5,2),
  model_agreement_score   NUMERIC(5,2),

  -- Narrative (AI-generated)
  summary_text            TEXT,
  key_factors             JSONB,
  narrative_generated_at  TIMESTAMPTZ,

  created_at              TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (match_id, version),
  CONSTRAINT probs_sum_to_one CHECK (
    ABS((prob_home_win + prob_draw + prob_away_win) - 1.0) < 0.001
  )
);

CREATE INDEX idx_predictions_match      ON match_predictions (match_id, version DESC);
CREATE INDEX idx_predictions_published  ON match_predictions (is_published, published_at DESC);
CREATE INDEX idx_predictions_locked     ON match_predictions (is_locked);

-- ============================================================
-- BOOKMAKER ODDS
-- ============================================================
CREATE TABLE bookmaker_odds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        UUID NOT NULL REFERENCES matches(id),
  bookmaker       VARCHAR(50) NOT NULL,
  market          VARCHAR(20) NOT NULL
    CHECK (market IN ('1x2','over_15','under_15','over_25','under_25',
                      'over_35','under_35','btts_yes','btts_no',
                      'home_win','draw','away_win')),
  selection       VARCHAR(20) NOT NULL,
  decimal_odds    NUMERIC(8,3) NOT NULL CHECK (decimal_odds > 1.0),
  implied_prob    NUMERIC(7,6) GENERATED ALWAYS AS (1.0 / decimal_odds) STORED,
  is_best_odds    BOOLEAN DEFAULT FALSE,
  odds_timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_odds_match_market ON bookmaker_odds (match_id, market, selection, odds_timestamp DESC);
CREATE INDEX idx_odds_bookmaker    ON bookmaker_odds (bookmaker, match_id);

-- ============================================================
-- VALUE BETS  (recalculated on every odds refresh)
-- ============================================================
CREATE TABLE value_bets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id            UUID NOT NULL REFERENCES matches(id),
  prediction_id       UUID NOT NULL REFERENCES match_predictions(id),
  odds_id             UUID NOT NULL REFERENCES bookmaker_odds(id),
  market              VARCHAR(20) NOT NULL,
  selection           VARCHAR(20) NOT NULL,
  bookmaker           VARCHAR(50) NOT NULL,
  our_probability     NUMERIC(7,6) NOT NULL,
  market_probability  NUMERIC(7,6) NOT NULL,
  decimal_odds        NUMERIC(8,3) NOT NULL,
  ev_percentage       NUMERIC(7,3) NOT NULL,
  edge_percentage     NUMERIC(7,3) NOT NULL,
  confidence_score    NUMERIC(5,2),
  kelly_fraction      NUMERIC(7,6),
  half_kelly          NUMERIC(7,6),
  quarter_kelly       NUMERIC(7,6),
  is_active           BOOLEAN DEFAULT TRUE,
  ev_tier             VARCHAR(15) GENERATED ALWAYS AS (
    CASE
      WHEN ev_percentage >= 15 THEN 'exceptional'
      WHEN ev_percentage >= 8  THEN 'strong'
      WHEN ev_percentage >= 3  THEN 'marginal'
      ELSE 'below_threshold'
    END
  ) STORED,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vb_ev_active   ON value_bets (ev_percentage DESC) WHERE is_active = TRUE;
CREATE INDEX idx_vb_match       ON value_bets (match_id, is_active);
CREATE INDEX idx_vb_tier        ON value_bets (ev_tier, is_active);

-- ============================================================
-- TOURNAMENT SIMULATIONS
-- ============================================================
CREATE TABLE tournament_simulations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  iterations            INT NOT NULL DEFAULT 100000,
  team_id               UUID NOT NULL REFERENCES teams(id),
  prob_exit_groups      NUMERIC(7,6),
  prob_qualify_groups   NUMERIC(7,6),
  prob_reach_r32        NUMERIC(7,6),
  prob_reach_r16        NUMERIC(7,6),
  prob_reach_qf         NUMERIC(7,6),
  prob_reach_sf         NUMERIC(7,6),
  prob_reach_final      NUMERIC(7,6),
  prob_win_tournament   NUMERIC(7,6),
  expected_goals_for    NUMERIC(5,2),
  fair_outright_odds    NUMERIC(8,3),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sims_run_at ON tournament_simulations (run_at DESC);
CREATE INDEX idx_sims_team   ON tournament_simulations (team_id, run_at DESC);

-- ============================================================
-- PREDICTION RESULTS (locked records — written after match)
-- ============================================================
CREATE TABLE prediction_results (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id            UUID NOT NULL UNIQUE REFERENCES match_predictions(id),
  match_id                 UUID NOT NULL REFERENCES matches(id),
  actual_home_score        SMALLINT NOT NULL,
  actual_away_score        SMALLINT NOT NULL,
  actual_outcome           VARCHAR(10) NOT NULL
    CHECK (actual_outcome IN ('home','draw','away')),
  actual_over_25           BOOLEAN NOT NULL,
  actual_btts              BOOLEAN NOT NULL,
  prob_given_to_outcome    NUMERIC(7,6),
  log_loss_1x2             NUMERIC(12,10),
  brier_score_1x2          NUMERIC(12,10),
  brier_score_goals        NUMERIC(12,10),
  was_value_bet            BOOLEAN DEFAULT FALSE,
  value_bet_won            BOOLEAN,
  pnl_1x2_1unit            NUMERIC(8,3),
  pnl_over25_1unit         NUMERIC(8,3),
  pnl_btts_1unit           NUMERIC(8,3),
  recorded_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USER PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE user_profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username          VARCHAR(50) UNIQUE,
  display_name      VARCHAR(100),
  subscription      VARCHAR(20) DEFAULT 'free'
    CHECK (subscription IN ('free','premium','pro')),
  subscription_ends TIMESTAMPTZ,
  stripe_customer_id VARCHAR(100) UNIQUE,
  timezone          VARCHAR(60) DEFAULT 'UTC',
  odds_format       VARCHAR(15) DEFAULT 'decimal'
    CHECK (odds_format IN ('decimal','fractional','american')),
  affiliate_ref     VARCHAR(50),    -- which affiliate link brought them in
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SAVED BETS (user bet tracker)
-- ============================================================
CREATE TABLE saved_bets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  match_id         UUID REFERENCES matches(id),
  market           VARCHAR(20) NOT NULL,
  selection        VARCHAR(30) NOT NULL,
  bookmaker        VARCHAR(50),
  decimal_odds     NUMERIC(8,3) NOT NULL CHECK (decimal_odds > 1.0),
  stake            NUMERIC(10,2) NOT NULL CHECK (stake > 0),
  potential_return NUMERIC(10,2) GENERATED ALWAYS AS (stake * decimal_odds) STORED,
  status           VARCHAR(20) DEFAULT 'open'
    CHECK (status IN ('open','won','lost','void','cashed_out')),
  profit_loss      NUMERIC(10,2),
  our_ev_at_time   NUMERIC(7,3),
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  settled_at       TIMESTAMPTZ
);

CREATE INDEX idx_saved_bets_user   ON saved_bets (user_id, status, created_at DESC);
CREATE INDEX idx_saved_bets_match  ON saved_bets (match_id);

-- ============================================================
-- DATABASE FUNCTIONS
-- ============================================================

-- Auto-lock predictions when match goes live
CREATE OR REPLACE FUNCTION lock_predictions_at_kickoff()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'live' AND OLD.status = 'scheduled' THEN
    UPDATE match_predictions
    SET is_locked = TRUE, locked_at = NOW()
    WHERE match_id = NEW.id
      AND is_published = TRUE
      AND is_locked = FALSE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lock_predictions
  AFTER UPDATE OF status ON matches
  FOR EACH ROW EXECUTE FUNCTION lock_predictions_at_kickoff();

-- Auto-calculate Kelly on value_bets insert/update
CREATE OR REPLACE FUNCTION calc_kelly_fractions()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  b NUMERIC;
BEGIN
  b := NEW.decimal_odds - 1.0;
  IF b > 0 THEN
    NEW.kelly_fraction  := GREATEST(0, (b * NEW.our_probability - (1 - NEW.our_probability)) / b);
    NEW.half_kelly      := NEW.kelly_fraction / 2;
    NEW.quarter_kelly   := NEW.kelly_fraction / 4;
  ELSE
    NEW.kelly_fraction  := 0;
    NEW.half_kelly      := 0;
    NEW.quarter_kelly   := 0;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kelly_calc
  BEFORE INSERT OR UPDATE ON value_bets
  FOR EACH ROW EXECUTE FUNCTION calc_kelly_fractions();

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_teams_updated_at
  BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_players_updated_at
  BEFORE UPDATE ON players FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_matches_updated_at
  BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vb_updated_at
  BEFORE UPDATE ON value_bets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- VIEWS
-- ============================================================

-- Latest team ratings
CREATE VIEW v_latest_team_ratings AS
SELECT DISTINCT ON (team_id)
  tr.*,
  t.name AS team_name,
  t.fifa_code,
  t.flag_emoji,
  t.confederation,
  t.group_letter
FROM team_ratings tr
JOIN teams t ON t.id = tr.team_id
ORDER BY team_id, rating_date DESC;

-- Active value bets with match info
CREATE VIEW v_active_value_bets AS
SELECT
  vb.*,
  m.kickoff_utc,
  m.stage,
  m.group_letter,
  m.status AS match_status,
  ht.name  AS home_team_name,
  ht.fifa_code AS home_code,
  ht.flag_emoji AS home_flag,
  at.name  AS away_team_name,
  at.fifa_code AS away_code,
  at.flag_emoji AS away_flag
FROM value_bets vb
JOIN matches m ON m.id = vb.match_id
JOIN teams ht  ON ht.id = m.home_team_id
JOIN teams at  ON at.id = m.away_team_id
WHERE vb.is_active = TRUE
  AND m.status = 'scheduled'
  AND m.kickoff_utc > NOW()
ORDER BY vb.ev_percentage DESC;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE teams                ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_ratings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE players              ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_availability  ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches              ENABLE ROW LEVEL SECURITY;
ALTER TABLE head_to_head         ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_predictions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmaker_odds       ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_bets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_results   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_bets           ENABLE ROW LEVEL SECURITY;

-- Public read on reference/prediction data
CREATE POLICY "public_read_teams"      ON teams FOR SELECT USING (TRUE);
CREATE POLICY "public_read_ratings"    ON team_ratings FOR SELECT USING (TRUE);
CREATE POLICY "public_read_players"    ON players FOR SELECT USING (TRUE);
CREATE POLICY "public_read_avail"      ON player_availability FOR SELECT USING (TRUE);
CREATE POLICY "public_read_matches"    ON matches FOR SELECT USING (TRUE);
CREATE POLICY "public_read_h2h"        ON head_to_head FOR SELECT USING (TRUE);
CREATE POLICY "public_read_odds"       ON bookmaker_odds FOR SELECT USING (TRUE);
CREATE POLICY "public_read_sims"       ON tournament_simulations FOR SELECT USING (TRUE);
CREATE POLICY "public_read_results"    ON prediction_results FOR SELECT USING (TRUE);

-- Predictions: only published ones public
CREATE POLICY "public_read_predictions" ON match_predictions
  FOR SELECT USING (is_published = TRUE);

-- Value bets: only active ones public
CREATE POLICY "public_read_value_bets" ON value_bets
  FOR SELECT USING (is_active = TRUE);

-- User profiles: own row only
CREATE POLICY "users_own_profile" ON user_profiles
  USING (auth.uid() = id);

-- Saved bets: own rows only
CREATE POLICY "users_own_bets" ON saved_bets
  USING (auth.uid() = user_id);
