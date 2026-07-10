# Prediction Architecture
## World Cup Betting Predictor

**Version:** 1.0  
**Date:** 2026-06-02

---

## Overview

The prediction engine uses a layered approach:

```
Layer 1: Team Ratings (Elo + xG-based attack/defence)
     ↓
Layer 2: Match Simulation (Dixon-Coles Bivariate Poisson)
     ↓
Layer 3: Market Comparison (fair odds vs bookmaker odds)
     ↓
Layer 4: EV Calculation + Kelly Sizing
     ↓
Layer 5: Confidence Scoring
     ↓
Layer 6: AI Narrative Generation (Claude)
```

---

## Layer 1: Team Ratings

### 1a. Elo Rating System

Elo provides a single scalar measure of team quality. We use a modified version of the standard Elo system optimised for international football.

**Formula:**
```
New Elo = Old Elo + K × (Actual − Expected)

Expected = 1 / (1 + 10^((opponent_elo - team_elo) / 400))

K-factor = 60 (major tournaments) / 40 (qualifiers) / 30 (friendlies)
```

**Seeding process:**
- Baseline from FIFA rankings (converted to Elo scale)
- Updated with each competitive match result since 2022 World Cup
- Weight decay: older results contribute less (exponential decay, half-life = 18 months)
- Tournament stage multiplier: knockout matches weighted 1.5×

**Initial ratings for 2026 World Cup (estimated):**

| Tier | Teams | Elo Range |
|---|---|---|
| Elite | France, Brazil, England, Argentina, Spain, Germany | 2000–2100 |
| Strong | Portugal, Netherlands, Italy, Belgium | 1900–2000 |
| Competitive | USA, Mexico, Japan, Morocco, Senegal | 1750–1900 |
| Emerging | Rest of field | 1550–1750 |

### 1b. Attack / Defence Strength (xG-based)

Using expected goals (xG) data from the last 24 months of competitive matches.

```
attack_strength_i = (mean_xg_scored_i over last N matches) / (global_mean_xg_scored)

defence_strength_i = (mean_xg_conceded_i over last N matches) / (global_mean_xg_conceded)
```

Minimum N = 8 matches for reliable estimate. Below 8 → fall back to Elo-only model with reduced confidence.

**Data source priority:**
1. StatsBomb / Understat API (xG data)
2. FBref scrape
3. API-Football xG fields
4. Fallback: goals scored/conceded as xG proxy (less accurate, flagged in confidence score)

### 1c. Form Score

Weighted recency score from last 5 competitive matches.

```
form_score = Σ (result_i × weight_i × opponent_quality_i)

weight = [0.35, 0.25, 0.20, 0.12, 0.08] (most recent to oldest)
result = 1.0 (win) / 0.5 (draw) / 0.0 (loss)
opponent_quality = opponent_elo / 1800 (normalised)
```

---

## Layer 2: Match Simulation — Dixon-Coles Model

### The Model

Dixon-Coles (1997) models goals scored by each team as independent Poisson random variables, with a correction factor (τ) for low-scoring outcomes (0-0, 1-0, 0-1, 1-1 are more common than pure Poisson predicts).

**Expected goals for match:**
```
λ_home = attack_home × defence_away × home_advantage × global_mean
λ_away = attack_away × defence_home × global_mean

home_advantage = 1.0 (World Cup, neutral venues — no systematic home advantage)
                 1.12 (for co-host nations USA/Canada/Mexico vs opponents)
```

Note: 2026 World Cup has three host nations. Co-hosts will have mild crowd advantage.

**Poisson goal probability:**
```
P(X = k) = (e^(-λ) × λ^k) / k!

We calculate P(home scores i goals) × P(away scores j goals) for i,j in 0..10
```

**Dixon-Coles correction for low-score cells:**
```
τ(i, j, λ_home, λ_away, ρ) applied to cells (0,0), (1,0), (0,1), (1,1)
ρ ≈ -0.13 (estimated from World Cup data — underdogs score more than club football)
```

### Derived Market Probabilities

From the full score matrix P(i,j):

```python
# 1X2
prob_home_win = Σ P(i,j) for all i > j
prob_draw     = Σ P(i,j) for all i == j
prob_away_win = Σ P(i,j) for all i < j

# Goals markets
prob_over_25 = Σ P(i,j) for all i+j > 2
prob_over_15 = Σ P(i,j) for all i+j > 1
prob_over_35 = Σ P(i,j) for all i+j > 3
prob_btts    = Σ P(i,j) for all i > 0 AND j > 0

# Fair odds
fair_odds_X = 1 / prob_X  (no margin, pure model output)
```

### Parameter Estimation

```
Parameters: attack_i, defence_i for each team i, plus ρ
Estimated via Maximum Likelihood Estimation on historical World Cup + major tournament data
Re-estimated after each tournament match (5-day rolling update)
```

---

## Layer 3: Market Comparison

**Market odds collection:**
1. If Odds API integrated: pull latest odds from Pinnacle (sharpest market), Bet365, Betway, DraftKings
2. If manual: admin enters representative odds
3. De-vig the bookmaker probability:
   ```
   raw_implied_prob_i = 1 / decimal_odds_i
   overround = Σ raw_implied_prob_all_selections
   true_implied_prob_i = raw_implied_prob_i / overround
   ```

**Market comparison:**
```
edge = our_probability - true_implied_prob
```

---

## Layer 4: EV Calculation + Kelly Sizing

### Expected Value

```
EV = (our_prob × (decimal_odds − 1)) − ((1 − our_prob) × 1)

EV% = EV × 100  (as percentage of stake)
```

**Example:**
- We estimate Spain win vs Morocco at 62% (fair odds: 1.61)
- Bookmaker offers 1.90
- EV = (0.62 × 0.90) − (0.38 × 1.0) = 0.558 − 0.380 = +0.178 = +17.8%
- **This is a strong value bet**

### Kelly Criterion

```
f* = (b×p − q) / b

where:
  b = decimal_odds − 1  (net profit per unit staked)
  p = our estimated win probability
  q = 1 − p

f* = optimal fraction of bankroll to bet
```

**We apply fractional Kelly:**
```
Recommended stake = 0.25 × f* × bankroll  (quarter-Kelly, conservative)
Maximum stake = min(0.05 × bankroll, 0.5 × f* × bankroll)  (5% hard cap)
```

**EV threshold for display:**
- Show in value bets feed: EV ≥ +3%
- Flag as "strong value": EV ≥ +8%
- Flag as "exceptional": EV ≥ +15%
- Hide from value feed: EV < +3%

---

## Layer 5: Confidence Scoring

Confidence (0–100) reflects how much we trust this specific prediction, not the probability itself.

```
confidence = 0.30 × data_quality
           + 0.25 × model_stability
           + 0.20 × market_agreement
           + 0.15 × h2h_depth
           + 0.10 × injury_clarity

Each component scored 0–100, weighted sum gives final confidence.
```

### Component Definitions

**data_quality (0–100):**
- Full xG data available: +40
- ≥ 10 competitive matches in last 18 months: +30
- No missing key inputs: +30

**model_stability (0–100):**
- Probability shifts < 5% over last 48h: +50
- Model variants agree within ±5%: +50

**market_agreement (0–100):**
- Our probability within ±5% of market: +30 (market is often right, agreement is normal)
- Our probability differs by 5–15%: +60 (potential value, model disagrees but credibly)
- Our probability differs by >15%: +20 (big disagreement, could be edge or error — flag)
- Note: maximum market_agreement at mid-range divergence is by design

**h2h_depth (0–100):**
- ≥ 10 H2H matches available: 100
- 6–9 matches: 75
- 3–5 matches: 50
- 1–2 matches: 25
- 0 matches (first ever meeting): 10

**injury_clarity (0–100):**
- All key players confirmed available: 100
- Minor doubtfuls only: 75
- 1 key player uncertain: 50
- Multiple key players uncertain: 25
- Major uncertainty (e.g., star striker unconfirmed): 10

### Confidence Bands

| Score | Label | Colour |
|---|---|---|
| 70–100 | High Confidence | Green |
| 50–69  | Moderate | Amber |
| 0–49   | Low Confidence | Red |

Low confidence predictions are published but with prominent warning. Never suppress — suppress creates false confidence elsewhere.

---

## Layer 6: AI Narrative (Claude API)

Each prediction includes a plain-English explanation generated by Claude.

**Prompt template:**
```
You are a professional football betting analyst. 

Given this match data:
- Home team: {home_team}, Elo: {home_elo}, Attack: {home_atk}, Defence: {home_def}
- Away team: {away_team}, Elo: {away_elo}, Attack: {away_atk}, Defence: {away_def}
- Head-to-head: {h2h_summary}
- Key injuries: {injuries}
- Our probabilities: Home {prob_home}%, Draw {prob_draw}%, Away {prob_away}%
- Best value bet: {value_bet}

Write a 3-4 sentence match analysis explaining:
1. Why the odds are set as they are
2. What statistical factors drive our prediction
3. Where we see the value bet opportunity (if any)
4. One key risk that could invalidate the prediction

Tone: Professional, analytical, not promotional. Do not guarantee outcomes.
```

**Cost control:**
- Generate narrative once per prediction version
- Cache in `match_predictions.summary_text`
- Only regenerate if team rating changes > 5% or injury update
- Estimated API cost: ~$0.01 per prediction × 64 matches = ~$0.64

---

## Tournament Simulation (Monte Carlo)

For group stage and knockout probabilities:

```python
def run_simulation(N=100000):
    results = defaultdict(lambda: defaultdict(int))
    
    for _ in range(N):
        # Simulate all remaining group stage matches
        group_standings = simulate_groups()
        # Apply FIFA qualification rules (top 2 per group + best 3rd place)
        qualified = determine_qualified(group_standings)
        # Simulate knockout rounds until winner
        winner = simulate_knockouts(qualified)
        
        # Record all intermediate results
        for team, stage_reached in winner.items():
            results[team][stage_reached] += 1
    
    # Convert to probabilities
    return {team: {stage: count/N for stage, count in stages.items()}
            for team, stages in results.items()}
```

**Re-run triggers:**
- After each match result
- After major injury news
- On odds of any team moving > 20% in outright market

---

## Model Validation Approach

### Backtesting
- Test model on 2022 Qatar World Cup
- Test on 2021/2024 Euros
- Test on 2021/2024 Copa América
- Metric: Brier score < 0.22, log loss < 0.95

### Calibration
- Expected: team assigned 60% probability should win ~60% of the time
- Plot calibration curve weekly during tournament
- If systematically miscalibrated (>5% off) → recalibrate attack/defence priors

### Live Tracking
- After every 10 matches, publish calibration stats
- Segment by stage: group vs knockout (different dynamics)
- Track separately: 1X2, goals, BTTS

---

## Model Limitations (Disclosed to Users)

1. **Limited head-to-head data** — many World Cup teams meet rarely
2. **Club vs international form** — xG from club football used, with correction factor
3. **Tournament pressure** — psychological factors not quantified
4. **Referee/VAR effects** — not modelled
5. **Weather/pitch conditions** — partially modelled (venue data)
6. **Manager tactical adjustments** — not modelled in real-time
7. **Momentum effects** — partially captured by form score, but imperfect

These limitations are shown on the methodology page and referenced in confidence scoring.
