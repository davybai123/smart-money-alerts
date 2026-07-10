# Product Constitution
## World Cup Betting Predictor

**Version:** 1.0  
**Date:** 2026-06-02  
**Status:** AUTHORITATIVE — all decisions must align with this document

---

## 1. Mission Statement

> Identify betting value in World Cup markets by estimating true probabilities more accurately than bookmakers, and communicating that edge transparently to users.

---

## 2. Vision

The most trusted, transparent, and profitable World Cup betting intelligence platform. Users trust our numbers because we show our work, track our record, and never pretend certainty where none exists.

---

## 3. Core Principles (Non-Negotiable)

### P1 — Value Over Picks
We do not predict winners. We identify mispriced odds. A bet with a 30% true probability at +400 (25% implied) is better than a bet with a 70% probability at -250 (71.4% implied). EV is everything.

### P2 — Probabilistic Honesty
Every prediction ships with a confidence band. We never show a single probability without acknowledging model uncertainty. We show what we know AND what we don't know.

### P3 — Transparency of Process
Users can see why we think what we think. Model inputs are visible. Assumptions are disclosed. Historical performance is public and unfalsifiable.

### P4 — Kelly Discipline
Recommended stake sizes are derived from the Kelly Criterion (fractional). We never recommend sizing that risks ruin. Default to quarter-Kelly. Hard cap at 5% bankroll per bet.

### P5 — Separation of Signal and Noise
We only surface bets with EV ≥ +3%. Everything below threshold is suppressed from the value bets feed. Better to show 3 good bets than 30 marginal ones.

### P6 — Track Record Integrity
All predictions are timestamped and locked before match kickoff. Retroactive editing is architecturally prevented. Performance stats are calculated from locked records only.

### P7 — Responsible Gambling
Every page includes responsible gambling messaging. We do not target addiction-risk behaviours. We do not send push notifications promoting "last chance" bets.

---

## 4. What We Are NOT

- We are **not** a tipster service that claims "guaranteed wins"
- We are **not** an arbitrage scanner (that is a future feature)
- We are **not** a betting exchange
- We are **not** a signal copy-trading platform
- We are **not** responsible for users' gambling decisions

---

## 5. Success Metrics

### North Star Metric
**Prediction Calibration Score** — the correlation between our estimated probabilities and actual outcomes, measured over 100+ predictions. A perfect score = 1.0. Target: ≥ 0.72 by end of tournament.

### Business Metrics (MVP)
| Metric | Target |
|---|---|
| Registered users | 1,000 by end of group stage |
| Daily active users | 300 peak match days |
| Predictions published | All 64 matches |
| Value bets identified | ≥ 40 over tournament |
| Email open rate | ≥ 35% |

### Model Performance Metrics
| Metric | Target |
|---|---|
| Log loss | < 0.95 |
| Brier score | < 0.22 |
| ROI on recommended bets | ≥ +5% |
| EV accuracy (predicted vs realised) | Within ±8% |

---

## 6. User Contract

We promise users:
1. Predictions published ≥ 24h before kickoff
2. Odds locked at time of publication
3. All results tracked publicly
4. Model assumptions disclosed
5. No paid promotion of specific bookmakers without disclosure

---

## 7. Regulatory Assumptions

- Platform is informational / analytical, not a licensed gambling operator
- Users bet independently through licensed bookmakers
- Legal disclaimer: "For informational purposes only. Please gamble responsibly."
- Age gate: 18+ only
- Jurisdiction notice: check local laws before betting

---

## 8. Monetisation Philosophy

Free access to all match predictions. Premium tier unlocks:
- Full EV calculations and confidence intervals
- Player props analysis
- Odds movement alerts
- API access for professional users

(Monetisation detail in MVP Scope document)
