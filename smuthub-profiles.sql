-- smutHub: profiles table (usernames + saved bookcase theme)
-- Run once in Supabase → SQL Editor. Safe to re-run.

create table if not exists profiles (
  id         uuid primary key references auth.users on delete cascade,
  username   text unique,
  theme      text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
