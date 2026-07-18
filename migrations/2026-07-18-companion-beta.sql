-- ════════════════════════════════════════════════════════════════════════
--  smutHub · Companion beta
--
--  Private allowlist, companion preferences, reading progress, and a small
--  conversation history. Safe to re-run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- Access is intentionally separate from profiles. Members can update their
-- own profile, so a boolean there would let them grant themselves beta access.
create table if not exists companion_beta_access (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  active        boolean not null default true,
  note          text,
  granted_at    timestamptz not null default now(),
  expires_at    timestamptz
);

alter table companion_beta_access enable row level security;

drop policy if exists "read own companion beta access" on companion_beta_access;
create policy "read own companion beta access" on companion_beta_access
  for select using (
    auth.uid() = user_id
    and active
    and (expires_at is null or expires_at > now())
  );

-- No insert/update/delete policy is created. Access is granted only from the
-- Supabase dashboard, SQL editor, or another service-role admin surface.

create table if not exists companion_profiles (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  companion_name   text not null default 'Aren',
  archetype        text not null default 'guardian'
                     check (archetype in ('guardian','rival','confidant')),
  voice_style      text not null default 'velvet'
                     check (voice_style in ('velvet','ember','stillwater')),
  initiative       text not null default 'contextual'
                     check (initiative in ('quiet','contextual','proactive')),
  flirt_level      int not null default 1 check (flirt_level between 0 and 3),
  spoiler_mode     text not null default 'strict'
                     check (spoiler_mode in ('strict','ask','off')),
  updated_at       timestamptz not null default now()
);

alter table companion_profiles enable row level security;
drop policy if exists "manage own companion profile" on companion_profiles;
create policy "manage own companion profile" on companion_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists reading_progress (
  user_id       uuid not null references auth.users(id) on delete cascade,
  book_key      text not null,
  chapter       text,
  percent       int check (percent between 0 and 100),
  notes         text,
  updated_at    timestamptz not null default now(),
  primary key (user_id, book_key)
);

alter table reading_progress enable row level security;
drop policy if exists "manage own reading progress" on reading_progress;
create policy "manage own reading progress" on reading_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists companion_messages (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null check (role in ('user','assistant')),
  content       text not null check (char_length(content) between 1 and 4000),
  page_context  text,
  created_at    timestamptz not null default now()
);

create index if not exists companion_messages_user_time_idx
  on companion_messages (user_id, created_at desc);

alter table companion_messages enable row level security;
drop policy if exists "read own companion messages" on companion_messages;
create policy "read own companion messages" on companion_messages
  for select using (auth.uid() = user_id);
drop policy if exists "insert own companion messages" on companion_messages;
create policy "insert own companion messages" on companion_messages
  for insert with check (auth.uid() = user_id);
drop policy if exists "delete own companion messages" on companion_messages;
create policy "delete own companion messages" on companion_messages
  for delete using (auth.uid() = user_id);

-- Grant a tester by email (run manually, replacing the address):
-- insert into companion_beta_access (user_id, note)
-- select id, 'founding tester' from auth.users where email = 'reader@example.com'
-- on conflict (user_id) do update set active = true, expires_at = null;

-- Remove access without deleting their settings or history:
-- update companion_beta_access set active = false where user_id =
--   (select id from auth.users where email = 'reader@example.com');
