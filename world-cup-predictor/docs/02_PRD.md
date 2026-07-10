# Product Requirements Document (PRD)
## World Cup Betting Predictor

**Version:** 1.0  
**Date:** 2026-06-02  
**Status:** MVP Scope

---

## 1. User Personas

### Persona 1 — "The Casual" (Charlie)
- Bets £20–£50/match for fun
- Reads predictions on phone during lunch
- Wants simple "is this a good bet?" answer
- Does NOT want to see raw numbers
- Needs: clear recommendations, simple UI, responsible messaging

### Persona 2 — "The Value Hunter" (Vee)
- Bets £100–£500/match seriously
- Has accounts at 5+ bookmakers
- Wants EV numbers and confidence bands
- Wants to compare our odds vs market odds
- Needs: detailed analysis, odds comparison, track record proof

### Persona 3 — "The Pro" (Priya)
- Professional bettor / syndicates
- Needs raw probability output
- Wants API access or export
- Cares deeply about model methodology
- Needs: methodology docs, confidence intervals, API, historical accuracy

### Persona 4 — "The Analyst" (Alex)
- Football data journalist / analyst
- Not betting but using for content
- Wants tournament simulations, team power rankings
- Needs: visualisations, embeddable widgets, shareable cards

---

## 2. Feature Requirements

### MUST HAVE (MVP — Launch June 9)

#### F-001: Match Predictions
- **Description:** For every World Cup match, display predicted probabilities for Home Win / Draw / Away Win
- **User Story:** As a user, I want to see predicted probabilities for each match outcome so I can compare against bookmaker odds
- **Acceptance Criteria:**
  - Probabilities for 1X2 market shown as percentages
  - Probabilities sum to 100%
  - Fair odds shown (1/probability)
  - Published ≥ 24h before kickoff
  - Locked after publication (no edits)
- **Edge Cases:**
  - Both teams equally rated → probabilities close to 33/33/34
  - Major injury news after publication → show "updated" flag but keep original prediction
  - Match postponed → show suspended state

#### F-002: Goals Market Predictions
- **Description:** Over/Under 2.5 goals and BTTS predictions with probabilities
- **User Story:** As a user, I want goals market predictions so I can find value in total goals betting
- **Acceptance Criteria:**
  - O/U 1.5, 2.5, 3.5 all predicted
  - BTTS Yes/No predicted
  - Expected goals (xG projection) shown
  - Fair odds calculated for each
- **Edge Cases:**
  - Very defensive teams → O/U 1.5 might be the value market
  - High-scoring teams → Check O/U 3.5

#### F-003: EV Calculator
- **Description:** Enter bookmaker odds and see expected value for any prediction
- **User Story:** As Vee, I want to enter odds from my bookmaker and see the EV so I know if this bet has an edge
- **Acceptance Criteria:**
  - Accepts decimal, fractional, and American odds formats
  - Shows EV as percentage of stake
  - Shows confidence interval on EV
  - Highlights if EV > 3% (positive), near 0% (neutral), < 0% (negative)
  - Works for all available markets
- **Edge Cases:**
  - Odds < 1.0 input → validation error
  - Implied probability > 100% → show vig-adjusted figure

#### F-004: Value Bets Feed
- **Description:** Ranked list of all bets with EV > 3% across all markets
- **User Story:** As Vee, I want a curated feed of only the best value opportunities ranked by EV so I don't waste time
- **Acceptance Criteria:**
  - Only shows bets with EV ≥ 3%
  - Sorted by EV descending by default
  - Shows: market, odds, our prob, market prob, edge, EV, confidence
  - Filterable by market type, confidence level, match
  - Refreshes when new odds data arrives
- **Edge Cases:**
  - No value bets found → show "No edges detected — check back when odds update"
  - Multiple bookmakers offer different odds → show best available

#### F-005: Confidence Scoring
- **Description:** 0–100 confidence score on every prediction
- **User Story:** As any user, I want to know how confident the model is in each prediction
- **Acceptance Criteria:**
  - Score shown as percentage
  - Colour coded: ≥70 green, 50–69 amber, <50 red
  - Tooltip explains what drives the score
  - Score factors: data quality, model agreement, H2H history depth, odds market stability
- **Edge Cases:**
  - First-ever meeting between teams → lower confidence, disclosed
  - Key player injury data unavailable → lower confidence, disclosed

#### F-006: Match Detail Page
- **Description:** Full analysis page for each match
- **User Story:** As any user, I want to see the complete analysis for a match so I can understand the reasoning
- **Acceptance Criteria:**
  - Team form (last 5 matches)
  - Head-to-head record
  - Key player availability
  - xG attack/defence ratings
  - All predictions with fair odds
  - EV comparison table vs top 3 bookmakers
  - Model explanation in plain English (AI-generated)
  - Prediction history if pre-tournament predictions updated
- **Edge Cases:**
  - H2H data < 3 matches → show "limited H2H history" warning
  - Injury data not confirmed → show "rumoured" flag

#### F-007: Performance Tracker
- **Description:** Public, auditable record of all past predictions vs actual results
- **User Story:** As Vee/Priya, I want to see the model's historical accuracy to decide whether to trust it
- **Acceptance Criteria:**
  - All past predictions shown with locked probability at prediction time
  - Actual result shown
  - Brier score, log loss, calibration chart
  - ROI calculation if staking 1 unit at recommended odds
  - Filterable by market type, tournament stage
- **Edge Cases:**
  - Draws in knock-out stage (goes to extra time) → track separately
  - Void bets → excluded from ROI but included in probability calibration

#### F-008: Tournament Overview
- **Description:** Groups table, bracket, and qualification probabilities
- **User Story:** As any user, I want to see the big picture tournament view with win probabilities
- **Acceptance Criteria:**
  - Live group standings
  - Qualification % for each team (via Monte Carlo simulation)
  - Tournament winner probability
  - Semi-final / final appearance probability
  - Bracket updates after each result
- **Edge Cases:**
  - Goal difference tiebreaker affects sim → implement FIFA tiebreak rules exactly
  - Group decider: must simulate multiple scenarios

#### F-009: User Authentication
- **Description:** Supabase Auth — email + Google OAuth
- **Acceptance Criteria:**
  - Sign up / sign in / sign out
  - Email verification
  - Password reset
  - Guest mode (view only, no saved bets)
- **Edge Cases:**
  - Duplicate email → show clear error
  - OAuth failure → fallback to email

#### F-010: Odds Input & Comparison
- **Description:** Users can input or we source odds from major bookmakers
- **Acceptance Criteria:**
  - Manual odds input always available
  - If odds API integrated: show odds from ≥3 bookmakers
  - Best available odds highlighted
  - Odds timestamps shown (odds go stale)

---

### SHOULD HAVE (Week 2 — post group stage)

#### F-011: Player Props Predictions
- Top scorer probabilities
- Anytime goalscorer per match
- Cards markets
- Man of Match

#### F-012: Team Power Rankings
- Elo-based ranking with confidence intervals
- Movement since last update
- Comparison tool (Team A vs Team B)

#### F-013: Injury Impact Analysis
- Show squad availability
- Estimated impact on team attack/defence rating
- How rating changes with/without key players

#### F-014: Odds Movement Tracker
- Chart of how odds have moved since opening
- "Sharp money" signals (odds move against public sentiment)
- Alert when significant line movement detected

---

### NICE TO HAVE (Future)

#### F-015: AI Betting Assistant
- Chat interface powered by Claude
- "Should I bet on this match?" → AI pulls model data and gives analysis
- Natural language odds analysis

#### F-016: Arbitrage Scanner
- Cross-bookmaker arbitrage opportunities
- Sure bet calculator

#### F-017: Automated Portfolio Management
- Track all recommended bets
- Kelly-optimal allocation across multiple active bets
- Portfolio risk management

---

## 3. Non-Functional Requirements

| Requirement | Specification |
|---|---|
| Performance | Page load < 2s on 4G mobile |
| Uptime | 99.5% during tournament |
| Predictions latency | Published within 2h of odds opening |
| Odds refresh | Every 30 minutes during active betting periods |
| Data retention | All predictions retained permanently |
| Security | No PII beyond email; no payment data stored locally |
| Accessibility | WCAG 2.1 AA minimum |
| Mobile first | Designed for 375px viewport up |

---

## 4. User Journeys

### Journey 1: Casual Bet Check
1. User arrives at home page
2. Sees today's matches
3. Clicks a match
4. Reads the verdict ("Value here on BTTS Yes")
5. Sees what odds to look for
6. Leaves to bet

### Journey 2: Value Hunt
1. Lands on Value Bets page
2. Filters by EV > 5%
3. Finds 2 bets
4. Clicks through to match detail
5. Reads analysis and model inputs
6. Enters their bookmaker's odds
7. Confirms EV positive
8. Notes bet

### Journey 3: Tournament Outright
1. Goes to Tournament page
2. Sees win probabilities vs current outright odds
3. EV calculated on each winner market
4. Identifies mispriced outsider
5. Places ante-post bet

---

## 5. Acceptance Testing Checklist

- [ ] All 64 match predictions published before kickoff
- [ ] EV calculations match manual formula verification
- [ ] Probabilities sum to 100% on every prediction
- [ ] Performance tracker updates within 1h of final whistle
- [ ] Mobile layout renders correctly on iPhone SE and Android mid-range
- [ ] Value bets feed only shows EV ≥ 3%
- [ ] Confidence scores render with correct colour coding
- [ ] Locked predictions cannot be edited after publication
- [ ] User can sign up, sign in, and sign out without errors
- [ ] Tournament simulation updates after each result
