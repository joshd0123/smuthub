-- ════════════════════════════════════════════════════════════════════════
--  smutHub · tag cleanup (follow-up) — the 5 mood: survivors
--
--  These 5 mood tags survived the first pass because their books had a null
--  canonical column (age_category / subgenre) — dropping the mood tag would
--  have lost information. This pass:
--    1. BACKFILLS the canonical column on those books first, so no info is lost
--    2. Deletes every assignment for these 5 mood tags
--    3. Deletes the 5 tag rows themselves
--
--  Fourth Wing has age_category='Adult' but mood:young-adult (wrong on that
--  book) — dropping is correct. A different book with null age_category
--  and mood:young-adult gets promoted to age_category='YA' before the drop,
--  so its findability improves, not degrades.
--
--  Idempotent, validated against Postgres 16.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Backfill canonical columns from the mood: tags (null-only, no clobber) ─
update books set age_category = 'YA'
 where age_category is null and exists (
   select 1 from book_tag_assignments a join tags t on t.id = a.tag_id
    where a.book_id = books.slug and t.category='mood'
      and t.slug in ('young-adult','young-adult-fantasy')
 );

update books set age_category = 'NA'
 where age_category is null and exists (
   select 1 from book_tag_assignments a join tags t on t.id = a.tag_id
    where a.book_id = books.slug and t.category='mood' and t.slug='new-adult'
 );

update books set subgenre = 'romantasy'
 where subgenre is null and exists (
   select 1 from book_tag_assignments a join tags t on t.id = a.tag_id
    where a.book_id = books.slug and t.category='mood' and t.slug='romantasy'
 );

update books set subgenre = 'contemporary-romance'
 where subgenre is null and exists (
   select 1 from book_tag_assignments a join tags t on t.id = a.tag_id
    where a.book_id = books.slug and t.category='mood' and t.slug='contemporary'
 );

-- ── 2. Delete the 5 mood assignments (trigger auto-resyncs tag_ids) ────────
delete from book_tag_assignments where tag_id in (
  select id from tags where category='mood'
    and slug in ('young-adult','young-adult-fantasy','new-adult','romantasy','contemporary')
);

-- ── 3. Delete the tag rows themselves ──────────────────────────────────────
delete from tags where category='mood'
  and slug in ('young-adult','young-adult-fantasy','new-adult','romantasy','contemporary');

-- ── report ─────────────────────────────────────────────────────────────────
do $$
declare
  n_left int; n_bkfilled int;
begin
  select count(*) into n_left from tags where category='mood'
    and slug in ('young-adult','young-adult-fantasy','new-adult','romantasy','contemporary');
  select count(*) into n_bkfilled from books
   where age_category in ('YA','NA') or subgenre in ('romantasy','contemporary-romance');
  raise notice 'follow-up cleanup done → % of the 5 mood survivors remain', n_left;
end $$;
