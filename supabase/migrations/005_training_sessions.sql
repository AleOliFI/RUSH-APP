create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  session_date date not null,
  session_type text check (
    session_type in ('easy', 'tempo', 'interval', 'long_run', 'race', 'cross_training', 'rest')
  ),
  distance_km numeric,
  duration_minutes integer,
  avg_heart_rate integer,
  max_heart_rate integer,
  avg_pace_per_km_seconds integer,
  trimp_score numeric,
  source text not null default 'manual' check (
    source in ('manual', 'strava', 'garmin', 'apple_health', 'google_fit')
  ),
  external_id text,
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

create index training_sessions_user_date_idx on public.training_sessions (user_id, session_date desc);

alter table public.training_sessions enable row level security;

create policy "Users manage own sessions"
  on public.training_sessions
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
