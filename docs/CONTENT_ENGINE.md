# FacelessYT — Content Discovery & Opportunity Scoring Engine

**Date:** 2026-06-12
**Module:** `engine/modules/discovery/`
**Trigger:** Daily cron at 06:00 UTC

---

## 1. Overview

The content discovery engine is responsible for scanning the internet every morning to identify the highest-opportunity video topics for that day. It aggregates signals from five independent sources, normalizes them into a composite opportunity score, and surfaces a ranked shortlist of topics for the script engine to act on.

The goal is to find topics at the inflection point: high demand, low competition, strong CTR potential, and monetization-friendly. Being first to a trending topic on YouTube compounds views exponentially — a video published 6 hours ahead of the competition captures the algorithm's attention window.

---

## 2. Data Sources

### 2.1 YouTube Data API v3

**File:** `engine/modules/discovery/youtube-trends.ts`

The primary signal source. Two query types run each morning:

**Trending Video Search:**
```typescript
// Search for recent World Cup content sorted by view count velocity
const trending = await youtube.search.list({
  part: ['snippet', 'statistics'],
  q: 'world cup 2026',
  type: ['video'],
  order: 'viewCount',
  publishedAfter: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  maxResults: 50,
  regionCode: 'US',
  relevanceLanguage: 'en',
});
```

**View Velocity Calculation:**
For each trending video, fetch statistics and calculate velocity:
```typescript
const velocity = video.statistics.viewCount / hoursSincePublished;
// Videos with velocity > 5,000 views/hour = strong trending signal
```

**Competitor Channel Monitoring:**
Track top 20 soccer/World Cup channels. Detect new uploads within the last 24 hours. If multiple competitors upload on the same topic, it is a validated trend.

```typescript
const competitorChannels = [
  'UCid1...', // GOAL
  'UCid2...', // ESPN FC
  // ... top 20 channels loaded from channel_config in Supabase
];

// For each channel: list uploads in last 24h → extract topics
```

**Related Video Clustering:**
For each high-velocity video, call `videos.list` to get related video IDs (via search with same title keywords). Cluster topics that appear 3+ times → higher demand confidence.

---

### 2.2 Google Trends Signal

**Approach:** pytrends microservice or direct HTTP scraping

Google Trends does not have an official API, but pytrends (Python library) provides reliable access. Two options:

**Option A — Python Microservice (recommended for production):**
```
engine/services/trends-service/
├── app.py          # Flask endpoint: POST /trends { keywords: [...] }
├── requirements.txt  # pytrends, flask
└── Dockerfile
```

The engine calls `http://localhost:5001/trends` with candidate keywords and receives back a trend score (0-100 for each term over the past 7 days).

**Option B — SerpAPI Google Trends:**
Use SerpAPI's Google Trends endpoint ($50/month). More reliable but adds cost.

**Trend Velocity Score:**
```python
# pytrends: interest over time for last 7 days
# Velocity = today_score - avg(last_6_days)
# Positive velocity = rising topic
trend_velocity = today_score - (sum(last_6_days) / 6)
```

Topics with `trend_velocity > 15` are classified as "rising." Topics with `trend_velocity > 30` are classified as "viral breakout."

---

### 2.3 Reddit API

**File:** `engine/modules/discovery/reddit-signals.ts`

Subreddits monitored:
- `r/soccer` — 4.2M members, primary signal
- `r/worldcup` — seasonal spike, highest relevance for 2026
- `r/football` — UK perspective, different angle opportunities
- `r/mls` — US home audience signal (high RPM)
- `r/PremierLeague` — cross-sport viral potential

**Endpoint:** OAuth2 application credentials, `GET /r/{subreddit}/hot`

```typescript
interface RedditPost {
  title: string;
  score: number;       // upvotes
  numComments: number;
  upvoteRatio: number;
  created: number;     // unix timestamp
  url: string;
  isSelf: boolean;
}

// Virality signal formula:
const viralityScore = post.score * post.upvoteRatio * Math.log(post.numComments + 1);

// Filter: posts from last 12h with viralityScore > 500
```

**Comment Sentiment Analysis:**
For posts with virality > 1000, fetch top 20 comments and pass to Claude for sentiment and controversy detection. Controversial topics (strong positive + negative divide) predict high CTR. Pure positive topics predict strong engagement.

---

### 2.4 News API

**File:** `engine/modules/discovery/news-signals.ts`

```typescript
const headlines = await newsapi.v2.everything({
  q: 'World Cup 2026 OR FIFA 2026 OR soccer World Cup',
  language: 'en',
  sortBy: 'popularity',
  from: yesterday,
  pageSize: 50,
});
```

Key signals extracted from news:
- **Breaking news score:** Stories from last 6 hours get a 2x multiplier
- **Source authority:** CNN/ESPN/BBC count more than blogs
- **Controversy flag:** Headlines containing "controversy", "banned", "scandal", "vs", "drama", "shock" get a CTR boost flag
- **Statistical hook:** Headlines with numbers ("$2.3 billion", "32 teams", "record-breaking") get a hook_score boost

---

### 2.5 Competitor Channel Analysis

**File:** `engine/modules/discovery/competitor-scanner.ts`

The 20 tracked competitor channels are stored in `channel_config` in Supabase. Each morning, the scanner:

1. Fetches the last 5 uploads from each channel via YouTube Data API
2. Identifies uploads from the last 24 hours
3. Records: title, view count, like count, comment count, publish time
4. Clusters topics that 3+ competitors covered → **validated trend**
5. Identifies **topic gaps**: topics with high Reddit/news signals but zero competitor videos → **first-mover opportunity** (highest value)

```typescript
interface CompetitorUpload {
  channelId: string;
  channelName: string;
  videoId: string;
  title: string;
  viewCount: number;
  publishedAt: Date;
  topicCluster: string;
}

// Gap analysis:
const competitorTopics = new Set(uploads.map(u => u.topicCluster));
const candidateTopics = redditTopics.filter(t => !competitorTopics.has(t));
// candidateTopics = first-mover opportunities → 1.5x opportunity score multiplier
```

---

## 3. Opportunity Scoring Formula

**File:** `engine/modules/discovery/opportunity-scorer.ts`

Every candidate topic receives a composite `opportunity_score` computed as:

```
opportunity_score = demand_score × (1 / competition_score) × ctr_prediction × rpm_estimate × first_mover_multiplier
```

### 3.1 Demand Score

```typescript
function calculateDemandScore(topic: CandidateTopic): number {
  const searchVolume = normalizeToHundred(topic.youtubeSearchResults);
  const trendVelocity = normalizeToHundred(topic.googleTrendVelocity);
  const redditUpvotes = normalizeToHundred(topic.redditViralityScore);
  const newsPopularity = normalizeToHundred(topic.newsSourceCount);

  // Weighted average
  return (
    searchVolume    * 0.35 +   // YouTube intent is strongest signal
    trendVelocity   * 0.30 +   // Rising trends compound
    redditUpvotes   * 0.20 +   // Community passion
    newsPopularity  * 0.15     // Mainstream coverage = broad audience
  );
}
```

### 3.2 Competition Score

```typescript
function calculateCompetitionScore(topic: CandidateTopic): number {
  const topVideosAvgViews = topic.top10Videos.reduce((sum, v) => sum + v.viewCount, 0) / 10;
  const totalResults = topic.totalSearchResults;
  const freshVideoRatio = topic.videosUnder7Days / topic.totalSearchResults;

  // High avg views + many results = high competition
  const rawScore = (topVideosAvgViews / 1_000_000) * Math.log(totalResults / 1000 + 1);

  // Fresh video ratio penalty: if competitors just flooded the topic, competition is higher
  return rawScore * (1 + freshVideoRatio * 0.5);
}
// Lower competition_score = better opportunity (used as denominator)
```

### 3.3 CTR Prediction

```typescript
const CTR_BOOSTING_PATTERNS = {
  emotional_triggers:  ['shocking', 'unbelievable', 'insane', 'revealed', 'secret', 'exposed', 'truth'],
  number_hooks:        ['#1', 'top 10', '$', 'record', 'first time', 'all time'],
  controversy_markers: ['vs', 'vs.', 'controversy', 'drama', 'banned', 'scandal', 'fired'],
  curiosity_gaps:      ['why', 'what happened', 'real reason', 'you won\'t believe', 'untold'],
  urgency_markers:     ['breaking', 'just happened', 'right now', 'before everyone'],
};

function predictCTR(topic: string, headline: string): number {
  let score = 0.03; // baseline 3% CTR for soccer content
  const text = (topic + ' ' + headline).toLowerCase();

  for (const [category, patterns] of Object.entries(CTR_BOOSTING_PATTERNS)) {
    const matches = patterns.filter(p => text.includes(p)).length;
    score += matches * 0.005; // Each trigger word adds 0.5% predicted CTR
  }

  return Math.min(score, 0.15); // Cap at 15% CTR (realistic maximum)
}
```

### 3.4 RPM Estimate

RPM (Revenue Per Mille) varies significantly by sub-niche and audience geography:

| Niche | Estimated RPM | Notes |
|---|---|---|
| World Cup 2026 analysis | $8-12 | Premium advertiser category |
| Soccer tactics breakdown | $5-8 | Engaged adult male audience |
| Player biography/story | $4-6 | Broader appeal, lower intent |
| Controversial takes | $3-6 | High views, mixed ad safety |
| Transfer news | $4-7 | Timely, high search volume |
| Historical retrospective | $5-9 | Evergreen, compounds over time |

```typescript
function estimateRPM(topic: CandidateTopic): number {
  const rpmLookup: Record<string, number> = {
    world_cup_analysis: 10,
    tactics_breakdown: 6.5,
    player_biography: 5,
    controversy: 4.5,
    transfer_news: 5.5,
    historical: 7,
  };
  return rpmLookup[topic.niche] ?? 5; // Default $5 RPM
}
```

### 3.5 First Mover Multiplier

```typescript
const firstMoverMultiplier = topic.competitorVideoCount === 0 ? 1.5 : 1.0;
// Being first on a trending topic is worth 50% more
```

---

## 4. Output: ContentOpportunity Object

```typescript
interface ContentOpportunity {
  id: string;
  topic: string;
  topicCluster: string;
  headline: string;              // Suggested video hook
  demandScore: number;           // 0-100
  competitionScore: number;      // 0-100 (lower = better)
  ctrPrediction: number;         // 0.0-0.15 (predicted CTR %)
  rpmEstimate: number;           // USD per 1000 views
  firstMover: boolean;
  opportunityScore: number;      // Final composite score
  sources: string[];             // Which signals contributed
  redditTopPosts: string[];      // Top 3 Reddit post titles
  competitorVideoCount: number;
  googleTrendVelocity: number;
  suggestedAngles: string[];     // 3 narrative angles for script engine
  researchKeywords: string[];    // Keywords for Claude research phase
  createdAt: Date;
}
```

---

## 5. Daily Execution Flow

```typescript
async function runDiscovery(): Promise<ContentOpportunity[]> {
  logger.info('Starting daily discovery scan');

  // Step 1: Parallel data collection
  const [youtube, reddit, news, trends] = await Promise.allSettled([
    fetchYoutubeTrends(),
    fetchRedditSignals(),
    fetchNewsSignals(),
    fetchGoogleTrends(),
  ]);

  // Step 2: Competitor scan (sequential — rate limited)
  const competitorData = await scanCompetitorChannels();

  // Step 3: Topic extraction and deduplication
  const candidates = extractAndMergeTopics(youtube, reddit, news, trends, competitorData);

  // Step 4: Score each candidate
  const scored = candidates.map(topic => ({
    ...topic,
    opportunityScore: calculateOpportunityScore(topic),
  }));

  // Step 5: Rank and select top 10, save top 3 for production
  const ranked = scored.sort((a, b) => b.opportunityScore - a.opportunityScore);

  // Step 6: Persist to Supabase
  await supabase.from('opportunities').insert(ranked.slice(0, 10));

  logger.info(`Discovery complete. Top topic: ${ranked[0].topic} (score: ${ranked[0].opportunityScore.toFixed(2)})`);

  return ranked.slice(0, 3); // Return top 3 for script engine
}
```

---

## 6. Anti-Duplication Logic

Before scoring, every candidate topic is checked against:
1. Videos already produced in the last 30 days (`videos` table)
2. Currently queued opportunities (`opportunities` table, `used = false`)
3. A semantic similarity check via Claude: "Is this topic substantially the same as [existing topic]? Yes/No"

Topics with `similarity > 0.85` to existing content are filtered out to prevent channel flooding with near-duplicate content.

---

## 7. Monitoring & Alerts

- If fewer than 3 viable topics found (all scores < 20): Telegram alert to operator for manual topic injection
- If YouTube API quota approaches 8,000 units: switch to cached results from yesterday + Telegram warning
- If Reddit API rate-limited: skip subreddit signals, log degraded mode, continue with other sources
- All source failures are logged in `job_logs` table with error details
