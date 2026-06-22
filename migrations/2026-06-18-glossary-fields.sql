-- ════════════════════════════════════════════════════════════════════════
--  smutHub · glossary content fields on `tags`
--
--  Extends the existing tags table to back the romantasy glossary/encyclopedia.
--  The glossary IS the tag vocabulary — no parallel content type, no duplicate
--  data. Books linked through tag_ids auto-appear in their relevant entries
--  forever (zero ongoing glossary maintenance as the catalog grows).
--
--  Additive + safe to re-run. Run in Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════════════════

-- ── Encyclopedic content per term ──────────────────────────────────────────
alter table tags add column if not exists description       text;          -- 1-sentence canonical definition (REQUIRED for glossary visibility)
alter table tags add column if not exists voice_tagline     text;          -- wry one-liner in smutHub voice ("the 'why' varies but the 'inevitable' doesn't")
alter table tags add column if not exists beginner_blurb    text;          -- plain-language explainer for newcomers
alter table tags add column if not exists why_it_works      text;          -- emotional/structural appeal — THE differentiator section
alter table tags add column if not exists origin_note       text;          -- BookTok history / etymology (top ~30 terms only — optional)
alter table tags add column if not exists also_known_as     text[] default '{}';  -- synonyms / aliases for in-page search ("Mate Bond" → fated-mates)
alter table tags add column if not exists examples          text[] default '{}';  -- famous book titles for terms that don't match a filterable tag
alter table tags add column if not exists related_tag_ids   bigint[] default '{}'; -- manual override; auto-related computed from co-occurrence when empty

-- ── Flags ──────────────────────────────────────────────────────────────────
-- is_filterable=true → appears in the catalog-admin book-tag picker AND in
--   the public Search page filter dropdowns. Use for taxonomy that actually
--   filters books (trope, mood, etc.).
-- is_filterable=false → glossary-only entry. Reader jargon (TBR, BookTok),
--   abbreviations (FMC, MMC, POV), character roles, etc. Doesn't pollute the
--   tag UI but still gets a full glossary page.
alter table tags add column if not exists is_filterable     boolean default true;

-- glossary_visible=false → hide from the public glossary (rare; used for
-- internal or in-development tags).
alter table tags add column if not exists glossary_visible  boolean default true;

-- ── New categories beyond the original 10 ──────────────────────────────────
-- These are referenced by the seed and the glossary build script:
--   subgenre    — romantasy, contemporary-romance, paranormal-romance, urban-fantasy, historical-romance
--   format      — duet, trilogy, standalone, series, interconnected-series, POV variants
--   mechanics   — door styles (open/closed/fade-to-black), spice meta, smut, d/s, safe-word, burn
--   culture     — reader jargon (TBR, DNF, BookTok, OTP), abbreviations (FMC/MMC/LI), endings (HEA/HFN),
--                 relationship structures (MF/MM/FF/MMF/MFM/WC), and character-role terms
--   omegaverse  — omegaverse + shifter mechanics (alpha/omega/heat/knotting/scent-marking/true-mate)
-- No schema change required; categories are just text values.

-- ── Index for the glossary index page (A-Z within category) ────────────────
create index if not exists tags_glossary_idx on tags (category, label) where glossary_visible;

-- ── Helpful comments for the dashboard ─────────────────────────────────────
comment on column tags.description     is 'Required for a tag to appear in the public glossary. 1-sentence canonical definition.';
comment on column tags.voice_tagline   is 'Wry one-liner shown above the fold in the smutHub voice.';
comment on column tags.is_filterable   is 'true = appears in the catalog book-tag UI + Search filters. false = glossary-only (TBR, FMC, etc.).';
comment on column tags.glossary_visible is 'Set to false to hide from /glossary while keeping the tag itself live.';
