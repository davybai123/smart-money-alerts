# FacelessYT — End-to-End Video Production Pipeline

**Date:** 2026-06-12
**Module:** `engine/modules/voice/`, `engine/modules/visuals/`, `engine/modules/assembly/`
**Estimated Total Runtime:** 8-15 minutes per video

---

## 1. Overview

The video pipeline consumes a quality-checked `Script` JSON and produces a publication-ready 1080p MP4. Every component is fully automated — no human touch is required from script input to final rendered video. The pipeline is broken into parallel and sequential phases to minimize total wall-clock time.

```
INPUT: Script JSON (from script engine)
         │
         ├─────────────────────────┐
         ▼                         ▼
    VOICE GENERATION          VISUAL GENERATION
    (ElevenLabs TTS)          (Replicate SDXL/SVD)
    ~3-5 minutes              ~10-15 minutes (parallel)
         │                         │
         ▼                         ▼
    MP3 AUDIO                 IMAGE/VIDEO ASSETS
    → S3 /audio/              → S3 /images/, /clips/
         │                         │
         └─────────────┬───────────┘
                       ▼
               SUBTITLE GENERATION
               (OpenAI Whisper on MP3)
               ~2-3 minutes
                       │
                       ▼
               VIDEO ASSEMBLY (FFmpeg)
               ~5-8 minutes
                       │
                       ▼
OUTPUT: 1920×1080 MP4, H.264, AAC, 24fps
        → S3 /videos/
```

---

## 2. Phase 1: Scene Parsing

**File:** `engine/modules/assembly/scene-parser.ts`

The scene parser reads the `Script.scenes[]` array and creates a production manifest: a flat list of every visual segment, its duration, its narration text, and its B-roll instruction.

```typescript
interface ProductionSegment {
  segmentIndex: number;
  startTime: number;          // seconds from video start
  endTime: number;
  duration: number;
  narrationText: string;      // sent to ElevenLabs
  brollInstruction: string;   // sent to visual prompt builder
  tone: string;               // voice direction
  emphasisWords: string[];
}

function parseScenes(script: Script): ProductionSegment[] {
  return script.scenes.flatMap((scene, i) => {
    // Split scenes > 60s into sub-segments for visual variety
    if (scene.timingEnd - scene.timingStart > 60) {
      return splitIntoSubSegments(scene, 45); // max 45s per visual segment
    }
    return [mapSceneToSegment(scene, i)];
  });
}
```

Output: array of 12-18 `ProductionSegment` objects for an 8-10 minute video.

---

## 3. Phase 2A: Voice Generation (ElevenLabs)

**File:** `engine/modules/voice/elevenlabs.ts`

### 3.1 Voice Selection

Two voices are configured for the channel:

| Voice | ElevenLabs ID | Use Case |
|---|---|---|
| Josh | `TxGEqnHWrfWFTfGW9XjX` | Deep, authoritative. Used for analysis/tactics content |
| Rachel | `21m00Tcm4TlvDq8ikWAM` | Warm, engaging. Used for narrative/biography content |

Voice selection is based on the script's dominant tone flag. Topic clusters "tactics", "analysis", "controversy" → Josh. "Biography", "story", "history" → Rachel.

### 3.2 Generation Process

```typescript
async function generateVoiceover(segments: ProductionSegment[]): Promise<AudioAsset> {

  // Concatenate all narration with natural pause markers
  const fullScript = segments.map(seg => {
    // Add SSML-style pause markers at segment boundaries
    return seg.narrationText + (seg.emphasisWords.length > 0
      ? `<break time="300ms"/>` // Slight pause after emphasized points
      : '');
  }).join(' ');

  const response = await elevenlabs.textToSpeech.convert(VOICE_ID, {
    text: fullScript,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,           // Balanced expressiveness
      similarity_boost: 0.75,   // Strong voice consistency
      style: 0.4,               // Some stylistic variation
      use_speaker_boost: true,
    },
    output_format: 'mp3_44100_192',  // 192kbps MP3, 44.1kHz
  });

  // Stream to S3
  const s3Key = `audio/${videoId}/narration.mp3`;
  await uploadStreamToS3(response, s3Key);

  return { s3Key, duration: estimateDuration(fullScript), format: 'mp3' };
}
```

### 3.3 Timing Alignment

After voice generation, the actual audio duration is measured (via ffprobe) and compared against the script's intended timing. If the audio is more than 10% shorter or longer than the target duration, the scene timing is recalculated to match the actual audio. This ensures subtitles and visuals align correctly with the real voice pacing.

---

## 4. Phase 2B: Visual Asset Generation (Replicate)

**File:** `engine/modules/visuals/replicate.ts`, `engine/modules/visuals/prompt-builder.ts`

### 4.1 Visual Prompt Generation

Each B-roll instruction is converted into an optimized Stable Diffusion prompt:

```typescript
function buildVisualPrompt(brollInstruction: string, metadata: VideoMetadata): SDXLPrompt {
  const baseStyle = 'cinematic photography, 4K, sharp focus, dramatic lighting, professional sports photography';
  const negativePrompt = 'text, watermark, logo, low quality, blurry, cartoon, anime, illustration';

  // Parse the B-roll instruction for key subjects
  const subjects = extractSubjects(brollInstruction);
  const setting = extractSetting(brollInstruction);
  const emotion = extractEmotion(brollInstruction);

  return {
    prompt: `${subjects}, ${setting}, ${emotion}, ${baseStyle}`,
    negative_prompt: negativePrompt,
    width: 1920,
    height: 1080,
    num_inference_steps: 30,
    guidance_scale: 7.5,
    scheduler: 'K_EULER_ANCESTRAL',
  };
}
```

**Example transformations:**
- `[B-ROLL: Brazil match highlights montage, goalkeeper saves]` → `"Brazilian soccer player making a diving save, stadium crowd, green pitch, professional sports photography, cinematic 4K"`
- `[B-ROLL: World Cup trophy close-up]` → `"FIFA World Cup trophy golden, dramatic studio lighting, macro close-up, sharp focus, 4K"`

### 4.2 Asset Generation Strategy

For a 10-minute video, the visual mix is:

| Asset Type | Count | Replicate Model | Approx Time | Cost |
|---|---|---|---|---|
| Static images (SDXL) | 10-12 | `stability-ai/sdxl` | 5-10s each | ~$0.002/image |
| Short video clips (SVD) | 4-6 | `stability-ai/stable-video-diffusion` | 60-90s each | ~$0.09/clip |
| Stock fallback (if gen fails) | 0-3 | Pexels API (free) | instant | $0 |

Static images are used for 3-4 second holds. SVD clips are used for sections where motion adds emotional impact (goals, celebrations, action sequences).

### 4.3 Parallel Generation

All visual assets are generated in parallel with a concurrency limit of 5:

```typescript
async function generateAllVisuals(segments: ProductionSegment[]): Promise<VisualAsset[]> {
  const prompts = segments.map(buildVisualPrompt);

  // Separate images from video clip requests
  const imageSegments = segments.filter(s => s.duration <= 5);
  const videoSegments = segments.filter(s => s.duration > 5 && needsMotion(s));

  // Generate in parallel with concurrency control
  const [images, clips] = await Promise.all([
    generateImagesInParallel(imageSegments, { concurrency: 5 }),
    generateClipsInParallel(videoSegments, { concurrency: 3 }),
  ]);

  return [...images, ...clips];
}
```

### 4.4 Fallback: Stock Footage

If Replicate fails after 3 retries or returns unusable output, the system falls back to Pexels or Unsplash:

```typescript
async function fetchStockFallback(query: string): Promise<VisualAsset> {
  const pexels = await fetch(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1`,
    { headers: { Authorization: process.env.PEXELS_API_KEY } }
  );
  // Return first result URL + duration
}
```

---

## 5. Phase 3: Subtitle Generation (OpenAI Whisper)

**File:** `engine/modules/assembly/subtitle-generator.ts`

```typescript
async function generateSubtitles(audioS3Key: string): Promise<SubtitleFile> {
  // Download audio from S3
  const audioBuffer = await downloadFromS3(audioS3Key);

  // Call Whisper API
  const transcription = await openai.audio.transcriptions.create({
    file: audioBuffer,
    model: 'whisper-1',
    response_format: 'srt',     // SRT format directly
    language: 'en',
    temperature: 0.0,           // Deterministic for consistency
  });

  // Post-process SRT: fix common soccer terminology
  const correctedSRT = fixDomainTerminology(transcription, SOCCER_GLOSSARY);

  // Save to S3
  const srtKey = `subtitles/${videoId}/narration.srt`;
  await uploadToS3(correctedSRT, srtKey);

  return { srtKey, wordCount: countWords(correctedSRT) };
}
```

**Soccer terminology glossary** (common Whisper misrecognitions corrected):
- "FIFA" not "Fifa"
- "VAR" not "var" or "bar"
- "Mbappe" → "Mbappé"
- "Haaland" not "Harland"
- Proper team names, stadium names

---

## 6. Phase 4: FFmpeg Video Assembly

**File:** `engine/modules/assembly/ffmpeg-assembler.ts`

This is the most complex phase. FFmpeg executes a multi-step pipeline to produce the final video.

### 6.1 Assembly Sequence

```bash
# Step 1: Prepare individual visual clips
# For each static image: create 4-5 second video with Ken Burns effect
ffmpeg -loop 1 -t 4.5 -i image_01.png \
  -vf "zoompan=z='min(zoom+0.0015,1.5)':d=135:s=1920x1080" \
  -c:v libx264 -pix_fmt yuv420p clip_01.mp4

# Step 2: Concatenate all clips using filter complex
ffmpeg -i clip_01.mp4 -i clip_02.mp4 ... -i clip_N.mp4 \
  -filter_complex "[0:v][1:v]...[N:v]concat=n=N:v=1:a=0[outv]" \
  -map "[outv]" video_concat.mp4

# Step 3: Add narration audio
ffmpeg -i video_concat.mp4 -i narration.mp3 \
  -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 \
  video_with_audio.mp4

# Step 4: Mix background music at -20dB relative to narration
ffmpeg -i video_with_audio.mp4 -i background_music.mp3 \
  -filter_complex "[1:a]volume=0.15[music];[0:a][music]amix=inputs=2:duration=first[audio]" \
  -map 0:v -map "[audio]" video_with_music.mp4

# Step 5: Burn subtitles with styled appearance
ffmpeg -i video_with_music.mp4 \
  -vf "subtitles=narration.srt:force_style='FontSize=28,FontName=Montserrat,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,Shadow=1,MarginV=40'" \
  video_with_subtitles.mp4

# Step 6: Apply color grade LUT (cinematic soccer broadcast look)
ffmpeg -i video_with_subtitles.mp4 \
  -vf "lut3d=broadcast_sports.cube" \
  video_color_graded.mp4

# Step 7: Final render — H.264 at high quality
ffmpeg -i video_color_graded.mp4 \
  -c:v libx264 -preset slow -crf 18 -profile:v high -level 4.1 \
  -c:a aac -b:a 192k -ar 44100 \
  -r 24 -s 1920x1080 \
  -movflags +faststart \
  final_output.mp4
```

### 6.2 Output Specifications

| Parameter | Specification |
|---|---|
| Resolution | 1920×1080 (Full HD) |
| Video codec | H.264 (libx264) |
| Video profile | High, Level 4.1 |
| CRF | 18 (visually lossless) |
| Frame rate | 24fps |
| Audio codec | AAC |
| Audio bitrate | 192 kbps |
| Audio sample rate | 44,100 Hz |
| Max file size | 500MB (typical ~150-300MB) |
| Web optimization | `-movflags +faststart` (streaming ready) |

### 6.3 Background Music Library

A library of 20 royalty-free instrumental tracks is stored in S3 `/music/`:
- Energetic (for controversy, breaking news content)
- Dramatic (for historical, biography content)
- Upbeat (for positive results, tournament highlights)
- Subtle ambient (for tactical analysis)

Music selection is determined by the script's dominant tone. Volume is fixed at 15% of narration level.

---

## 7. Error Handling & Retry Logic

```typescript
const RETRY_CONFIG = {
  voice:    { maxAttempts: 3, delay: 10_000, backoffFactor: 2 },
  visual:   { maxAttempts: 3, delay: 30_000, backoffFactor: 1.5, fallback: fetchStockFallback },
  subtitle: { maxAttempts: 3, delay: 5_000,  backoffFactor: 2 },
  assembly: { maxAttempts: 2, delay: 60_000, backoffFactor: 1 },
};

// On all retries exhausted:
// 1. Log failure with full error context to job_logs table
// 2. Send Telegram alert: "⚠️ Pipeline failure: [phase] for video [id]"
// 3. Move job to dead letter queue
// 4. Continue with remaining videos (don't block the full daily run)
```

**Checkpoint/Resume Pattern:**
Each phase saves its output to S3 before the next phase begins. If the pipeline is interrupted (server restart, crash), it can resume from the last completed checkpoint rather than re-running expensive phases.

```typescript
async function checkResumable(videoId: string): Promise<PipelineCheckpoint> {
  const video = await supabase.from('videos').select('*').eq('id', videoId).single();
  return {
    hasAudio:     await s3KeyExists(`audio/${videoId}/narration.mp3`),
    hasVisuals:   await s3KeyExists(`images/${videoId}/`),
    hasSubtitles: await s3KeyExists(`subtitles/${videoId}/narration.srt`),
    hasFinalVideo: await s3KeyExists(`videos/${videoId}/final.mp4`),
  };
}
```

---

## 8. Time Budget

| Phase | Estimated Duration | Parallel? |
|---|---|---|
| Scene parsing | < 5 seconds | — |
| Voice generation (ElevenLabs) | 3-5 minutes | Yes (with visuals) |
| Visual generation (Replicate, 12 assets) | 10-15 minutes | Yes (with voice) |
| Subtitle generation (Whisper) | 2-3 minutes | No (needs audio) |
| FFmpeg assembly (6-step) | 5-8 minutes | No (sequential) |
| S3 upload of final video | 1-3 minutes | — |
| **Total (wall clock)** | **~18-25 minutes** | — |

With three videos per day and parallel processing where possible, the full batch completes within approximately 90 minutes, well within the allocated window (09:30-11:00 UTC).
