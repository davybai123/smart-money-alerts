# Lovable Build Plan
## World Cup Betting Predictor

**Version:** 1.0  
**Date:** 2026-06-02

---

## Tech Stack Summary

```
Frontend:     Lovable (React + TypeScript + Tailwind)
Backend:      Supabase (PostgreSQL + Auth + Edge Functions)
Deployment:   Vercel
State:        React Query (TanStack) + Zustand for UI state
Charts:       Recharts
Icons:        Lucide React
Fonts:        Inter (headings) + JetBrains Mono (numbers/odds)
```

---

## Design System

### Colours
```
Background:   #0A0F1E  (dark navy — financial terminal feel)
Surface:      #111827  (card backgrounds)
Border:       #1F2937  
Text Primary: #F9FAFB
Text Muted:   #6B7280
Green:        #10B981  (value, positive EV, wins)
Red:          #EF4444  (negative EV, losses)
Amber:        #F59E0B  (moderate confidence, warnings)
Blue:         #3B82F6  (info, selections)
Gold:         #F59E0B  (featured/best value)
```

### Typography
- Headings: `font-display` (Inter 700/900)
- Body: Inter 400/500
- Numbers/Odds: JetBrains Mono (monospace for alignment)

### Component Language
- Cards with `rounded-xl border border-gray-800`
- Confidence bars in green/amber/red
- Probability pills showing %
- EV badges: `+12.4% EV` in green rounded pill
- "Best Odds" star badge on bookmaker rows

---

## Screens & Lovable Prompts

---

### Screen 1: Home Page / Match Dashboard

**Route:** `/`

**Layout:** Full-width dark background. Top: sticky nav. Below: today's matches cards grid. Below: value bets ticker. Below: tournament snapshot.

**Lovable Prompt:**
```
Build a dark-themed sports analytics dashboard for a football betting predictor.

Background: #0A0F1E. Cards: #111827 with border #1F2937.

Top navigation:
- Logo left: football icon + "SmartPick" in white bold
- Nav links: Matches | Value Bets | Tournament | Track Record | How It Works
- Right: Sign In button (outlined) + Sign Up button (green filled)
- Sticky on scroll

Hero section (no image, just text + stats):
- Heading: "Find Value. Not Winners."
- Subheading: "AI-powered World Cup betting analysis. We identify mispriced odds so you can bet smarter."
- 3 stat chips: "64 matches analysed" | "48 value bets identified" | "71% prediction confidence"
- CTA: "See Value Bets →" (green button)

Matches section:
- Section title: "Today's Matches" with date
- Grid of match cards (2 columns desktop, 1 column mobile)
- Each card shows:
  - Team flags + team names
  - Kickoff time (localised)
  - Probability bars for Home/Draw/Away (three horizontal bars with %)
  - Confidence badge (green/amber/red pill with score)
  - Best value market highlighted: e.g. "Value: Over 2.5 | +8.4% EV" in green
  - "Full Analysis →" link
- If no matches today: "Next match in X hours" countdown

Value Bets ticker section:
- Dark card: "🔥 Live Value Bets" 
- Horizontal scrolling cards showing top 5 value bets
- Each: Match name | Market | Odds | EV %
- "See All Value Bets →" link

Tournament snapshot:
- Small 3-column grid: Top 3 tournament favourites with win %
- "See Full Simulation →" link

Footer:
- "18+ | Gamble Responsibly | This is analysis, not financial advice"
- Links: About | Methodology | Track Record | Contact
```

---

### Screen 2: Matches List

**Route:** `/matches`

**Lovable Prompt:**
```
Build a matches list page for a football World Cup predictor.

Same dark theme as home page.

Filter bar at top:
- "All Stages" dropdown: Group Stage | Round of 32 | Round of 16 | Quarter-Finals | Semi-Finals | Final
- "Group" filter: All | Group A through L
- "Date" filter: date picker
- "Has Value Bet" toggle switch

Match list (full width cards, not grid):
Each card:
- Left section: Date + Time | Stage | Group
- Center: Home flag + name vs Away flag + name
- Center below: Probability pills — "Home 45%" | "Draw 28%" | "Away 27%" (coloured backgrounds)
- Right: Confidence score (circular badge, colour coded)
- Right below: Top value bet highlighted: "BTTS Yes +6.2% EV" (green badge) or "No value detected" (gray)
- Entire card is clickable → match detail

Group matches together under date headings.
Show live matches at top with "LIVE" badge.
Completed matches at bottom with score shown instead of probabilities.
```

---

### Screen 3: Match Detail Page

**Route:** `/match/{id}`

**Lovable Prompt:**
```
Build a detailed match analysis page for a World Cup prediction platform.

Dark theme. Page has 3 sections:

SECTION 1 — Match Header
- Large header card showing:
  - Both teams: flag + name + Elo rating (small text below name)
  - VS in center with match info: date, time, venue, stage
  - Live score if match is in progress
  - Confidence indicator: circular gauge 0-100 with label

SECTION 2 — Predictions Grid
- 3 column grid (Home Win / Draw / Away Win):
  Each column:
    - Large probability: "48.2%"
    - Fair odds below: "Fair: 2.07"
    - Best market odds: "Best: 2.40 @ Pinnacle"
    - EV badge: "+13.4% EV" (green) or "-5.2% EV" (red) or "~0% EV" (gray)
    - "Bet This" button (only shown if EV > 3%)

- Below that, Goals markets row:
  4 cards: O/U 1.5 | O/U 2.5 | O/U 3.5 | BTTS
  Each shows: probability, fair odds, best odds, EV

SECTION 3 — Analysis Tabs
- Tab 1: AI Analysis — paragraph text explaining the prediction
- Tab 2: Team Stats — two-column comparison
    Home: xG scored | xG conceded | Form (5 match icons W/D/L) | Elo rating
    Away: same
- Tab 3: Head to Head — table of last 5 H2H results with scores
- Tab 4: Odds Comparison — table of all bookmaker odds for all markets with best highlighted

SECTION 4 — Save Bet (authenticated users)
- Form to save this bet to their tracker: Market selector | Odds input | Stake input | Bookmaker | Save
- If not logged in: "Sign in to save bets and track your performance"

Bottom: "⚠️ Analysis locked at kickoff. Predictions cannot be modified after this point."
```

---

### Screen 4: Value Bets Feed

**Route:** `/value-bets`

**Lovable Prompt:**
```
Build a value bets feed page for a football betting platform.

Dark theme. Professional. Like a Bloomberg terminal for betting.

Header: "Value Bets" | subtext: "Only bets with positive expected value (EV > 3%) are shown. Updated every 30 minutes."

Filter sidebar (left, collapsible on mobile):
- EV threshold slider: 3% to 20%+
- Market type checkboxes: 1X2 | Goals | BTTS | Player Props
- Confidence level: High (70+) | Medium (50-69) | All
- Kickoff: Today | This week | All upcoming

Results count: "Showing 12 value bets"

Sort options: EV % ↓ | Confidence ↓ | Kickoff soonest

Main feed — card per value bet:
Each card contains:
  - Top row: Match name (Home vs Away) | Stage | Kickoff time
  - Market row: Bold market name "Over 2.5 Goals" | Selection
  - Stats row:
      Our prob: 61.2%
      Market prob: 52.4%
      Edge: +8.8%
      EV: +16.8% (large, green)
      Confidence: 74 (green badge)
  - Odds row: Fair Odds: 1.63 | Best Available: 1.91 @ Pinnacle
  - Kelly row: Full Kelly: 8.8% | Half Kelly: 4.4% | Rec. Stake: £44/£1000 bankroll
  - Bottom: [View Analysis] button | [Save Bet] button
  - Right edge: coloured EV bar showing magnitude

When no value bets match filters:
  "No value bets meet your criteria right now. Odds update every 30 minutes — check back soon."
  Last updated timestamp shown.
```

---

### Screen 5: Tournament Simulator

**Route:** `/tournament`

**Lovable Prompt:**
```
Build a World Cup tournament simulation page.

Dark theme.

Section 1: Tournament Winner Probabilities
- Horizontal bar chart showing all 48 teams ranked by probability of winning
- Top 8 shown expanded, rest collapsed with "Show all" toggle
- Each bar: flag + team name + probability % + fair odds + best market odds + EV

Section 2: Group Standings
- Grid of all groups (A through L for 48-team WC)
- Each group is a card showing:
  - Team, Played, W, D, L, GF, GA, GD, Pts
  - Qualification probability % (progress bar on right)
  - Colour code: qualified (green), in contention (amber), eliminated (red)

Section 3: Knockout Bracket
- Visual bracket showing round of 32 through final
- Each slot: team name + win probability for that round
- Completed matches show actual scores
- Future matches show predicted winner with probability

Section 4: Stage Probabilities Table
- All teams in alphabetical order
- Columns: Win Tournament | Reach Final | Reach SF | Reach QF | Reach R16 | Exit Groups
- Sortable columns

Note at bottom: "Simulation runs 100,000 tournament iterations after each result. Last run: {timestamp}"
```

---

### Screen 6: Performance Tracker / Track Record

**Route:** `/track-record`

**Lovable Prompt:**
```
Build a prediction performance tracker page for a football analytics platform.

Dark theme. This page is about building trust by showing transparent results.

Hero stats bar (top, 4 cards):
- Total Predictions: 48
- Accuracy Rate: 54.2%
- ROI (1 unit staking): +12.4%
- Average EV on bets: +7.8%

Calibration chart (key trust feature):
- Scatter plot: X axis = predicted probability (0-100%), Y axis = actual win rate
- Points for each 10% bucket
- Perfect calibration line (diagonal)
- Our calibration line
- Title: "How accurate are our probabilities?"
- Explanation text below: "A perfectly calibrated model's line would exactly match the diagonal. Points above = we're underestimating probability; below = overestimating."

Filter tabs: All Markets | 1X2 | Goals | BTTS | Player Props

Results table:
- Match | Date | Market | Selection | Our Prob | Odds | Result | P&L | EV Predicted | EV Realised
- Colour code result: Win (green) | Loss (red) | Push (gray)
- Sortable, paginated

Running P&L chart:
- Area chart showing cumulative P&L if staking 1 unit on all value bets
- Baseline = 0, green area above, red below

Transparency note:
"All predictions are published and locked before kickoff. No retroactive changes are possible — these results are the full, unedited record."
```

---

### Screen 7: User Account / My Bets

**Route:** `/account`

**Lovable Prompt:**
```
Build a user account page for a betting analytics platform.

Dark theme. Split into two panels.

Left panel: Account info
- Avatar (initials based) + name + email
- Subscription badge: "Free" or "Premium"
- If free: upgrade CTA: "Unlock full EV analysis and alerts" + Upgrade button
- Settings: odds format preference (Decimal/Fractional/American), timezone

Right panel: My Bets tracker
- Summary stats bar: Total Bets | Total Staked | Total Return | Net P&L | ROI%
- P&L chart (area chart, same style as track record)
- Bets table:
  Match | Market | Odds | Stake | Status | P&L
  Status options: Open (blue badge) | Won (green) | Lost (red) | Void (gray)
  Open bets show pending P&L if win
- "Add Bet Manually" button → modal form
```

---

### Screen 8: How It Works / Methodology

**Route:** `/methodology`

**Lovable Prompt:**
```
Build a methodology explanation page for a football betting predictor.

Dark theme. Clean, documentation-style layout with left nav TOC.

Sections:
1. Our Philosophy — "We identify value, not winners"
2. The Prediction Model — Explain Dixon-Coles + Elo in plain English with a diagram
3. Expected Value Explained — Simple worked example with numbers
4. Kelly Criterion — What it is, why we use quarter-Kelly
5. Confidence Scores — What factors drive them
6. Data Sources — Where we get our data
7. Model Limitations — Honest about what we don't know
8. Track Record — Link to /track-record

Each section has a clear heading, explanation paragraph, and a worked example box where appropriate.

Include an interactive EV calculator widget:
- Enter: Your probability estimate | Bookmaker's odds
- Shows: EV%, Kelly fraction, recommendation
- Mobile-friendly
```

---

## Navigation Structure

```
/ (Home)
├── /matches
│   └── /match/{id}
├── /value-bets
├── /tournament
├── /track-record
├── /methodology
└── /account
    ├── /account/bets
    └── /account/settings
```

---

## Responsive Breakpoints

| Breakpoint | Layout Change |
|---|---|
| Mobile (< 768px) | Single column, bottom nav bar |
| Tablet (768–1024px) | 2 column, sidebar collapses |
| Desktop (> 1024px) | Full 3-column layout on detail pages |

---

## Build Sequence for Lovable

Build in this order (each builds on previous):

1. Design system setup (colours, typography, base components)
2. Navigation component
3. Home page (static, no data)
4. Matches list (static mock data)
5. Match detail page (static mock data)
6. Value bets feed (static mock data)
7. Tournament page (static mock data)
8. Connect Supabase (replace mock data with live queries)
9. Authentication (sign up / sign in / sign out)
10. Track record page
11. User account + bet tracker
12. Methodology page
13. Polish + mobile optimization
14. EV calculator widget
