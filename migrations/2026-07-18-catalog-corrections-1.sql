-- ════════════════════════════════════════════════════════════════════════
--  smutHub · catalog corrections — pass 1 (A–R)
--
--  From reviewing the 2026-07 catalog export. Fixes ONLY books I know with
--  confidence, keyed on exact slug so rows update IN PLACE (no re-import, no
--  duplicate risk). Three kinds of fixes:
--    1. Invalid enum values that break filters ("wide open", "closed door",
--       "third person pov; male pov; dual pov;", "YA?")
--    2. Wrong facts (Divine Rivals year 2026→2023, Haunting Adeline 2025→2021)
--    3. Null filter columns filled in for well-known books (spice, door,
--       subgenre, age, ending, pov, world, relationship)
--
--  DELIBERATELY NOT TOUCHED:
--    • tag_ids — it's a trigger-synced cache of book_tag_assignments; hand-
--      editing it diverges from the join table. Tag cleanup (dupes like
--      mood:angst vs mood:angsty, typos like trope:enemites-to-lovers /
--      trope:millitary / trope:revere-harem / warning:mental-trama) is a
--      separate pass through book_tag_assignments.
--    • Books I don't know (indie 2026 titles) — no guessing.
--    • S–Z books — the export was truncated at 100 rows; send the rest.
--
--  Idempotent, safe to re-run. Run in Supabase → SQL Editor, then rebuild.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Invalid enum values (these break the Search filters) ────────────────
update books set door='open'   where slug='from-blood-and-ash-armentrout-2020' and door='wide open';
update books set door='open'   where slug='ignite-me-mafi-2014' and door='closed door';
update books set pov='multi'   where slug='kingdom-of-ash-maas-2018' and pov like '%;%';
update books set age_category=null where slug='dire-bound-sorensen-2025' and age_category='YA?';

-- ── 2. Wrong facts ─────────────────────────────────────────────────────────
update books set year=2023 where slug='divine-rivals-ross'        and year=2026;
update books set year=2021 where slug='haunting-adeline-carlton'  and year=2025;
update books set year=2023 where slug='iron-flame-yarros'         and year is null;
update books set year=2022 where slug='lightlark-aster'           and year is null;

-- ── 3. Fill null/incomplete filter columns (well-known books only) ─────────
-- coalesce() everywhere: never overwrites a value you've already set.

-- Sarah J. Maas
update books set
  subgenre=coalesce(subgenre,'romantasy'), age_category=coalesce(age_category,'Adult'),
  ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true),
  pov=coalesce(pov,'1st single'), world_type=coalesce(world_type,'high-fantasy'),
  relationship_type=coalesce(relationship_type,'MF')
where slug='a-court-of-mist-and-fury-maas';

update books set age_category='Adult', ending=coalesce(ending,'HFN')
where slug='a-court-of-thorns-and-roses-maas' and age_category='NA';

update books set
  spice_level=coalesce(spice_level,3), door=coalesce(door,'open'),
  subgenre=coalesce(subgenre,'romantasy'), age_category=coalesce(age_category,'Adult'),
  ending=coalesce(ending,'HFN'), pov=coalesce(pov,'multi'),
  world_type=coalesce(world_type,'urban-fantasy'), relationship_type=coalesce(relationship_type,'MF')
where slug='house-of-earth-and-blood-maas';

update books set ending=coalesce(ending,'HEA'), relationship_type=coalesce(relationship_type,'MF'),
  cliffhanger=coalesce(cliffhanger,false)
where slug='kingdom-of-ash-maas-2018';

-- Rebecca Yarros
update books set
  spice_level=coalesce(spice_level,4), door=coalesce(door,'open'),
  spice_frequency=coalesce(spice_frequency,'frequent'),
  subgenre=coalesce(subgenre,'romantasy'), age_category=coalesce(age_category,'Adult'),
  ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true),
  pov=coalesce(pov,'1st single'), world_type=coalesce(world_type,'high-fantasy'),
  relationship_type=coalesce(relationship_type,'MF')
where slug='iron-flame-yarros';

-- Jennifer L. Armentrout
update books set
  spice_level=coalesce(spice_level,4), door=coalesce(door,'open'),
  subgenre=coalesce(subgenre,'romantasy'), age_category=coalesce(age_category,'Adult'),
  ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true),
  pov=coalesce(pov,'1st single'), world_type=coalesce(world_type,'high-fantasy'),
  relationship_type=coalesce(relationship_type,'MF')
where slug='a-kingdom-of-flesh-and-fire-armentrout';

update books set
  spice_level=coalesce(spice_level,4), door=coalesce(door,'open'),
  subgenre=coalesce(subgenre,'romantasy'), age_category=coalesce(age_category,'Adult'),
  pov=coalesce(pov,'1st single'), world_type=coalesce(world_type,'high-fantasy'),
  relationship_type=coalesce(relationship_type,'MF')
where slug='a-soul-of-ash-and-blood-armentrout';

update books set
  spice_level=4, age_category=coalesce(age_category,'Adult'),
  ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true),
  pov=coalesce(pov,'1st single'), world_type=coalesce(world_type,'high-fantasy'),
  relationship_type=coalesce(relationship_type,'MF')
where slug='from-blood-and-ash-armentrout-2020' and coalesce(spice_level,0) <= 2;

-- Raven Kennedy (Plated Prisoner)
update books set
  spice_level=coalesce(spice_level,3), age_category=coalesce(age_category,'Adult'),
  ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true),
  pov=coalesce(pov,'1st single'), world_type=coalesce(world_type,'high-fantasy'),
  relationship_type=coalesce(relationship_type,'MF')
where slug='gild-kennedy-2020';

update books set ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true),
  relationship_type=coalesce(relationship_type,'MF')
where slug='glow-kennedy-2022';

-- Adalyn Grace
update books set
  spice_level=coalesce(spice_level,2), door=coalesce(door,'fade'),
  subgenre=coalesce(subgenre,'romantasy'), age_category=coalesce(age_category,'YA'),
  ending=coalesce(ending,'HFN'), world_type=coalesce(world_type,'paranormal'),
  relationship_type=coalesce(relationship_type,'MF')
where slug='belladonna-grace';

-- Ali Hazelwood
update books set
  spice_level=coalesce(spice_level,4), door=coalesce(door,'open'),
  spice_frequency=coalesce(spice_frequency,'frequent'),
  subgenre=coalesce(subgenre,'paranormal-romance'), age_category=coalesce(age_category,'Adult'),
  ending=coalesce(ending,'HEA'), pov=coalesce(pov,'1st dual'),
  world_type=coalesce(world_type,'paranormal'), relationship_type=coalesce(relationship_type,'MF')
where slug='bride-hazelwood';

-- Rebecca Ross
update books set
  spice_level=coalesce(spice_level,1), door=coalesce(door,'closed'),
  subgenre=coalesce(subgenre,'romantasy'), age_category=coalesce(age_category,'YA'),
  ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true),
  pov=coalesce(pov,'3rd dual'), world_type=coalesce(world_type,'historical'),
  relationship_type=coalesce(relationship_type,'MF')
where slug='divine-rivals-ross';

-- Stephanie Garber
update books set
  spice_level=coalesce(spice_level,1), door=coalesce(door,'closed'),
  subgenre=coalesce(subgenre,'romantasy'), ending=coalesce(ending,'HEA'),
  pov=coalesce(pov,'multi'), world_type=coalesce(world_type,'high-fantasy'),
  relationship_type=coalesce(relationship_type,'MF')
where slug='finale-garber-2019';

-- H. D. Carlton
update books set
  spice_level=coalesce(spice_level,5), door=coalesce(door,'open'),
  spice_frequency=coalesce(spice_frequency,'frequent'),
  subgenre=coalesce(subgenre,'dark-romance'), age_category=coalesce(age_category,'Adult'),
  ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true),
  pov=coalesce(pov,'1st dual'), world_type=coalesce(world_type,'contemporary'),
  relationship_type=coalesce(relationship_type,'MF')
where slug='haunting-adeline-carlton';

-- Kristen Ciccarelli
update books set
  spice_level=coalesce(spice_level,2), door=coalesce(door,'fade'),
  subgenre=coalesce(subgenre,'romantasy'), age_category=coalesce(age_category,'YA'),
  ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true),
  pov=coalesce(pov,'3rd dual'), world_type=coalesce(world_type,'high-fantasy'),
  relationship_type=coalesce(relationship_type,'MF')
where slug='heartless-hunter-ciccarelli';

-- Alex Aster
update books set
  spice_level=coalesce(spice_level,1), door=coalesce(door,'closed'),
  subgenre=coalesce(subgenre,'romantasy'), age_category=coalesce(age_category,'YA'),
  ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true),
  pov=coalesce(pov,'3rd single'), world_type=coalesce(world_type,'high-fantasy'),
  relationship_type=coalesce(relationship_type,'MF')
where slug='lightlark-aster';

-- Tahereh Mafi (Shatter Me is dystopian sci-fi, not fantasy/romantasy)
update books set
  subgenre='sci-fi-romance', world_type=coalesce(world_type,'sci-fi'),
  ending=coalesce(ending,'HEA'), spice_level=3
where slug='ignite-me-mafi-2014';

update books set
  subgenre='sci-fi-romance', world_type='sci-fi', ending=coalesce(ending,'HFN')
where slug='defy-me-mafi-2019';

-- Lauren Roberts
update books set
  subgenre=coalesce(subgenre,'romantasy'),
  ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true),
  pov=coalesce(pov,'1st dual'), world_type=coalesce(world_type,'high-fantasy')
where slug='powerless-roberts-2023';

-- Callie Hart
update books set
  subgenre=coalesce(subgenre,'romantasy'), age_category=coalesce(age_category,'Adult'),
  ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true),
  world_type=coalesce(world_type,'high-fantasy'), relationship_type=coalesce(relationship_type,'MF')
where slug='quicksilver-hart';

-- Caroline Peckham & Susanne Valenti
update books set ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true)
where slug='never-keep-valenti-2024';

update books set subgenre=coalesce(subgenre,'romantasy')
where slug='cinder-vale-valenti-2026';

-- Hannah Nicole Maehrer (adult cozy-adjacent, not YA)
update books set
  age_category='Adult', ending=coalesce(ending,'cliffhanger'), cliffhanger=coalesce(cliffhanger,true),
  relationship_type=coalesce(relationship_type,'MF')
where slug='assistant-to-the-villain-maehrer' and coalesce(age_category,'')<>'Adult';

-- ── report ─────────────────────────────────────────────────────────────────
do $$
declare n int;
begin
  select count(*) into n from books
   where status='live' and (spice_level is null or subgenre is null or ending is null);
  raise notice 'corrections pass 1 done → % live books still missing spice/subgenre/ending (mostly indie 2026 titles + S–Z pending)', n;
end $$;
