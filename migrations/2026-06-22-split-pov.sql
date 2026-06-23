-- ════════════════════════════════════════════════════════════════════════
--  smutHub · split POV out of Format category
--
--  Format (book structure: duet/trilogy/standalone/series) and POV (narrative
--  perspective: 1st/3rd, single/dual) are conceptually different. The breadcrumb
--  "Format & POV / Standalone" was misleading because Standalone has nothing to
--  do with POV. Moves the 5 POV tags into their own 'pov' category.
--
--  URL impact: /glossary/format/pov/ → /glossary/pov/pov/ etc. (5 pages, days old.)
--  Idempotent. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

update tags
set category = 'pov'
where category = 'format'
  and slug in ('pov','dual-pov','single-pov','first-person-pov','third-person-pov');

do $$
declare n int;
begin
  select count(*) into n from tags where category='pov';
  raise notice 'pov category now has % tags', n;
end $$;
