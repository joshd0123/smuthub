-- ════════════════════════════════════════════════════════
--  smutHub: your own book catalog  (run once in Supabase → SQL Editor; safe to re-run)
--
--  This is YOUR database of books. The Search page's "browse" (empty box) shows a
--  random set of catalog books that have a cover_url — so you control exactly which
--  books feature and which cover each uses, with zero dependency on Google.
--
--  COVERS: host them in Supabase Storage (this script creates a public "covers"
--  bucket). Upload an image in Supabase → Storage → covers, click it, copy the
--  public URL, and paste it into the book's cover_url (Table Editor). That URL
--  lives on Supabase's CDN and never breaks. (cover_url is just a URL, so a NAS or
--  any host works too — but Storage is simplest and already in your stack.)
-- ════════════════════════════════════════════════════════

create table if not exists catalog (
  id         bigint generated always as identity primary key,
  title      text not null,
  author     text,
  cover_url  text,                 -- paste a working image URL (ideally a Storage URL)
  spice      int,                  -- optional default 🌶️ rating (1–5)
  tropes     text[] default '{}',  -- optional, e.g. {enemies-to-lovers, fae}
  blurb      text,
  year       int,
  created_at timestamptz default now(),
  unique(title, author)
);

alter table catalog enable row level security;

-- Anyone (logged in or not) can READ the catalog — the public browse uses it.
drop policy if exists "catalog public read" on catalog;
create policy "catalog public read" on catalog for select using (true);

-- ── Admin writes (powers the search page's "★ Add to catalog" button) ──
alter table profiles add column if not exists is_admin boolean default false;
-- After running this, make yourself an admin:
--   update profiles set is_admin = true where id = auth.uid();
drop policy if exists "catalog admin write" on catalog;
create policy "catalog admin write" on catalog for all
  using      (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- ── Public Storage bucket for self-hosted covers ──
insert into storage.buckets (id, name, public) values ('covers','covers',true)
  on conflict (id) do nothing;
drop policy if exists "covers public read" on storage.objects;
create policy "covers public read" on storage.objects for select using (bucket_id = 'covers');
-- (Upload covers from the Supabase dashboard, which uses the service role and
--  bypasses RLS — no upload policy needed for admin dashboard uploads.)

-- ── Seed with popular titles (cover_url blank — fill via Storage URLs, or use
--    the "★ Add to catalog" button which captures the cover already showing) ──
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
