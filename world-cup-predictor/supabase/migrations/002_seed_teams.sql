-- ============================================================
-- GoalEdge.io — Seed: Teams + Initial Elo Ratings
-- Migration 002
-- ⚠️  VERIFY group assignments against official FIFA draw before launch
-- Elo ratings as of June 2026 (estimated from competitive results)
-- ============================================================

INSERT INTO teams (fifa_code, name, full_name, confederation, flag_emoji, group_letter, is_host_nation) VALUES

-- ── UEFA (Europe) — 16 teams ──────────────────────────────
('FRA', 'France',      'France',              'UEFA', '🇫🇷', 'A', FALSE),
('BRA', 'Brazil',      'Brazil',              'CONMEBOL', '🇧🇷', 'A', FALSE),
('ENG', 'England',     'England',             'UEFA', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'B', FALSE),
('ARG', 'Argentina',   'Argentina',           'CONMEBOL', '🇦🇷', 'B', FALSE),
('ESP', 'Spain',       'Spain',               'UEFA', '🇪🇸', 'C', FALSE),
('GER', 'Germany',     'Germany',             'UEFA', '🇩🇪', 'C', FALSE),
('POR', 'Portugal',    'Portugal',            'UEFA', '🇵🇹', 'D', FALSE),
('NED', 'Netherlands', 'Netherlands',         'UEFA', '🇳🇱', 'D', FALSE),
('BEL', 'Belgium',     'Belgium',             'UEFA', '🇧🇪', 'E', FALSE),
('CRO', 'Croatia',     'Croatia',             'UEFA', '🇭🇷', 'E', FALSE),
('URU', 'Uruguay',     'Uruguay',             'CONMEBOL', '🇺🇾', 'F', FALSE),
('COL', 'Colombia',    'Colombia',            'CONMEBOL', '🇨🇴', 'F', FALSE),
('MAR', 'Morocco',     'Morocco',             'CAF', '🇲🇦', 'G', FALSE),
('SEN', 'Senegal',     'Senegal',             'CAF', '🇸🇳', 'G', FALSE),
('JPN', 'Japan',       'Japan',               'AFC', '🇯🇵', 'H', FALSE),
('KOR', 'South Korea', 'Republic of Korea',   'AFC', '🇰🇷', 'H', FALSE),

-- Host nations
('USA', 'USA',         'United States',       'CONCACAF', '🇺🇸', 'I', TRUE),
('MEX', 'Mexico',      'Mexico',              'CONCACAF', '🇲🇽', 'I', TRUE),
('CAN', 'Canada',      'Canada',              'CONCACAF', '🇨🇦', 'J', TRUE),

-- Remaining qualifiers (⚠️ verify exact group assignments)
('ITA', 'Italy',       'Italy',               'UEFA', '🇮🇹', 'J', FALSE),
('DEN', 'Denmark',     'Denmark',             'UEFA', '🇩🇰', 'K', FALSE),
('AUT', 'Austria',     'Austria',             'UEFA', '🇦🇹', 'K', FALSE),
('SUI', 'Switzerland', 'Switzerland',         'UEFA', '🇨🇭', 'L', FALSE),
('TUR', 'Turkey',      'Turkey',              'UEFA', '🇹🇷', 'L', FALSE),
('SRB', 'Serbia',      'Serbia',              'UEFA', '🇷🇸', 'A', FALSE),
('POL', 'Poland',      'Poland',              'UEFA', '🇵🇱', 'B', FALSE),
('UKR', 'Ukraine',     'Ukraine',             'UEFA', '🇺🇦', 'C', FALSE),
('HUN', 'Hungary',     'Hungary',             'UEFA', '🇭🇺', 'D', FALSE),

-- CONMEBOL
('ECU', 'Ecuador',     'Ecuador',             'CONMEBOL', '🇪🇨', 'E', FALSE),
('PAR', 'Paraguay',    'Paraguay',            'CONMEBOL', '🇵🇾', 'F', FALSE),
('CHI', 'Chile',       'Chile',               'CONMEBOL', '🇨🇱', 'G', FALSE),

-- CONCACAF (non-hosts)
('JAM', 'Jamaica',     'Jamaica',             'CONCACAF', '🇯🇲', 'H', FALSE),
('PAN', 'Panama',      'Panama',              'CONCACAF', '🇵🇦', 'I', FALSE),
('CRC', 'Costa Rica',  'Costa Rica',          'CONCACAF', '🇨🇷', 'J', FALSE),
('HON', 'Honduras',    'Honduras',            'CONCACAF', '🇭🇳', 'K', FALSE),

-- CAF (Africa)
('NGA', 'Nigeria',     'Nigeria',             'CAF', '🇳🇬', 'L', FALSE),
('CMR', 'Cameroon',    'Cameroon',            'CAF', '🇨🇲', 'A', FALSE),
('EGY', 'Egypt',       'Egypt',               'CAF', '🇪🇬', 'B', FALSE),
('GHA', 'Ghana',       'Ghana',               'CAF', '🇬🇭', 'C', FALSE),
('CIV', 'Ivory Coast', 'Côte d''Ivoire',      'CAF', '🇨🇮', 'D', FALSE),
('TUN', 'Tunisia',     'Tunisia',             'CAF', '🇹🇳', 'E', FALSE),
('ALG', 'Algeria',     'Algeria',             'CAF', '🇩🇿', 'F', FALSE),
('RSA', 'South Africa','South Africa',        'CAF', '🇿🇦', 'G', FALSE),
('MAL', 'Mali',        'Mali',                'CAF', '🇲🇱', 'H', FALSE),

-- AFC (Asia)
('SAU', 'Saudi Arabia','Saudi Arabia',        'AFC', '🇸🇦', 'I', FALSE),
('IRN', 'Iran',        'Iran',                'AFC', '🇮🇷', 'J', FALSE),
('AUS', 'Australia',   'Australia',           'AFC', '🇦🇺', 'K', FALSE),
('IRQ', 'Iraq',        'Iraq',                'AFC', '🇮🇶', 'L', FALSE),
('QAT', 'Qatar',       'Qatar',               'AFC', '🇶🇦', 'A', FALSE),

-- OFC
('NZL', 'New Zealand', 'New Zealand',         'OFC', '🇳🇿', 'B', FALSE);


-- ============================================================
-- INITIAL ELO RATINGS (June 2026)
-- Based on competitive results 2022–2026
-- ⚠️  Update with final pre-tournament ratings from model run
-- ============================================================

INSERT INTO team_ratings (team_id, rating_date, elo_rating, attack_strength, defence_strength, form_score, avg_xg_scored, avg_xg_conceded, notes)
SELECT
  t.id,
  '2026-06-02'::DATE,
  er.elo,
  er.atk,
  er.def,
  er.form,
  er.xg_for,
  er.xg_ag,
  'Initial seed — verify and recalculate before first match'
FROM teams t
JOIN (VALUES
  -- (fifa_code, elo,    atk,   def,   form,  xg_for, xg_ag)
  ('FRA', 2055.00, 1.35,  0.72,  0.78,  1.85,  0.92),
  ('ARG', 2045.00, 1.32,  0.75,  0.81,  1.82,  0.88),
  ('BRA', 2020.00, 1.28,  0.78,  0.76,  1.78,  0.95),
  ('ENG', 1995.00, 1.22,  0.80,  0.74,  1.68,  0.98),
  ('ESP', 1985.00, 1.20,  0.82,  0.72,  1.65,  1.02),
  ('GER', 1970.00, 1.18,  0.85,  0.70,  1.62,  1.05),
  ('POR', 1960.00, 1.25,  0.78,  0.73,  1.75,  0.96),
  ('NED', 1940.00, 1.15,  0.86,  0.68,  1.55,  1.08),
  ('BEL', 1905.00, 1.10,  0.90,  0.65,  1.48,  1.12),
  ('CRO', 1885.00, 1.05,  0.92,  0.64,  1.42,  1.14),
  ('URU', 1875.00, 1.08,  0.88,  0.66,  1.45,  1.10),
  ('COL', 1860.00, 1.06,  0.91,  0.63,  1.40,  1.16),
  ('ITA', 1855.00, 1.02,  0.95,  0.62,  1.35,  1.18),
  ('DEN', 1840.00, 0.98,  0.98,  0.61,  1.28,  1.20),
  ('MAR', 1835.00, 0.92,  0.96,  0.62,  1.22,  1.15),
  ('SUI', 1820.00, 0.95,  0.97,  0.60,  1.25,  1.22),
  ('USA', 1815.00, 0.96,  0.96,  0.60,  1.26,  1.21),
  ('MEX', 1805.00, 0.93,  0.99,  0.59,  1.20,  1.25),
  ('SEN', 1800.00, 0.90,  1.01,  0.58,  1.18,  1.28),
  ('AUT', 1798.00, 0.88,  1.02,  0.58,  1.15,  1.30),
  ('TUR', 1790.00, 0.87,  1.03,  0.57,  1.12,  1.32),
  ('JPN', 1788.00, 0.86,  1.04,  0.57,  1.10,  1.34),
  ('CAN', 1782.00, 0.85,  1.05,  0.56,  1.08,  1.36),
  ('SRB', 1775.00, 0.84,  1.06,  0.56,  1.06,  1.38),
  ('POL', 1768.00, 0.83,  1.07,  0.55,  1.04,  1.40),
  ('KOR', 1762.00, 0.82,  1.08,  0.55,  1.02,  1.42),
  ('ECU', 1748.00, 0.80,  1.10,  0.54,  0.98,  1.45),
  ('UKR', 1745.00, 0.79,  1.11,  0.53,  0.96,  1.47),
  ('COL', 1860.00, 1.06,  0.91,  0.63,  1.40,  1.16),
  ('IRN', 1720.00, 0.75,  1.15,  0.52,  0.88,  1.52),
  ('SAU', 1715.00, 0.74,  1.16,  0.51,  0.86,  1.54),
  ('NGA', 1710.00, 0.73,  1.17,  0.51,  0.84,  1.56),
  ('AUS', 1705.00, 0.72,  1.18,  0.50,  0.82,  1.58),
  ('HUN', 1700.00, 0.71,  1.19,  0.50,  0.80,  1.60),
  ('CHI', 1695.00, 0.70,  1.20,  0.49,  0.78,  1.62),
  ('CMR', 1688.00, 0.69,  1.21,  0.49,  0.76,  1.64),
  ('EGY', 1682.00, 0.68,  1.22,  0.48,  0.74,  1.66),
  ('PAR', 1675.00, 0.67,  1.23,  0.48,  0.72,  1.68),
  ('GHA', 1668.00, 0.66,  1.24,  0.47,  0.70,  1.70),
  ('CIV', 1662.00, 0.65,  1.25,  0.47,  0.68,  1.72),
  ('TUN', 1655.00, 0.64,  1.26,  0.46,  0.66,  1.74),
  ('ALG', 1648.00, 0.63,  1.27,  0.46,  0.64,  1.76),
  ('IRQ', 1640.00, 0.62,  1.28,  0.45,  0.62,  1.78),
  ('RSA', 1635.00, 0.61,  1.29,  0.45,  0.60,  1.80),
  ('CRC', 1625.00, 0.60,  1.30,  0.44,  0.58,  1.82),
  ('PAN', 1618.00, 0.59,  1.31,  0.44,  0.56,  1.84),
  ('JAM', 1610.00, 0.58,  1.32,  0.43,  0.54,  1.86),
  ('HON', 1600.00, 0.57,  1.33,  0.43,  0.52,  1.88),
  ('MAL', 1590.00, 0.56,  1.34,  0.42,  0.50,  1.90),
  ('QAT', 1582.00, 0.55,  1.35,  0.42,  0.48,  1.92),
  ('NZL', 1570.00, 0.52,  1.38,  0.40,  0.44,  1.98),
  ('CHI', 1695.00, 0.70,  1.20,  0.49,  0.78,  1.62)
) AS er(fifa_code, elo, atk, def, form, xg_for, xg_ag)
  ON t.fifa_code = er.fifa_code
ON CONFLICT (team_id, rating_date) DO UPDATE
  SET elo_rating = EXCLUDED.elo_rating,
      attack_strength = EXCLUDED.attack_strength,
      defence_strength = EXCLUDED.defence_strength,
      form_score = EXCLUDED.form_score,
      avg_xg_scored = EXCLUDED.avg_xg_scored,
      avg_xg_conceded = EXCLUDED.avg_xg_conceded;
