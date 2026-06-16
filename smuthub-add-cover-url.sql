-- ════════════════════════════════════════════════════════
--  smutHub: store a cover image URL on the shelf
--  Google Books covers are URLs (not Open Library numeric ids), so we keep a
--  cover_url alongside the existing cover_i. Run once in Supabase SQL Editor.
-- ════════════════════════════════════════════════════════

alter table shelf add column if not exists cover_url text;
