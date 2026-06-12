import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../lib/logger';

const logger = createLogger('assembler');

export interface SceneAsset {
  imagePath: string;
  duration: number;
  sceneName: string;
}

export interface AssemblyInput {
  scenes: SceneAsset[];
  audioPath: string;
  subtitlePath: string;
  backgroundMusicPath?: string;
  outputPath: string;
}

export interface AssemblyResult {
  outputPath: string;
  durationSeconds: number;
  fileSizeBytes: number;
}

function runFFmpeg(command: ffmpeg.FfmpegCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    command
      .on('start', (cmdLine) => logger.debug('FFmpeg started', { cmdLine: cmdLine.slice(0, 120) }))
      .on('progress', (progress) => {
        if (progress.percent) {
          logger.debug('FFmpeg progress', { percent: progress.percent.toFixed(1) });
        }
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

export async function createImageVideoClip(
  imagePath: string,
  duration: number,
  outputPath: string
): Promise<string> {
  logger.info('Creating image video clip', { imagePath, duration, outputPath });
  const startTime = Date.now();

  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

  const frameDuration = Math.ceil(duration * 25); // frames at 25fps

  const command = ffmpeg()
    .input(imagePath)
    .inputOptions(['-loop 1', `-t ${duration}`])
    .outputOptions([
      '-vf',
      `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+0.0015,1.5)':d=${frameDuration}:s=1920x1080`,
      '-c:v libx264',
      '-preset fast',
      '-crf 23',
      '-r 25',
      '-pix_fmt yuv420p',
    ])
    .output(outputPath);

  await runFFmpeg(command);
  logger.info('Image clip created', { outputPath, elapsed: Date.now() - startTime });
  return outputPath;
}

export async function concatenateClips(
  clipPaths: string[],
  outputPath: string
): Promise<string> {
  logger.info('Concatenating clips', { count: clipPaths.length, outputPath });
  const startTime = Date.now();

  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

  // Write concat list file
  const listPath = outputPath + '.concat.txt';
  const listContent = clipPaths.map((p) => `file '${p}'`).join('\n');
  await fs.promises.writeFile(listPath, listContent, 'utf-8');

  const command = ffmpeg()
    .input(listPath)
    .inputOptions(['-f concat', '-safe 0'])
    .outputOptions(['-c copy'])
    .output(outputPath);

  await runFFmpeg(command);
  await fs.promises.unlink(listPath);

  logger.info('Clips concatenated', { outputPath, elapsed: Date.now() - startTime });
  return outputPath;
}

async function mixAudio(
  voiceoverPath: string,
  backgroundMusicPath: string | undefined,
  outputPath: string
): Promise<string> {
  if (!backgroundMusicPath) {
    logger.info('No background music, using voiceover directly');
    return voiceoverPath;
  }

  logger.info('Mixing audio', { voiceoverPath, backgroundMusicPath, outputPath });
  const startTime = Date.now();

  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

  const command = ffmpeg()
    .input(voiceoverPath)
    .input(backgroundMusicPath)
    .complexFilter([
      // Voiceover at 100%, background music at 15%
      '[0:a]volume=1.0[voice]',
      '[1:a]volume=0.15,aloop=loop=-1:size=2e+09[music]',
      '[voice][music]amix=inputs=2:duration=first:dropout_transition=3[aout]',
    ])
    .outputOptions(['-map [aout]', '-c:a aac', '-b:a 192k'])
    .output(outputPath);

  await runFFmpeg(command);
  logger.info('Audio mixed', { outputPath, elapsed: Date.now() - startTime });
  return outputPath;
}

async function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, data) => {
      if (err) return reject(err);
      resolve(data.format.duration ?? 0);
    });
  });
}

export async function assembleVideo(input: AssemblyInput): Promise<AssemblyResult> {
  const { scenes, audioPath, subtitlePath, backgroundMusicPath, outputPath } = input;

  logger.info('Starting video assembly', {
    sceneCount: scenes.length,
    outputPath,
    hasBackgroundMusic: !!backgroundMusicPath,
  });

  const tmpDir = path.join(path.dirname(outputPath), '_tmp_assembly');
  await fs.promises.mkdir(tmpDir, { recursive: true });
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

  // Step 1: Create per-scene video clips with Ken Burns effect
  logger.info('Step 1: Creating per-scene video clips');
  const step1Start = Date.now();
  const clipPaths: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const clipPath = path.join(tmpDir, `clip_${String(i).padStart(3, '0')}.mp4`);
    await createImageVideoClip(scene.imagePath, scene.duration, clipPath);
    clipPaths.push(clipPath);
  }
  logger.info('Step 1 done', { elapsed: Date.now() - step1Start });

  // Step 2: Concatenate all clips into one raw video
  logger.info('Step 2: Concatenating clips');
  const step2Start = Date.now();
  const rawVideoPath = path.join(tmpDir, 'raw_video.mp4');
  await concatenateClips(clipPaths, rawVideoPath);
  logger.info('Step 2 done', { elapsed: Date.now() - step2Start });

  // Step 3: Mix audio (voiceover + optional background music)
  logger.info('Step 3: Mixing audio');
  const step3Start = Date.now();
  const mixedAudioPath = path.join(tmpDir, 'mixed_audio.m4a');
  const finalAudioPath = await mixAudio(audioPath, backgroundMusicPath, mixedAudioPath);
  logger.info('Step 3 done', { elapsed: Date.now() - step3Start });

  // Step 4 + 5: Burn subtitles, apply color grade, final render
  logger.info('Step 4/5: Burning subtitles, color grading, final render');
  const step4Start = Date.now();

  // Escape subtitle path for FFmpeg filter (colons are special)
  const escapedSubtitlePath = subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:');

  const command = ffmpeg()
    .input(rawVideoPath)
    .input(finalAudioPath)
    .complexFilter([
      // Color grade: contrast 1.1, brightness 0.02, saturation 1.2
      `[0:v]eq=contrast=1.1:brightness=0.02:saturation=1.2,subtitles='${escapedSubtitlePath}':force_style='FontName=Arial,FontSize=20,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Shadow=1,Alignment=2,MarginV=30'[vout]`,
    ])
    .outputOptions([
      '-map [vout]',
      '-map 1:a',
      '-c:v libx264',
      '-preset medium',
      '-crf 23',
      '-r 24',
      '-s 1920x1080',
      '-pix_fmt yuv420p',
      '-c:a aac',
      '-b:a 192k',
      '-movflags +faststart',
    ])
    .output(outputPath);

  await runFFmpeg(command);
  logger.info('Step 4/5 done', { elapsed: Date.now() - step4Start });

  // Cleanup tmp clips
  for (const clipPath of clipPaths) {
    await fs.promises.unlink(clipPath).catch(() => {});
  }
  await fs.promises.unlink(rawVideoPath).catch(() => {});
  if (finalAudioPath !== audioPath) {
    await fs.promises.unlink(finalAudioPath).catch(() => {});
  }
  await fs.promises.rmdir(tmpDir).catch(() => {});

  const durationSeconds = await getVideoDuration(outputPath);
  const stats = await fs.promises.stat(outputPath);

  logger.info('Video assembly complete', {
    outputPath,
    durationSeconds,
    fileSizeBytes: stats.size,
  });

  return {
    outputPath,
    durationSeconds,
    fileSizeBytes: stats.size,
  };
}
