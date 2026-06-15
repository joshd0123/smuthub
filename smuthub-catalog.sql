-- ════════════════════════════════════════════════════════
--  smutHub: your own book catalog
--  Run once in Supabase → SQL Editor. Safe to re-run.
--
--  This is YOUR database of books. The Search page's "browse" (empty box)
--  shows a random set of catalog books that have a cover_url — so you control
--  exactly which books feature and which cover each uses (no more depending on
--  Google's flaky edition-matching). Manage rows in Supabase → Table Editor.
-- ════════════════════════════════════════════════════════

create table if not exists catalog (
  id         bigint generated always as identity primary key,
  title      text not null,
  author     text,
  cover_url  text,                 -- paste a working image URL; that's what browse shows
  spice      int,                  -- optional default 🌶️ rating (1–5)
  tropes     text[] default '{}',  -- optional, e.g. {enemies-to-lovers, fae}
  blurb      text,
  year       int,
  created_at timestamptz default now(),
  unique(title, author)
);

alter table catalog enable row level security;

-- Anyone (logged in or not) can read the catalog — the public browse uses it.
drop policy if exists "catalog public read" on catalog;
create policy "catalog public read" on catalog for select using (true);
-- Writes are intentionally NOT exposed to the app: add/edit/delete books from the
-- Supabase Table Editor (service role), which bypasses RLS. That keeps your
-- catalog admin-only without building a separate admin login yet.

-- ── Seed with popular titles (cover_url left blank for you to fill) ──
-- After running this, open Table Editor → catalog, and for each row paste a
-- cover_url. Easiest source: open the book on Google Books or the publisher
-- site, right-click the cover → "Copy image address". Once a row has a cover_url
-- it appears in browse. Safe to re-run (won't duplicate).
insert into catalog (title, author) values
  ('Fourth Wing','Rebecca Yarros'),
  ('Iron Flame','Rebecca Yarros'),
  ('A Court of Thorns and Roses','Sarah J. Maas'),
  ('A Court of Mist and Fury','Sarah J. Maas'),
  ('House of Earth and Blood','Sarah J. Maas'),
  ('Throne of Glass','Sarah J. Maas'),
  ('Quicksilver','Callie Hart'),
  ('A Kiss of Iron','Clare Sager'),
  ('Powerless','Lauren Roberts'),
  ('Reckless','Lauren Roberts'),
  ('The Serpent and the Wings of Night','Carissa Broadbent'),
  ('From Blood and Ash','Jennifer L. Armentrout'),
  ('A Kingdom of Flesh and Fire','Jennifer L. Armentrout'),
  ('The Cruel Prince','Holly Black'),
  ('The Wicked King','Holly Black'),
  ('Haunting Adeline','H. D. Carlton'),
  ('Bride','Ali Hazelwood'),
  ('Divine Rivals','Rebecca Ross'),
  ('Lightlark','Alex Aster'),
  ('The Hurricane Wars','Thea Guanzon'),
  ('Heartless Hunter','Kristen Ciccarelli'),
  ('These Hollow Vows','Lexi Ryan'),
  ('The Bridge Kingdom','Danielle L. Jensen'),
  ('A Dawn of Onyx','Kate Golden'),
  ('Assistant to the Villain','Hannah Nicole Maehrer'),
  ('One Dark Window','Rachel Gillig'),
  ('Belladonna','Adalyn Grace'),
  ('Zodiac Academy: The Awakening','Caroline Peckham'),
  ('A Soul of Ash and Blood','Jennifer L. Armentrout')
on conflict (title, author) do nothing;
