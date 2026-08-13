# Updating content (covers · tropes · ratings · any book data)

**The one thing to remember:** the public book pages, the `/books/` browse
index, and the `/glossary/` pages are **static files generated from Supabase**.
Editing data in Supabase does **not** change them — you must **rebuild and push**.

`/search`, the dashboard, and your bookshelf read Supabase *live*, so they
update instantly. That's the trap: your change looks live there while the
static SEO pages stay stale until you regenerate. Always finish the job.

---

## The full loop

```
1. EDIT data      → catalog-admin.html (manual) or admin.html / SQL (bulk)
2. COVERS → R2    → auto on manual save; run migrate-covers.mjs after bulk
3. REBUILD        → node scripts/build-books.mjs   (+ build-glossary.mjs)
4. DEPLOY         → git add -A && git commit && git push   (Cloudflare auto-deploys)
5. VERIFY         → hard-refresh the live book + glossary page
```

---

## 1. Edit the data

**Manual (one book at a time)** — `https://smuthub.ca/catalog-admin.html`
(sign in as your admin account; needs `is_admin = true` on your profile).
Edit cover, tropes/tags, rating, spice, blurb, page count, series, etc. → **Save**.
On save it **auto-rehosts an external cover to R2** (covers.smuthub.ca) for you.

**Bulk** — `https://smuthub.ca/admin.html` (Bulk Import), or raw SQL in the
Supabase SQL editor. This upserts many books/fields at once but does **NOT**
rehost covers — do step 2 after.

## 2. Covers → R2 (only after bulk / SQL cover changes)

Manual saves already rehost. After a bulk import or SQL cover update, move any
external cover URLs onto R2 so they serve from covers.smuthub.ca:

```bash
FUNCTION_URL="https://kufpvbmwrtcciamdomhp.supabase.co/functions/v1/rehost-cover" \
ADMIN_TOKEN="<your admin access token>" \
node scripts/migrate-covers.mjs
```

Idempotent — already-migrated covers are skipped. (Get `ADMIN_TOKEN`: sign in as
admin, then in that tab's DevTools console read the Supabase session's
`access_token`. See `migrations/R2-COVERS.md`.)

## 3. Rebuild the static pages

```bash
node scripts/build-books.mjs      # /books/ index + every /books/<slug>/ + sitemap
node scripts/build-glossary.mjs   # /glossary/** (term pages list books + covers) + sitemap
```

**Which one?**
- **Covers or tropes changed → run BOTH.** (Covers appear in glossary book lists;
  tropes decide which books show under each glossary term.)
- **Ratings / blurbs / page counts / series only → `build-books.mjs` is enough.**
- When in doubt, run both — it's fast and always safe.

## 4. Deploy

```bash
git add -A
git commit -m "content: <what changed>"
git push        # Cloudflare auto-deploys in ~30–60s
```

## 5. Verify (don't skip)

Hard-refresh the actual static pages you changed:
- `https://smuthub.ca/books/<slug>/`
- `https://smuthub.ca/glossary/trope/<trope-slug>/`

If it still looks old: give the edge ~60s, then reload. (`_headers` sends
`no-cache`, so a reload after the deploy finishes is enough.)

---

## Quick reference — what needs a rebuild

| You changed…            | Rebuild books | Rebuild glossary | Live w/o rebuild on |
|-------------------------|:-------------:|:----------------:|---------------------|
| Cover image             | ✅            | ✅               | /search, dashboard  |
| Tropes / tags           | ✅            | ✅               | /search, dashboard  |
| Rating (rating_avg)     | ✅            | —                | /search, dashboard  |
| Blurb / page count      | ✅            | —                | /search, dashboard  |
| Series / spice / ending | ✅            | —                | /search, dashboard  |
