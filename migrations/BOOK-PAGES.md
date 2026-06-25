# Book "Plot / About" Pages

Per-book static HTML pages (`/book/<slug>/`) — the Goodreads-style page a reader
lands on when they tap a book cover anywhere on the site. Generated from the
`books` table by `scripts/build-books.mjs`. Same DB as the catalog and glossary;
the page just renders one book's metadata and links its tropes/moods/vibes back
into the glossary.

## Architecture

```
books table        ← the normalized catalog (slug PK, spice_*, door, pov, pacing,
       │             ending, series, tag_ids[], blurb, triggers_detail, cover_url …)
       │
       ▼
scripts/build-books.mjs
       │  one page per LIVE book; resolves tag_ids → glossary links;
       │  computes "more like this / by author / in series" from the full catalog
       ▼
/book/<slug>/index.html             ← canonical plot page (one per live book)
       │
       ▼
Cloudflare static deploy            ← fully pre-rendered HTML, per-book SEO
```

Each page has its own canonical URL, title, meta description, **Open Graph image
= the book's own cover** (so shared links preview the real cover), Twitter card,
and JSON-LD `Book` structured data — built so each title can rank for its own
long-tail queries ("<book> spice level", "<book> content warnings", "is <book>
a cliffhanger").

## Page anatomy (v1)

| Section | Source columns |
|---|---|
| **Hero** | `cover_url`, `title`, `author`, `year`, `series` + `series_number`, `subgenre` |
| **Spice Meter** | `spice_level` (0–5 chilis), `door`, `spice_frequency`, `heat_type[]` |
| **Reader Heads-Up** (collapsed `<details>`) | `tag_ids` where category = `warning`, plus `triggers_detail` |
| **What it's about** | `blurb` + chips for trope/mood/vibe/theme/subgenre/etc. that **link to the glossary** |
| **The Details** | `pov`, `pacing`, `length_feel` + `page_count`, `world_type`, `setting`, `time_period`, `ending` (+`cliffhanger`), `relationship_type`, `who_falls_first`, `age_category`, `energy`, `tense`, `audiobook` |
| **More in `<series>`** | other live books with the same `series`, ordered by `series_number` |
| **More like this** | live books with the most shared *taste* tags (excludes warning/format/pov/mechanics, and same-series/same-author dupes) |
| **More by `<author>`** | other live books by the same `author` |
| **Add to shelf** | client-side; upserts `shelf` (book_key = slug) — mirrors the Search page exactly |

Only sections with data render — a sparse book degrades to just a hero + shelf
button, no empty panels.

### What's deferred to v2
User reviews/ratings and affiliate buy links (intentionally out of v1).

## Blurb formatting (what to type in the `blurb` column)

The blurb is a single text column, but the page renders it as structured
paragraphs — `What it's about` gets a small muted publisher intro, a larger
lead hook, body paragraphs, and an italic rose-amber "pitch" callout. Long
blurbs collapse to the first 3 paragraphs with a *Read more / Show less*
toggle. You control the structure with four conventions inside the blurb:

| You type | You get |
|---|---|
| blank line between paragraphs | paragraph break |
| `> ` at the start of a paragraph | small muted publisher intro |
| `***text***` wrapping a whole paragraph | italic pitch callout with the gradient left border |
| `**word**` inline | bold key term (`.term` span — no link; chips below handle navigation) |

The first non-intro, non-pitch paragraph is automatically promoted to the
**lead** style (larger, slightly brighter) — you don't need a marker for it.

In addition, any tag label that's on this book (`Enemies to Lovers`,
`Romantasy`, `Morally Grey`, etc.) is **auto-bolded** wherever it appears in
the blurb, whole-word and case-insensitive. So a book tagged
`subgenre:romantasy` will see every mention of "romantasy" bolded without
any markup. You only need the manual `**word**` markers for book-specific
worldbuilding terms ("Fae", "Reapers", a made-up empire name) that aren't
catalog tags.

Example:

```
> Highly anticipated first in the spin-off to the Zodiac Academy phenomenon.

The dragons are lost. The elements are at war.

I'm a wielder of hearts and summoner of corruption. But I'm one of only two
**Fae** in this divided land who might be starting to see through the lies.

The **Reapers** are merciless. The **Royals** are lying. The **Werewolves**
run rampant.

***An enemies to lovers romantasy set in the same world as Zodiac Academy —
but a dark and villainous tale of its own.***
```

Renders as: muted intro, dramatic lead, two body paragraphs with bolded
worldbuilding terms, italic pitch callout with "enemies to lovers" and
"romantasy" auto-bolded (they're tags).

## Chips → glossary linking

A book's `tag_ids` are `"category:slug"` strings. A chip links to
`/glossary/<category>/<slug>/` **only when that glossary page actually exists** —
i.e. the tag is Tier 1+2 (`has_page != false` AND `description` set), the exact
same rule `build-glossary.mjs` uses. Tags without a page (or not yet loaded)
render as non-clickable chips, so chips never point at a 404.

## Build it

From the repo root, locally:

```sh
node scripts/build-books.mjs
```

It reads the anon Supabase key from `config.js` (no secrets — `books` is
public-read for `status='live'`), fetches every live book plus the glossary
tags, and writes:

- `book/<slug>/index.html` for every live book
- Updates `sitemap.xml` (replaces the block between `<!-- BOOK-AUTO-START -->`
  and `<!-- BOOK-AUTO-END -->`; first run inserts the markers before `</urlset>`)

Then:
```sh
git add book/ sitemap.xml
git commit -m "build: refresh book pages"
git push
```

Cloudflare auto-deploys; the pages go live. (`scripts/` and `*.md` are in
`.assetsignore`, so the build script and this doc never ship as site assets;
`book/` is **not** ignored, so the pages do.)

### Full rebuild (glossary + books together)

When you've changed tag content *and* book content, run both — order doesn't
matter, they touch different sitemap blocks:

```sh
node scripts/build-glossary.mjs
node scripts/build-books.mjs
git add glossary/ book/ sitemap.xml && git commit -m "build: refresh glossary + book pages" && git push
```

## Where book links point

Every book card across the site now deep-links to `/book/<slug>/`:

| Surface | File | Behavior |
|---|---|---|
| Homepage "Trending/Featured" | `index.html` | featured cards → `/book/<slug>/` |
| Glossary "Books featuring this term" | `scripts/build-glossary.mjs` (runtime fetch) | each cover → `/book/<slug>/` |
| Search results | `smuthub-app.html` | **catalog** results (key = slug) link cover + title; external Google/OpenLibrary results stay un-linked |
| Bookshelf detail sheet | `smuthub-bookcase.html` | "📖 View book page" action for catalog shelf entries only |

A "catalog" book is identified by its key being the slug — *not* a Google Books
`gb:…` id and *not* an OpenLibrary `/works/…` path (and not a `demo-…` key on the
shelf). External search hits and demo tiles never link, because they have no page.

## Workflow: when to rebuild

| Change | Rebuild book pages? |
|---|---|
| Edited a book's content (blurb, spice, tags, series, cover…) | **Yes** — the content is baked into the static HTML |
| Published a new book (`status` → `live`) | **Yes** — its page must be generated + added to the sitemap |
| Archived/unpublished a book | **Yes** — its page should disappear from the sitemap (stale `/book/<slug>/` 404s on next deploy since `book/` is wiped & rebuilt) |
| Edited a glossary tag's `description`/`has_page` | Optional — only changes whether a chip links; rebuild to refresh chip links |
| A user shelved/rated a book | **No** — shelf state is per-user, loaded client-side |

`build-books.mjs` wipes and re-creates the whole `book/` directory each run, so
archived books drop out automatically — no stale pages linger in the repo.

## Notes / gotchas

- **Covers**: OG/Twitter/JSON-LD `image` use `cover_url` as-is when it's absolute
  (e.g. `https://covers.smuthub.ca/<slug>.jpg`); books with no cover fall back to
  `/og-image.png` and show a title placeholder card.
- **Blurb newlines** are preserved on-page (`white-space:pre-line`) but collapsed
  to a single line for the meta description / OG tags.
- **"More like this"** weighs *taste* tags only (tropes, moods, vibes, themes,
  worldbuilding, kinks, archetypes…), deliberately ignoring content warnings,
  format, POV and spice mechanics so overlap reflects vibe, not "both are 400pp".
- The add-to-shelf control is the **same** `shelf` upsert the Search page uses
  (`onConflict: user_id,book_key`, with the same `cover_url`-missing retry), so a
  book shelved from its page and from Search are the same row.
