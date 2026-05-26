create table public.wellbeing_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  logged_at timestamptz not null default now(),
  sleep_quality integer not null check (sleep_quality between 1 and 5),
  doms_level integer not null check (doms_level between 1 and 5),
  stress_level integer not null check (stress_level between 1 and 5),
  fatigue_level integer not null check (fatigue_level between 1 and 5),
  -- higher is better: sleep(raw) + (6-doms) + (6-stress) + (6-fatigue)
  wellbeing_score numeric generated always as (
    (sleep_quality + (6 - doms_level) + (6 - stress_level) + (6 - fatigue_level))::numeric / 4.0
  ) stored,
  created_at timestamptz not null default now()
);

create index wellbeing_logs_user_date_idx on public.wellbeing_logs (user_id, logged_at desc);

alter table public.wellbeing_logs enable row level security;

create policy "Users manage own wellbeing logs"
  on public.wellbeing_logs
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
