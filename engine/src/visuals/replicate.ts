import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../lib/logger';
import { withRetry, withTimeout } from '../lib/retry';
import type { ScriptScene } from '../db/schema';

const logger = createLogger('replicate');

const DEFAULT_MODEL =
  'stability-ai/sdxl:39ed52f2319f9c8f3d0d...placeholder_use_current_sdxl_version';
const POLL_INTERVAL_MS = 2000;
const PREDICTION_TIMEOUT_MS = 120_000;

export interface ImageResult {
  imageUrl: string;
  localPath?: string;
}

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string[];
  error?: string;
  urls?: {
    get: string;
    cancel: string;
  };
}

function getApiToken(): string {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN environment variable is not set');
  return token;
}

async function pollPrediction(predictionId: string, token: string): Promise<string> {
  const url = `https://api.replicate.com/v1/predictions/${predictionId}`;
  const headers = { Authorization: `Token ${token}` };

  const startTime = Date.now();

  while (true) {
    if (Date.now() - startTime > PREDICTION_TIMEOUT_MS) {
      throw new Error(`Prediction ${predictionId} timed out after ${PREDICTION_TIMEOUT_MS}ms`);
    }

    const response = await axios.get<ReplicatePrediction>(url, { headers });
    const prediction = response.data;

    logger.debug('Polling prediction', { id: predictionId, status: prediction.status });

    if (prediction.status === 'succeeded') {
      const output = prediction.output;
      if (!output || output.length === 0) {
        throw new Error('Prediction succeeded but returned no output');
      }
      return output[0];
    }

    if (prediction.status === 'failed') {
      throw new Error(`Prediction failed: ${prediction.error ?? 'unknown error'}`);
    }

    if (prediction.status === 'canceled') {
      throw new Error('Prediction was canceled');
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

export async function generateImage(
  prompt: string,
  options?: { width?: number; height?: number; model?: string }
): Promise<ImageResult> {
  return withRetry(
    async () => {
      const token = getApiToken();
      const modelVersion = options?.model ?? DEFAULT_MODEL;

      logger.info('Generating image', { prompt: prompt.slice(0, 80), modelVersion });

      const response = await axios.post<ReplicatePrediction>(
        'https://api.replicate.com/v1/predictions',
        {
          version: modelVersion,
          input: {
            prompt,
            negative_prompt: 'blurry, low quality, text, watermark',
            width: options?.width ?? 1920,
            height: options?.height ?? 1080,
            num_inference_steps: 30,
          },
        },
        {
          headers: {
            Authorization: `Token ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const predictionId = response.data.id;
      logger.info('Prediction created, polling for result', { predictionId });

      const imageUrl = await pollPrediction(predictionId, token);
      logger.info('Image generation complete', { imageUrl: imageUrl.slice(0, 80) });

      return { imageUrl };
    },
    { attempts: 3, delayMs: 2000 }
  );
}

export async function downloadImage(url: string, outputPath: string): Promise<string> {
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  logger.info('Downloading image', { url: url.slice(0, 80), outputPath });

  const response = await axios.get(url, { responseType: 'stream' });

  await new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
    response.data.on('error', reject);
  });

  logger.info('Image downloaded', { outputPath });
  return outputPath;
}

export function buildVisualPrompt(brollCue: string, tone: string): string {
  const styleMap: Record<string, string> = {
    dramatic:
      'dramatic cinematic lighting, high contrast, intense atmosphere, professional photography',
    celebratory: 'vibrant colors, festive atmosphere, crowd energy, professional sports photography',
    tense:
      'dark moody atmosphere, dramatic shadows, suspenseful composition, cinematic photography',
    analytical: 'clean sharp imagery, well-lit stadium, objective documentary style photography',
    emotional:
      'warm golden hour lighting, emotional atmosphere, close-up details, professional photography',
    exciting:
      'dynamic action shot, motion blur, high energy, vibrant colors, professional sports photography',
  };

  const toneModifier = styleMap[tone.toLowerCase()] ?? styleMap['dramatic'];
  return `cinematic, professional photography, 4K, ${brollCue}, ${toneModifier}, ultra-detailed, sharp focus, award-winning photography`;
}

export async function generateSceneVisuals(
  scenes: ScriptScene[],
  outputDir: string
): Promise<ImageResult[]> {
  await fs.promises.mkdir(outputDir, { recursive: true });
  logger.info('Generating scene visuals', { sceneCount: scenes.length, outputDir });

  const results: ImageResult[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const prompt = buildVisualPrompt(scene.broll_cue, scene.tone ?? 'dramatic');
    const safeSegment = scene.segment.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
    const localPath = path.join(outputDir, `scene_${String(i).padStart(3, '0')}_${safeSegment}.png`);

    logger.info(`Generating visual for scene ${i + 1}/${scenes.length}`, {
      segment: scene.segment,
      prompt: prompt.slice(0, 80),
    });

    const result = await generateImage(prompt);
    const downloadedPath = await downloadImage(result.imageUrl, localPath);

    results.push({ imageUrl: result.imageUrl, localPath: downloadedPath });
  }

  logger.info('All scene visuals generated', { count: results.length });
  return results;
}
