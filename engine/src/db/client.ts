import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '../lib/logger';
import {
  ContentOpportunity,
  Script,
  Video,
  VideoMetrics,
  ThumbnailVariant,
} from './schema';

const log = createLogger('db/client');

// ─── Supabase client singleton ─────────────────────────────────────────────

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_KEY env vars must be set');
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function insert<T>(table: string, data: Partial<T>): Promise<T> {
  log.debug(`Inserting into ${table}`, { data });
  const { data: result, error } = await getSupabase()
    .from(table)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(data as any)
    .select()
    .single();
  if (error) {
    log.error(`Insert into ${table} failed`, { error: error.message });
    throw new Error(`DB insert error (${table}): ${error.message}`);
  }
  log.info(`Inserted into ${table}`, { id: (result as Record<string, unknown>).id });
  return result as T;
}

async function select<T>(
  table: string,
  filters?: Record<string, unknown>
): Promise<T[]> {
  log.debug(`Selecting from ${table}`, { filters });
  let query = getSupabase().from(table).select('*');
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value as string);
    }
  }
  const { data, error } = await query;
  if (error) {
    log.error(`Select from ${table} failed`, { error: error.message });
    throw new Error(`DB select error (${table}): ${error.message}`);
  }
  return (data ?? []) as T[];
}

async function selectOne<T>(
  table: string,
  id: string
): Promise<T | null> {
  log.debug(`Select one from ${table}`, { id });
  const { data, error } = await getSupabase()
    .from(table)
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null; // row not found
    log.error(`Select one from ${table} failed`, { error: error.message });
    throw new Error(`DB selectOne error (${table}): ${error.message}`);
  }
  return data as T;
}

async function update<T>(
  table: string,
  id: string,
  data: Partial<T>
): Promise<void> {
  log.debug(`Updating ${table}`, { id, data });
  const { error } = await getSupabase()
    .from(table)
    .update(data as Record<string, unknown>)
    .eq('id', id);
  if (error) {
    log.error(`Update ${table} failed`, { id, error: error.message });
    throw new Error(`DB update error (${table}): ${error.message}`);
  }
  log.info(`Updated ${table}`, { id });
}

// ─── Content Opportunities ─────────────────────────────────────────────────

export async function insertOpportunity(
  data: Omit<ContentOpportunity, 'id' | 'created_at'>
): Promise<ContentOpportunity> {
  return insert<ContentOpportunity>('content_opportunities', data);
}

export async function getOpportunities(
  status?: string
): Promise<ContentOpportunity[]> {
  const filters = status ? { status } : undefined;
  return select<ContentOpportunity>('content_opportunities', filters);
}

export async function updateOpportunity(
  id: string,
  data: Partial<ContentOpportunity>
): Promise<void> {
  return update<ContentOpportunity>('content_opportunities', id, data);
}

// ─── Scripts ───────────────────────────────────────────────────────────────

export async function insertScript(
  data: Omit<Script, 'id' | 'created_at'>
): Promise<Script> {
  return insert<Script>('scripts', data);
}

export async function getScript(id: string): Promise<Script | null> {
  return selectOne<Script>('scripts', id);
}

// ─── Videos ────────────────────────────────────────────────────────────────

export async function insertVideo(
  data: Omit<Video, 'id' | 'created_at'>
): Promise<Video> {
  return insert<Video>('videos', data);
}

export async function updateVideo(
  id: string,
  data: Partial<Video>
): Promise<void> {
  return update<Video>('videos', id, data);
}

// ─── Video Metrics ─────────────────────────────────────────────────────────

export async function insertMetrics(
  data: Omit<VideoMetrics, 'id'>
): Promise<void> {
  log.debug('Inserting video metrics', { video_id: data.video_id });
  const { error } = await getSupabase()
    .from('video_metrics')
    .insert(data);
  if (error) {
    log.error('Insert video_metrics failed', { error: error.message });
    throw new Error(`DB insert error (video_metrics): ${error.message}`);
  }
  log.info('Inserted video metrics', { video_id: data.video_id });
}

export async function getVideoMetrics(
  videoId: string
): Promise<VideoMetrics[]> {
  return select<VideoMetrics>('video_metrics', { video_id: videoId });
}

// ─── Thumbnail Variants ────────────────────────────────────────────────────

export async function insertThumbnailVariant(
  data: Omit<ThumbnailVariant, 'id' | 'created_at'>
): Promise<ThumbnailVariant> {
  return insert<ThumbnailVariant>('thumbnail_variants', data);
}

export async function updateThumbnailVariant(
  id: string,
  data: Partial<ThumbnailVariant>
): Promise<void> {
  return update<ThumbnailVariant>('thumbnail_variants', id, data);
}
