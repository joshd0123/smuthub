# smutHub · Analytics

Umami, self-hosted. Everything here is first-party: no cookies, no cross-site
identifiers, no personal data in event payloads.

---

## Setup

| | |
|---|---|
| Dashboard | <https://analytics.smuthub.ca> |
| Script | `https://analytics.smuthub.ca/script.js` |
| Website ID | `571d3bb1-66a8-484a-9db0-1918903a2425` (public, like a GA id) |
| Hosting | Umami box behind a Cloudflare Tunnel (`cloudflared`) |
| Config | [`auth.js`](auth.js) — the `UMAMI` constant near the top |

The script is injected by `mountUmami()` in `auth.js`, so every page that loads
`auth.js` is tracked automatically. There is no snippet to paste into new pages.

### What is deliberately NOT tracked

1. **Admin pages.** `mountUmami()` refuses to load on `admin.html` and
   `catalog-admin.html`.
2. **Admin people — pageviews *and* events.** `mountUmami()` also refuses to
   load at all for an admin session (`isAdminSession()`), so an admin's
   pageviews and sessions are excluded, not just their custom events; and
   `SH.track()` is independently a no-op for admins. Curating the catalog means
   browsing `/search`, `/books/` and the book pages constantly — the exact pages
   being measured — so without this an admin's own sessions read as reader
   behaviour. The flag is mirrored into `sessionStorage` because the profile
   loads asynchronously; on the *first* page of a fresh session the pageview can
   still slip through before the profile resolves, but every page after is out.
3. **Anything identifying.** Search terms are truncated to 80 characters and
   no user id, email or shelf content is ever sent.

---

## ⚠️ Known break in the data: the `/search` rename

On **2026-07-21** the search page moved from `/smuthub-app` to `/search`.
Umami keys pageviews on the URL path, so **there is no continuous history for
that page across that date**:

- Before 2026-07-21 → `/smuthub-app` (and `/smuthub-app.html`)
- After → `/search`

When looking at anything longer than a few weeks, query both paths and add them
together. `_redirects` 301s the old paths, so any lingering traffic on
`/smuthub-app` after the cutover is an external link, not a real user journey.

The `/books/` browse index did not exist before that date either, so its numbers
start from zero rather than being a decline from anything.

---

## Event reference

Two entry points, both from `auth.js`:

- **`SH.track(name, data)`** — for events triggered by a user action. Safe to
  call anywhere; no-ops if Umami hasn't loaded.
- **`SH.trackWhenReady(name, data)`** — for events fired on page load. Queues
  the event and flushes once the Umami script arrives. Necessary because the
  script is external and deferred, so a plain `track()` during load is dropped
  on most cold visits.

### Discovery — how readers find books

| Event | Payload | Fired from | Question it answers |
|---|---|---|---|
| `book-open` | `slug`, `from` | every book page, on load | **Which discovery path actually works.** `from` is one of `browse`, `search`, `dashboard`, `series`, `related`, `author`, `glossary`, `bookshelf`, `home`, `book`, `internal`, `external`, `direct` |
| `browse-filter` | `type`, `value` | `/books/` | Which metadata is worth tagging. `type` is `trope`, `mood`, `spice` or `text` |
| `browse-tag-arrival` | `tag` | `/books/` | Whether the glossary "Find books with this…" CTAs convert |
| `search` | `q` | `/search`, dashboard | What readers look for |
| `search-zero` | `q` | `/search` | **The acquisition list** — deliberate searches that returned nothing |
| `filter` | `type`, `value` | `/search` | Filter use on the search page |

`book-open.from` is derived from `document.referrer`, except for clicks on the
book page's own rails: those write a hint to `sessionStorage` first, because the
referrer cannot distinguish "series" from "related" (both are `/books/<slug>/`).

### Engagement — does the page do its job

| Event | Payload | Fired from | Question it answers |
|---|---|---|---|
| `ask-jump` | `question`, `slug` | book page | **Whether "answers first" is the right hierarchy.** `question` is `plot`, `spice`, `tropes`, `warnings`, `fit` or `commitment` |
| `blurb-expand` | `slug` | book page | Whether the 30-second answer is enough, or readers always want the full blurb |
| `drawer-open` | `kind` | book page | Demand for the complete trope / warning lists |
| `review-open` | `slug` | book page | Demand for reader reviews on a book |
| `ending-reveal` | `where` | book page | Demand for the spoiler-gated ending. `where` = `book-page` (the section button) or `ask-list` (revealed from the Q&A) |
| `share` | `where` | book page | |
| `share-bookshelf` | — | dashboard | Whether readers share their public bookshelf (website version) link |

### Conversion

| Event | Payload | Fired from | |
|---|---|---|---|
| `shelve` | `status`, `where` | book page, `/search` | `status` = `want`/`reading`/`read`/`dnf` |
| `spice-rate` | `n`, `where` | book page, `/search` | 1–5 |
| `signup` | `where` | any page (`auth.js`) | New account created (fired on the first `SIGNED_IN` for an account < 60s old) — the top post-launch conversion now that the waitlist is gone. `where` = the path the account landed on after auth, so signups attribute to the surface that drove them |
| `signin` | `where` | any page (`auth.js`) | Returning login (first genuine `SIGNED_IN` per session; session restores are `INITIAL_SESSION` and excluded) |
| `add-to-catalog` | — | `/search` | Admin-only, so suppressed in practice |

### Monetization — is the paid model landing (added 2026-08-11, post-launch)

The `/founders/` pricing page and the live premium bookshelf world (Moonlit,
free to preview / CA$4.99 to unlock / included with the Founder's Key) are the
first things that sell. These events answer: *do readers want in, and does the
free→paid path convert.* Umami already counts `/founders/` and `/bookshelf/`
pageviews for free — these are the intent signals on top.

| Event | Payload | Fired from | Question it answers |
|---|---|---|---|
| `coffee-click` | `where` | `/founders/` | Clicks on the Buy-Me-a-Coffee link — the only live spend today, and the current top of the support funnel |
| `founders-cta` | `action` | `/founders/` | Which founders CTA pulls. `action` = `to-bookshelf` (preview the live world / start a shelf) or `roadmap` |
| `world-unlock-intent` | `world` | `/bookshelf/` | **The key conversion signal** — a free reader clicked the "$4.99 / see access" CTA to get inside the premium world |
| `world-enter` | `world` | `/bookshelf/` | An owner actually entered the live world they have access to (retention of the paid thing) |
| `customize-unlock-intent` | — | `/bookshelf/` | Interest in unlocking full bookcase customization (the "coming soon" upsell) |

> Removed **2026-07-28:** `waitlist-signup` — the pre-launch waitlist was retired
> in favour of Google sign-in, so the event no longer fires. `signup` replaces it.

### Library import — `/import/`

| Event | Payload | Question it answers |
|---|---|---|
| `library-import-start` | — | How many readers begin a Goodreads/StoryGraph/CSV import |
| `library-import-parsed` | — | How many get a file parsed successfully (drop-off before this = format/upload friction) |
| `library-import-complete` | — | How many finish — the real conversion of the import feature |
| `library-import-error` | — | Where imports fail (the denominator for import reliability) |

---

## Questions worth asking the data

**Is `/books/` earning its place?**
Compare `book-open` by `from`. Before the browse index existed, the only routes
in were the homepage's featured books and search. If `from=browse` isn't a
meaningful share, the index isn't doing its job.

**Is the Ask First hierarchy right?**
Rank `ask-jump` by `question`. The six are ordered by an assumption about what
readers want first. If `warnings` or `fit` dominates and `plot` trails, the
order is wrong. If one question is never clicked, it's answering something
nobody asked.

**Is the short answer working?**
`blurb-expand` ÷ `book-open`. A high ratio means the 30-second answer isn't
enough and should be longer. A very low one means the full blurb could be
demoted further.

**Which books should we add next?**
`search-zero`, grouped by `q`. These are readers asking for something the
catalog doesn't have, in their own words.

**Which metadata deserves the tagging effort?**
`browse-filter` by `type` and `value`. Tropes are tagged heavily (1,280
book-slots) and moods lightly (385). If mood filtering is popular, that ratio
is backwards.

**Does the continuation flow work?**
`book-open` where `from` is `series`, `related` or `author`. This is the
"one more book" loop — the difference between a reader landing from Google and
leaving, versus reading three pages.

---

## Adding a new event

1. Call it: `if (window.SH && SH.track) SH.track('my-event', { key: 'value' });`
2. On generated pages (`/books/**`, `/glossary/**`) edit the **generator**
   (`scripts/build-books.mjs` / `scripts/build-glossary.mjs`), not the output,
   then rebuild.
3. **Page-load events must use `SH.trackWhenReady()`.** Two things are not
   ready during parse: `auth.js` (deferred, so `window.SH` may not exist) and
   the Umami script itself (external). Poll briefly for `SH`, then hand off —
   `trackWhenReady` handles the second wait. A plain `track()` on load is
   silently dropped on most cold visits. See `fireOnLoad()` in
   `scripts/build-books.mjs` for the pattern.
4. Keep payload values short and non-identifying.
5. Add a row to the tables above.
