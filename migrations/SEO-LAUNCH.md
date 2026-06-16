# SEO + launch checklist

## What's wired in code already (Tier 1)

Every page (except admin) has:
- Unique `<title>` (page-first format: `Search — SmutHub`)
- `<meta name="description">` — one per page
- `<link rel="canonical">` → `https://smuthub.com/...`
- `<meta name="theme-color">` (mobile address-bar color)
- `<link rel="icon" type="image/svg+xml" href="/favicon.svg">`
- `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`
- Open Graph (`og:type`, `og:site_name`, `og:title`, `og:description`,
  `og:url`, `og:image` + width/height)
- Twitter Card (`twitter:card=summary_large_image` + title/desc/image)

`index.html` additionally has:
- JSON-LD `WebSite` with `SearchAction` (lets Google render a sitelinks
  search box for your domain in SERPs)
- JSON-LD `Organization`

Admin pages (`admin.html`, `catalog-admin.html`):
- `<meta name="robots" content="noindex,nofollow">` — kept out of Google
- No canonical / OG (intentional — they don't need previews)

Plus, in repo root:
- `robots.txt` — allows all crawlers, blocks `/admin.html` + `/catalog-admin.html`, points to sitemap
- `sitemap.xml` — lists every public URL (update when new pages ship)
- `favicon.svg` — gradient "sH" mark
- `og-image.svg` — 1200×630 social preview (see "Manual steps" below)

Plus, fixed for accessibility / Lighthouse:
- `smuthub-bookcase.html` no longer disables pinch-zoom

## What YOU need to do manually before launch

1. **Register the domain.** I wired `https://smuthub.com` as the canonical
   everywhere. If you go with `.ca` (or anything else), do a project-wide
   find-replace from `smuthub.com` → `smuthub.ca` — touches every HTML
   file + `robots.txt` + `sitemap.xml`. One commit.

2. **Point the domain at Cloudflare Workers.** In Cloudflare dashboard →
   Workers → smuthub → Settings → Triggers → Custom Domains → add your
   domain. Cloudflare handles SSL automatically.

3. **Generate `og-image.png` from `og-image.svg`** (1200×630). The SVG
   already exists in the repo with the brand styling. To convert: drop
   `og-image.svg` into any of these:
   - **CloudConvert** (free, no signup): https://cloudconvert.com/svg-to-png — set width 1200, height 630
   - **Figma / Photoshop**: import the SVG, export 1200×630 PNG
   - **macOS Preview**: open SVG, File → Export → PNG at 1200×630
   Save the result as `og-image.png` at the repo root, commit, push.
   Until you do this, social link previews fall back to no image. The page
   meta is otherwise complete.

4. **Generate `apple-touch-icon.png`** (180×180). Same drill — convert
   `favicon.svg` at 180×180 and save as `apple-touch-icon.png` at repo
   root. Until this exists, iOS uses the SVG favicon at a default size,
   which works but looks slightly less crisp on home-screen saves.

5. **Submit to search engines** (post-launch, once the domain resolves):
   - Google Search Console → Add property → submit `sitemap.xml`
   - Bing Webmaster Tools → same
   Both are free; coverage reports show up within ~48h.

6. **Verify previews** before announcing the launch:
   - https://www.opengraph.xyz/ — pastes a URL, shows you exactly what
     iMessage / Twitter / Facebook / LinkedIn / Discord will render
   - https://cards-dev.twitter.com/validator — Twitter-specific validator

## What's deliberately NOT done yet (Tier 2/3)

- Per-book pages (`/books/<slug>/`) — needs a routing layer or a small
  Worker script to render book pages from the `books` table on demand,
  plus JSON-LD `Book` schema. Highest-leverage long-tail SEO.
- Per-trope landing pages (`/tropes/<slug>/`) — same pattern.
- Analytics — recommend Plausible (lightweight, no cookie banner). One
  `<script>` snippet, no consent UX needed.
- `<img loading="lazy">` on cover images — minor Core Web Vitals win.
- Real alt text on covers — pulled from `title` + `author` in the card
  render. Quick to add.

When you're ready for any of those, say so.
