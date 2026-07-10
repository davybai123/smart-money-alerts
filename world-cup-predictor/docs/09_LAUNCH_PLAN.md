# Launch Plan
## World Cup Betting Predictor

**Version:** 1.0  
**Date:** 2026-06-02

---

## Launch Timeline

```
June 2  ─── Architecture & planning (TODAY)
June 3  ─── Data pipeline + prediction engine
June 4  ─── Odds integration + EV pipeline
June 5  ─── Lovable frontend build
June 6  ─── Frontend completion + auth
June 7  ─── QA, polish, mobile
June 8  ─── Staging deploy, soft launch (10 beta users)
June 9  ─── PUBLIC LAUNCH ← target
June 11 ─── World Cup Group Stage begins
```

---

## Pre-Launch Checklist

### Technical ✓
- [ ] Vercel project deployed from GitHub
- [ ] Custom domain configured + SSL active
- [ ] Supabase production project created (not free tier)
- [ ] Environment variables set in Vercel (SUPABASE_URL, SUPABASE_ANON_KEY, API keys)
- [ ] Edge Functions deployed and tested
- [ ] Cron jobs scheduled (odds refresh, result ingestion)
- [ ] Monitoring dashboard live (Supabase logs + Vercel analytics)
- [ ] Error alerts configured (email/Slack on critical failures)
- [ ] Database backups enabled
- [ ] Rate limiting active on all public endpoints

### Data ✓
- [ ] All 48 teams seeded with ratings
- [ ] All 48 group stage fixtures loaded
- [ ] Initial predictions generated and manually QA'd
- [ ] All predictions published with timestamp
- [ ] Value bets feed showing ≥ 3 opportunities
- [ ] Odds data fresh (< 1 hour old at launch)

### Content ✓
- [ ] All 48 match narratives generated
- [ ] Methodology page written and published
- [ ] FAQ page (common questions about betting advice)
- [ ] About page
- [ ] Responsible gambling page

### Legal ✓
- [ ] Terms of Service (basic)
- [ ] Privacy Policy (GDPR-friendly if targeting EU)
- [ ] Cookie consent banner
- [ ] "18+ Gamble Responsibly" on every page
- [ ] Disclaimer: "Not financial advice. Predictions for informational purposes only."
- [ ] No affiliation with FIFA or any bookmaker unless disclosed

### UX ✓
- [ ] Mobile layout tested (375px, 390px, 414px widths)
- [ ] Tablet tested (768px)
- [ ] Page speed: Lighthouse score ≥ 80 on mobile
- [ ] All links working (no 404s)
- [ ] Authentication flows tested end-to-end
- [ ] Error states shown correctly
- [ ] Loading states on all data-fetching components

---

## Go-to-Market Plan (Organic First, Zero Ad Spend)

### Target Communities (first 72 hours)

**Reddit:**
- r/soccer — Post: "I built a World Cup EV betting analyzer — here's what the model says about the first round of fixtures"
- r/SoccerBetting — Value bets post with methodology
- r/dataisbeautiful — Post: "Visualizing World Cup win probabilities using Monte Carlo simulation"
- r/WorldCup — Daily value bet thread

**Twitter/X:**
- Thread on opening day: "Our model's top 5 value bets for World Cup 2026 Group Stage"
- Daily pre-match posts with probability breakdown
- Track record updates after each matchday

**Football betting Discord servers:**
- Share in relevant prediction channels
- Offer free premium access to moderators in exchange for pinned post

**Betfair Community / Betting forums:**
- Write up model methodology as a blog post
- Share track record as it builds

### Content Strategy (During Tournament)

**Daily content:**
- Pre-match analysis posts (2–3 matches/day)
- Value bet alerts (whenever EV > 8% detected)
- Post-match: "We predicted X — here's what happened"
- Running P&L thread

**Weekly content:**
- Calibration update: how accurate are our probabilities?
- ROI tracker update
- Week-in-review: biggest value bets found

**Viral potential content:**
- "The model gives [huge underdog] a 22% chance — here's why" (surprising picks)
- "Every World Cup winner since 1998 — were they value at the time?" (historical piece)
- Calibration chart after group stage (proof of accuracy)

---

## Monetisation Plan

### Phase 1 — Launch (June 9) — Free Only
- Everything free for first 2 weeks
- Build email list aggressively
- Focus on track record building (can't sell accuracy you haven't proven)

### Phase 2 — Round of 16 (June 27) — Premium Tier Launch
Price: **£9.99/month or £24.99 for tournament pass**

| Feature | Free | Premium |
|---|---|---|
| Match predictions (1X2) | ✓ | ✓ |
| Goals market predictions | Blurred | ✓ |
| EV percentages | Top 3 only | All |
| Value bets feed | Limited | Full + filters |
| Confidence intervals | ✓ | ✓ |
| Player props | ✗ | ✓ |
| Odds movement alerts | ✗ | ✓ |
| Track record detail | ✓ | ✓ (full export) |
| API access | ✗ | ✓ (100 calls/day) |

**Stripe integration:**
- Supabase handles user subscription status
- Stripe Checkout for payment
- Webhook updates `user_profiles.subscription` on successful payment

### Revenue Projections (Conservative)

| Scenario | Users | Conversion | MRR |
|---|---|---|---|
| Bear | 500 MAU | 2% | ~£100 |
| Base | 2,000 MAU | 3% | ~£600 |
| Bull | 5,000 MAU | 5% | ~£2,500 |

### Phase 3 — Post-Tournament — Growth

Options to evaluate after tournament:
1. **Data API product** — sell prediction data to affiliates, content sites
2. **Affiliate model** — bookmaker affiliate links (£30–£100 CPA per depositing user)
3. **B2B** — sell model outputs to tipster services, media
4. **Expand to club football** — Premier League, Champions League predictions

Affiliate model note: Only pursue if we can maintain editorial independence. We will never rate bookmakers by who pays most — only by odds quality.

---

## Post-Launch Operations (During Tournament)

### Daily Routine
```
08:00 — Check injury news, update availability
09:00 — Run player availability update
09:30 — Check confidence scores changed; republish if significant update needed
12:00 — Pre-match predictions posted on social
14:00 — Odds refresh check; new value bets? Post on social
18:00 — Pre-match final check: odds settled, predictions locked
21:00 — Post-match: record results, performance stats update
21:30 — Social post: "Here's what happened to our predictions today"
```

### Matchday Monitoring
- Supabase logs open in one window
- Vercel analytics in another
- Check for: Edge function errors, database errors, unusual traffic spikes
- On-call: someone available during all match windows

### Model Performance Review (Weekly)
- Calculate Brier score, log loss, calibration
- Compare to benchmark (always-predict-equal and market-implied models)
- If systematically off → diagnose and recalibrate

### User Feedback Loop
- Simple NPS survey after tournament
- Feature request board (Canny or plain GitHub Issues)
- Priority framework: does this make predictions better or user trust higher?

---

## Success Metrics at Tournament End

| Metric | Target | Stretch |
|---|---|---|
| Total registered users | 2,000 | 5,000 |
| Peak daily active | 500 | 1,500 |
| Predictions published | 64/64 | — |
| Value bets EV > 5% | 40 | 60 |
| Actual ROI on recommended bets | +5% | +15% |
| Model Brier score | < 0.22 | < 0.20 |
| Premium conversions | 60 | 200 |
| MRR at tournament end | £500 | £2,000 |
| Email list | 1,000 | 5,000 |
| Social following | 500 | 2,000 |

---

## Post-Tournament Plan (August 2026)

If metrics achieved:
1. Keep site live as case study
2. Begin Premier League 2026/27 season predictions
3. Build annual subscription model (£49/year for all football)
4. Explore partnership with established football data companies
5. Consider funding/backing if traction strong

If metrics not achieved:
1. Analyse where model was weakest — recalibrate
2. User research: what did users actually want?
3. Pivot or shut down
4. Key learning: data pipeline was the hardest part — can sell that
