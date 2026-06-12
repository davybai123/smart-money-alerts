import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../lib/logger';
import { withRetry } from '../lib/retry';
import type { ScriptScene } from '../db/schema';

const logger = createLogger('elevenlabs');

export interface VoiceoverResult {
  filePath: string;
  durationSeconds: number;
  fileSizeBytes: number;
}

function getEnvVars(): { apiKey: string; voiceId: string } {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY environment variable is not set');
  if (!voiceId) throw new Error('ELEVENLABS_VOICE_ID environment variable is not set');
  return { apiKey, voiceId };
}

export function estimateDuration(text: string): number {
  const wordCount = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
  return wordCount / 2.5;
}

export async function generateVoiceover(
  text: string,
  outputPath: string
): Promise<VoiceoverResult> {
  return withRetry(
    async () => {
      const { apiKey, voiceId } = getEnvVars();
      logger.info('Generating voiceover', { textLength: text.length, outputPath });

      const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;

      const response = await axios.post(
        url,
        {
          text,
          model_id: 'eleven_turbo_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        },
        {
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          responseType: 'stream',
        }
      );

      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

      await new Promise<void>((resolve, reject) => {
        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
        response.data.on('error', reject);
      });

      const stats = await fs.promises.stat(outputPath);
      const durationSeconds = estimateDuration(text);

      logger.info('Voiceover generated', {
        outputPath,
        durationSeconds,
        fileSizeBytes: stats.size,
      });

      return {
        filePath: outputPath,
        durationSeconds,
        fileSizeBytes: stats.size,
      };
    },
    { maxAttempts: 3, delayMs: 1000, backoff: true, label: 'elevenlabs.generateVoiceover' }
  );
}

export async function splitAndGenerateVoiceover(
  scenes: ScriptScene[],
  outputDir: string
): Promise<VoiceoverResult[]> {
  await fs.promises.mkdir(outputDir, { recursive: true });
  logger.info('Generating voiceovers for scenes', { sceneCount: scenes.length, outputDir });

  const results: VoiceoverResult[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const safeSegment = scene.segment.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
    const filename = `scene_${String(i).padStart(3, '0')}_${safeSegment}.mp3`;
    const outputPath = path.join(outputDir, filename);

    logger.info(`Generating voiceover for scene ${i + 1}/${scenes.length}`, {
      segment: scene.segment,
    });

    const result = await generateVoiceover(scene.narration, outputPath);
    results.push(result);
  }

  logger.info('All scene voiceovers generated', { count: results.length });
  return results;
}
