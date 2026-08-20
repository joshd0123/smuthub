# smutHub

Romantasy, decoded — a static site where readers browse spice-rated romantasy
titles, build a personal bookshelf, and read the glossary and guides.

It's a plain HTML/JS site served by **Cloudflare Workers static assets**
(custom domain `smuthub.ca`), backed by **Supabase** for auth and data: the
`shelf`, `book_tags`, and `profiles` tables plus the normalized catalog
(`books` / `tags` / `book_tag_assignments`). There is no build step — the files
in this repo are the site.

## Repo structure

### Root pages (`*.html`)

| Page | Purpose |
|---|---|
| `index.html` | Landing page |
| `search.html` | Add / find a book — search, spice ratings, add-to-shelf over the live catalog |
| `scan.html` + `scan-app.js` | Scan a book by cover/ISBN |
| `dashboard.html` | Signed-in dashboard: stats, favourites, taste, read-race |
| `companion.html` + `companion.js` + `companion.css` | Reading Companion (beta) |
| `about.html`, `contact.html`, `privacy.html`, `terms.html` | Static info + legal pages |
| `admin.html` | Admin-only bulk CSV import into the catalog (via `upsert_book`) |
| `catalog-admin.html` | Admin-only catalog manager: books list + per-book edit form |
| `stores.html` | Store finder (Leaflet / OpenStreetMap) |
| `sitemap.html` | Human-readable sitemap |

### Content sections (directories)

| Path | What's there |
|---|---|
| `books/` | The catalog browse pages + per-book detail pages |
| `bookshelf/` | The bookshelf: shelves, themes, book detail sheet |
| `glossary/` | Romantasy glossary & encyclopedia |
| `guides/` | Romantasy guides (incl. gift guides) |
| `founders/` | The Founder's Key |
| `roadmap/` | Public roadmap |
| `u/` | Public user profiles / social layer |
| `import/` | Authenticated Goodreads, StoryGraph, CSV, and ISBN importer |
| `themes/` | Bookshelf theme scene art |
| `data/` | Static JSON data used by pages |

### Shared scripts & config

| File | Purpose |
|---|---|
| `config.js` | `window.SMUTHUB_CONFIG` — Supabase URL/publishable key, Web3Forms, Google Books keys. **Deployed** — pages need it. |
| `auth.js` | Shared auth layer: login modal, header widget into `#authbox`, fires the `sh-auth` event |
| `bookcase-catalog.js` | Shared catalog data helpers for the bookshelf |
| `_headers` | `Cache-Control: no-cache` for everything (no stale deploys) |
| `_redirects`, `robots.txt`, `sitemap.xml` | Routing, crawl rules, and the canonical sitemap |
| `wrangler.jsonc` | Cloudflare Workers static-assets config (points at this directory) |
| `.assetsignore` | Files that must never be served — `*.md`, `*.sql`, `migrations/`, `supabase/`, `scripts/`, and config/git files |

Every page uses the same header (`.nav` > logo / `.navlinks` / `#authbox`) and
loads, in order: Supabase CDN → `config.js` → `auth.js` (defer). Page scripts
listen for the `sh-auth` window event instead of touching auth state directly.

### Not served (tooling & docs)

These live in the repo but are excluded from the deploy by `.assetsignore`:

| Path | What's there |
|---|---|
| `docs/launch/` | Active launch docs (launch gate, launch checklist) |
| `docs/reference/` | Living reference (analytics, content workflow, monetization notes, git cheatsheet) |
| `docs/archive/` | Shipped / historical notes |
| `migrations/` | Catalog schema migrations + tag seed + per-migration design notes — see `migrations/README.md` |
| `migrations/legacy/` | The original one-time `smuthub-*.sql` setup scripts (pre-migration-convention) |
| `supabase/functions/` | Edge Functions (e.g. `rehost-cover`, which rehosts covers to Cloudflare R2 at `covers.smuthub.ca` — see `migrations/R2-COVERS.md`) |
| `scripts/` | One-off runners (e.g. `migrate-covers.mjs`) |

## Deploying

Deploys happen automatically: **pushing to `main` triggers a Cloudflare
deploy** of the whole directory. Because each deploy replaces the full asset
manifest, deleted or renamed files stop being served — there's no separate
"deploy folder" to drift out of sync, and `.assetsignore` keeps docs, SQL, and
tooling off the live site.

**Deploy by committing and pushing to `main` — that is the canonical path.**

```sh
git add -A && git commit -m "…" && git push origin main
```

> ⚠️ **Do not deploy with `npx wrangler deploy`.** It uploads your working
> directory straight to the Worker, but it is **not** the source of truth — the
> next push to `main` auto-deploys from git and **overwrites it**, silently
> reverting anything you only wrangler-deployed and leaving git out of sync with
> what's live. (This bit us once: a wrangler-deployed robots.txt cleanup was
> reverted by an unrelated push minutes later.) Anything you want to stay live
> must be **committed and pushed**. Treat `wrangler deploy` as a throwaway
> preview only, and never on top of uncommitted changes you care about.

If a deploy ever looks stale, `_headers` forces edge + browser revalidation
(`no-cache`), so a normal reload after a successful deploy is enough.
