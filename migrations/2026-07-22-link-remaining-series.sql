-- ════════════════════════════════════════════════════════════════════
--  smutHub · link the final 9 books to their series
--  Run in: Supabase dashboard -> SQL Editor -> New query -> Run
--  Safe to re-run.
-- ════════════════════════════════════════════════════════════════════
-- These are the books the first migration deliberately skipped: their author
-- had no existing series in the catalog, so the value could not be inferred
-- from our own data. Each was verified against the publisher / Goodreads /
-- Amazon listing rather than guessed:
--
--   Bride                 -> "Bride" #1        sequel Mate (Oct 2025) = #2
--   A Study in Drowning   -> own name #1       duology; A Theory of Dreaming = #2
--   A Kiss of Iron        -> Shadows of the Tenebris Court #1
--   Haunting Adeline      -> Cat and Mouse Duet #1   (Hunting Adeline = #2)
--   Heartless Hunter      -> The Crimson Moth #1     (duology)
--   Swordheart            -> "Swordheart" #1   trilogy planned; Daggerbound 2026
--   Legends & Lattes      -> "Legends & Lattes" #1
--   Bookshops & Bonedust  -> "Legends & Lattes" #2
--   Iron Widow            -> "Iron Widow" #1    (Heavenly Tyrant = #2)
--
-- Note on Bookshops & Bonedust: it is chronologically a prequel, but both the
-- publisher's numbering and the author's recommended reading order put it
-- SECOND. Numbering it 2 keeps the series rail in the order a reader should
-- actually read them, rather than opening on the prequel.

update books set series = v.series, series_number = v.num
from (values
  ('bride-hazelwood',                 'Bride',                           1),
  ('a-study-in-drowning-reid-2023',   'A Study in Drowning',             1),
  ('a-kiss-of-iron-sager',            'Shadows of the Tenebris Court',   1),
  ('haunting-adeline-carlton',        'Cat and Mouse Duet',              1),
  ('heartless-hunter-ciccarelli',     'The Crimson Moth',                1),
  ('swordheart-kingfisher-2024',      'Swordheart',                      1),
  ('legends-lattes-baldree-2022',     'Legends & Lattes',                1),
  ('bookshops-bonedust-baldree-2023', 'Legends & Lattes',                2),
  ('iron-widow-zhao-2021',            'Iron Widow',                      1)
) as v(slug, series, num)
where books.slug = v.slug;

-- Check: should return 0 rows once this has run.
select slug, title, author from books
where status = 'live' and series is null and standalone is not true
order by author;
