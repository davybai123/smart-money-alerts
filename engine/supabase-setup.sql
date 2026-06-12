-- Run this in Supabase → SQL Editor → New Query → Run

create table if not exists content_opportunities (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  teams text not null,
  match_date text not null,
  demand_score numeric not null default 0,
  competition_score numeric not null default 0,
  opportunity_score numeric not null default 0,
  predicted_ctr numeric not null default 0,
  predicted_rpm numeric not null default 0,
  sources jsonb not null default '{}',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists scripts (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references content_opportunities(id) on delete cascade,
  title text not null,
  hook text not null,
  full_script text not null,
  word_count integer not null default 0,
  estimated_duration_seconds integer not null default 0,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  script_id uuid references scripts(id) on delete cascade,
  opportunity_id uuid references content_opportunities(id) on delete cascade,
  youtube_id text,
  title text not null,
  description text not null default '',
  tags text[] not null default '{}',
  thumbnail_url text,
  video_url text,
  status text not null default 'assembling',
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists video_metrics (
  id uuid primary key default gen_random_uuid(),
  video_id uuid references videos(id) on delete cascade,
  youtube_id text not null,
  measured_at timestamptz not null default now(),
  views integer not null default 0,
  watch_time_minutes numeric not null default 0,
  avg_view_duration_seconds numeric not null default 0,
  impressions integer not null default 0,
  ctr numeric not null default 0,
  likes integer not null default 0,
  comments integer not null default 0,
  subscribers_gained integer not null default 0,
  estimated_revenue numeric not null default 0
);

create table if not exists thumbnail_variants (
  id uuid primary key default gen_random_uuid(),
  video_id uuid references videos(id) on delete cascade,
  variant text not null check (variant in ('A', 'B', 'C')),
  image_url text not null,
  impressions integer not null default 0,
  ctr numeric not null default 0,
  winner boolean not null default false,
  created_at timestamptz not null default now()
);
