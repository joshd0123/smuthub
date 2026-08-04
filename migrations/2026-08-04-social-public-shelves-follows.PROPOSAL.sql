-- ════════════════════════════════════════════════════════════════════════
--  smutHub · PROPOSAL — DO NOT RUN until reviewed & approved by Josh
--  Social layer v1 — Phases 1+2
--    • Phase 1: opt-in PUBLIC bookshelves (a shelf is private until you turn it on)
--    • Phase 2: one-directional FOLLOW graph
--
--  Design principles:
--    • Fail-closed. Everything is private by default; nothing is exposed unless
--      the owner sets is_public = true.
--    • Additive. We ADD read policies alongside the existing owner-only ones.
--      Postgres RLS is permissive (policies OR together), so private rows stay
--      owner-only. No existing policy is dropped.
--    • No column leakage. Public reads of profile data go through a view that
--      exposes ONLY safe columns (username, created_at) — never is_admin, never
--      the raw profiles row.
--
--  Pre-req to verify before running (ask if unsure):
--    • `shelf` and `book_tags` already have RLS enabled with owner-only SELECT
--      (confirmed: anon reads return []). This migration ADDS a public-read path.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. The opt-in flag ───────────────────────────────────────────────────
-- Default false: making this migration live does NOT expose anyone. Each user
-- (including the founder) must explicitly opt in.
alter table profiles add column if not exists is_public boolean not null default false;

-- ── 2. SECURITY DEFINER helper — "is this user's shelf public?" ───────────
-- Used by the shelf / book_tags / follows policies. SECURITY DEFINER so the
-- check reads profiles.is_public without recursing into profiles' own RLS
-- (a policy that self-queries the same table under RLS can recurse/deadlock).
-- It returns ONLY a boolean — it cannot be used to read profile contents.
create or replace function public.profile_is_public(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$ select coalesce((select is_public from profiles where id = uid), false) $$;
revoke all on function public.profile_is_public(uuid) from public;
grant execute on public.profile_is_public(uuid) to anon, authenticated;

-- ── 3. Safe public-profile view (definer → bypasses profiles RLS, but only
--       ever returns these columns for is_public rows). The app reads THIS,
--       never the profiles table, for anyone but the signed-in user. Because
--       we do NOT add a public SELECT policy to the profiles base table,
--       is_admin and any future private column can never leak. ─────────────
create or replace view public.public_profiles as
  select id, username, created_at
  from profiles
  where is_public = true;
grant select on public.public_profiles to anon, authenticated;

-- ── 4. Public READ policies for shelf + book_tags, gated on the owner being
--       public. Added ALONGSIDE the existing owner-only SELECT policies. ────
drop policy if exists "read public shelves" on shelf;
create policy "read public shelves" on shelf
  for select using (public.profile_is_public(user_id));

drop policy if exists "read public book_tags" on book_tags;
create policy "read public book_tags" on book_tags
  for select using (public.profile_is_public(user_id));

-- ── 5. Follow graph (one-directional; "add friend" = follow) ──────────────
create table if not exists follows (
  follower_id  uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);
alter table follows enable row level security;

-- Read: only edges you are part of — who you follow, and who follows you.
-- (Other people's full follower lists are NOT world-readable in v1. Public
--  follower/following COUNTS, if wanted later, should come from a definer RPC.)
drop policy if exists "read own follow edges" on follows;
create policy "read own follow edges" on follows
  for select using (auth.uid() = follower_id or auth.uid() = following_id);

-- Follow: only as yourself, and only someone who is currently public.
drop policy if exists "follow" on follows;
create policy "follow" on follows
  for insert with check (auth.uid() = follower_id and public.profile_is_public(following_id));

-- Unfollow: only your own edges.
drop policy if exists "unfollow" on follows;
create policy "unfollow" on follows
  for delete using (auth.uid() = follower_id);

-- ── 6. (Optional, recommended) helpful indexes ───────────────────────────
create index if not exists follows_following_idx on follows (following_id);
create index if not exists profiles_public_username_idx on profiles (username) where is_public;

-- ════════════════════════════════════════════════════════════════════════
--  ROLLBACK (if needed)
--    drop table if exists follows;
--    drop view if exists public.public_profiles;
--    drop function if exists public.profile_is_public(uuid);
--    drop policy if exists "read public shelves" on shelf;
--    drop policy if exists "read public book_tags" on book_tags;
--    alter table profiles drop column if exists is_public;
-- ════════════════════════════════════════════════════════════════════════
