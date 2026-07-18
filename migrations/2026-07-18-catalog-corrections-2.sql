-- ════════════════════════════════════════════════════════════════════════
--  smutHub · catalog corrections — pass 2 (S–Z tail + remaining null rows)
--
--  From the full 190-book export. Same rules as pass 1: slug-keyed in-place
--  UPDATEs, known books only, coalesce-guarded so hand-set values survive.
--  tag_ids untouched (trigger-synced cache; tag cleanup is its own pass).
--
--  Idempotent, safe to re-run. Run in Supabase → SQL Editor, then rebuild.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Invalid values (break filters) ──────────────────────────────────────
update books set door='closed' where slug='the-queen-of-nothing-black-2019' and door='closed door';
update books set door=null     where slug='to-break-a-vow-laurenti-2026'    and door='craked';
update books set pov='1st single' where slug='shield-of-sparrows-perry-2025' and pov like '%;%';
-- 'fantasy' isn't a valid subgenre value; nearest valid is fantasy-romance
update books set subgenre='fantasy-romance' where slug in
  ('chosen-of-the-moonn-kerrigan-2026','no-gods-no-kings-paxton-2026') and subgenre='fantasy';

-- ── 2. Wrong facts ─────────────────────────────────────────────────────────
-- Zodiac Academy #1 published 2019 (not 2024) and is co-authored with Valenti,
-- matching the other 7 ZA rows.
update books set year=2019, author='Caroline Peckham, Susanne Valenti'
 where slug='zodiac-academy-the-awakening-peckham';
-- Heat of the Everflame published 2024 (row said 2025)
update books set year=2024 where slug='heat-of-the-everflame-cole-2023' and year=2025;
-- The Hurricane Wars published 2023
update books set year=coalesce(year,2023) where slug='the-hurricane-wars-guanzon';
-- Shatter Me world books are dystopian sci-fi, not fantasy
update books set subgenre='sci-fi-romance', world_type='sci-fi'
 where slug in ('watch-me-mafi-2025','unravel-me-mafi-2013') ;
update books set subgenre='sci-fi-romance' where slug='iron-widow-zhao-2021' and subgenre='romantasy';
-- Keep Me Safe is contemporary romantic suspense (its own tags say contemporary/billionaire)
update books set subgenre='contemporary-romance', world_type='contemporary'
 where slug='keep-me-safe-sloane-2026';

-- ── 3. Fill null filter columns (well-known books only) ────────────────────

-- Holly Black · Folk of the Air
update books set
  spice_level=coalesce(spice_level,1), door=coalesce(door,'closed'),
  subgenre=coalesce(subgenre,'romantasy'), age_category=coalesce(age_category,'YA'),
  ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true),
  pov=coalesce(pov,'1st single'), world_type=coalesce(world_type,'high-fantasy'),
  relationship_type=coalesce(relationship_type,'MF')
where slug='the-cruel-prince-black';

update books set
  door=coalesce(door,'closed'), subgenre=coalesce(subgenre,'romantasy'),
  ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true),
  world_type=coalesce(world_type,'high-fantasy')
where slug='the-wicked-king-black-2019';

update books set
  ending=coalesce(ending,'HEA'), world_type=coalesce(world_type,'high-fantasy')
where slug='the-queen-of-nothing-black-2019';

update books set ending=coalesce(ending,'HEA')
where slug='how-the-king-of-elfhame-learned-to-hate-stories-black-2020';

-- Sarah J. Maas · Throne of Glass #1
update books set
  spice_level=coalesce(spice_level,1), door=coalesce(door,'closed'),
  subgenre=coalesce(subgenre,'romantasy'), age_category=coalesce(age_category,'YA'),
  ending=coalesce(ending,'HFN'), pov=coalesce(pov,'multi'),
  world_type=coalesce(world_type,'high-fantasy'), relationship_type=coalesce(relationship_type,'MF')
where slug='throne-of-glass-maas';

-- Rebecca Yarros · Fourth Wing (ends on a major reveal cliffhanger)
update books set
  ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true),
  relationship_type=coalesce(relationship_type,'MF')
where slug='fourth-wing-yarros';

-- Carissa Broadbent · The Serpent and the Wings of Night
update books set
  spice_level=coalesce(spice_level,3), door=coalesce(door,'open'),
  subgenre=coalesce(subgenre,'romantasy'), age_category=coalesce(age_category,'Adult'),
  ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true),
  pov=coalesce(pov,'1st single'), world_type=coalesce(world_type,'high-fantasy'),
  relationship_type=coalesce(relationship_type,'MF')
where slug='the-serpent-and-the-wings-of-night-broadbent';

-- Lexi Ryan · These Hollow Vows #1
update books set
  spice_level=coalesce(spice_level,3), door=coalesce(door,'open'),
  subgenre=coalesce(subgenre,'romantasy'), age_category=coalesce(age_category,'YA'),
  ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true),
  pov=coalesce(pov,'1st single'), world_type=coalesce(world_type,'high-fantasy'),
  relationship_type=coalesce(relationship_type,'MF')
where slug='these-hollow-vows-ryan';

-- Danielle L. Jensen · The Bridge Kingdom #1
update books set
  spice_level=coalesce(spice_level,3), door=coalesce(door,'open'),
  subgenre=coalesce(subgenre,'romantasy'), age_category=coalesce(age_category,'Adult'),
  ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true),
  pov=coalesce(pov,'1st dual'), world_type=coalesce(world_type,'high-fantasy'),
  relationship_type=coalesce(relationship_type,'MF')
where slug='the-bridge-kingdom-jensen';

-- Thea Guanzon · The Hurricane Wars #1
update books set
  spice_level=coalesce(spice_level,3), door=coalesce(door,'open'),
  subgenre=coalesce(subgenre,'romantasy'), age_category=coalesce(age_category,'Adult'),
  ending=coalesce(ending,'HFN'), pov=coalesce(pov,'3rd dual'),
  world_type=coalesce(world_type,'high-fantasy'), relationship_type=coalesce(relationship_type,'MF')
where slug='the-hurricane-wars-guanzon';

-- Rachel Gillig · One Dark Window
update books set
  spice_level=coalesce(spice_level,2), door=coalesce(door,'fade'),
  subgenre=coalesce(subgenre,'romantasy'), age_category=coalesce(age_category,'Adult'),
  ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true),
  pov=coalesce(pov,'1st single'), world_type=coalesce(world_type,'high-fantasy'),
  relationship_type=coalesce(relationship_type,'MF')
where slug='one-dark-window-gillig';

-- Penn Cole · Heat of the Everflame
update books set
  spice_level=coalesce(spice_level,4), age_category=coalesce(age_category,'Adult'),
  ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true),
  pov=coalesce(pov,'1st single'), world_type=coalesce(world_type,'high-fantasy'),
  relationship_type=coalesce(relationship_type,'MF')
where slug='heat-of-the-everflame-cole-2023';

-- Clare Sager · A Kiss of Iron
update books set
  spice_level=coalesce(spice_level,4), door=coalesce(door,'open'),
  subgenre=coalesce(subgenre,'romantasy'), age_category=coalesce(age_category,'Adult'),
  pov=coalesce(pov,'1st dual'), world_type=coalesce(world_type,'high-fantasy'),
  relationship_type=coalesce(relationship_type,'MF')
where slug='a-kiss-of-iron-sager';

-- Kate Golden · A Dawn of Onyx (adult, ends on a cliffhanger)
update books set
  age_category='Adult', ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true)
where slug='a-dawn-of-onyx-golden' and coalesce(age_category,'NA')='NA';

-- Peckham/Valenti · Zodiac Academy #1
update books set
  spice_level=coalesce(spice_level,2), door=coalesce(door,'fade'),
  subgenre=coalesce(subgenre,'romantasy'), age_category=coalesce(age_category,'NA'),
  ending=coalesce(ending,'HFN'), pov=coalesce(pov,'multi'),
  world_type=coalesce(world_type,'high-fantasy'), relationship_type=coalesce(relationship_type,'MF')
where slug='zodiac-academy-the-awakening-peckham';

-- Stephanie Garber · The Ballad of Never After (huge cliffhanger)
update books set ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true)
where slug='the-ballad-of-never-after-garber-2022';

-- Tahereh Mafi · Unravel Me ends mid-battle
update books set ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true)
where slug='unravel-me-mafi-2013';

-- Devney Perry · Shield of Sparrows
update books set age_category=coalesce(age_category,'Adult')
where slug='shield-of-sparrows-perry-2025';

-- ── report ─────────────────────────────────────────────────────────────────
do $$
declare n int; m int;
begin
  select count(*) into n from books
   where status='live' and (spice_level is null or subgenre is null or ending is null);
  select count(*) into m from books where status='live';
  raise notice 'corrections pass 2 done → % live books · % still missing spice/subgenre/ending (unknown indie titles — fill via catalog-admin or paste blurbs/facts to Claude)', m, n;
end $$;
