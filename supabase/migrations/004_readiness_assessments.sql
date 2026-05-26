create table public.readiness_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  assessed_at date not null default current_date,
  hrv_reading_id uuid references public.hrv_readings,
  wellbeing_log_id uuid references public.wellbeing_logs,
  hrv_status text not null check (
    hrv_status in ('elevated', 'baseline', 'below_baseline', 'low_trend', 'calibrating')
  ),
  rhr_status text not null check (rhr_status in ('reduced', 'normal', 'elevated')),
  wellbeing_status text not null check (
    wellbeing_status in ('excellent', 'good', 'poor', 'very_poor')
  ),
  readiness_state integer not null check (readiness_state between 1 and 5),
  readiness_color text not null check (
    readiness_color in ('green', 'yellow', 'orange', 'red', 'dark_red', 'gray')
  ),
  readiness_score numeric not null check (readiness_score >= 0 and readiness_score <= 100),
  training_directive text not null check (
    training_directive in ('high_intensity', 'moderate', 'regenerative', 'rest', 'calibrating')
  ),
  prescription_text text not null,
  example_session text not null default '',
  baseline_rmssd_7d numeric,
  cv_7d numeric,
  created_at timestamptz not null default now(),
  unique (user_id, assessed_at)
);

create index readiness_user_date_idx on public.readiness_assessments (user_id, assessed_at desc);

alter table public.readiness_assessments enable row level security;

create policy "Users manage own assessments"
  on public.readiness_assessments
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
