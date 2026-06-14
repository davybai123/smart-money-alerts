import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../lib/logger';
import { withRetry } from '../lib/retry';

const logger = createLogger('subtitles');

export interface SRTEntry {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
}

export interface SubtitleResult {
  srtPath: string;
  wordCount: number;
  durationSeconds: number;
}

function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is not set');
  return apiKey;
}

export function formatSRTTime(seconds: number): string {
  const totalMs = Math.round(seconds * 1000);
  const ms = totalMs % 1000;
  const totalSecs = Math.floor(totalMs / 1000);
  const secs = totalSecs % 60;
  const totalMins = Math.floor(totalSecs / 60);
  const mins = totalMins % 60;
  const hours = Math.floor(totalMins / 60);

  const hh = String(hours).padStart(2, '0');
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const mmm = String(ms).padStart(3, '0');

  return `${hh}:${mm}:${ss},${mmm}`;
}

export function parseSRT(srtContent: string): SRTEntry[] {
  const entries: SRTEntry[] = [];
  // Split on blank lines between subtitle blocks
  const blocks = srtContent.trim().split(/\r?\n\r?\n/);

  for (const block of blocks) {
    const lines = block.trim().split(/\r?\n/);
    if (lines.length < 3) continue;

    const index = parseInt(lines[0].trim(), 10);
    if (isNaN(index)) continue;

    const timeLine = lines[1].trim();
    const timeMatch = timeLine.match(
      /^(\d{2}:\d{2}:\d{2},\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2},\d{3})$/
    );
    if (!timeMatch) continue;

    const startTime = timeMatch[1];
    const endTime = timeMatch[2];
    const text = lines.slice(2).join('\n').trim();

    entries.push({ index, startTime, endTime, text });
  }

  return entries;
}

function srtTimeToSeconds(srtTime: string): number {
  // Format: HH:MM:SS,mmm
  const match = srtTime.match(/^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/);
  if (!match) return 0;
  const hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const secs = parseInt(match[3], 10);
  const ms = parseInt(match[4], 10);
  return hours * 3600 + mins * 60 + secs + ms / 1000;
}

export async function generateSubtitles(
  audioPath: string,
  outputPath: string
): Promise<SubtitleResult> {
  return withRetry(
    async () => {
      const apiKey = getApiKey();
      logger.info('Generating subtitles via Whisper', { audioPath, outputPath });

      if (!fs.existsSync(audioPath)) {
        throw new Error(`Audio file not found: ${audioPath}`);
      }

      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

      const form = new FormData();
      form.append('file', fs.createReadStream(audioPath), {
        filename: path.basename(audioPath),
        contentType: 'audio/mpeg',
      });
      form.append('model', 'whisper-1');
      form.append('response_format', 'srt');

      const response = await axios.post<string>(
        'https://api.openai.com/v1/audio/transcriptions',
        form,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            ...form.getHeaders(),
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      );

      const srtContent = response.data;
      await fs.promises.writeFile(outputPath, srtContent, 'utf-8');

      const entries = parseSRT(srtContent);
      const wordCount = entries.reduce(
        (acc, entry) => acc + entry.text.split(/\s+/).filter((w) => w.length > 0).length,
        0
      );

      let durationSeconds = 0;
      if (entries.length > 0) {
        const lastEntry = entries[entries.length - 1];
        durationSeconds = srtTimeToSeconds(lastEntry.endTime);
      }

      logger.info('Subtitles generated', {
        outputPath,
        wordCount,
        durationSeconds,
        entries: entries.length,
      });

      return { srtPath: outputPath, wordCount, durationSeconds };
    },
    { maxAttempts: 3, delayMs: 1000, backoff: true, label: 'whisper.generateSubtitles' }
  );
}
