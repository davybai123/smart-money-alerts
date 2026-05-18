-- =============================================================================
-- PT App - Initial Database Schema
-- =============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table if not exists public.profiles (
  id            uuid references auth.users(id) on delete cascade primary key,
  username      text unique,
  full_name     text not null default '',
  avatar_url    text,
  age           int not null default 25,
  height_cm     int not null default 175,
  weight_kg     decimal(5,2) not null default 75,
  goal          text not null default 'general_fitness'
                  check (goal in ('weight_loss','fat_loss','muscle_gain','strength','athletic_performance','general_fitness')),
  activity_level text not null default 'moderately_active'
                  check (activity_level in ('sedentary','lightly_active','moderately_active','very_active','extremely_active')),
  daily_calorie_target int not null default 2500,
  protein_target       int not null default 150,
  carbs_target         int not null default 280,
  fat_target           int not null default 80,
  water_target_litres  decimal(3,1) not null default 3.0,
  sport         text,
  position      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- RLS
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- FOOD LOGS
-- ============================================================
create table if not exists public.food_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  date         date not null default current_date,
  meal         text not null check (meal in ('breakfast','lunch','dinner','snack','pre_workout','post_workout')),
  food_name    text not null,
  brand        text,
  barcode      text,
  calories     decimal(8,2) not null default 0,
  protein      decimal(6,2) not null default 0,
  carbs        decimal(6,2) not null default 0,
  fat          decimal(6,2) not null default 0,
  fiber        decimal(6,2),
  sugar        decimal(6,2),
  quantity     decimal(6,2) not null default 1,
  serving_unit text not null default 'serving',
  created_at   timestamptz not null default now()
);

create index food_logs_user_date on public.food_logs(user_id, date);

alter table public.food_logs enable row level security;
create policy "Users own food logs" on public.food_logs for all using (auth.uid() = user_id);

-- ============================================================
-- WORKOUT SESSIONS
-- ============================================================
create table if not exists public.workout_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  date             date not null default current_date,
  title            text not null,
  type             text not null default 'strength'
                     check (type in ('strength','cardio','rugby','hiit','recovery','mobility','sport_specific')),
  duration_minutes int not null default 60,
  notes            text,
  rpe              int check (rpe between 1 and 10),
  ai_generated     boolean not null default false,
  created_at       timestamptz not null default now()
);

create index workout_sessions_user_date on public.workout_sessions(user_id, date desc);

alter table public.workout_sessions enable row level security;
create policy "Users own workout sessions" on public.workout_sessions for all using (auth.uid() = user_id);

-- ============================================================
-- WORKOUT EXERCISES
-- ============================================================
create table if not exists public.workout_exercises (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.workout_sessions(id) on delete cascade,
  name         text not null,
  sets         int not null default 3,
  reps         int not null default 10,
  weight_kg    decimal(6,2) not null default 0,
  notes        text,
  rest_seconds int default 90,
  order_index  int not null default 0
);

create index workout_exercises_session on public.workout_exercises(session_id, order_index);

alter table public.workout_exercises enable row level security;
create policy "Users own exercises via session" on public.workout_exercises for all
  using (session_id in (select id from public.workout_sessions where user_id = auth.uid()));

-- ============================================================
-- AI MESSAGES
-- ============================================================
create table if not exists public.ai_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

create index ai_messages_user on public.ai_messages(user_id, created_at asc);

alter table public.ai_messages enable row level security;
create policy "Users own ai messages" on public.ai_messages for all using (auth.uid() = user_id);

-- ============================================================
-- BODY METRICS (progress tracking)
-- ============================================================
create table if not exists public.body_metrics (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          date not null default current_date,
  weight_kg     decimal(5,2) not null,
  body_fat_pct  decimal(4,1),
  notes         text,
  created_at    timestamptz not null default now(),
  unique(user_id, date)
);

create index body_metrics_user_date on public.body_metrics(user_id, date desc);

alter table public.body_metrics enable row level security;
create policy "Users own body metrics" on public.body_metrics for all using (auth.uid() = user_id);

-- ============================================================
-- WATER LOGS (daily water tracking)
-- ============================================================
create table if not exists public.water_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null default current_date,
  litres      decimal(4,2) not null default 0,
  updated_at  timestamptz not null default now(),
  unique(user_id, date)
);

alter table public.water_logs enable row level security;
create policy "Users own water logs" on public.water_logs for all using (auth.uid() = user_id);

-- ============================================================
-- HELPER VIEWS
-- ============================================================
create or replace view public.daily_nutrition_summary as
select
  user_id,
  date,
  sum(calories) as total_calories,
  sum(protein)  as total_protein,
  sum(carbs)    as total_carbs,
  sum(fat)      as total_fat,
  sum(fiber)    as total_fiber,
  count(*)      as food_items
from public.food_logs
group by user_id, date;
