# FacelessYT — AI Script Generation Engine

**Date:** 2026-06-12
**Module:** `engine/modules/script/`
**Primary Model:** Claude claude-sonnet-4-6 (Anthropic)

---

## 1. Overview

The script engine transforms a validated `ContentOpportunity` object into a production-ready, retention-optimized video script. Every design decision — structure, pacing, hook selection, language level, B-roll cues — is calibrated to maximize YouTube's three key algorithmic metrics: Click-Through Rate (CTR), Average View Duration (AVD), and Watch Time.

YouTube's algorithm rewards videos that hold viewers. A 55%+ AVD on a 10-minute video means 5.5 minutes of engaged watch time — enough for the algorithm to classify the video as "strong content" and expand distribution. The script engine is built entirely around manufacturing that retention.

---

## 2. 8-Part Script Structure

Every video follows a strict 8-part structure with defined timing targets. The total target runtime is 8-10 minutes (480-600 seconds), which falls into YouTube's sweet spot for mid-roll ad placement (required for maximum revenue).

```
SEGMENT    | TIMING      | DURATION | PURPOSE
───────────────────────────────────────────────────────────────────
HOOK       | 0-15s       | 15s      | Stop the scroll. Create immediate curiosity.
OPEN LOOP  | 15-45s      | 30s      | Preview the payoff without revealing it. Create FOMO.
PROBLEM    | 45-90s      | 45s      | Frame the stakes. Why does this matter? Who's affected?
STORY      | 90-180s     | 90s      | Narrative arc. Character, tension, timeline.
VALUE      | 180-360s    | 3min     | Core content. Data, analysis, insights. Maximum density.
TWIST      | 360-420s    | 60s      | Subvert expectations. The thing they didn't see coming.
PAYOFF     | 420-480s    | 60s      | Answer the open loop from the top. Resolve tension.
CTA        | 480-510s    | 30s      | Subscribe, comment prompt, end screen tease.
───────────────────────────────────────────────────────────────────
TOTAL                    | ~510s    | ~8.5 minutes
```

---

## 3. Hook Types and Templates

The hook is the most critical element. It determines whether a viewer who clicked the thumbnail actually starts watching. Target: 70%+ of clickers should still be watching at 30 seconds.

### Type 1: Shocking Stat
```
"[Team/Player] did something that only [X] players have EVER done in World Cup history."
"The last time [country] reached a World Cup final, [shocking historical fact]."
```

### Type 2: Bold Claim
```
"[Team] is already eliminated from the 2026 World Cup. They just don't know it yet."
"This is the most underrated player at the 2026 World Cup. And it's not even close."
```

### Type 3: Question Hook
```
"What would happen if [country] had [star player] back for this tournament?"
"Is [team] actually the worst defensive record of any World Cup favorite in history?"
```

### Type 4: Before/After Contrast
```
"Six months ago, [player] couldn't even get into his club's starting lineup. Today, he's..."
"In 2022, [country] was eliminated in the group stage. Here's what changed."
```

### Selection Logic:
The script engine scores each hook type against the topic's CTR prediction data. Topics with controversy flags → bold claim hooks. Topics with stat-rich research → shocking stat hooks. Topics with transformation narratives → before/after hooks.

---

## 4. Retention Engineering Tactics

### 4.1 Pattern Interrupts Every 60 Seconds

The human brain disengages after ~60 seconds of uniform stimulus. A pattern interrupt resets attention. The script engine inserts one of the following every 60 seconds:

- **Perspective shift:** "But here's where it gets interesting..."
- **Stat drop:** Deliver a single powerful statistic, pause
- **B-roll change:** Scene cut instruction with new visual
- **Direct address:** "Think about this for a second."
- **Callback:** Reference something mentioned earlier in a new context
- **Preview:** "And I'll show you exactly why that matters in about 2 minutes."

### 4.2 Open Loops

An "open loop" is a question or promise that hasn't been answered yet. Viewers physiologically cannot leave a video with an unresolved question. The engine maintains 2-3 open loops at all times:

```
LOOP TRACKING IN SCRIPT JSON:
{
  "open_loops": [
    { "opened_at_segment": "OPEN_LOOP", "text": "the real reason [X] happened", "resolved_at_segment": "PAYOFF" },
    { "opened_at_segment": "STORY", "text": "what [player] said backstage", "resolved_at_segment": "TWIST" }
  ]
}
```

Rules:
- Open loop must be created before segment 3 (PROBLEM)
- All open loops must be resolved by segment 7 (PAYOFF)
- Never open more than 3 loops simultaneously — cognitive overload causes drop-off

### 4.3 Curiosity Gaps

A curiosity gap is a deliberate withholding of information the viewer now wants. Examples:
- "The answer to that is in segment 5 — but first..."
- "I'll get to the most shocking part in a moment."
- "There's a number here that almost made me disbelieve this story."

The engine injects minimum 2 curiosity gaps per video, always in segments 2-5 (before the midpoint).

---

## 5. Script Metadata and Cue Markers

Every line of narration is tagged with production cues:

```json
{
  "segment": "VALUE",
  "timing_start": 180,
  "timing_end": 360,
  "narration": "Brazil has actually conceded fewer goals per game in World Cup tournaments than any other team since 1958.",
  "broll": "[B-ROLL: Brazil match highlights montage, goalkeeping saves, defensive formations]",
  "tone": "[TONE: analytical, measured, building conviction]",
  "pause_before": false,
  "emphasis_words": ["fewer goals per game", "any other team", "since 1958"],
  "pattern_interrupt": null,
  "open_loop_reference": null
}
```

B-roll tag categories:
- `[B-ROLL: match footage description]`
- `[B-ROLL: player close-up description]`
- `[B-ROLL: stadium/crowd description]`
- `[B-ROLL: graphic/text animation]`
- `[B-ROLL: map/country flag]`
- `[STOCK: getty images search query]` — fallback

---

## 6. Quality Checks

The quality checker runs after generation and before the script enters the voice queue:

```typescript
interface ScriptQualityReport {
  wordCount: number;                  // Target: 1200-2000 words
  estimatedDuration: number;          // Target: 480-600 seconds
  fleschReadingEase: number;          // Target: 60+ (conversational)
  fillerPhraseCount: number;          // Target: 0 (see list below)
  openLoopCount: number;              // Target: 2-3
  openLoopsResolved: boolean;         // Must be true
  patternInterruptCount: number;      // Target: 7+ (every ~60s)
  brollCueCount: number;              // Target: 1 per 30 seconds
  ctaPresent: boolean;                // Must be true
  hookType: string;                   // Must be one of 4 types
  pass: boolean;                      // true if all targets met
  failReasons: string[];
}
```

**Banned filler phrases (auto-detected and flagged):**
- "in conclusion"
- "as we can see"
- "it is important to note"
- "at the end of the day"
- "that being said"
- "needless to say"
- "in summary"
- "firstly, secondly, thirdly"
- "I hope you enjoyed"

**Readability Target:** Flesch-Kincaid Reading Ease ≥ 60. Video narration should sound conversational, not academic. The engine targets 8th-grade reading level — accessible to a global English-speaking audience.

---

## 7. Prompt Engineering

### 7.1 System Prompt

```typescript
const SYSTEM_PROMPT = `You are an expert YouTube scriptwriter specializing in soccer and football content. You have studied the top 100 most-watched sports YouTube videos and understand exactly what makes viewers stay.

Your scripts:
- Start with a hook that makes stopping feel impossible
- Maintain exactly 2-3 open loops at all times
- Use a pattern interrupt (perspective shift, stat drop, direct address) every 60 seconds
- Are conversational, direct, and emotionally engaging
- Never use academic or formal language
- Include specific numbers, names, and dates — vagueness kills retention
- Always resolve every promise made in the opening

Channel voice: Authoritative but passionate. Like a knowledgeable friend who has just watched 40 hours of tape and can't wait to tell you what they found.
Target audience: 18-35 male soccer fans, predominantly US/UK/Latin America.
Retention benchmark: 55% average view duration.`;
```

### 7.2 Script Generation Prompt

```typescript
function buildScriptPrompt(opportunity: ContentOpportunity, research: ResearchData): string {
  return `
Generate a complete YouTube video script for the following topic.

TOPIC: ${opportunity.topic}
SUGGESTED ANGLE: ${opportunity.suggestedAngles[0]}
RESEARCH DATA: ${JSON.stringify(research.keyFacts)}
TARGET HOOK TYPE: ${opportunity.hookType}

REQUIREMENTS:
- Total word count: 1400-1800 words
- Structure: HOOK (15s) → OPEN LOOP (30s) → PROBLEM (45s) → STORY (90s) → VALUE (180s) → TWIST (60s) → PAYOFF (60s) → CTA (30s)
- Include [B-ROLL: description] tags before each major segment change
- Include [TONE: description] tags for the voice actor
- Open 2 loops in the first 90 seconds, resolve both by the end
- Insert a pattern interrupt marker [INTERRUPT] at every 60-second boundary
- End with a strong CTA: ask viewers to comment their opinion and subscribe

Output format: JSON matching the ScriptScene[] schema below.
${SCRIPT_JSON_SCHEMA}
`;
}
```

### 7.3 Output Schema

```typescript
interface ScriptScene {
  segment: 'HOOK' | 'OPEN_LOOP' | 'PROBLEM' | 'STORY' | 'VALUE' | 'TWIST' | 'PAYOFF' | 'CTA';
  timingStart: number;     // seconds
  timingEnd: number;       // seconds
  narration: string;       // text to be read by voice actor / TTS
  broll: string;           // B-roll direction for visual editor
  tone: string;            // emotional direction for voice
  patternInterrupt: string | null;
  openLoopAction: 'open' | 'close' | null;
  openLoopText: string | null;
  emphasisWords: string[];
}

interface Script {
  videoId: string;
  topic: string;
  hookType: 'shocking_stat' | 'bold_claim' | 'question' | 'before_after';
  targetDuration: number;
  scenes: ScriptScene[];
  openLoops: OpenLoop[];
  qualityReport: ScriptQualityReport;
  createdAt: string;
}
```

---

## 8. Fact-Checking Pass

After script generation, a second Claude call runs immediately:

```typescript
const factCheckPrompt = `
Review this YouTube script for factual accuracy. For every specific claim, statistic, date, or player/team fact, classify it as:
- VERIFIED: Commonly known, almost certainly accurate
- UNCERTAIN: Plausible but you cannot verify with high confidence
- LIKELY_FALSE: Contradicts known facts

For UNCERTAIN and LIKELY_FALSE items, either provide the correct information or recommend softening the language ("reportedly", "sources suggest", etc.).

Script: ${JSON.stringify(script.scenes)}
`;
```

Any `LIKELY_FALSE` claim causes the script to fail quality check and regenerate. `UNCERTAIN` claims are softened automatically.

---

## 9. Generation Pipeline

```typescript
async function generateScript(
  opportunity: ContentOpportunity,
  research: ResearchData,
  attempt: number = 0
): Promise<Script> {

  if (attempt >= 3) throw new Error('Script generation failed after 3 attempts');

  // Step 1: Generate script
  const rawScript = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildScriptPrompt(opportunity, research) }],
  });

  // Step 2: Parse JSON response
  const script = parseScriptJSON(rawScript.content[0].text);

  // Step 3: Quality check
  const quality = runQualityChecks(script);
  if (!quality.pass) {
    logger.warn(`Script quality failed: ${quality.failReasons.join(', ')}. Retrying.`);
    return generateScript(opportunity, research, attempt + 1);
  }

  // Step 4: Fact check
  const factCheck = await runFactCheck(script);
  const finalScript = applyFactCheckCorrections(script, factCheck);

  // Step 5: Save to Supabase
  await supabase.from('videos').update({
    script_json: finalScript,
    status: 'scripted',
  }).eq('id', opportunity.id);

  return finalScript;
}
```

---

## 10. Performance Targets

| Metric | Target | Measurement |
|---|---|---|
| Script generation time | < 45 seconds | From API call to quality-checked JSON |
| Quality pass rate (first attempt) | > 75% | Reduces re-generation cost |
| Estimated video AVD from scripts | > 55% | Measured post-upload via Analytics API |
| Readability score | ≥ 60 Flesch | Auto-computed by quality checker |
| CTR prediction accuracy | ±2% of actual CTR | Validated weekly via learning engine |
