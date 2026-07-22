-- ════════════════════════════════════════════════════════════════════
--  smutHub · link the 19 unlinked books to their series
--  Run in: Supabase dashboard -> SQL Editor -> New query -> Run
--  Safe to re-run. Only touches rows that are still unlinked.
-- ════════════════════════════════════════════════════════════════════
-- Each value below fills the ONE gap in a series already in your catalog
-- (e.g. ACOTAR has books 1, 3, 3.5, 4 — so A Court of Mist and Fury is 2).

update books set series = v.series, series_number = v.num
from (values
  ('belladonna-grace',                            'Belladonna',                   1),
  ('lightlark-aster',                             'Lightlark',                    1),
  ('quicksilver-hart',                            'Fae & Alchemy',                1),
  ('the-serpent-and-the-wings-of-night-broadbent', 'Crowns of Nyaxia',            1),
  ('zodiac-academy-the-awakening-peckham',        'Zodiac Academy',               1),
  ('the-bridge-kingdom-jensen',                   'The Bridge Kingdom',           1),
  ('shield-of-sparrows-perry-2025',               'Shield of Sparrows',           1),
  ('the-cruel-prince-black',                      'The Folk of the Air',          1),
  ('a-kingdom-of-flesh-and-fire-armentrout',      'Blood and Ash',                2),
  ('a-soul-of-ash-and-blood-armentrout',          'Blood and Ash',                5),
  ('these-hollow-vows-ryan',                      'These Hollow Vows',            1),
  ('one-dark-window-gillig',                      'The Shepherd King',            1),
  ('divine-rivals-ross',                          'Letters of Enchantment',       1),
  ('iron-flame-yarros',                           'The Empyrean',                 2),
  ('when-the-moon-hatched-parker-2024',           'Moonfall',                     1),
  ('house-of-earth-and-blood-maas',               'Crescent City',                1),
  ('a-court-of-mist-and-fury-maas',               'A Court of Thorns and Roses',  2),
  ('throne-of-glass-maas',                        'Throne of Glass',              1),
  ('the-hurricane-wars-guanzon',                  'The Hurricane Wars',           1)
) as v(slug, series, num)
where books.slug = v.slug;

-- Check: should return 0 rows once the update has run.
select slug, title, author from books
where status = 'live' and series is null and standalone is not true
order by author;
