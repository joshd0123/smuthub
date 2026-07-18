-- ════════════════════════════════════════════════════════════════════════
--  smutHub · catalog cleanup 2 — junk, duplicates, and typos
--
--  Found in the live catalog (2026-07):
--   • Wrong books from bad Google matches (not romantasy at all)
--   • Duplicate rows for the same book (year-less vs year-suffixed, a Swedish
--     edition of Fourth Wing, etc.)
--   • Typo'd titles/authors that also stop Google from ever matching them
--
--  Archiving (not deleting) is reversible: `update books set status='live'
--  where slug='…';`. Shelves keep their own title/cover snapshot, so archiving
--  never breaks anyone's bookshelf.
--
--  Idempotent — explicit slugs, safe to re-run. Run in Supabase → SQL Editor,
--  then rebuild:  node scripts/build-books.mjs && push.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Archive wrong-book junk (bad Google matches — not romantasy) ────────
update books set status='archived' where slug in (
  'just-watch-me-lindsay-2019',   -- Jeff Lindsay (Dexter author) — wrong "Watch Me"
  'watch-me-mcclintock-2008',     -- Norah McClintock YA crime — wrong "Watch Me"
  'vitalia-mynamebooks-2019'      -- author "MyNameBooks" — junk import
);

-- ── 2. Collapse duplicate rows (keep the richest, archive the rest) ────────
-- Keep the well-tagged / correctly-titled row in each cluster; archive the twin.
update books set status='archived' where slug in (
  'a-court-of-thorns-and-roses-maas-2015',        -- twin of a-court-of-thorns-and-roses-maas (richer)
  'fourth-wing-yarros-2023',                       -- twin of fourth-wing-yarros
  'fourth-wing-svensk-utg-va--yarros-2023',        -- Swedish edition of Fourth Wing
  'quicksilver-hart-2024',                         -- twin of quicksilver-hart
  'the-wicked-king-black',                         -- 0-tag twin of the-wicked-king-black-2019
  'the-poison-daugher-masterson-2025'              -- typo twin of the-poison-daughter-masterson-2026
);
-- Make sure the keeper of the Wicked King cluster is actually published
-- (its richer twin was a draft in the earlier pass).
update books set status='live'
 where slug='the-wicked-king-black-2019' and status='archived' is not true and status<>'live';
update books set status='live' where slug='the-wicked-king-black-2019' and status='draft';

-- ── 3. Fix typo'd titles / authors (slug stays; this only corrects display) ─
-- NOTE: "Cornwed" → "Crowned" is an inference — verify it's the intended word.
update books set title='Chosen of the Moon'
 where slug='chosen-of-the-moonn-kerrigan-2026' and title='Chosen of the Moonn';
update books set title='A Queen Crowned in Flames'
 where slug='a-queen-cornwed-in-flames-mcbride-2026' and title='A Queen Cornwed in Flames';
update books set author='Julia Silverwood'
 where slug='the-ninth-realm-silverwood-2026' and author='Juila Silverwood';
update books set author='Tahereh Mafi'
 where slug='ignite-me-mafi-2014' and author='Taherah Mafi';

-- ── report ─────────────────────────────────────────────────────────────────
do $$
declare live_n int; arch_n int;
begin
  select count(*) into live_n from books where status='live';
  select count(*) into arch_n from books where status='archived';
  raise notice 'cleanup done → % live · % archived', live_n, arch_n;
end $$;
