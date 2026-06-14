// ============================================================
// Supabase table type definitions for the FacelessYT engine
// ============================================================

export type ContentOpportunityStatus =
  | 'pending'
  | 'selected'
  | 'scripted'
  | 'produced'
  | 'uploaded'
  | 'rejected';

export interface ContentOpportunity {
  id: string;
  topic: string;
  teams: string;
  match_date: string;
  demand_score: number;         // 0-100
  competition_score: number;    // 0-100
  opportunity_score: number;    // 0-100
  predicted_ctr: number;
  predicted_rpm: number;
  sources: Record<string, unknown>;
  status: ContentOpportunityStatus;
  created_at: string;
}

export type ScriptStatus = 'draft' | 'approved' | 'producing';

export interface Script {
  id: string;
  opportunity_id: string;
  title: string;
  hook: string;
  full_script: string;           // JSON stringified ScriptScene[]
  word_count: number;
  estimated_duration_seconds: number;
  status: ScriptStatus;
  created_at: string;
}

export type VideoStatus =
  | 'assembling'
  | 'ready'
  | 'uploading'
  | 'scheduled'
  | 'published'
  | 'failed';

export interface Video {
  id: string;
  script_id: string;
  opportunity_id: string;
  youtube_id: string | null;
  title: string;
  description: string;
  tags: string[];
  thumbnail_url: string | null;
  video_url: string | null;      // S3 URL
  status: VideoStatus;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
}

export interface VideoMetrics {
  id: string;
  video_id: string;
  youtube_id: string;
  measured_at: string;
  views: number;
  watch_time_minutes: number;
  avg_view_duration_seconds: number;
  impressions: number;
  ctr: number;
  likes: number;
  comments: number;
  subscribers_gained: number;
  estimated_revenue: number;
}

export type ThumbnailVariant = {
  id: string;
  video_id: string;
  variant: 'A' | 'B' | 'C';
  image_url: string;
  impressions: number;
  ctr: number;
  winner: boolean;
  created_at: string;
};

export type ScriptSegment =
  | 'hook'
  | 'open_loop'
  | 'problem'
  | 'story'
  | 'value'
  | 'twist'
  | 'payoff'
  | 'cta';

export interface ScriptScene {
  scene_number: number;
  segment: ScriptSegment;
  narration: string;
  broll_cue: string;
  tone: string;
  duration_seconds: number;
}
