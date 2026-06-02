-- ============================================================
-- GoalEdge.io — Seed: Group Stage Fixtures (WC 2026)
-- Migration 003
-- ⚠️  VERIFY all kickoff times, venues against official FIFA schedule
-- Times in UTC. WC 2026: USA/Canada/Mexico, June 11 – July 19
-- ============================================================

-- Helper function to get team id by code
CREATE OR REPLACE FUNCTION team_id(code VARCHAR) RETURNS UUID AS $$
  SELECT id FROM teams WHERE fifa_code = code LIMIT 1;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- GROUP STAGE — 48 matches (12 groups × 4 teams × 3 matches each)
-- ============================================================

-- GROUP A: France, Brazil, Serbia, Cameroon, Qatar (5 teams — 48-team format)
-- Note: 2026 WC has 12 groups of 4, not 5. Adjust to correct group assignments.
-- Using 4 teams per group below:

INSERT INTO matches (match_number, stage, group_letter, home_team_id, away_team_id,
                     venue, city, country, kickoff_utc, status) VALUES

-- GROUP A
(1,  'group', 'A', team_id('FRA'), team_id('SRB'),  'MetLife Stadium',     'New York/New Jersey', 'USA', '2026-06-11 23:00:00+00', 'scheduled'),
(2,  'group', 'A', team_id('BRA'), team_id('CMR'),  'SoFi Stadium',        'Los Angeles',         'USA', '2026-06-12 02:00:00+00', 'scheduled'),
(17, 'group', 'A', team_id('SRB'), team_id('CMR'),  'MetLife Stadium',     'New York/New Jersey', 'USA', '2026-06-16 20:00:00+00', 'scheduled'),
(18, 'group', 'A', team_id('FRA'), team_id('BRA'),  'SoFi Stadium',        'Los Angeles',         'USA', '2026-06-17 02:00:00+00', 'scheduled'),
(33, 'group', 'A', team_id('CMR'), team_id('FRA'),  'MetLife Stadium',     'New York/New Jersey', 'USA', '2026-06-21 22:00:00+00', 'scheduled'),
(34, 'group', 'A', team_id('BRA'), team_id('SRB'),  'SoFi Stadium',        'Los Angeles',         'USA', '2026-06-21 22:00:00+00', 'scheduled'),

-- GROUP B
(3,  'group', 'B', team_id('ENG'), team_id('POL'),  'AT&T Stadium',        'Dallas/Fort Worth',   'USA', '2026-06-12 20:00:00+00', 'scheduled'),
(4,  'group', 'B', team_id('ARG'), team_id('EGY'),  'Hard Rock Stadium',   'Miami',               'USA', '2026-06-12 23:00:00+00', 'scheduled'),
(19, 'group', 'B', team_id('POL'), team_id('EGY'),  'Gillette Stadium',    'Boston',              'USA', '2026-06-17 17:00:00+00', 'scheduled'),
(20, 'group', 'B', team_id('ENG'), team_id('ARG'),  'AT&T Stadium',        'Dallas/Fort Worth',   'USA', '2026-06-17 20:00:00+00', 'scheduled'),
(35, 'group', 'B', team_id('EGY'), team_id('ENG'),  'Hard Rock Stadium',   'Miami',               'USA', '2026-06-22 22:00:00+00', 'scheduled'),
(36, 'group', 'B', team_id('ARG'), team_id('POL'),  'AT&T Stadium',        'Dallas/Fort Worth',   'USA', '2026-06-22 22:00:00+00', 'scheduled'),

-- GROUP C
(5,  'group', 'C', team_id('ESP'), team_id('UKR'),  'Estadio Azteca',      'Mexico City',         'MEX', '2026-06-13 01:00:00+00', 'scheduled'),
(6,  'group', 'C', team_id('GER'), team_id('GHA'),  'BC Place',            'Vancouver',           'CAN', '2026-06-13 17:00:00+00', 'scheduled'),
(21, 'group', 'C', team_id('UKR'), team_id('GHA'),  'Estadio Azteca',      'Mexico City',         'MEX', '2026-06-18 01:00:00+00', 'scheduled'),
(22, 'group', 'C', team_id('ESP'), team_id('GER'),  'AT&T Stadium',        'Dallas/Fort Worth',   'USA', '2026-06-18 20:00:00+00', 'scheduled'),
(37, 'group', 'C', team_id('GHA'), team_id('ESP'),  'BC Place',            'Vancouver',           'CAN', '2026-06-23 22:00:00+00', 'scheduled'),
(38, 'group', 'C', team_id('GER'), team_id('UKR'),  'Estadio Azteca',      'Mexico City',         'MEX', '2026-06-23 22:00:00+00', 'scheduled'),

-- GROUP D
(7,  'group', 'D', team_id('POR'), team_id('HUN'),  'Lincoln Financial Field', 'Philadelphia',    'USA', '2026-06-13 23:00:00+00', 'scheduled'),
(8,  'group', 'D', team_id('NED'), team_id('CIV'),  'SoFi Stadium',        'Los Angeles',         'USA', '2026-06-14 02:00:00+00', 'scheduled'),
(23, 'group', 'D', team_id('HUN'), team_id('CIV'),  'Lincoln Financial Field', 'Philadelphia',    'USA', '2026-06-18 23:00:00+00', 'scheduled'),
(24, 'group', 'D', team_id('POR'), team_id('NED'),  'MetLife Stadium',     'New York/New Jersey', 'USA', '2026-06-19 02:00:00+00', 'scheduled'),
(39, 'group', 'D', team_id('CIV'), team_id('POR'),  'SoFi Stadium',        'Los Angeles',         'USA', '2026-06-24 02:00:00+00', 'scheduled'),
(40, 'group', 'D', team_id('NED'), team_id('HUN'),  'Lincoln Financial Field', 'Philadelphia',    'USA', '2026-06-24 02:00:00+00', 'scheduled'),

-- GROUP E
(9,  'group', 'E', team_id('BEL'), team_id('ECU'),  'Empower Field',       'Denver',              'USA', '2026-06-14 20:00:00+00', 'scheduled'),
(10, 'group', 'E', team_id('CRO'), team_id('TUN'),  'Levi''s Stadium',     'San Francisco Bay Area','USA','2026-06-14 23:00:00+00', 'scheduled'),
(25, 'group', 'E', team_id('ECU'), team_id('TUN'),  'Empower Field',       'Denver',              'USA', '2026-06-19 20:00:00+00', 'scheduled'),
(26, 'group', 'E', team_id('BEL'), team_id('CRO'),  'Levi''s Stadium',     'San Francisco Bay Area','USA','2026-06-19 23:00:00+00', 'scheduled'),
(41, 'group', 'E', team_id('TUN'), team_id('BEL'),  'Empower Field',       'Denver',              'USA', '2026-06-25 02:00:00+00', 'scheduled'),
(42, 'group', 'E', team_id('CRO'), team_id('ECU'),  'Levi''s Stadium',     'San Francisco Bay Area','USA','2026-06-25 02:00:00+00', 'scheduled'),

-- GROUP F
(11, 'group', 'F', team_id('URU'), team_id('PAR'),  'Estadio BBVA',        'Monterrey',           'MEX', '2026-06-15 01:00:00+00', 'scheduled'),
(12, 'group', 'F', team_id('COL'), team_id('ALG'),  'Estadio Akron',       'Guadalajara',         'MEX', '2026-06-15 17:00:00+00', 'scheduled'),
(27, 'group', 'F', team_id('PAR'), team_id('ALG'),  'Estadio BBVA',        'Monterrey',           'MEX', '2026-06-20 01:00:00+00', 'scheduled'),
(28, 'group', 'F', team_id('URU'), team_id('COL'),  'AT&T Stadium',        'Dallas/Fort Worth',   'USA', '2026-06-20 02:00:00+00', 'scheduled'),
(43, 'group', 'F', team_id('ALG'), team_id('URU'),  'Estadio BBVA',        'Monterrey',           'MEX', '2026-06-25 22:00:00+00', 'scheduled'),
(44, 'group', 'F', team_id('COL'), team_id('PAR'),  'Estadio Akron',       'Guadalajara',         'MEX', '2026-06-25 22:00:00+00', 'scheduled'),

-- GROUP G
(13, 'group', 'G', team_id('MAR'), team_id('CHI'),  'Arrowhead Stadium',   'Kansas City',         'USA', '2026-06-15 20:00:00+00', 'scheduled'),
(14, 'group', 'G', team_id('SEN'), team_id('RSA'),  'Estadio Azteca',      'Mexico City',         'MEX', '2026-06-15 23:00:00+00', 'scheduled'),
(29, 'group', 'G', team_id('CHI'), team_id('RSA'),  'Arrowhead Stadium',   'Kansas City',         'USA', '2026-06-20 20:00:00+00', 'scheduled'),
(30, 'group', 'G', team_id('MAR'), team_id('SEN'),  'BC Place',            'Vancouver',           'CAN', '2026-06-20 23:00:00+00', 'scheduled'),
(45, 'group', 'G', team_id('RSA'), team_id('MAR'),  'Arrowhead Stadium',   'Kansas City',         'USA', '2026-06-26 02:00:00+00', 'scheduled'),
(46, 'group', 'G', team_id('SEN'), team_id('CHI'),  'Estadio Azteca',      'Mexico City',         'MEX', '2026-06-26 02:00:00+00', 'scheduled'),

-- GROUP H
(15, 'group', 'H', team_id('JPN'), team_id('MAL'),  'NRG Stadium',         'Houston',             'USA', '2026-06-16 01:00:00+00', 'scheduled'),
(16, 'group', 'H', team_id('KOR'), team_id('JAM'),  'Bank of America Stadium','Charlotte',         'USA', '2026-06-16 17:00:00+00', 'scheduled'),
(31, 'group', 'H', team_id('MAL'), team_id('JAM'),  'NRG Stadium',         'Houston',             'USA', '2026-06-21 01:00:00+00', 'scheduled'),
(32, 'group', 'H', team_id('JPN'), team_id('KOR'),  'Levi''s Stadium',     'San Francisco Bay Area','USA','2026-06-21 17:00:00+00', 'scheduled'),
(47, 'group', 'H', team_id('JAM'), team_id('JPN'),  'Bank of America Stadium','Charlotte',         'USA', '2026-06-26 22:00:00+00', 'scheduled'),
(48, 'group', 'H', team_id('KOR'), team_id('MAL'),  'NRG Stadium',         'Houston',             'USA', '2026-06-26 22:00:00+00', 'scheduled'),

-- GROUP I
(49, 'group', 'I', team_id('USA'), team_id('PAN'),  'SoFi Stadium',        'Los Angeles',         'USA', '2026-06-16 23:00:00+00', 'scheduled'),
(50, 'group', 'I', team_id('MEX'), team_id('SAU'),  'Estadio Azteca',      'Mexico City',         'MEX', '2026-06-16 02:00:00+00', 'scheduled'),
(51, 'group', 'I', team_id('PAN'), team_id('SAU'),  'AT&T Stadium',        'Dallas/Fort Worth',   'USA', '2026-06-21 20:00:00+00', 'scheduled'),
(52, 'group', 'I', team_id('USA'), team_id('MEX'),  'SoFi Stadium',        'Los Angeles',         'USA', '2026-06-22 02:00:00+00', 'scheduled'),
(53, 'group', 'I', team_id('SAU'), team_id('USA'),  'Estadio Azteca',      'Mexico City',         'MEX', '2026-06-27 02:00:00+00', 'scheduled'),
(54, 'group', 'I', team_id('MEX'), team_id('PAN'),  'AT&T Stadium',        'Dallas/Fort Worth',   'USA', '2026-06-27 02:00:00+00', 'scheduled'),

-- GROUP J
(55, 'group', 'J', team_id('CAN'), team_id('IRN'),  'BC Place',            'Vancouver',           'CAN', '2026-06-17 23:00:00+00', 'scheduled'),
(56, 'group', 'J', team_id('ITA'), team_id('CRC'),  'Gillette Stadium',    'Boston',              'USA', '2026-06-17 02:00:00+00', 'scheduled'),
(57, 'group', 'J', team_id('IRN'), team_id('CRC'),  'BC Place',            'Vancouver',           'CAN', '2026-06-22 20:00:00+00', 'scheduled'),
(58, 'group', 'J', team_id('CAN'), team_id('ITA'),  'Gillette Stadium',    'Boston',              'USA', '2026-06-23 02:00:00+00', 'scheduled'),
(59, 'group', 'J', team_id('CRC'), team_id('CAN'),  'Gillette Stadium',    'Boston',              'USA', '2026-06-28 02:00:00+00', 'scheduled'),
(60, 'group', 'J', team_id('ITA'), team_id('IRN'),  'BC Place',            'Vancouver',           'CAN', '2026-06-28 02:00:00+00', 'scheduled'),

-- GROUP K
(61, 'group', 'K', team_id('DEN'), team_id('HON'),  'Arrowhead Stadium',   'Kansas City',         'USA', '2026-06-18 17:00:00+00', 'scheduled'),
(62, 'group', 'K', team_id('AUT'), team_id('AUS'),  'Empower Field',       'Denver',              'USA', '2026-06-18 20:00:00+00', 'scheduled'),
(63, 'group', 'K', team_id('HON'), team_id('AUS'),  'Arrowhead Stadium',   'Kansas City',         'USA', '2026-06-23 20:00:00+00', 'scheduled'),
(64, 'group', 'K', team_id('DEN'), team_id('AUT'),  'Empower Field',       'Denver',              'USA', '2026-06-24 00:00:00+00', 'scheduled'),
(65, 'group', 'K', team_id('AUS'), team_id('DEN'),  'BC Place',            'Vancouver',           'CAN', '2026-06-29 02:00:00+00', 'scheduled'),
(66, 'group', 'K', team_id('AUT'), team_id('HON'),  'Empower Field',       'Denver',              'USA', '2026-06-29 02:00:00+00', 'scheduled'),

-- GROUP L
(67, 'group', 'L', team_id('SUI'), team_id('IRQ'),  'NRG Stadium',         'Houston',             'USA', '2026-06-18 23:00:00+00', 'scheduled'),
(68, 'group', 'L', team_id('TUR'), team_id('NGA'),  'Hard Rock Stadium',   'Miami',               'USA', '2026-06-19 02:00:00+00', 'scheduled'),
(69, 'group', 'L', team_id('IRQ'), team_id('NGA'),  'NRG Stadium',         'Houston',             'USA', '2026-06-24 20:00:00+00', 'scheduled'),
(70, 'group', 'L', team_id('SUI'), team_id('TUR'),  'Lincoln Financial Field','Philadelphia',      'USA', '2026-06-25 00:00:00+00', 'scheduled'),
(71, 'group', 'L', team_id('NGA'), team_id('SUI'),  'Hard Rock Stadium',   'Miami',               'USA', '2026-06-30 02:00:00+00', 'scheduled'),
(72, 'group', 'L', team_id('TUR'), team_id('IRQ'),  'NRG Stadium',         'Houston',             'USA', '2026-06-30 02:00:00+00', 'scheduled');

-- Clean up helper function
DROP FUNCTION team_id(VARCHAR);
