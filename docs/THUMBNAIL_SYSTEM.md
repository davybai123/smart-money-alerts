# FacelessYT — High-CTR Thumbnail Generation System

**Date:** 2026-06-12
**Module:** `engine/modules/thumbnail/`
**Target CTR:** 6-10% (industry average for sports content: 3-5%)

---

## 1. Overview

The thumbnail is the single highest-leverage element in a YouTube video's performance. Before a viewer reads the title, they see the thumbnail. In YouTube's browse and homepage feed, thumbnails compete side-by-side. A thumbnail that achieves 8% CTR versus 4% CTR results in 2x the views from the same impression count — a direct multiplier on all downstream metrics: watch time, revenue, subscriber growth.

The thumbnail system generates three variants per video using different styles, overlays text automatically, scores each variant for predicted CTR, and implements A/B testing via YouTube's thumbnail system. After a statistical threshold of impressions is reached, the learning engine declares a winner and updates style preferences.

---

## 2. Architecture Overview

```
Script JSON + Topic Data
         │
         ▼
  Thumbnail Brief Builder
  (extract: key faces, dramatic moment, core message, emotion target)
         │
         ▼
  ┌──────────────────────────────────────────────┐
  │  VARIANT GENERATOR (3 variants in parallel)  │
  │                                              │
  │  Variant A: Shock Face style                 │
  │  Variant B: Number/Stat Reveal style         │
  │  Variant C: Fire/Drama style                 │
  └──────────────────────────────────────────────┘
         │
         ▼
  Text Overlay Engine (sharp + canvas)
  (title keywords, numbers, emoji accents)
         │
         ▼
  CTR Pre-Scorer
  (contrast ratio, text size, focal point, color psychology)
         │
         ▼
  Mobile Optimization Check
  (legible at 120×90px)
         │
         ▼
  Upload to S3 /thumbs/
  Upload all 3 to YouTube (thumbnails.set + A/B rotation)
```

---

## 3. The Five Thumbnail Templates

### Template 1: Shock Face
**Best for:** Controversy, shocking reveals, player controversies

The "shock face" template places a human face in extreme emotional expression as the dominant element. Research across high-performing YouTube thumbnails shows that human faces with exaggerated emotion achieve 23% higher CTR than thumbnails without faces.

```typescript
const shockFacePrompt = (topic: string) => `
  extreme close-up of a soccer player's face showing shock, disbelief, jaw dropped open,
  ${topic}, dramatic stadium lighting, dark background, hyper-realistic, 
  8K photography, sharp eyes, emotional, cinematic
  NEGATIVE: blurry, text, watermark, cartoon, illustration
`;
```

Text overlay position: Top-left for one word ("SHOCKING", "EXPOSED"), bottom-right for a supporting stat.
Background treatment: Deep shadow vignette on edges, face brightly lit.

---

### Template 2: Comparison / Split Screen
**Best for:** "X vs Y" topics, before/after, team comparisons

Two subjects placed side-by-side with a visual divider. A "vs" element in the center. Each side has a distinct color treatment (warm left, cool right, or competing team colors).

```typescript
const comparisonPrompt = (subjectA: string, subjectB: string) => `
  split screen composition, left side: ${subjectA}, right side: ${subjectB},
  professional sports photography, dramatic lighting, vivid colors,
  center dividing line, mirror composition, 1920x1080
`;
```

Text overlay: Left label, "VS" in center, right label. High contrast with drop shadow.
Color rule: Use competing team's official colors where possible.

---

### Template 3: Number/Stat Reveal
**Best for:** Record-breaking stats, "Top 10" lists, milestone stories

A clean, bold number dominates the frame. The number must be surprising enough to create a curiosity gap. Background is a high-energy sports action image.

```typescript
const numberRevealPrompt = (context: string) => `
  ${context}, dynamic action shot, motion blur, stadium atmosphere,
  dark moody background, professional sports photography, bokeh,
  cinematic lens flare, dramatic overhead lighting
`;
```

Text overlay: The number in extreme 200pt+ font. Supporting context in 60pt below.
Rule: The number must be visible and readable on a phone screen in 0.5 seconds.

---

### Template 4: Fire / Explosion / Drama
**Best for:** Hot takes, rivalries, tournament drama, elimination stories

High-energy visual with fire, sparks, or dramatic atmospheric effects. Used when the topic has intensity and urgency.

```typescript
const firePrompt = (subject: string) => `
  ${subject}, surrounded by dramatic fire effects, stadium night atmosphere,
  sparks, smoke, epic cinematic lighting, lens flare, ultra-wide angle,
  dramatic sky, silhouette effect, 4K
`;
```

Color palette: Red, orange, gold — urgency and excitement.
Text: White or yellow knockout text. Maximum 3 words.

---

### Template 5: Countdown / Bracket
**Best for:** Tournament previews, "X days until...", predictions

A clean countdown number or tournament bracket graphic as the dominant element. Works best for scheduled events and predictions.

```typescript
const countdownPrompt = (context: string) => `
  ${context}, stadium crowd, dramatic wide angle, twilight lighting,
  epic scale, World Cup atmosphere, professional photography,
  bokeh foreground elements, cinematic depth of field
`;
```

Text overlay: Large countdown number with supporting label.
Design: Bold geometric borders, official tournament color palette.

---

## 4. Image Generation (Replicate SDXL)

```typescript
interface ThumbnailGenerationJob {
  videoId: string;
  variant: 'A' | 'B' | 'C';
  style: ThumbnailStyle;
  prompt: string;
  negativePrompt: string;
}

async function generateThumbnailBase(job: ThumbnailGenerationJob): Promise<string> {
  const output = await replicate.run(
    'stability-ai/sdxl:39ed52f2319f9e57e...', // pinned model hash
    {
      input: {
        prompt: job.prompt,
        negative_prompt: job.negativePrompt,
        width: 1280,
        height: 720,
        num_inference_steps: 40,    // Higher than video assets for quality
        guidance_scale: 8.5,
        scheduler: 'K_EULER_ANCESTRAL',
        num_outputs: 1,
        apply_watermark: false,
        high_noise_frac: 0.8,
      },
    }
  );

  // Download from Replicate URL, upload to S3
  const s3Key = `thumbs/${job.videoId}/base_${job.variant}.png`;
  await downloadAndUploadToS3(output[0], s3Key);
  return s3Key;
}
```

---

## 5. Text Overlay Engine

**File:** `engine/modules/thumbnail/text-overlay.ts`

Uses `sharp` for image manipulation and `@napi-rs/canvas` for text rendering:

```typescript
interface TextOverlayConfig {
  primaryText: string;        // Max 3 words, ALL CAPS
  secondaryText?: string;     // Max 6 words, mixed case
  primaryFontSize: number;    // 80-120pt depending on text length
  secondaryFontSize: number;  // 40-60pt
  primaryColor: string;       // '#FFFFFF' default
  primaryOutlineColor: string;// '#000000' default
  outlineWidth: number;       // 4-6px
  dropShadow: boolean;        // true always
  primaryPosition: TextPosition;
  secondaryPosition: TextPosition;
  badgeText?: string;         // e.g., "NEW", "MUST WATCH"
  badgeColor?: string;
}

async function applyTextOverlay(
  imageS3Key: string,
  config: TextOverlayConfig,
  outputS3Key: string
): Promise<void> {

  const imageBuffer = await downloadFromS3(imageS3Key);

  // Create canvas for text rendering
  const canvas = createCanvas(1280, 720);
  const ctx = canvas.getContext('2d');

  // Draw base image
  const img = await loadImage(imageBuffer);
  ctx.drawImage(img, 0, 0, 1280, 720);

  // Apply gradient overlay for text legibility
  const gradient = ctx.createLinearGradient(0, 450, 0, 720);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1280, 720);

  // Render primary text with outline
  ctx.font = `bold ${config.primaryFontSize}px "Montserrat"`;
  ctx.fillStyle = config.primaryColor;
  ctx.strokeStyle = config.primaryOutlineColor;
  ctx.lineWidth = config.outlineWidth;
  ctx.strokeText(config.primaryText, ...getPosition(config.primaryPosition));
  ctx.fillText(config.primaryText, ...getPosition(config.primaryPosition));

  // Render badge if present
  if (config.badgeText) {
    renderBadge(ctx, config.badgeText, config.badgeColor ?? '#FF0000');
  }

  // Convert to JPEG for YouTube (max 2MB)
  const outputBuffer = canvas.toBuffer('image/jpeg', { quality: 0.92 });
  await uploadToS3(outputBuffer, outputS3Key, 'image/jpeg');
}
```

### Text Extraction from Script

```typescript
function extractThumbnailText(script: Script, topic: string): TextOverlayConfig {
  // Extract the most emotionally charged phrase from the HOOK segment
  const hookText = script.scenes.find(s => s.segment === 'HOOK')?.narration ?? '';

  // Claude micro-prompt: "Extract the 2-3 most clickable words from: [hookText]"
  const primaryText = await extractClickablePhrase(hookText);

  // Secondary text from topic or key stat
  const secondaryText = extractKeyStatFromScript(script);

  return {
    primaryText: primaryText.toUpperCase(),
    secondaryText,
    primaryFontSize: primaryText.length > 10 ? 72 : 96,
    // ... rest of config
  };
}
```

---

## 6. A/B Testing System

Three variants are uploaded to YouTube simultaneously. YouTube itself A/B tests them automatically by rotating which thumbnail impressions see — this is the built-in YouTube Studio A/B testing behavior.

The engine tracks:

```typescript
// On upload: save all 3 thumbnail S3 keys to thumbnail_variants table
await supabase.from('thumbnail_variants').insert([
  { video_id: videoId, s3_key: variantA, style: 'shock_face', impressions: 0, ctr: 0 },
  { video_id: videoId, s3_key: variantB, style: 'number_reveal', impressions: 0, ctr: 0 },
  { video_id: videoId, s3_key: variantC, style: 'fire_drama', impressions: 0, ctr: 0 },
]);
```

**Declaring a winner (Learning Engine):**
- After 500 total impressions per variant (1,500 total impressions)
- The variant with highest CTR is declared the winner
- Winner is set as the permanent thumbnail via `thumbnails.set` API
- Winner style is recorded as a positive signal for future thumbnail generation

---

## 7. Mobile Optimization

At 120×90 pixels (the size YouTube shows thumbnails in mobile grid view), the thumbnail must still communicate the core emotional hook.

```typescript
async function checkMobileReadability(thumbnailS3Key: string): Promise<MobileCheckResult> {
  // Download and resize to 120x90
  const tiny = await sharp(await downloadFromS3(thumbnailS3Key))
    .resize(120, 90)
    .toBuffer();

  // Check: is there enough contrast between text and background?
  // Uses luminance difference formula (WCAG 2.1 contrast ratio)
  const contrastRatio = await measureTextContrast(tiny);

  // Check: is the focal point (face/number) visible at this size?
  const focalVisible = await checkFocalPointVisibility(tiny);

  return {
    contrastRatio,
    focalVisible,
    pass: contrastRatio >= 4.5 && focalVisible,
  };
}
```

If the mobile check fails, the system automatically increases font size by 15% and re-renders.

---

## 8. Color Psychology Guide

Color choices in thumbnails are not arbitrary. The engine uses a color selection matrix based on the topic's emotional target:

| Emotion Target | Primary Colors | Use Case |
|---|---|---|
| Urgency / Alarm | Red (`#FF0000`), Orange (`#FF6B00`) | Breaking news, controversy, elimination |
| Excitement / Energy | Yellow (`#FFD700`), Gold (`#FFA500`) | Tournament wins, records, celebrations |
| Credibility / Analysis | Blue (`#1E3A8A`), White (`#FFFFFF`) | Tactical breakdowns, statistics |
| Envy / Aspiration | Green (`#22C55E`), Gold | Money stats, contract reveals, transfer fees |
| Drama / Mystery | Deep Purple (`#6B21A8`), Dark Red | Scandal, secret stories, untold histories |

The dominant color of the topic's associated team (where applicable) should be incorporated as an accent.

---

## 9. Quality Checklist

Before a thumbnail batch is marked complete, all three variants must pass:

| Check | Requirement | Failure Action |
|---|---|---|
| File size | < 2MB JPEG | Re-compress at lower quality |
| Dimensions | Exactly 1280×720 | Re-render at correct dimensions |
| Mobile contrast | WCAG ≥ 4.5:1 | Increase font size + outline, re-render |
| Text length | Primary ≤ 3 words, Secondary ≤ 6 words | Trim text, re-render |
| Face/focal visible at 120×90 | Yes | Crop to tighter focal point |
| No watermark or logo | Confirmed | Reject asset, regenerate |
| JPEG format (not PNG) | Confirmed | Convert |

---

## 10. Canva API Alternative (Optional)

For teams who prefer template-based thumbnails over AI generation, Canva Connect API provides:

```typescript
// Use Canva's brand template system
const design = await canva.createDesign({
  design_type: { type: 'custom', width: 1280, height: 720 },
  from_brand_template: TEMPLATE_ID,
  dataset: {
    primary_text: thumbnailText.primaryText,
    secondary_text: thumbnailText.secondaryText,
    background_image_url: backgroundImageUrl,
  },
});
```

This produces pixel-perfect template-consistent thumbnails but requires upfront template design work. Recommended as a phase 2 upgrade once the SDXL + overlay pipeline has validated which styles work best.
