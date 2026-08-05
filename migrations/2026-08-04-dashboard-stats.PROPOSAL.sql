-- ════════════════════════════════════════════════════════════════════════
--  smutHub · PROPOSAL — DO NOT RUN until reviewed & approved by Josh
--  Dashboard redesign data — favourites, finished dates, series completion
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. ⭐ Favourite flag (per shelved book) ──────────────────────────────
-- Powers "Your favourites". Toggled from the book modal on your own shelf.
alter table shelf add column if not exists favourite boolean not null default false;

-- Public read of favourites on public shelves: the existing "read public shelves"
-- policy already covers SELECT on shelf for public profiles, so favourites ride
-- along with no extra policy. Owners keep write via their existing owner policy.

-- ── 2. finished_at — when a book was actually READ ──────────────────────
-- shelf.created_at is when a book was ADDED, not read. finished_at powers the
-- reading-pace chart and "read this year". Set it when status moves to 'read'.
-- Existing reads stay NULL (no retroactive/fake dates) and simply don't count
-- toward pace until re-marked; new "→ Read" transitions stamp it.
alter table shelf add column if not exists finished_at timestamptz;

-- Optional convenience: backfill finished_at = created_at for CURRENT reads, so
-- the pace chart isn't empty on day one. ONLY run this if you accept that these
-- dates are "added" dates standing in for "finished" — comment out to keep them null.
-- update shelf set finished_at = created_at where status = 'read' and finished_at is null;

-- ── 3. series table — is a series finished, and how many books? ─────────
-- Catalog books carry `series` + `series_number`, but nothing says whether a
-- series is COMPLETE (author done) vs ongoing. This curated table supplies that,
-- so the dashboard can tell "Completed" apart from "caught up, waiting for the
-- next book", and show accurate X/Y even when the catalog is missing an entry.
create table if not exists series (
  name         text primary key,          -- must match books.series exactly
  is_complete  boolean not null default false,
  total_books  int,                        -- published count; null → count catalog rows
  created_at   timestamptz default now()
);
alter table series enable row level security;

-- Public read (series metadata isn't sensitive); writes are admin-only.
drop policy if exists "read series" on series;
create policy "read series" on series for select using (true);

drop policy if exists "admin writes series" on series;
create policy "admin writes series" on series
  for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- Seed examples (edit to taste; add rows as you curate):
--   insert into series (name, is_complete, total_books) values
--     ('A Court of Thorns and Roses', false, 5),
--     ('The Folk of the Air', true, 3)
--   on conflict (name) do update set is_complete = excluded.is_complete, total_books = excluded.total_books;

-- ════════════════════════════════════════════════════════════════════════
--  ROLLBACK
--    drop table if exists series;
--    alter table shelf drop column if exists favourite;
--    alter table shelf drop column if exists finished_at;
-- ════════════════════════════════════════════════════════════════════════
