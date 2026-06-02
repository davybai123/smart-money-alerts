# MVP Scope Document
## World Cup Betting Predictor

**Version:** 1.0  
**Date:** 2026-06-02  
**Hard Deadline:** June 9, 2026 (2 days before WC kickoff)

---

## THE CLOCK IS TICKING

World Cup 2026 starts: **June 11, 2026**  
Available build time: **7 days**  
Days until meaningful betting market opens: **NOW** (outright and group markets already live)

This means every hour of delay costs real betting opportunity for users. We ship in 7 days or we miss the most valuable part of the tournament.

---

## MVP Definition

The MVP must do exactly one thing excellently:

> **Show users which World Cup bets have positive expected value, and explain why.**

Nothing else matters until this works.

---

## IN Scope (Must Launch June 9)

### Data Layer ✓
- [ ] Supabase project created, schema deployed
- [ ] All 48 teams seeded with Elo ratings and attack/defence ratings
- [ ] All 64 matches seeded (group stage first, knockout bracket after draws)
- [ ] Initial team ratings calculated
- [ ] H2H data populated for all likely group stage matchups

### Prediction Engine ✓
- [ ] Dixon-Coles model implemented in Edge Function
- [ ] 1X2 probabilities for all group stage matches
- [ ] Goals market probabilities (O/U 1.5, 2.5, 3.5, BTTS)
- [ ] Fair odds calculated
- [ ] Confidence scoring implemented
- [ ] All group stage predictions published before June 11

### Odds Integration ✓
- [ ] The Odds API integrated (manual fallback if budget issue)
- [ ] Odds for 3 bookmakers: Pinnacle, Bet365, Betway
- [ ] EV calculation running on latest odds
- [ ] Value bets feed populating

### Frontend ✓
- [ ] Home page with today's matches
- [ ] Matches list page (group stage)
- [ ] Match detail page with full analysis
- [ ] Value bets feed
- [ ] Static tournament overview (group tables + winner probabilities)
- [ ] Performance tracker (starts empty, populates after games)
- [ ] Basic responsive mobile layout

### Auth ✓
- [ ] Sign up / sign in / sign out (Supabase Auth)
- [ ] User profile created on signup
- [ ] Guest mode works (all predictions viewable without account)

### Narrative ✓
- [ ] Claude API integrated
- [ ] Narratives generated for all group stage matches
- [ ] Template fallback if Claude unavailable

### Trust & Legal ✓
- [ ] Methodology page live
- [ ] Responsible gambling messaging on every page
- [ ] 18+ notice
- [ ] Legal disclaimer: "For informational purposes only"
- [ ] Locked prediction notice (timestamped)

---

## OUT of Scope (MVP)

| Feature | Reason | Timeline |
|---|---|---|
| Payment / Subscriptions | Stripe setup takes 3+ days, launch first | Week 2 |
| Player props | Requires more granular data pipeline | Week 2 |
| Odds alerts / notifications | Email service setup required | Week 2 |
| Arbitrage detection | Complex, not core | Post-tournament |
| AI betting assistant | Nice-to-have, not core | Post-tournament |
| Mobile app | Web first | Post-tournament |
| Social sharing | Nice-to-have | Week 2 |
| Saved bets tracker | Not critical for trust-building | Week 2 |

**Rule:** If a feature doesn't directly make predictions better or more trustworthy, it's post-MVP.

---

## Day-by-Day Build Plan

### Day 1 (June 2) — Architecture & Data
- [ ] Set up Supabase project
- [ ] Deploy database schema (all tables)
- [ ] Seed teams table with all 48 teams
- [ ] Seed matches table with group stage fixtures
- [ ] Implement initial Elo ratings for all teams
- [ ] Set up API-Football integration
- [ ] Set up The Odds API integration
- [ ] Deploy basic Edge Functions skeleton

### Day 2 (June 3) — Prediction Engine
- [ ] Implement Dixon-Coles model in TypeScript
- [ ] Test model against 2022 World Cup results (validation)
- [ ] Implement attack/defence strength calculation
- [ ] Implement form score calculation
- [ ] Implement confidence scoring
- [ ] Run first full set of group stage predictions
- [ ] Verify all probabilities sum to 100%
- [ ] Verify EV calculations against manual verification

### Day 3 (June 4) — Odds + EV Pipeline
- [ ] Ingest live odds from The Odds API
- [ ] Value bets calculation running correctly
- [ ] Top 5 value bets identified across group stage
- [ ] Manual QA of EV numbers (sanity check)
- [ ] Claude API narrative generation for all 48 group matches
- [ ] Admin interface for publishing predictions

### Day 4 (June 5) — Lovable Frontend (Core)
- [ ] Lovable project created with design system
- [ ] Supabase client connected
- [ ] Home page with live match data
- [ ] Matches list working with real predictions
- [ ] Match detail page with full analysis
- [ ] Value bets feed working

### Day 5 (June 6) — Lovable Frontend (Secondary)
- [ ] Authentication flows (sign up, sign in, sign out)
- [ ] Tournament page (groups + winner probabilities)
- [ ] Performance tracker (empty state ready for results)
- [ ] Methodology page
- [ ] Mobile responsive pass

### Day 6 (June 7) — QA & Polish
- [ ] Full QA pass: all 48 group stage matches have predictions
- [ ] All EV calculations manually verified for 5 random matches
- [ ] Mobile layout tested on iPhone SE and Android
- [ ] Performance test: page loads < 2s on 4G
- [ ] Responsible gambling messaging audit
- [ ] 18+ gate implemented
- [ ] Legal disclaimers reviewed

### Day 7 (June 8–9) — Launch
- [ ] Deploy to Vercel (production)
- [ ] Custom domain configured (if available)
- [ ] All predictions locked-and-ready for June 11
- [ ] Monitoring set up (Supabase logs + Vercel analytics)
- [ ] Error tracking set up
- [ ] Soft launch: share with 10 beta users
- [ ] Fix critical bugs
- [ ] Public launch

### June 11 — World Cup Kickoff
- [ ] All day-1 predictions published and locked
- [ ] Monitoring match — Supabase function logs open
- [ ] Result recording within 2h of final whistle
- [ ] Performance stats updating

---

## MVP Success Criteria

**Hard criteria (must hit ALL):**
1. All 48 group stage match predictions published before June 11
2. EV calculator works correctly (verified against manual calculation)
3. Value bets feed shows ≥ 3 bets with EV > 5% at tournament start
4. Site loads in < 3s on mobile
5. Zero critical data errors in predictions (probabilities sum to 100%)
6. Responsible gambling messaging present on all pages

**Soft criteria (target):**
1. 100 registered users by June 14
2. 500 unique visitors in first week
3. At least 1 value bet identified that wins in the first round

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Odds API budget issue | Medium | High | Start with The Odds API free tier (500 requests), manual fallback |
| API-Football data gaps | Medium | Medium | Manual data entry for critical team stats |
| Claude API costs exceed budget | Low | Low | Pre-generate all narratives, cache aggressively |
| Lovable frontend takes longer | Medium | High | Start Lovable on Day 4 with mock data already working |
| Supabase Edge Function cold starts | Low | Medium | Keep functions warm with scheduled pings |
| Team ratings significantly wrong | Medium | High | Backtest on 2022 WC before publishing |
| Legal challenge | Low | High | Clear disclaimers, informational framing, no payment Day 1 |
| Time runs out | Medium | Critical | MVP reduces to: just the match detail page + EV calc if needed |

---

## Minimum Viable MVP (if time runs out)

If Day 6 arrives with features incomplete, ship in this priority:

1. **Match detail page** — one prediction, full analysis, EV calc ✓
2. **Value bets feed** — just a list, minimal styling ✓
3. **Home page** — links to the above ✓

Everything else can come after launch. We can launch with 3 pages if needed.
