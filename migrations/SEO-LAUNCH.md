# SEO + launch checklist

## What's wired in code already (Tier 1)

Every page (except admin) has:
- Unique `<title>` (page-first format: `Search — SmutHub`)
- `<meta name="description">` — one per page
- `<link rel="canonical">` → `https://smuthub.ca/...`
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

1. **Register `smuthub.ca`** (~$15 CAD/year). `.com` was confirmed taken by
   a squatter at $5k CAD — out. The `.ca` is the locked-in canonical and
   every page, OG tag, sitemap entry, and JSON-LD URL already points to
   `https://smuthub.ca/`.
   - **Where to register:** I'd go with **Cloudflare Registrar** — at-cost
     pricing (no registrar markup), and since the site already lives on
     Cloudflare Workers, the DNS + custom-domain setup becomes one click.
     Alternative registrars: Hover (good support, fair pricing), Namecheap,
     Porkbun. **Avoid GoDaddy** — known for renewal price hikes.
   - **Why `.ca` is actually a quiet win, not a fallback:**
     - **Squatting protection.** CIRA requires Canadian presence to
       register a `.ca`, so the situation you just hit on `.com` can't
       happen again on this name.
     - **Google.ca SEO bonus.** For ambiguous Canadian queries, `.ca` ranks
       higher than `.com` by default.
     - **Predictable pricing.** No "premium domain" surprise hikes the way
       some `.com` renewals carry.

2. **Point `smuthub.ca` at Cloudflare Workers.** In Cloudflare dashboard →
   Workers & Pages → smuthub → Settings → Triggers → Custom Domains → Add
   Custom Domain → `smuthub.ca`. Cloudflare handles SSL automatically.
   If you registered through Cloudflare Registrar, the DNS records get
   added for you; if you registered elsewhere, point the domain's
   nameservers at the ones Cloudflare gives you (or add a CNAME/A record
   per Cloudflare's setup screen).
   Also add `www.smuthub.ca` as a second custom domain and set up a 301
   redirect (`www` → root, or vice versa — pick one canonical, but most
   modern brands go root-only). Worker rules can handle that, or do it
   in the Cloudflare Rules tab.

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
   - Google Search Console → Add property → submit `https://smuthub.ca/sitemap.xml`
   - Bing Webmaster Tools → same
   - In Google Search Console → Settings → International Targeting →
     **leave geographic target unset** (or set to "no target"). `.ca` is
     auto-targeted to Canada otherwise, which would hurt rankings for
     US/UK readers. You want global visibility, not Canadian-only.
   Both submissions are free; coverage reports show up within ~48h.

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
