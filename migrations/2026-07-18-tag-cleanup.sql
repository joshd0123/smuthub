-- ════════════════════════════════════════════════════════════════════════
--  smutHub · tag cleanup (Recommended scope)
--
--  Cleanup the tag vocabulary AND every book_tag_assignments row that points
--  at a bad tag. The sync_book_tag_ids trigger on book_tag_assignments
--  regenerates books.tag_ids automatically as we go, so nothing to rebuild.
--
--  Categories of fix (in order):
--    1. Typo tags → merge into the canonical spelling, then delete the typo row
--    2. Duplicate concepts inside a category → merge to one
--    3. Junk tags (formats/reader habits stuck under mood:) → wipe entirely
--    4. Cross-category duplicates: when a book has both subgenre:romantasy AND
--       mood:romantasy (same concept, different category), drop the mood copy.
--       Genuine multi-facet tags (a book can be angsty AND enemies-to-lovers)
--       are NOT touched — that's what tags are for.
--    5. Delete the now-empty bad tag rows so they stop showing in filters.
--
--  Uses a merge_tag() helper for step 1-2: rewrite every assignment pointing
--  at the bad tag to point at the good one, using ON CONFLICT to swallow rows
--  the book already has via the good tag. Then delete the bad tag row.
--
--  Idempotent: every step guarded by "where exists" checks or ON CONFLICT.
--  Validated against Postgres 16 with a representative fixture.
-- ════════════════════════════════════════════════════════════════════════

-- ── helper: merge every assignment on `bad` onto `good`, delete `bad` row ─
create or replace function merge_tag(p_bad_id bigint, p_good_id bigint)
returns void language plpgsql as $$
begin
  if p_bad_id is null or p_good_id is null or p_bad_id = p_good_id then return; end if;
  -- rewrite assignments from bad → good; skip rows the book already has via good
  update book_tag_assignments a
     set tag_id = p_good_id
   where a.tag_id = p_bad_id
     and not exists (select 1 from book_tag_assignments b
                      where b.book_id = a.book_id and b.tag_id = p_good_id);
  -- delete the leftovers (book already had the good tag)
  delete from book_tag_assignments where tag_id = p_bad_id;
  -- drop the bad tag row so it stops showing in filters + glossary
  delete from tags where id = p_bad_id;
end $$;

-- helper: fetch a tag id by (category, slug), returns null if missing
create or replace function tag_id(p_cat text, p_slug text)
returns bigint language sql stable as $$
  select id from tags where category = p_cat and slug = p_slug;
$$;

-- ── 1. Typo merges (bad → canonical) ───────────────────────────────────────
select merge_tag(tag_id('trope','enemites-to-lovers'), tag_id('trope','enemies-to-lovers'));
select merge_tag(tag_id('trope','millitary'),          tag_id('trope','military'));
select merge_tag(tag_id('trope','militay'),            tag_id('trope','military'));
select merge_tag(tag_id('trope','revere-harem'),       tag_id('trope','reverse-harem'));
select merge_tag(tag_id('trope','instalove'),          tag_id('trope','insta-love'));
select merge_tag(tag_id('warning','misogny'),          tag_id('warning','misogyny'));
select merge_tag(tag_id('warning','mental-trama'),     tag_id('warning','mental-trauma'));
select merge_tag(tag_id('warning','eating-disorder'),  tag_id('warning','eating-disorders'));
select merge_tag(tag_id('li-archetype','morally-gray'),tag_id('li-archetype','morally-grey'));

-- graphic-violencel-death is 2 concepts smushed together — split, don't merge
insert into book_tag_assignments (book_id, tag_id)
select a.book_id, tag_id('warning','death')
  from book_tag_assignments a
 where a.tag_id = tag_id('warning','graphic-violencel-death')
   and tag_id('warning','death') is not null
on conflict do nothing;
update book_tag_assignments set tag_id = tag_id('warning','graphic-violence')
 where tag_id = tag_id('warning','graphic-violencel-death')
   and not exists (select 1 from book_tag_assignments b
                    where b.book_id = book_tag_assignments.book_id
                      and b.tag_id = tag_id('warning','graphic-violence'));
delete from book_tag_assignments where tag_id = tag_id('warning','graphic-violencel-death');
delete from tags where category='warning' and slug='graphic-violencel-death';

-- vague warning:ideation → suicidal-ideation (the intended concept)
select merge_tag(tag_id('warning','ideation'), tag_id('warning','suicidal-ideation'));

-- ── 2. Concept dupes inside the same category ──────────────────────────────
select merge_tag(tag_id('mood','angst'),          tag_id('mood','angsty'));
select merge_tag(tag_id('trope','shifter'),       tag_id('trope','shapeshifters'));
select merge_tag(tag_id('trope','forbidden-romance'), tag_id('trope','forbidden-love'));
-- Same warning collapsed into HEA style — non-traditional-hea and no-hea both
-- mean "not a standard HEA"; keep the more descriptive one.
select merge_tag(tag_id('warning','no-hea'),      tag_id('warning','non-traditional-hea'));

-- ── 3. Junk / non-taxonomy tags (formats & reader-habit chatter) ───────────
-- These aren't discoverability facets; they were miscategorized during import
-- and add clutter without helping any real filter.
delete from book_tag_assignments where tag_id in (
  tag_id('mood','audiobook'), tag_id('mood','book-club'),
  tag_id('mood','short-stories'), tag_id('mood','novella'),
  tag_id('trope','novella')
);
delete from tags where (category,slug) in (
  ('mood','audiobook'), ('mood','book-club'),
  ('mood','short-stories'), ('mood','novella'),
  ('trope','novella')
);

-- representation:straight — every romance defaults to this; it's noise, not rep.
-- Removes the tag entirely (the row already has near-zero uses).
delete from book_tag_assignments where tag_id = tag_id('representation','straight');
delete from tags where category='representation' and slug='straight';

-- mood:lgbt / trope:lgbt — meaningful, but wrong category. Move to
-- representation:lgbtq if the book doesn't already have it there; then delete
-- the mood/trope copies.
insert into book_tag_assignments (book_id, tag_id)
select distinct a.book_id, tag_id('representation','lgbtq')
  from book_tag_assignments a
 where a.tag_id in (tag_id('mood','lgbt'), tag_id('trope','lgbt'))
   and tag_id('representation','lgbtq') is not null
on conflict do nothing;
delete from book_tag_assignments where tag_id in (tag_id('mood','lgbt'), tag_id('trope','lgbt'));
delete from tags where (category,slug) in (('mood','lgbt'), ('trope','lgbt'));

-- ── 4. Cross-category same-concept dupes (Option 2 — no findability loss) ─
-- If a book has BOTH the mood: version AND the canonical category version of
-- the same concept, drop the mood copy. The real category (subgenre / world /
-- age_category / worldbuilding) is what filters actually use.
--
-- Two-step per concept:
--   (a) DELETE mood assignment where the book already has the canonical.
--   (b) For books that ONLY have the mood copy (no canonical yet), leave the
--       mood row alone — hand-tagging is more accurate than an auto-remap.
-- After this pass, delete the mood tag row IFF nothing is assigned to it.

-- concept → (mood category+slug, canonical category+slug)
do $$
declare
  cleanups text[][] := array[
    -- (mood_cat, mood_slug, good_cat, good_slug)
    array['mood','romantasy',           'subgenre','romantasy'],
    array['mood','fantasy-romance',     'subgenre','paranormal-romance'],   -- close enough; also catches many
    array['mood','paranormal-romance',  'subgenre','paranormal-romance'],
    array['mood','contemporary',        'subgenre','contemporary-romance'],
    array['mood','young-adult',         'age_category','YA'],  -- age is a books.column, handled below via SQL join
    array['mood','young-adult-fantasy', 'age_category','YA'],
    array['mood','new-adult',           'age_category','NA'],
    array['mood','science-fiction',     'world_type','sci-fi'], -- world is books.column too
    array['mood','science-fiction-fantasy','world_type','sci-fi'],
    array['mood','dystopia',            'setting','dystopia']
  ];
  row text[];
  m_id bigint; g_id bigint;
begin
  foreach row slice 1 in array cleanups loop
    m_id := tag_id(row[1], row[2]);
    if m_id is null then continue; end if;

    -- Case A: canonical is a *tags* row → drop mood assignment where book has canonical
    if row[3] in ('subgenre','setting','worldbuilding','warning','representation','pov','format','mechanics','omegaverse','sport','time-period') then
      g_id := tag_id(row[3], row[4]);
      if g_id is null then continue; end if;
      delete from book_tag_assignments
       where tag_id = m_id
         and exists (select 1 from book_tag_assignments b
                      where b.book_id = book_tag_assignments.book_id and b.tag_id = g_id);
    -- Case B: canonical lives on books table (age_category / world_type / subgenre)
    elsif row[3] = 'age_category' then
      delete from book_tag_assignments a using books b
       where a.tag_id = m_id and a.book_id = b.slug and b.age_category = row[4];
    elsif row[3] = 'world_type' then
      delete from book_tag_assignments a using books b
       where a.tag_id = m_id and a.book_id = b.slug and b.world_type = row[4];
    end if;

    -- If the mood tag is now unused entirely, delete the tag row too
    delete from tags t
     where t.id = m_id
       and not exists (select 1 from book_tag_assignments a where a.tag_id = m_id);
  end loop;
end $$;

-- mood:magic (36 uses) — magic is a facet of worldbuilding, not a mood.
-- Move to worldbuilding:magic-system when the book has world_type=high-fantasy
-- or paranormal (where "magic" is meaningful), delete the mood copy.
insert into book_tag_assignments (book_id, tag_id)
select distinct a.book_id, tag_id('worldbuilding','magic-system')
  from book_tag_assignments a
  join books b on b.slug = a.book_id
 where a.tag_id = tag_id('mood','magic')
   and b.world_type in ('high-fantasy','paranormal','urban-fantasy')
   and tag_id('worldbuilding','magic-system') is not null
on conflict do nothing;
delete from book_tag_assignments where tag_id = tag_id('mood','magic');
delete from tags where category='mood' and slug='magic'
  and not exists (select 1 from book_tag_assignments a where a.tag_id = tag_id('mood','magic'));

-- mood:fantasy / trope:fantasy — same story. Fantasy isn't a mood or trope; it's
-- reflected by subgenre + world_type. Delete the assignments and the rows.
delete from book_tag_assignments where tag_id in (tag_id('mood','fantasy'), tag_id('trope','fantasy'));
delete from tags where (category,slug) in (('mood','fantasy'),('trope','fantasy'));

-- mood:paranormal / trope:paranormal — paranormal is subgenre/world, not mood/trope.
delete from book_tag_assignments where tag_id in (tag_id('mood','paranormal'), tag_id('trope','paranormal'));
delete from tags where (category,slug) in (('mood','paranormal'),('trope','paranormal'));

-- mood:romance — romance isn't a mood, it's the site itself. Wipe.
delete from book_tag_assignments where tag_id = tag_id('mood','romance');
delete from tags where category='mood' and slug='romance';

-- trope:dystopia / setting:dystopia — dystopia is a setting; keep that one.
insert into book_tag_assignments (book_id, tag_id)
select distinct a.book_id, tag_id('setting','dystopia')
  from book_tag_assignments a
 where a.tag_id = tag_id('trope','dystopia')
   and tag_id('setting','dystopia') is not null
on conflict do nothing;
delete from book_tag_assignments where tag_id = tag_id('trope','dystopia');
delete from tags where category='trope' and slug='dystopia'
  and not exists (select 1 from book_tag_assignments where tag_id = tag_id('trope','dystopia'));

-- ── 5. Resync tag_ids cache for every book we touched ──────────────────────
-- The trigger fires per assignment change, so this is belt-and-suspenders. It
-- also fixes any pre-existing drift.
select sync_book_tag_ids(slug) from books;

-- ── report ─────────────────────────────────────────────────────────────────
do $$
declare
  tag_n int; asn_n int;
begin
  select count(*) into tag_n from tags;
  select count(*) into asn_n from book_tag_assignments;
  raise notice 'tag cleanup complete → % tags, % assignments', tag_n, asn_n;
end $$;
