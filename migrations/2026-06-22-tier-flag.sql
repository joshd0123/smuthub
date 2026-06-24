-- ════════════════════════════════════════════════════════════════════════
--  smutHub · tier flag on tags
--
--  Adds a `has_page` boolean to tags. Drives the 3-tier model:
--    has_page=true  + description set → full /glossary/<cat>/<slug>/ page (Tier 1+2)
--    has_page=false                   → filterable tag only, NO glossary URL (Tier 3)
--
--  Default true (existing tags keep their pages). Additive, safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

alter table tags add column if not exists has_page boolean default true;

-- New optional categories enabled by the expanded glossary:
--   time-period (regency, medieval, futuristic, …)
--   sport       (baseball, hockey, mma, …)
-- No schema change required (category is text), just documented here.

comment on column tags.has_page is 'true=generate a /glossary/<cat>/<slug>/ page; false=tag only appears in book-filter UI, no glossary URL.';
