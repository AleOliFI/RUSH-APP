create table public.hrv_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  measured_at timestamptz not null default now(),
  rmssd numeric not null check (rmssd > 0),
  rhr integer check (rhr > 0 and rhr < 300),
  measurement_method text not null check (
    measurement_method in (
      'camera_ppg', 'accelerometer_scg', 'strava', 'garmin',
      'apple_health', 'google_fit', 'manual'
    )
  ),
  duration_seconds integer,
  quality_score numeric check (quality_score >= 0 and quality_score <= 1),
  raw_rr_intervals jsonb,
  created_at timestamptz not null default now()
);

create index hrv_readings_user_date_idx on public.hrv_readings (user_id, measured_at desc);

alter table public.hrv_readings enable row level security;

create policy "Users manage own readings"
  on public.hrv_readings
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
