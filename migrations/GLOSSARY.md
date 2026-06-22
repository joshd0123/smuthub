# Glossary / Romantasy Encyclopedia

Per-term static HTML pages (`/glossary/<category>/<slug>/`) generated from the
`tags` table. Same DB as the catalog — every glossary entry is just a tag with
encyclopedic fields filled in, and the books that share that tag auto-appear
under the entry forever.

## Architecture

```
tags table         ← extended with: description, voice_tagline, beginner_blurb,
                     why_it_works, origin_note, also_known_as[], examples[],
                     related_tag_ids[], is_filterable, glossary_visible
       │
       ▼
scripts/build-glossary.mjs
       │  generates per-term + per-category + index HTML pages
       ▼
/glossary/                          ← A-Z index + category filter + live search
/glossary/<category>/               ← per-category landing page
/glossary/<category>/<slug>/        ← per-term encyclopedia page (canonical URL)
       │
       ▼
Cloudflare static deploy    ← fully pre-rendered HTML, perfect for SEO
```

Each per-term page has its own canonical URL, title, meta description, Open
Graph card, Twitter card, and JSON-LD `DefinedTerm` structured data — built so
each term can rank independently for its long-tail queries.

Books featured under each term load via a small client-side `fetch` at runtime
from the live catalog, so adding new books in Manage catalog **auto-populates**
every relevant glossary page with zero rebuild required.

## Vocabulary categories

Existing 10 (filterable for book tagging): `trope`, `mood`, `vibe`, `theme`,
`warning`, `representation`, `setting`, `kink`, `mc-archetype`, `li-archetype`.

New for glossary (mix of filterable and glossary-only):
- `subgenre` — romantasy, contemporary, paranormal, urban-fantasy, historical
- `format` — duet, trilogy, standalone, series, POV variants
- `mechanics` — door styles, spice meta, smut, d/s, safe-word, burn
- `culture` — TBR, DNF, BookTok, OTP, HEA, HFN, FMC, MMC, MF/MM/FF/MMF/MFM/WC, etc.
- `omegaverse` — omegaverse + shifter-specific terminology

A tag's `is_filterable` flag controls whether it shows up in the Manage catalog
book-tag picker (`true`) or is glossary-only (`false`). Default is `true`.

## One-time setup

### 1. Apply the SQL

In Supabase → SQL Editor, in order:

1. `migrations/2026-06-18-glossary-fields.sql` — adds the encyclopedic columns
   to `tags`. Additive, safe to re-run.
2. `migrations/2026-06-18-glossary-seed.sql` — seeds ~50 curated terms cleaned
   up from the source draft. Idempotent (`coalesce`-preserves any prior edits).

After running, the SQL prints a notice with the term count and how many have
descriptions (= are glossary-ready). Expect ~50–60 ready entries on first run.

### 2. Build the static pages

From the repo root, locally:

```sh
node scripts/build-glossary.mjs
```

It reads the anon Supabase key from `config.js` (no secrets needed — tags
table is public-read), fetches every term where `description IS NOT NULL`
and `glossary_visible = true`, and writes:

- `glossary/index.html`
- `glossary/<category>/index.html` × ~14 categories
- `glossary/<category>/<slug>/index.html` × ~50 terms
- Updates `sitemap.xml` (replaces the block between `<!-- GLOSSARY-AUTO-START -->`
  and `<!-- GLOSSARY-AUTO-END -->` markers; first run inserts them)

Then:
```sh
git add glossary/ sitemap.xml
git commit -m "build: refresh glossary"
git push
```

Cloudflare auto-deploys; the new pages are live.

## Workflow: adding or editing terms

You're maintaining the glossary directly in the `tags` table — same place the
catalog's tag vocabulary lives. Two flows:

**Tag with content already in the catalog (e.g. `enemies-to-lovers`):**
1. Open Supabase Table Editor → `tags` → find the row.
2. Edit `description`, `voice_tagline`, `why_it_works`, etc.
3. Locally: `node scripts/build-glossary.mjs && git add glossary/ sitemap.xml && git commit && git push`.

**Brand-new glossary entry not yet in the catalog (e.g. "Shadow Lord Daddy"):**
1. Supabase Table Editor → `tags` → Insert row with `category`, `slug`, `label`,
   `description` (at minimum). Set `is_filterable=false` if it's glossary-only.
2. Rebuild + push as above.

Don't have content yet? Leave `description` null — the term won't appear in
the public glossary until you give it a definition. (Filtering still works for
its books; the entry just stays unpublished.)

## Workflow: when to rebuild

| Change | Rebuild needed? |
|---|---|
| Edited a `tags` row's content (description, why_it_works, etc.) | **Yes** — content lives in the static HTML |
| Added a brand-new tag with `description` | **Yes** — new page needs to be generated |
| Tagged an existing book with a tag that's already in the glossary | **No** — books load via runtime fetch |
| Added a new book and tagged it | **No** — runtime fetch picks it up |
| Marked a book `featured` | **No** — runtime fetch picks it up |
| Changed `glossary_visible` from true→false | **Yes** — page needs to disappear |

Rule of thumb: rebuild when **tag content** changes. Don't rebuild when **book
content** changes.

## What's NOT done in v1 (deferred)

- **Authoring UI in catalog-admin** for editing tag content from the browser
  (today you edit in the Supabase Table Editor). Easy follow-on.
- **Auto-related terms via co-occurrence** — for now we fall back to "other
  tags in the same category" when `related_tag_ids` is empty. The smarter
  "books with this tag often also have which tags?" requires a DB function;
  v2 enhancement.
- **Reader voting** — defer until traffic justifies it.
- **Per-term Open Graph images** — every page currently uses the site-wide
  og-image.png. Per-term OG cards (one image per term with the term name) are
  a nice polish for social sharing — v2.
- **`is_filterable` enforcement in the catalog-admin tag picker** — the picker
  currently shows all tags regardless. Add `where is_filterable` to its query
  to clean up the UI once the long tail of glossary-only tags is in.

## Rollback

Nothing destructive. To take the glossary offline:
- Delete the `glossary/` folder, commit, push → pages 404.
- Or set `glossary_visible=false` on all tags, rebuild, push → all pages removed
  from the deploy.

The `tags` content fields remain in the DB regardless — set
`glossary_visible=true` and rebuild to bring them back.
