# Tag knowledge-graph — what we adopted, rejected, and deferred

This documents the response to the "Upgrade tags from controlled vocabulary to
knowledge graph" brief. The brief was written without knowledge of the current
built state; several of its core decisions conflicted with what's already live.
We adopted the safe, valuable parts and rejected/deferred the rest.

## Adopted (additive, in `2026-06-22-tag-graph.sql`)

- **`tag_relations` table** — editorial links between tags (`similar`,
  `often-paired`, `parent`, `child`, `opposite`) with a `strength` (1–10).
  References the surrogate `tags.id bigint` (see "Rejected" #1). Powers the
  "Related terms" section on glossary pages, replacing the dumb
  same-category fallback.
- **`link_tags()` helper** — adds a relation BOTH directions in one call, so
  you can author the graph from the SQL editor without an admin UI:
  ```sql
  select link_tags('trope','fated-mates','trope','dragon-rider','often-paired',7);
  select link_tags('mechanics','open-door','mechanics','closed-door','opposite',8);
  select link_tags('subgenre','romantasy','subgenre','paranormal-romance','parent',6);
  ```
  `similar`/`often-paired`/`opposite` are stored symmetrically; `parent` auto-
  creates the inverse `child`. Re-running updates strength/type (idempotent).
- **Roadmap columns on `tags`**: `seo_description` (~155-char meta snippet,
  distinct from the on-page definition), `priority` (1–100 — which tags earn
  rich treatment first), `search_volume_note`, per-tag `emoji` override,
  `updated_at` (+ touch trigger).
- **`authors` table** — ADDITIVE first-class entity, populated from your distinct
  book authors. **Does NOT touch `books.author`.** Nothing reads it yet; it's
  groundwork so author pages are trivial later, with zero catalog risk.

## Rejected (would break the live site)

1. **`tags.id text primary key` (slug as PK)** — 30+ slugs live in multiple
   categories (`morally-grey` is a trope AND mc-archetype AND li-archetype;
   `dark-romance` is a trope AND subgenre; `alpha`, `possessive`, `villain`,
   `cinnamon-roll`, `war`, `age-gap`, `found-family`, `knotting`…). A text-slug
   PK would crash on the first duplicate. The surrogate `bigint id` +
   `unique(category, slug)` is load-bearing — it's the fix for that exact bug.
2. **Collapsing to 7 categories** — the category is in every live glossary URL
   (`/glossary/trope/fated-mates/`). Re-bucketing 352 tags into the brief's 7
   would rewrite every indexed URL, create 404s, and discard SEO equity. There's
   also no home in those 7 for `culture` (TBR, BookTok), `format` (POV, duet), or
   `mechanics` (open-door, smut). Kept the 15 categories. (If a higher-level
   navigation grouping is wanted later, add a display-only `category_group`
   column — no URL change.)
3. **New `/tag/{slug}` routing** — the live `/glossary/<category>/<slug>/` pages
   ARE the tag pages. A parallel namespace would be duplicate content.

## Deferred (high blast radius — needs its own snapshot-first effort)

- **`books.author` text → `authors` FK migration.** `make_slug` bakes the author
  surname into every book slug; `upsert_book`, the CSV importer, catalog-admin,
  Search, dashboard, bookcase, and the glossary book grids all read
  `books.author` as text. Swapping it to a FK is a catalog-wide change. The
  additive `authors` table above gets us author pages later without the FK swap.
- **Relations-authoring admin UI** — premature for a pre-launch catalog. Author
  relations via `link_tags()` in the SQL editor for now; build the UI when
  traffic/content justify the editorial effort.
- **`author_tags` join, author pages, per-tag OG images, reader voting.**

## How to use it

1. Apply `migrations/2026-06-22-tag-graph.sql` in Supabase → SQL Editor.
   Additive + idempotent; nothing on the live site changes yet.
2. (Optional) Author some relations with `link_tags(...)` — start with the
   flagship tropes the brief listed (fated-mates, enemies-to-lovers, dragon-
   rider, slow-burn, morally-grey, etc.).
3. Rebuild the glossary so the relations show up:
   ```sh
   node scripts/build-glossary.mjs
   git add glossary/ sitemap.xml && git commit -m "build: glossary relations" && git push
   ```
   The build reads `tag_relations` and renders them under "Related terms"
   (strongest first, labeled by relation type). If you author no relations,
   the pages keep the sensible same-category fallback — no harm, no empty space.

## Verification

Validated end-to-end on a throwaway Postgres 16: `link_tags()` creates clean
bidirectional rows (`opposite` symmetric, `parent`→`child` inverse), `authors`
populates and dedupes (one row per author across multiple books), and the
glossary build consumes `tag_relations` with a graceful fallback when the table
is absent or empty.
