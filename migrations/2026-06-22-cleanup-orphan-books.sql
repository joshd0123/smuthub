-- ════════════════════════════════════════════════════════════════════════
--  smutHub · catalog cleanup helper (READ-ONLY + opt-in cleanup)
--
--  Surfaces likely-orphan + duplicate book rows so Josh can review and
--  selectively archive/delete. Run sections IN ORDER. Sections 1–2 are
--  read-only diagnostics. Sections 3–4 modify data and are commented OUT
--  by default — uncomment to execute.
--
--  Background: when the catalog migration first ran, the original 29 seed
--  books had no year, producing slugs like `iron-flame-yarros`. Books later
--  re-added via Manage catalog (with Google Books year autofill) produced
--  fresh slugs like `iron-flame-yarros-2024`. Both rows live in `books`,
--  same title, different slugs. The orphans are the empty seed rows.
--
--  Identifying criteria for an ORPHAN:
--    • no cover_url
--    • no tag assignments (tag_ids is empty)
--    • no year
--   (and usually no spice_level, blurb, etc. — but the above three are enough)
--
--  Run in Supabase → SQL Editor. NOT auto-run. Safe to re-run sections 1–2
--  any time.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Find orphan candidates (READ-ONLY) ─────────────────────────────────
-- Books with no cover, no tags, AND no year. These are the empty seed
-- placeholders, almost always safe to archive or delete.
select
  slug, title, author, status,
  coalesce(cover_url, '(none)')   as cover_url,
  coalesce(year::text, '(none)')  as year,
  coalesce(array_length(tag_ids,1), 0) as tag_count,
  created_at::date as added
from books
where (cover_url is null or cover_url = '')
  and (tag_ids is null or array_length(tag_ids,1) is null or array_length(tag_ids,1) = 0)
  and year is null
order by created_at, slug;


-- ── 2. Find duplicate clusters by normalized title (READ-ONLY) ────────────
-- Groups books whose titles match (ignoring case + punctuation + the year
-- suffix). Shows you which titles have multiple slugs — these are the actual
-- duplicates to merge in Manage catalog.
-- The "richest" entry in each cluster (most fields populated) is starred so
-- you can see at a glance which one to keep.
with normalized as (
  select
    id, slug, title, author, cover_url, year, status,
    coalesce(array_length(tag_ids,1), 0) as tag_count,
    -- richness score: cover + tags + year + blurb each worth one point
    (case when cover_url is not null and cover_url <> '' then 4 else 0 end)
    + least(coalesce(array_length(tag_ids,1),0), 5)
    + (case when year is not null then 2 else 0 end)
    + (case when blurb is not null and length(blurb) > 20 then 1 else 0 end)
      as richness,
    lower(regexp_replace(coalesce(title,''), '[^a-zA-Z0-9]+', '', 'g')) as norm_title
  from books
),
clusters as (
  select norm_title, count(*) as variants
  from normalized
  group by norm_title
  having count(*) > 1
)
select
  n.norm_title,
  c.variants,
  n.slug,
  n.title,
  n.author,
  n.status,
  n.tag_count,
  case when n.cover_url is null then '✗' else '✓' end as cover,
  case when n.year is null then '✗' else n.year::text end as year,
  n.richness,
  case when n.richness = max(n.richness) over (partition by n.norm_title) then '★ keep' else '↪ drop' end as suggested
from normalized n
join clusters c on c.norm_title = n.norm_title
order by c.variants desc, n.norm_title, n.richness desc;


-- ── 3. Bulk-archive orphans (MODIFIES DATA — uncomment to run) ────────────
-- Marks orphan rows as status='archived'. They stay in the DB and on their
-- slug URLs but vanish from public browse + filters. Reversible:
--   update books set status='live' where slug = '<slug>';
--
-- begin;
--   update books
--      set status = 'archived'
--    where (cover_url is null or cover_url = '')
--      and (tag_ids is null or array_length(tag_ids,1) is null or array_length(tag_ids,1) = 0)
--      and year is null
--      and status <> 'archived';
--   -- safety: review counts before commit
--   select status, count(*) from books group by status order by 1;
--   -- If the numbers look right, run:  commit;
--   -- If something looks wrong, run:   rollback;


-- ── 4. Bulk-delete orphans (MODIFIES DATA — destructive, uncomment to run) ─
-- Stronger than archive — removes the rows entirely. Use only after you're
-- sure none of these orphan slugs are referenced by anyone's shelf (shelves
-- store their own title/author/cover_url snapshot, so shelves are safe).
--
-- begin;
--   delete from books
--    where (cover_url is null or cover_url = '')
--      and (tag_ids is null or array_length(tag_ids,1) is null or array_length(tag_ids,1) = 0)
--      and year is null;
--   -- review:
--   select count(*) as books_remaining from books;
--   -- commit; -- or rollback;


-- ── 5. Targeted cleanup: archive just the orphans whose richer twin exists ─
-- Safer than blanket-archiving all orphans — only touches rows where a
-- better-populated twin (same normalized title) is already in the catalog.
-- Uncomment to run.
--
-- begin;
--   with normalized as (
--     select id, slug, cover_url, tag_ids, year, blurb, status,
--       lower(regexp_replace(coalesce(title,''), '[^a-zA-Z0-9]+', '', 'g')) as norm_title,
--       (case when cover_url is not null and cover_url <> '' then 4 else 0 end)
--         + least(coalesce(array_length(tag_ids,1),0),5)
--         + (case when year is not null then 2 else 0 end)
--         + (case when blurb is not null and length(blurb) > 20 then 1 else 0 end) as richness
--     from books
--   ),
--   winners as (
--     select norm_title, max(richness) as best from normalized group by norm_title having count(*) > 1
--   )
--   update books b
--      set status = 'archived'
--     from normalized n
--     join winners w on w.norm_title = n.norm_title
--    where b.id = n.id
--      and n.richness < w.best
--      and (b.cover_url is null or b.cover_url = '')
--      and b.status <> 'archived';
--   -- review:
--   select slug, title, status from books where status = 'archived' order by slug;
--   -- commit; -- or rollback;
