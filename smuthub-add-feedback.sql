-- ════════════════════════════════════════════════════════
--  smutHub: feedback table (members-only feedback)
--  Run in Supabase → SQL Editor. Safe to re-run.
-- ════════════════════════════════════════════════════════

create table if not exists feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users on delete cascade,
  page       text,
  message    text not null,
  created_at timestamptz default now()
);

alter table feedback enable row level security;

-- Members can submit feedback as themselves…
drop policy if exists "insert own feedback" on feedback;
create policy "insert own feedback" on feedback
  for insert with check (auth.uid() = user_id);

-- …and read back only their own submissions.
drop policy if exists "read own feedback" on feedback;
create policy "read own feedback" on feedback
  for select using (auth.uid() = user_id);
