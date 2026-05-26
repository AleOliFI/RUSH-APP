create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  gender text check (gender in ('male', 'female', 'other')),
  date_of_birth date,
  weekly_mileage_km numeric,
  runner_level text check (runner_level in ('beginner', 'intermediate', 'advanced')),
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'premium')),
  subscription_expires_at timestamptz,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
