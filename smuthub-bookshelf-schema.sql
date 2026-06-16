-- ════════════════════════════════════════════════════════
--  smutHub: bookshelf v2 — per-shelf customization + premium flag
--  Run once in Supabase → SQL Editor. Safe to re-run.
-- ════════════════════════════════════════════════════════

-- gen_random_uuid() ships with Supabase (Postgres 13+). This is a safe no-op
-- if the extension is already present; keep it in case the project is older.
create extension if not exists pgcrypto;

-- ── Premium flag lives on the EXISTING profiles table ──────────────
-- NOTE: the spec suggested a new `user_profile` table, but this project
-- already has `profiles` (id → auth.users, username, theme, created_at),
-- and auth.js already persists the bookcase theme to profiles.theme.
-- Creating a second profile table would split that storage, so we extend
-- the existing one instead. The bookcase theme stays in profiles.theme.
alter table profiles add column if not exists is_premium boolean default false;

-- ── Per-user, per-shelf customization (backdrop / lighting / props) ──
-- Does NOT modify the existing shelf or book_tags tables.
create table if not exists shelf_customization (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  shelf_status  text not null check (shelf_status in ('want','reading','read','dnf')),
  active_theme  text default 'walnut',
  backdrop_key  text,
  lighting_key  text,
  props         jsonb default '[]'::jsonb,   -- [{key:'candle', x:0.4, y:0.6, scale:1, rotation:0}, …]
  updated_at    timestamptz default now(),
  unique(user_id, shelf_status)
);

alter table shelf_customization enable row level security;

drop policy if exists "read own customization" on shelf_customization;
create policy "read own customization" on shelf_customization
  for select using (auth.uid() = user_id);

drop policy if exists "write own customization" on shelf_customization;
create policy "write own customization" on shelf_customization
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── How to preview premium while there's no payment system yet ──────
-- Gating is currently VISUAL ONLY (badges + upsell, nothing is blocked),
-- so you can use every theme today. When you later flip gating to real,
-- mark your own account premium with:
--   update profiles set is_premium = true where id = auth.uid();
