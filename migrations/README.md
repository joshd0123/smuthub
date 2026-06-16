# Catalog: normalized schema + controlled-vocabulary tags

This folder holds the migration that turns the flat `catalog` table into a
normalized **books + tags + assignments** model with a controlled tag
vocabulary, richer spice fields, draft/live publishing, and an admin edit UI.

## What to run, in order (Supabase → SQL Editor)

These are **not** run automatically — apply them yourself and check the row
counts the script prints at the end.

1. `2026-06-16-catalog-normalized.sql` — **the whole migration.** Creates the
   tables, indexes, the `tag_ids` sync trigger, RLS, the `upsert_book()` RPC,
   seeds the tag vocabulary, and migrates your existing `catalog` rows into the
   new tables. Safe to re-run.
2. `2026-06-16-seed-tags.sql` — *optional.* The same vocabulary seed, standalone,
   for adding new tags later or seeding a fresh database. (Already included in
   step 1, so you don't need it on first run.)

Prerequisites already in your project: `smuthub-profiles.sql`,
`smuthub-catalog.sql`, `smuthub-catalog-fields.sql`. The migration **reads**
`catalog` but never drops or renames it — your old data stays put until you
choose to retire it.

After running, make sure you're an admin (once):

```sql
update profiles set is_admin = true where id = auth.uid();
```

## The model

```
books (slug PK)                tags (id PK)                 book_tag_assignments
─ slug 'fourth-wing-…-2023'    ─ id                         ─ book_id  → books.slug
─ title, author, cover_url     ─ category  (10 kinds)       ─ tag_id   → tags.id
─ bibliographic, spice,        ─ slug      lowercase-hyph    ─ source   admin|migration|community
  structure, discovery cols    ─ label     display text      ─ votes
─ status  draft|live|archived  unique(category, slug)        PK(book_id, tag_id)
─ tag_ids text[]  ← synced cache: {"trope:enemies-to-lovers", "mood:dark", …}
```

- **Slug primary keys.** A book's id is a human-readable slug built from
  title + author surname + year (`make_slug()`), e.g. `fourth-wing-yarros-2023`.
- **Tags are the source of truth.** Tropes, moods, content warnings,
  representation, archetypes, etc. live in `tags` and are attached through
  `book_tag_assignments`.
- **Hybrid `tag_ids[]` for fast filtering.** A trigger keeps `books.tag_ids`
  in sync with the join table, storing each tag as `"category:slug"`. The public
  Search page filters with a single `tag_ids @> ['trope:enemies-to-lovers']`
  call — no join, no extra round-trip — while the join table stays canonical.
- **One write path: `upsert_book(jsonb)`.** The CSV importer, the per-book edit
  form, and the "★ Add to catalog" button all call this RPC. It writes the book
  row and explodes the tag arrays into tags + assignments in one transaction.
  Update rule: a key **present** in the payload is set exactly (even to `null`,
  so the edit form can clear a field); a key **absent** is left alone (so the
  importer's "leave a cell blank to skip it" still holds). Tag categories are
  only replaced when their key is present.
- **RLS.** The public can read only `status='live'` books; admins read and write
  everything. `tags`/assignments are world-readable, admin-writable.
  `upsert_book` additionally refuses non-admin callers.

### Tag categories (10)

`trope · mood · vibe · theme · warning · representation · setting · kink ·
mc-archetype · li-archetype`

## How the front-end uses it

| Page | Change |
|---|---|
| `smuthub-app.html` | Browse + filters read `books` (live only); trope/mood filters hit `tag_ids`; spice → `spice_level`; "★ Add to catalog" and cover-fill go through `upsert_book`/`books`. Shelf `book_key` for catalog books is now the slug. |
| `admin.html` | Bulk CSV importer now calls `upsert_book` per row, so tags are created and attached automatically. New rows import as **drafts**. |
| `catalog-admin.html` | **New.** Books list (drafts + live) + full edit form: identity, spice block, structure, tags as checkboxes per category (with inline "add new tag"), status, and Google Books fact autofill. |

## Deviations from the original brief (and why)

- **Surrogate tag id + `unique(category, slug)`** instead of the brief's
  `tags.id text primary key`. The brief's seed used the same slug in two
  categories (e.g. `morally-grey` as both a trope and an li-archetype,
  `why-choose` as a trope), which are duplicate primary keys and would fail to
  insert. The surrogate id lets a slug live in multiple categories.
- **Hybrid `tag_ids[]` cache** added (not in the brief) so the existing public
  filter UI stays a fast single-table query and keeps working unchanged.
- **`books` keeps several single-value columns** the brief modeled as tag
  categories — `energy`, `relationship_type`, `who_falls_first`, `ending`,
  `pacing`, etc. They're genuinely single-valued and already existed as
  structured columns; keeping them as columns is simpler to filter and sort.
  Multi-valued controlled fields became tags.
- **No data loss.** Every column from `smuthub-catalog-fields.sql` is carried
  over: array columns (`themes`, `vibes`, `kink_tags`, `mc_archetype`,
  `li_archetype`, `setting`, …) became tag categories; the rest became `books`
  columns. Legacy field names are mapped (`spice`→`spice_level`,
  `open_door`→`door`, `steam_frequency`→`spice_frequency`).
- **Status mapping on migration.** Existing rows (`status='published'` or
  unset) migrate to `live`; rows already `draft` stay `draft`. New books default
  to `draft` so nothing auto-publishes.
- **Legacy `catalog` and `book_tags` are untouched.** `catalog` remains as the
  read source for the migration; the user-spice `book_tags` table is unrelated
  and unchanged.

### Note on existing shelves

Shelves key books by `book_key`. Catalog-sourced search results previously used
`cat:<id>`; they now use the book **slug**. Shelves built from Google/Open
Library results (the vast majority) are unaffected — they key on those sources'
ids and store their own title/author/cover snapshot. A handful of older
`cat:<id>` shelf entries won't re-link to the new slug, but the shelf still
renders them from its stored snapshot, so nothing breaks.
