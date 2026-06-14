import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../lib/logger';
import { generateImage, downloadImage } from '../visuals/replicate';

const logger = createLogger('thumbnail-generator');

export interface ThumbnailInput {
  title: string;
  topic: string;
  teams: string;
  style: 'shock' | 'comparison' | 'number' | 'fire' | 'countdown';
}

export interface ThumbnailResult {
  imagePath: string;
  imageUrl: string;
}

const THUMBNAIL_WIDTH = 1280;
const THUMBNAIL_HEIGHT = 720;

const STYLE_PROMPTS: Record<ThumbnailInput['style'], string> = {
  shock:
    'dramatic close-up shocked face, soccer stadium background, cinematic lighting, 8K, ultra detailed, professional sports photography',
  comparison:
    'split screen two teams, professional sports photography, dramatic lighting, 8K, sharp focus, cinematic composition',
  number:
    'bold number graphic, soccer ball, stadium, dramatic colors, 4K, professional sports graphic, cinematic',
  fire: 'soccer ball on fire, dramatic explosion, dark background, 8K cinematic, glowing flames, professional photography',
  countdown:
    'dramatic clock countdown, soccer stadium crowd, tension, cinematic, 8K, dramatic lighting, professional photography',
};

const TEXT_POSITIONS: Record<string, { x: string; y: string; fontsize: number }> = {
  shock: { x: '(w-tw)/2', y: 'h-th-40', fontsize: 52 },
  comparison: { x: '(w-tw)/2', y: 'h-th-40', fontsize: 48 },
  number: { x: '(w-tw)/2', y: '40', fontsize: 64 },
  fire: { x: '(w-tw)/2', y: 'h-th-40', fontsize: 52 },
  countdown: { x: '(w-tw)/2', y: '(h-th)/2', fontsize: 60 },
};

function buildThumbnailPrompt(input: ThumbnailInput): string {
  const basePrompt = STYLE_PROMPTS[input.style];
  // Extract key words from title to guide the image
  const titleKeywords = input.title
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5)
    .join(', ');

  const teamsContext = input.teams ? `, featuring ${input.teams}` : '';
  return `${basePrompt}${teamsContext}, theme: ${titleKeywords}, no text, no watermarks`;
}

export async function addTextOverlay(
  imagePath: string,
  text: string,
  style: string
): Promise<string> {
  const truncated = text.length > 30 ? text.slice(0, 30) : text;
  const outputPath = imagePath.replace(/(\.[^.]+)$/, '_text$1');

  const position = TEXT_POSITIONS[style] ?? TEXT_POSITIONS['shock'];

  logger.info('Adding text overlay', { imagePath, text: truncated, style });

  // Escape special characters in text for FFmpeg drawtext
  const escapedText = truncated
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:');

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(imagePath)
      .complexFilter([
        // Bold white text with black stroke/shadow
        `[0:v]drawtext=text='${escapedText}':fontsize=${position.fontsize}:fontcolor=white:bordercolor=black:borderw=4:shadowcolor=black@0.8:shadowx=3:shadowy=3:x=${position.x}:y=${position.y}:font=Arial:fontweight=bold[vout]`,
      ])
      .outputOptions(['-map [vout]', '-c:v png'])
      .output(outputPath)
      .on('start', (cmdLine) => logger.debug('Drawtext started', { cmdLine: cmdLine.slice(0, 120) }))
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });

  logger.info('Text overlay added', { outputPath });
  return outputPath;
}

export async function generateThumbnail(input: ThumbnailInput): Promise<ThumbnailResult> {
  logger.info('Generating thumbnail', { title: input.title, style: input.style });

  const prompt = buildThumbnailPrompt(input);
  logger.debug('Thumbnail prompt', { prompt });

  // Generate image via Replicate SDXL at thumbnail dimensions
  const imageResult = await generateImage(prompt, {
    width: THUMBNAIL_WIDTH,
    height: THUMBNAIL_HEIGHT,
  });

  // Download to temp location
  const tmpDir = path.join(process.cwd(), 'tmp', 'thumbnails');
  await fs.promises.mkdir(tmpDir, { recursive: true });

  const safeStyle = input.style.replace(/[^a-z0-9]/g, '_');
  const safeTitle = input.title
    .replace(/[^a-zA-Z0-9]/g, '_')
    .slice(0, 40);
  const rawPath = path.join(tmpDir, `thumb_${safeStyle}_${safeTitle}_raw.png`);

  await downloadImage(imageResult.imageUrl, rawPath);

  // Add text overlay
  const finalPath = await addTextOverlay(rawPath, input.title, input.style);

  // Remove the raw version
  await fs.promises.unlink(rawPath).catch(() => {});

  logger.info('Thumbnail generated', { imagePath: finalPath, style: input.style });

  return {
    imagePath: finalPath,
    imageUrl: imageResult.imageUrl,
  };
}

export async function generateThumbnailVariants(
  input: Omit<ThumbnailInput, 'style'>
): Promise<ThumbnailResult[]> {
  const styles: ThumbnailInput['style'][] = ['shock', 'number', 'fire'];
  logger.info('Generating thumbnail variants', { styles, title: input.title });

  const results: ThumbnailResult[] = [];

  for (const style of styles) {
    logger.info(`Generating ${style} variant`);
    const result = await generateThumbnail({ ...input, style });
    results.push(result);
  }

  logger.info('All thumbnail variants generated', { count: results.length });
  return results;
}
