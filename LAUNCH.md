# smutHub · Launch checklist

Going live means pointing **smuthub.ca** at the Worker. Everything is built and
deployed already — the site serves from `smuthub.joshd0123.workers.dev`, and the
whole codebase (canonicals, `og:url`, JSON-LD, all 672 sitemap URLs) already
claims `https://smuthub.ca/`. These steps make that claim true.

Work top to bottom. Steps 1–4 are the launch itself; 5–8 are verification.

---

### 1. Remove the parked DNS records

Cloudflare dashboard → **smuthub.ca** → DNS. Delete the records that currently
send the apex (and `www`) to GoDaddy's website builder.

They must be gone first: with `custom_domain: true`, wrangler creates its own
records and the deploy **fails** if a conflicting one exists.

> Do **not** touch `covers.smuthub.ca` or `analytics.smuthub.ca`. Those are
> separate records — R2 covers and the Umami tunnel — and are working.

### 2. Attach the domain to the Worker

Uncomment the `routes` block in [`wrangler.jsonc`](wrangler.jsonc), then:

```bash
npx wrangler deploy
```

Or do it in the dashboard instead: Workers & Pages → **smuthub** → Settings →
Domains & Routes → Add custom domain → `smuthub.ca`, then again for
`www.smuthub.ca`.

Add **www explicitly**. It does not resolve at all today, so fixing only the
apex leaves `www.smuthub.ca` dead.

### 3. Confirm the domain serves the site

```bash
curl -sI https://smuthub.ca/ | head -1                 # expect HTTP/2 200
curl -s https://smuthub.ca/ | grep -o "<title>[^<]*"   # expect the smutHub title
curl -s https://smuthub.ca/books/ | grep -c "bcard"     # expect 289
```

If you still see GoDaddy content, a DNS record from step 1 survived.

### 4. ⚠️ Re-enable crawling

Edit [`robots.txt`](robots.txt): delete the `Disallow: /`, uncomment the block
beneath it, redeploy.

**This is the easiest step to forget and the most expensive to miss.** Nothing
on the site looks broken if you skip it — the site is simply invisible to
Google, indefinitely.

```bash
curl -s https://smuthub.ca/robots.txt      # must NOT contain "Disallow: /"
```

`/search` stays out of the index regardless — it carries its own
`<meta name="robots" content="noindex, follow">` and is excluded from the
sitemap, because it's a tool, not content. Nothing to toggle.

### 4a. ⚠️ Disable the workers.dev preview host

Once `smuthub.ca` serves the site and crawling is on, **turn off the
`workers.dev` host** so Google can't index the preview as a duplicate of
production. Every canonical already points at `smuthub.ca`, but the cleanest
guarantee is for the preview host to stop resolving entirely.

Add to [`wrangler.jsonc`](wrangler.jsonc) and redeploy:

```jsonc
"workers_dev": false
```

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://smuthub.joshd0123.workers.dev/   # expect 404/522, not 200
```

Why this and not a `noindex` header on the preview: Cloudflare's `_headers`
file matches on **path only**, not hostname, so it can't noindex one host and
not the other. Removing the host is the reliable fix.

### 5. Verify the canonicals resolve

Every page claims `https://smuthub.ca/...`. Spot-check that those URLs are real:

```bash
for u in / /books/ /search /glossary/ /books/powerless-roberts-2023/; do
  echo "$u -> $(curl -s -o /dev/null -w '%{http_code}' https://smuthub.ca$u)"
done
```

All should be 200. Also confirm the old search path still redirects:
`https://smuthub.ca/smuthub-app` → `/search`.

### 6. Check the subdomains survived the DNS change

```bash
curl -s -o /dev/null -w "covers:    %{http_code}\n" https://covers.smuthub.ca/powerless-roberts-2023.jpg
curl -s -o /dev/null -w "analytics: %{http_code}\n" https://analytics.smuthub.ca/script.js
```

Both must be 200. The first backs every cover image on the site; the second is
the Umami tracker.

### 7. Confirm analytics records from the real domain

Load `https://smuthub.ca/` in a browser, then check Umami for a pageview on
hostname `smuthub.ca`. Website ID `571d3bb1-66a8-484a-9db0-1918903a2425` is
hardcoded in [`auth.js`](auth.js) and must still match the site in Umami.

See [ANALYTICS.md](ANALYTICS.md). Note that events are suppressed for admin
accounts, so log out (or use a private window) when testing.

### 8. Submit the sitemap

Google Search Console → add `smuthub.ca` → submit `https://smuthub.ca/sitemap.xml`.

Only after step 4. Submitting while `Disallow: /` is live tells Google the whole
site is off limits.

---

## Known gaps at time of writing

Not launch blockers, but worth knowing:

- **49 books have no cover art** — 48 with no `cover_url`, plus *A Fire in the
  Flesh* whose Google source is a 558-byte placeholder. They render a styled
  title tile, not a broken image.
- **~215 books have no page count.** There is a **📐 Fill missing page counts**
  button in the admin bar on `/search`; Google's daily quota was exhausted at
  the time of writing.
- **28 books are not linked to a series**, so they are missing from the
  "Books in the series" rail — including *A Court of Mist and Fury* and
  *Iron Flame*. The fix is ready to run:
  [`migrations/2026-07-21-link-missing-series.sql`](migrations/2026-07-21-link-missing-series.sql).
- **27 covers are oversized** (7 over 1 MB, largest 3.9 MB) against a ~150px
  display size. Lazy loading covers the first paint; it costs mobile data when
  scrolling `/books/`.
- The **homepage hero search box** does not search — the button scrolls to the
  waitlist. Deliberate pre-launch, but it reads as broken to a first-time visitor.

After changing any book data in Supabase, rebuild the static pages:

```bash
node scripts/build-books.mjs
node scripts/build-glossary.mjs
```
