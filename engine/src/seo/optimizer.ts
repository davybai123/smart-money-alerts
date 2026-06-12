import { createLogger } from '../lib/logger';
import { generateJSON } from '../lib/claude';
import type { Script, ScriptScene } from '../db/schema';
import { estimateDuration } from '../voice/elevenlabs';

const logger = createLogger('seo-optimizer');

export interface Chapter {
  timestamp: string;
  title: string;
}

export interface SEOInput {
  topic: string;
  teams: string;
  stage: string;
  script: Script;
  keywords: string[];
}

export interface SEOOutput {
  titles: string[];
  selectedTitle: string;
  description: string;
  tags: string[];
  hashtags: string[];
  chapters: Chapter[];
}

interface RawSEOResponse {
  titles: string[];
  description: string;
  tags: string[];
  hashtags: string[];
  chapters: Array<{ timestamp: string; title: string }>;
}

const RAW_SEO_SCHEMA = `{
  "titles": ["string (max 70 chars, required x5)"],
  "description": "string (250-500 words)",
  "tags": ["string (max 30 chars each, 20 total)"],
  "hashtags": ["string (no # prefix, 5 total)"],
  "chapters": [
    { "timestamp": "MM:SS", "title": "string" }
  ]
}`;

const POWER_WORDS = [
  'shocking',
  'insane',
  'biggest',
  'worst',
  'best',
  'revealed',
  'truth',
  'secret',
  'unbelievable',
  'incredible',
  'outrageous',
  'exposed',
  'leaked',
  'destroyed',
  'dominated',
  'crushing',
];

export function scoreTitleCTR(title: string): number {
  let score = 0;
  const lowerTitle = title.toLowerCase();

  // Numbers boost
  if (/\d/.test(title)) {
    score += 10;
  }

  // Emotional / power words (+8 each)
  for (const word of POWER_WORDS) {
    if (lowerTitle.includes(word)) {
      score += 8;
    }
  }

  // Question mark
  if (title.includes('?')) {
    score += 5;
  }

  // Brackets or parentheses
  if (/[\[\]()\|]/.test(title)) {
    score += 3;
  }

  // Year (2024-2030)
  if (/\b20(2[4-9]|3\d)\b/.test(title)) {
    score += 4;
  }

  // Length penalty if over 60 chars
  if (title.length > 60) {
    score -= Math.floor((title.length - 60) / 5) * 2;
  }

  return score;
}

function selectBestTitle(titles: string[]): string {
  if (titles.length === 0) return '';
  let best = titles[0];
  let bestScore = scoreTitleCTR(best);

  for (let i = 1; i < titles.length; i++) {
    const score = scoreTitleCTR(titles[i]);
    if (score > bestScore) {
      bestScore = score;
      best = titles[i];
    }
  }

  return best;
}

export function estimateChapters(scenes: ScriptScene[]): Chapter[] {
  const chapters: Chapter[] = [];
  let cumulativeSeconds = 0;

  for (const scene of scenes) {
    const timestamp = formatChapterTimestamp(cumulativeSeconds);
    chapters.push({
      timestamp,
      title: scene.segment,
    });

    const sceneDuration = estimateDuration(scene.narration);
    cumulativeSeconds += sceneDuration;
  }

  return chapters;
}

function formatChapterTimestamp(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function parseScenesFromScript(script: Script): ScriptScene[] {
  if (!script.full_script) return [];
  try {
    const parsed = JSON.parse(script.full_script);
    return Array.isArray(parsed) ? (parsed as ScriptScene[]) : [];
  } catch {
    return [];
  }
}

export async function generateSEO(input: SEOInput): Promise<SEOOutput> {
  const { topic, teams, stage, script, keywords } = input;
  const scenes = parseScenesFromScript(script);

  logger.info('Generating SEO metadata', { topic, teams, stage });

  const keywordList = keywords.join(', ');
  const year = new Date().getFullYear();

  const prompt = `Generate YouTube SEO metadata for a soccer video about: "${topic}"
Teams involved: ${teams || 'N/A'}
Stage/Context: ${stage}
Target keywords: ${keywordList}
Year: ${year}

Requirements:
- 5 title variants, each MAX 70 characters, must include year ${year}, must include at least one emotional trigger word (shocking, insane, biggest, worst, best, revealed, truth, secret, unbelievable, incredible). Use numbers, brackets/parentheses, and questions where natural.
- Full description 250-500 words: start with a hook paragraph, include chapter timestamps like "00:00 Intro", keyword-rich body about the topic, call to action (Like, Subscribe, Comment), social links as placeholders: Subscribe: [CHANNEL_LINK] | Twitter: [TWITTER_LINK] | Instagram: [IG_LINK], and 5 hashtags at the bottom.
- 20 tags: mix of exact-match (e.g. "${topic}"), broad (e.g. "soccer analysis", "football highlights", "soccer ${year}"), and channel brand (e.g. "smart money alerts soccer"). Each tag max 30 characters.
- 5 hashtags without # prefix, relevant to topic.
- 5-8 chapters based on typical video structure, timestamps as MM:SS.`;

  const raw = await generateJSON<RawSEOResponse>(prompt, RAW_SEO_SCHEMA);

  const titles = raw.titles ?? [];
  const selectedTitle = selectBestTitle(titles);

  // If scenes are available, override chapters with real cumulative timestamps
  const chapters: Chapter[] =
    scenes.length > 0 ? estimateChapters(scenes) : (raw.chapters ?? []);

  logger.info('SEO metadata generated', {
    titleCount: titles.length,
    selectedTitle,
    tagCount: raw.tags?.length ?? 0,
    chapterCount: chapters.length,
  });

  return {
    titles,
    selectedTitle,
    description: raw.description ?? '',
    tags: raw.tags ?? [],
    hashtags: raw.hashtags ?? [],
    chapters,
  };
}
