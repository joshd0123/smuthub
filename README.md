# smutHub

Static site (plain HTML/JS) deployed to Cloudflare Workers static assets at
`smuthub.joshd0123.workers.dev`, backed by Supabase (auth + `shelf`,
`book_tags`, `profiles`, and the normalized catalog `books` / `tags` /
`book_tag_assignments` tables).

## Files

| File | Purpose |
|---|---|
| `index.html` | Landing page + email waitlist |
| `smuthub-app.html` | Search + spice ratings + add-to-shelf; catalog browse & filters (live books) |
| `smuthub-bookcase.html` | The bookcase: shelves, themes, book detail sheet |
| `admin.html` | Admin-only bulk CSV import into the catalog (via `upsert_book`) |
| `catalog-admin.html` | Admin-only catalog manager: books list + per-book edit form (facts, spice, tags, status) |
| `stores.html` | Store finder (Leaflet/OpenStreetMap demo) |
| `sitemap.html` | Sitemap |
| `config.js` | `window.SMUTHUB_CONFIG` — Supabase URL/publishable key + Web3Forms + Google Books keys |
| `auth.js` | Shared auth layer: login modal, header widget into `#authbox`, fires `sh-auth` |
| `_headers` | `Cache-Control: no-cache` for everything (no stale deploys) |
| `smuthub-profiles.sql` | One-time Supabase setup for the `profiles` table (not deployed) |
| `migrations/` | Catalog schema migration + tag seed + design notes — see `migrations/README.md` |
| `supabase/functions/rehost-cover/` | Edge Function that rehosts book covers to Cloudflare R2 (`covers.smuthub.ca`) — see `migrations/R2-COVERS.md` |
| `scripts/migrate-covers.mjs` | One-time runner that migrates all existing covers to R2 (run manually) |

Every page uses the same header (`.nav` > logo / `.navlinks` / `#authbox`) and
loads, in order: Supabase CDN → `config.js` → `auth.js` (defer). Page scripts
listen for the `sh-auth` window event instead of touching auth state directly.

## Deploying

```sh
npx wrangler deploy
```

Run it from this folder. `wrangler.jsonc` points at this directory, so each
deploy replaces the full asset manifest — deleted/renamed files stop being
served, and there is no separate "deploy folder" to drift out of sync.
`.assetsignore` keeps the README, SQL, and config files for tooling off the
live site (`config.js` IS deployed — pages need it).

If a deploy ever looks stale: `_headers` forces edge + browser revalidation
(`no-cache`), so a normal reload after a successful deploy is enough.
^above not needed as we push through github now.
