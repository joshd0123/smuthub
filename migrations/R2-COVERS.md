# Self-hosted book covers on Cloudflare R2

Move book covers off third-party hotlinks (Google Books, Amazon/Goodreads)
onto **`covers.smuthub.ca`**, backed by a Cloudflare R2 bucket. Branded URLs,
free egress, CDN-cached, no broken-image risk when a source rotates.

## Architecture (v1 — migration-first)

```
  source image (Google/Amazon)
        │  fetched server-side (browsers can't — no CORS on those hosts)
        ▼
  rehost-cover  ── Supabase Edge Function (admin-gated)
        │  PUT via S3 API
        ▼
  R2 bucket  smuthub-covers  ──(public, CDN)──►  https://covers.smuthub.ca/<slug>.<ext>
        │
        ▼
  books.cover_url  ← updated to the R2 URL   (books.cover_source_url ← original, for audit)
```

- **Reads** are unchanged: every page keeps consuming `books.cover_url`, which
  is now an R2 URL. No public-page / `config.js` / `auth.js` changes.
- **The website stays a pure static deploy** — the one server-side piece is the
  Supabase Edge Function, not a Cloudflare Worker. `wrangler.jsonc` is untouched.
- **No CORS config is needed on the bucket for display** — `<img src>` loads
  cross-origin without CORS. (You'd only need bucket CORS if JS read cover pixels
  via `fetch`/canvas, which nothing does.)
- **v1 does not transcode** to JPEG (Edge can't run sharp/imagemagick, and the
  current covers are already JPEG). Images are stored as-is with the correct
  `Content-Type`; the file extension follows the source format. If you later want
  resizing / auto-WebP, point Cloudflare Images *at* this R2 bucket and pay only
  per-transform.

## ⚠ Prerequisite: smuthub.ca must be live on Cloudflare

An R2 custom domain must be an active zone in your Cloudflare account. Until
`smuthub.ca` is registered and added to Cloudflare, `covers.smuthub.ca` can't be
attached and the rehosted URLs won't resolve. Do the domain first (see
`migrations/SEO-LAUNCH.md`).

## One-time setup

### 1. Database

Run `migrations/2026-06-17-cover-source-url.sql` in Supabase → SQL Editor (adds
the `books.cover_source_url` audit column).

### 2. R2 bucket + custom domain

In the Cloudflare dashboard → R2:
1. **Create bucket** `smuthub-covers`. (Skip a `-dev` bucket — there's no
   preview environment.)
2. **Settings → Public access → Custom Domains → Connect Domain** →
   `covers.smuthub.ca`. This makes the bucket publicly readable AND fronts it
   with Cloudflare's CDN cache. Do **not** rely on the `r2.dev` URL — it's
   rate-limited and Cloudflare says not to use it in production.
3. (CORS not required for serving — skip it.)

### 3. R2 S3 API token

R2 → **Manage R2 API Tokens → Create API Token** → Object Read & Write, scoped
to the `smuthub-covers` bucket. Note the **Access Key ID**, **Secret Access
Key**, and your **Account ID** (shown on the R2 overview page).

### 4. Deploy the Edge Function

Requires the Supabase CLI (`npm i -g supabase`), logged in and linked to the
project (`supabase link --project-ref <ref>`).

```sh
# from the repo root
supabase secrets set \
  R2_ACCOUNT_ID="<account id>" \
  R2_ACCESS_KEY_ID="<access key id>" \
  R2_SECRET_ACCESS_KEY="<secret access key>" \
  R2_BUCKET="smuthub-covers" \
  COVERS_BASE_URL="https://covers.smuthub.ca"

supabase functions deploy rehost-cover
```

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — do
not set them yourself.)

## Run the migration (manual, when you're ready)

```sh
FUNCTION_URL="https://<project-ref>.supabase.co/functions/v1/rehost-cover" \
ADMIN_TOKEN="<an admin user's access token>" \
node scripts/migrate-covers.mjs
```

Get `ADMIN_TOKEN`: log into smutHub as your admin account, then in the browser
devtools console:

```js
JSON.parse(localStorage.getItem(
  Object.keys(localStorage).find(k => k.endsWith('-auth-token'))
)).access_token
```

The script loops in batches of 25 until `remaining` hits 0, printing each book
and any failures. It's idempotent — re-run any time (e.g. after adding new
books); already-migrated covers are skipped. Failed books keep their original
`cover_url` and are listed with a reason so you can re-source them in Manage
catalog.

**Verify before trusting it:** spot-check a few `covers.smuthub.ca/<slug>.jpg`
URLs in the browser, confirm the books still render on Search / Dashboard /
Bookshelf, then you're done. The original URLs remain in `cover_source_url`;
don't drop that column until you're satisfied.

## Adding a single cover manually

Either rehost one book through the function:

```sh
curl -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"slug":"fourth-wing-yarros-2023"}'
# or from an explicit source:  -d '{"slug":"…","source_url":"https://…"}'
```

…or upload an image straight into the R2 bucket in the Cloudflare dashboard with
the key `<slug>.jpg`, then set that book's `cover_url` to
`https://covers.smuthub.ca/<slug>.jpg` in Manage catalog.

## Not done in v1 (deferred)

- **Live "rehost on save"** in `catalog-admin.html` (paste a URL → auto-rehost
  on save). The Edge Function already supports single-book mode; wiring the admin
  form to call it (with the logged-in admin's token) is the remaining step.
- **JPEG transcode / resize** — see the note above; add via Cloudflare Images
  later if wanted.

## Rollback

Nothing is destructive. `cover_source_url` holds every original URL, so to
revert a book: `update books set cover_url = cover_source_url where slug = '…';`
Objects left in R2 are harmless (and free at this scale).
