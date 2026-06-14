# FacelessYT — YouTube SEO Automation System

**Date:** 2026-06-12
**Module:** `engine/modules/seo/`
**Target:** Maximize organic search discovery and browse/suggestion feed placement

---

## 1. Overview

YouTube SEO is the difference between a video that generates 500 views organically and one that generates 50,000. For a faceless channel with no existing subscriber base, SEO is the primary growth mechanism for the first 3-6 months. The algorithm must be trained to understand what the video is about, who should see it, and why that audience will engage with it.

This module automates every SEO element: titles, descriptions, tags, hashtags, chapter timestamps, end screens, and cards. All outputs are optimized based on real CTR data from the YouTube Data API and continuously updated by the learning engine.

---

## 2. Title Generation

**File:** `engine/modules/seo/title-generator.ts`

### 2.1 The Title Formula

Every generated title follows this structure:

```
[Trigger Element] + [Core Topic] + [Curiosity/Value Gap] + [Year/Relevance Marker]
```

Maximum 70 characters (YouTube truncates titles beyond this in most surfaces).

**Formula components:**

| Component | Examples | Max chars |
|---|---|---|
| Trigger | Number, "Why", "How", Emotional word | 15 |
| Core Topic | Player name, Team, Event | 25 |
| Curiosity/Value Gap | "No One's Talking About", "Real Reason", "Untold Story" | 25 |
| Year/Relevance | "World Cup 2026", "2026" | 10 |

**Example outputs:**
- `Why Brazil Is ALREADY The 2026 World Cup Favorite` (50 chars)
- `The $200 Million Secret FIFA Doesn't Want You to Know` (53 chars)
- `10 Players Who Will Shock The World Cup 2026` (44 chars)
- `England's Real Problem: Why 2026 Will End The Same Way` (54 chars)

### 2.2 CTR Keyword Bank

The engine maintains a scored keyword bank updated weekly from real CTR data:

```typescript
const HIGH_CTR_KEYWORDS = {
  superlatives: ['BEST', 'WORST', 'GREATEST', 'EVER', 'ALL TIME', '#1'],
  emotional:    ['SHOCKING', 'UNBELIEVABLE', 'INSANE', 'BRUTAL', 'EPIC'],
  curiosity:    ['SECRET', 'REVEALED', 'EXPOSED', 'REAL REASON', 'TRUTH ABOUT'],
  urgency:      ['BREAKING', 'RIGHT NOW', 'JUST HAPPENED', 'BEFORE EVERYONE'],
  social_proof: ['NO ONE TALKS ABOUT', 'EVERYONE MISSED', 'HIDDEN'],
  numbers:      ['$', '10', 'TOP 5', '#1', 'RECORD', 'FIRST TIME', 'LAST EVER'],
};

// Each keyword has a CTR lift score from 0.0 to 0.08 (measured from analytics)
// Updated by learning engine every 30 days
```

### 2.3 Title Generation Prompt

```typescript
async function generateTitleVariants(script: Script, topic: string): Promise<string[]> {
  const prompt = `
Generate 5 YouTube title variants for a video about: ${topic}

Script hook (first 50 words): ${script.scenes[0].narration.slice(0, 200)}
Key facts/stats from the video: ${extractKeyStats(script)}
Target audience: Soccer/football fans 18-35, US/UK/Global English speakers
Channel niche: World Cup 2026 analysis

TITLE REQUIREMENTS:
- Maximum 70 characters each
- At least 2 must include a number or dollar amount
- At least 1 must use a question format
- At least 1 must use an emotional trigger word
- All must include some reference to World Cup 2026 or the team/player
- Avoid clickbait that the video doesn't deliver on
- Do NOT use "you won't believe" — overused

Output: JSON array of 5 strings, nothing else.
  `;

  const response = await claude(prompt);
  return JSON.parse(response);
}
```

### 2.4 Title Scoring and Selection

```typescript
function scoreTitleCTR(title: string): number {
  let score = 0;
  const upper = title.toUpperCase();

  // Length penalty: ideal is 40-60 chars
  if (title.length < 40) score -= 0.1;
  if (title.length > 65) score -= 0.2;

  // Keyword bonuses
  for (const [category, keywords] of Object.entries(HIGH_CTR_KEYWORDS)) {
    const weight = CTR_KEYWORD_WEIGHTS[category]; // from learning engine
    keywords.forEach(kw => {
      if (upper.includes(kw)) score += weight;
    });
  }

  // Number bonus (digits in title)
  const numberCount = (title.match(/\d+/g) ?? []).length;
  score += numberCount * 0.05;

  // Question mark bonus
  if (title.endsWith('?')) score += 0.03;

  return score;
}

// Select title with highest CTR score
const bestTitle = titleVariants.sort((a, b) => scoreTitleCTR(b) - scoreTitleCTR(a))[0];
```

---

## 3. Description Generation

**File:** `engine/modules/seo/description-builder.ts`

### 3.1 Description Template

YouTube descriptions have three audiences: humans (first 125 characters are shown as preview), YouTube's search indexer, and suggested video algorithm.

```typescript
const DESCRIPTION_TEMPLATE = `
{{HOOK_PARAGRAPH}}

⏱️ CHAPTERS
{{CHAPTER_TIMESTAMPS}}

📊 IN THIS VIDEO
{{KEYWORD_RICH_BODY}}

🔔 Subscribe for daily World Cup 2026 coverage: {{SUBSCRIBE_URL}}

📱 Social Media
{{SOCIAL_LINKS}}

#WorldCup2026 {{NICHE_HASHTAGS}} {{TRENDING_HASHTAGS}}

KEYWORDS: {{SEO_KEYWORDS}}
`;
```

### 3.2 Hook Paragraph (First 125 Characters)

The first 125 characters are critical — they appear below the video before "Show more" is clicked. They must immediately tell the algorithm and viewer what the video is about.

```typescript
async function generateHookParagraph(topic: string, script: Script): Promise<string> {
  const prompt = `
Write a 2-3 sentence opening paragraph for a YouTube video description.
Topic: ${topic}
The first sentence must be under 125 characters total.
Must naturally include the primary keyword: "${topic}"
Must tease the video's core value proposition.
Do NOT start with "In this video" or "Welcome to".
  `;
  return await claude(prompt);
}
```

### 3.3 Keyword-Rich Body

The body section (after chapters) repeats the video's topic keywords in natural prose. This helps YouTube's search indexer categorize the video:

```typescript
async function generateKeywordBody(script: Script, tags: string[]): Promise<string> {
  const topKeywords = tags.slice(0, 15).join(', ');
  const prompt = `
Write 3-4 short paragraphs (2-3 sentences each) about the video topic.
Naturally include these keywords: ${topKeywords}
Write in a natural, readable way. Do NOT stuff keywords unnaturally.
Include the full team names, tournament name "World Cup 2026", and key player names.
  `;
  return await claude(prompt);
}
```

---

## 4. Tag Generation

**File:** `engine/modules/seo/tag-generator.ts`

YouTube tags still matter for suggested video placement (appearing alongside similar content). The system generates 25 tags in three categories:

### 4.1 Tag Structure

| Category | Count | Example | Purpose |
|---|---|---|---|
| Exact-match | 10 | "world cup 2026 predictions" | Direct search ranking |
| Broad match | 10 | "soccer analysis", "football" | Suggested video placement |
| Channel authority | 5 | "facelessyt", "world cup analysis 2026" | Brand signal |

```typescript
async function generateTags(topic: string, script: Script): Promise<string[]> {
  // Base tags always included
  const baseTags = [
    'world cup 2026',
    'world cup 2026 predictions',
    'fifa world cup 2026',
    'soccer analysis',
    'football analysis',
  ];

  // Topic-specific exact match tags (from Claude)
  const exactMatch = await claude(`
Generate 10 YouTube search tags for a video about: ${topic}
Tags should be 2-5 words each, lowercase.
Focus on what people actually search for.
Include country names, player names, and tournament-specific phrases.
Output: JSON array of 10 strings.
  `);

  // Broad match tags
  const broadMatch = [
    'soccer',
    'football',
    'world cup',
    'soccer news',
    'football news',
    'world cup predictions',
    'soccer highlights',
    'football analysis',
    'world cup 2026 news',
    'soccer explained',
  ];

  // Channel-specific
  const channelTags = ['world cup 2026 analysis', 'best soccer channel'];

  return [...baseTags, ...JSON.parse(exactMatch), ...broadMatch, ...channelTags].slice(0, 500); // YouTube's 500 char limit
}
```

---

## 5. Hashtag Selection

Hashtags appear at the top of the description and in suggested search overlays on mobile. YouTube recommends 3-5 hashtags maximum — more than 15 causes all hashtags to be ignored.

```typescript
async function selectHashtags(topic: string, trendingHashtags: string[]): Promise<string[]> {
  const niche = ['#WorldCup2026', '#SoccerAnalysis', '#FootballAnalysis'];
  const trending = trendingHashtags.slice(0, 2); // From Discovery Engine's Reddit/Twitter scan
  const topicSpecific = await generateTopicHashtag(topic); // e.g., '#Brazil2026'

  return [...niche.slice(0, 2), ...trending.slice(0, 2), topicSpecific].slice(0, 5);
}
```

Rules:
- Always include `#WorldCup2026` as the first hashtag
- Maximum 5 hashtags total
- At least 1 trending hashtag (from current day's discovery scan)
- At least 1 niche hashtag
- At least 1 topic-specific hashtag

---

## 6. Chapter Timestamps

YouTube chapters improve AVD because viewers can navigate to content they want, and the chapter list in the description also serves as additional keyword-indexed text for the algorithm.

```typescript
function generateChapterTimestamps(script: Script): string {
  const chapterMap: Record<Script['scenes'][0]['segment'], string> = {
    HOOK:      '🎯 The Hook',
    OPEN_LOOP: '🔍 What You Need to Know',
    PROBLEM:   '⚡ The Real Problem',
    STORY:     '📖 The Full Story',
    VALUE:     '📊 Deep Analysis',
    TWIST:     '😱 The Twist',
    PAYOFF:    '✅ The Answer',
    CTA:       '🔔 Final Thoughts',
  };

  return script.scenes
    .filter((scene, i, arr) => i === 0 || scene.segment !== arr[i-1].segment)
    .map(scene => {
      const minutes = Math.floor(scene.timingStart / 60);
      const seconds = scene.timingStart % 60;
      const timestamp = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      return `${timestamp} ${chapterMap[scene.segment]}`;
    })
    .join('\n');
}
```

Note: YouTube requires the first chapter to start at `0:00` for chapters to activate.

---

## 7. End Screen Configuration

End screens appear in the final 20 seconds of the video. The engine configures them via YouTube Data API:

```typescript
async function addEndScreen(videoId: string, relatedVideoId: string): Promise<void> {
  // End screen elements added at 80% mark
  const endScreenTime = Math.floor(videoDuration * 0.80);

  await youtube.watermarks.set({
    channelId: CHANNEL_ID,
    resource: {
      targetChannelId: CHANNEL_ID,
      position: { type: 'corner', cornerPosition: 'topRight' },
      timing: { type: 'offsetFromStart', offsetMs: endScreenTime * 1000, durationMs: 20000 },
    },
  });

  // Add "best video for viewer" suggestion card
  // YouTube auto-selects the best video to recommend based on viewer history
}
```

---

## 8. A/B Title Testing via YouTube Studio API

YouTube Studio supports experimental title A/B testing for channels with sufficient subscribers. Until that threshold is reached, the system simulates A/B testing by:

1. Uploading with the top-scored title
2. After 500 impressions with < 4% CTR, switching to the second-scored title
3. Recording which title performed better in `learning_data` table

```typescript
async function checkAndRotateTitle(videoId: string): Promise<void> {
  const metrics = await fetchVideoMetrics(videoId);

  if (metrics.impressions > 500 && metrics.ctr < 0.04) {
    const video = await supabase.from('videos').select('seo_data').eq('id', videoId).single();
    const alternativeTitles = video.seo_data.title_variants;
    const nextTitle = alternativeTitles.find(t => t !== metrics.currentTitle);

    if (nextTitle) {
      await youtube.videos.update({
        part: ['snippet'],
        requestBody: { id: videoId, snippet: { title: nextTitle } },
      });

      await supabase.from('videos').update({
        'seo_data->active_title': nextTitle,
      }).eq('id', videoId);

      logger.info(`Rotated title for ${videoId}: CTR was ${metrics.ctr} → trying "${nextTitle}"`);
    }
  }
}
```

---

## 9. SEO Data Output Schema

```typescript
interface SEOPackage {
  videoId: string;
  title: string;                    // Selected best title
  titleVariants: string[];          // All 5 generated titles
  titleCTRScores: number[];         // Predicted CTR for each variant
  description: string;              // Full assembled description
  tags: string[];                   // Up to 500 chars worth of tags
  hashtags: string[];               // 3-5 hashtags
  chapters: string;                 // Formatted timestamp string
  category: 17;                     // Sports (always 17 for FacelessYT)
  defaultLanguage: 'en';
  privacyStatus: 'private';         // Uploaded private, scheduled separately
  publishAt: string;                // ISO timestamp for scheduled publish
  selfDeclaredMadeForKids: false;
  createdAt: string;
}
```

---

## 10. SEO Performance Tracking

The Analytics Engine tracks these SEO-specific metrics:

| Metric | Target | Action if Below Target |
|---|---|---|
| Title CTR (impressions CTR) | > 5% | Rotate to next title variant |
| Search impressions | > 20% of total impressions | Review tags — add more exact-match |
| Browse/Suggested impressions | > 50% of total impressions | Review tags — add more broad match |
| Hashtag click-throughs | Monitor | Remove hashtags with zero traffic |
| Chapter engagement | Monitor | Identifies which sections cause drop-off |

All data stored in `daily_metrics` and `seo_data` JSONB column on `videos` table for learning engine analysis.
