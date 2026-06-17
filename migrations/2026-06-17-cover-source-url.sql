-- ════════════════════════════════════════════════════════════════════════
--  smutHub · cover migration audit column
--
--  Adds books.cover_source_url to preserve the ORIGINAL (pre-R2) cover URL
--  when covers are rehosted to Cloudflare R2 (covers.smuthub.ca). This is an
--  audit trail only — nothing reads it at display time; the public pages keep
--  reading books.cover_url, which simply becomes an R2 URL after migration.
--
--  Additive + safe to re-run. Run in Supabase → SQL Editor. NOT auto-run.
-- ════════════════════════════════════════════════════════════════════════

alter table books add column if not exists cover_source_url text;

comment on column books.cover_source_url is
  'Original external cover URL (Google Books / Amazon / etc.) captured before the cover was rehosted to Cloudflare R2 at covers.smuthub.ca. Audit trail; not used for display. Populated by the rehost-cover Edge Function + scripts/migrate-covers.mjs.';
