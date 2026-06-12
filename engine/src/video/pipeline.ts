import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../lib/logger';
import { updateVideo } from '../db/client';
import type { Script, ScriptScene } from '../db/schema';
import { splitAndGenerateVoiceover } from '../voice/elevenlabs';
import { generateSceneVisuals } from '../visuals/replicate';
import { generateSubtitles } from './subtitles';
import { assembleVideo, SceneAsset } from './assembler';
import { generateThumbnail } from '../thumbnails/generator';

const logger = createLogger('video-pipeline');

export interface VideoProductionInput {
  script: Script;
  /** Resolved topic string (from associated ContentOpportunity) */
  topic: string;
  /** Resolved teams string (from associated ContentOpportunity) */
  teams: string;
  outputDir: string;
}

export interface VideoProductionResult {
  videoPath: string;
  thumbnailPath: string;
  durationSeconds: number;
}

export async function concatAudioFiles(
  audioPaths: string[],
  outputPath: string
): Promise<string> {
  logger.info('Concatenating audio files', { count: audioPaths.length, outputPath });
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

  const listPath = outputPath + '.concat.txt';
  const listContent = audioPaths.map((p) => `file '${p}'`).join('\n');
  await fs.promises.writeFile(listPath, listContent, 'utf-8');

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(listPath)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions(['-c copy'])
      .output(outputPath)
      .on('start', (cmdLine) => logger.debug('Audio concat started', { cmdLine: cmdLine.slice(0, 100) }))
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });

  await fs.promises.unlink(listPath);
  logger.info('Audio concatenation complete', { outputPath });
  return outputPath;
}

function ensureScenes(script: Script): ScriptScene[] {
  if (!script.full_script) {
    throw new Error('Script has no full_script content');
  }
  try {
    const parsed = JSON.parse(script.full_script);
    if (!Array.isArray(parsed)) {
      throw new Error('full_script is not an array');
    }
    return parsed as ScriptScene[];
  } catch (err) {
    throw new Error(`Failed to parse script scenes: ${(err as Error).message}`);
  }
}

async function mkdirAll(dirs: string[]): Promise<void> {
  await Promise.all(dirs.map((d) => fs.promises.mkdir(d, { recursive: true })));
}

export async function produceVideo(input: VideoProductionInput): Promise<VideoProductionResult> {
  const { script, topic, teams, outputDir } = input;

  logger.info('Starting video production pipeline', {
    scriptId: script.id,
    topic,
    outputDir,
  });

  // Step 1: Parse script scenes
  logger.info('Step 1: Parsing script scenes');
  const scenes = ensureScenes(script);
  logger.info('Scenes parsed', { count: scenes.length });

  // Step 2: Create output subdirectories
  logger.info('Step 2: Creating output directories');
  const audioDir = path.join(outputDir, 'audio');
  const imagesDir = path.join(outputDir, 'images');
  const clipsDir = path.join(outputDir, 'clips');
  const finalDir = path.join(outputDir, 'final');
  await mkdirAll([audioDir, imagesDir, clipsDir, finalDir]);

  try {
    // Step 3: Generate voiceover for each scene
    logger.info('Step 3: Generating scene voiceovers via ElevenLabs');
    const voiceoverResults = await splitAndGenerateVoiceover(scenes, audioDir);
    logger.info('Voiceovers complete', { count: voiceoverResults.length });

    // Step 4: Generate visuals for each scene
    logger.info('Step 4: Generating scene visuals via Replicate');
    const imageResults = await generateSceneVisuals(scenes, imagesDir);
    logger.info('Visuals complete', { count: imageResults.length });

    // Step 5: Concatenate all audio files into one track
    logger.info('Step 5: Concatenating audio files');
    const audioPaths = voiceoverResults.map((r) => r.filePath);
    const combinedAudioPath = path.join(audioDir, 'combined_voiceover.mp3');
    await concatAudioFiles(audioPaths, combinedAudioPath);

    // Step 6: Generate subtitles from combined audio
    logger.info('Step 6: Generating subtitles via Whisper');
    const subtitlePath = path.join(finalDir, 'subtitles.srt');
    const subtitleResult = await generateSubtitles(combinedAudioPath, subtitlePath);
    logger.info('Subtitles generated', subtitleResult);

    // Step 7: Build SceneAsset array matching images to audio durations
    logger.info('Step 7: Building scene assets');
    const sceneAssets: SceneAsset[] = scenes.map((scene, i) => {
      const imagePath = imageResults[i].localPath!;
      const duration = voiceoverResults[i].durationSeconds;
      return {
        imagePath,
        duration,
        sceneName: scene.segment,
      };
    });

    // Step 8: Assemble full video
    logger.info('Step 8: Assembling video via FFmpeg');
    const videoOutputPath = path.join(finalDir, `video_${script.id}.mp4`);
    const assemblyResult = await assembleVideo({
      scenes: sceneAssets,
      audioPath: combinedAudioPath,
      subtitlePath,
      outputPath: videoOutputPath,
    });
    logger.info('Video assembled', {
      outputPath: assemblyResult.outputPath,
      durationSeconds: assemblyResult.durationSeconds,
      fileSizeBytes: assemblyResult.fileSizeBytes,
    });

    // Step 9: Generate thumbnail
    logger.info('Step 9: Generating thumbnail');
    const thumbnailResult = await generateThumbnail({
      title: script.title,
      topic,
      teams,
      style: 'shock',
    });
    const thumbnailPath = thumbnailResult.imagePath;
    logger.info('Thumbnail generated', { thumbnailPath });

    // Step 10: Update video status in DB
    logger.info('Step 10: Updating video record in database');
    await updateVideo(script.id, {
      status: 'ready',
      video_path: assemblyResult.outputPath,
      thumbnail_path: thumbnailPath,
      duration_seconds: assemblyResult.durationSeconds,
      file_size_bytes: assemblyResult.fileSizeBytes,
    });
    logger.info('Database updated, production complete');

    return {
      videoPath: assemblyResult.outputPath,
      thumbnailPath,
      durationSeconds: assemblyResult.durationSeconds,
    };
  } catch (err) {
    logger.error('Video production failed', { error: (err as Error).message, scriptId: script.id });

    try {
      await updateVideo(script.id, { status: 'failed' });
    } catch (dbErr) {
      logger.error('Failed to update video status to failed', { error: (dbErr as Error).message });
    }

    throw err;
  }
}
