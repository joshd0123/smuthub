#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
//  smutHub · book pages build
//
//  Generates the static "plot / about" page for every LIVE book — the
//  Goodreads-style page a reader lands on when they click a cover anywhere
//  on the site:
//    /book/<slug>/index.html
//
//  Each page is FULLY SERVER-RENDERED HTML (no SPA) with per-book SEO:
//  unique title / meta description / canonical / Open Graph + Twitter Card
//  (OG image = the book's own cover) and Schema.org `Book` structured data.
//
//  Anatomy (v1):
//    • Hero            — cover, title, author, year, series/book number
//    • Spice Meter     — spice_level chilis + door + frequency + heat-type chips
//    • Reader Heads-Up — content-warning tags + triggers_detail (collapsed)
//    • The Pitch       — blurb + trope/mood/vibe chips that LINK to the glossary
//    • The Details     — POV, pacing, length, world, ending, … (only set fields)
//    • More in series  — siblings ordered by series_number
//    • More like this  — tag-overlap neighbours
//    • More by author  — same author
//    • Add to shelf    — client-side, mirrors the Search page's shelveBook()
//
//  "More like this / by author / in series" are computed at BUILD time from
//  the full live catalog (real <a> links in the HTML = good for SEO). Only
//  the per-user shelf state loads client-side.
//
//  Usage:
//    node scripts/build-books.mjs
//  Then: git add book/ sitemap.xml && git commit && git push
//  (Manual local build — same workflow as build-glossary.mjs. No CI.)
//
//  No dependencies — Node built-in fetch + fs. Reads anon Supabase creds
//  from config.js (public anon key; books + tags are public-read for live rows).
// ════════════════════════════════════════════════════════════════════════

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BOOK_DIR = path.join(ROOT, 'book');
const SITE = 'https://smuthub.ca';
const SITE_NAME = 'smutHub';

// ── Read Supabase creds from the static config.js (anon key — public) ──────
const cfgRaw = await fs.readFile(path.join(ROOT, 'config.js'), 'utf-8');
const SUPABASE_URL = (cfgRaw.match(/SUPABASE_URL\s*:\s*['"]([^'"]+)['"]/) || [])[1];
const SUPABASE_KEY = (cfgRaw.match(/SUPABASE_KEY\s*:\s*['"]([^'"]+)['"]/) || [])[1];
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('✗ Could not parse SUPABASE_URL/SUPABASE_KEY from config.js'); process.exit(1); }
const REST = SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1';

async function pgGet(url){
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Accept: 'application/json' } });
  if(!r.ok) throw new Error(`PostgREST ${r.status}: ${await r.text()}`);
  return r.json();
}

// ── Fetch all live books + all glossary-visible tags ───────────────────────
const books = await pgGet(`${REST}/books?select=*&status=eq.live&order=featured.desc,title.asc`);
let allTags = [];
try {
  allTags = await pgGet(`${REST}/tags?select=category,slug,label,description,has_page&glossary_visible=eq.true`);
} catch (e) {
  console.log('  (could not load tags — chips will fall back to prettified slugs)');
}
console.log(`◇ Building pages for ${books.length} live books · resolved ${allTags.length} glossary tags`);

if (!books.length){ console.error('✗ No live books returned — nothing to build. Check status=live rows exist.'); process.exit(1); }

// ── Tag resolution: "category:slug" → {label, glossary href if a page exists} ──
const tagByKey = {};
for (const t of allTags) tagByKey[`${t.category}:${t.slug}`] = t;
// A glossary page exists only for Tier 1+2 tags (has_page!==false AND description) —
// must mirror build-glossary.mjs exactly so chips never link to a 404.
const pageEligible = new Set(
  allTags.filter(t => (t.has_page !== false) && t.description).map(t => `${t.category}:${t.slug}`)
);

const humanize = s => String(s == null ? '' : s).replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

function resolveTag(key){
  const i = String(key).indexOf(':');
  const category = i >= 0 ? key.slice(0, i) : '';
  const slug = i >= 0 ? key.slice(i + 1) : key;
  const t = tagByKey[key];
  return {
    key, category, slug,
    label: t ? t.label : humanize(slug),
    href: pageEligible.has(key) ? `/glossary/${category}/${slug}/` : null,
  };
}
const tagsOf = b => (Array.isArray(b.tag_ids) ? b.tag_ids : []).map(resolveTag);

// ── Helpers ────────────────────────────────────────────────────────────────
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const escAttr = esc;
const ensureDir = p => fs.mkdir(p, { recursive: true });
const bookPath = b => `/book/${b.slug}/`;
const bookURL = b => `${SITE}${bookPath(b)}`;

// Absolute cover URL for OG/Twitter + JSON-LD image. Covers live on
// covers.smuthub.ca (absolute already); fall back to the site OG image.
function absCover(b){
  const c = b.cover_url;
  if (!c) return null;
  if (/^https?:\/\//i.test(c)) return c;
  return `${SITE}${c.startsWith('/') ? '' : '/'}${c}`;
}

// ── Humanized labels for enum-ish columns ──────────────────────────────────
const DOOR   = { open:'On-page (open door)', fade:'Fade to black', closed:'Closed door' };
const FREQ   = { none:'None on-page', rare:'Rare', occasional:'Occasional', frequent:'Frequent', constant:'Constant' };
const ENDING = { HEA:'Happily Ever After (HEA)', HFN:'Happy For Now (HFN)', cliffhanger:'Cliffhanger', tragic:'Tragic', ambiguous:'Ambiguous' };
const LENGTH = { quick:'Quick read', standard:'Standard', chonky:'Chonky' };
const PACING = { 'slow-burn':'Slow burn', steady:'Steady', fast:'Fast' };
const POV    = { '1st single':'First person · single', '1st dual':'First person · dual', '3rd single':'Third person · single', '3rd dual':'Third person · dual', 'multi':'Multiple POV' };
const REL    = { MF:'M/F', MM:'M/M', FF:'F/F', poly:'Polyamorous', 'why-choose':'Why-choose' };
const WHO    = { MC:'Main character', LI:'Love interest', both:'Both', simultaneous:'Simultaneously' };
const ENERGY = { light:'Light', medium:'Medium', heavy:'Heavy' };
const TENSE  = { past:'Past tense', present:'Present tense' };

// ── Shared shell (mirrors build-glossary.mjs head/header/footer) ───────────
const SHARED_HEAD = (page) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(page.title)}</title>
<meta name="description" content="${escAttr(page.description)}">
<link rel="canonical" href="${escAttr(page.canonical)}">
<meta name="theme-color" content="#0c0708">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="${escAttr(page.ogType || 'website')}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${escAttr(page.title)}">
<meta property="og:description" content="${escAttr(page.description)}">
<meta property="og:url" content="${escAttr(page.canonical)}">
<meta property="og:image" content="${escAttr(page.ogImage || `${SITE}/og-image.png`)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escAttr(page.title)}">
<meta name="twitter:description" content="${escAttr(page.description)}">
<meta name="twitter:image" content="${escAttr(page.ogImage || `${SITE}/og-image.png`)}">
${page.jsonld ? `<script type="application/ld+json">${JSON.stringify(page.jsonld)}</script>` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Hanken+Grotesk:wght@400;500;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="/config.js"></script>
<script defer src="/auth.js"></script>
<style>
  :root{--ink:#0c0708;--ink-2:#150e10;--panel:#1c1316;--line:#2a1d22;--cream:#f4e8e3;--muted:#b69089;--rose:#ff3d76;--amber:#ffab40;--grad:linear-gradient(100deg,#ff3d76 0%,#ff7a4d 55%,#ffab40 100%)}
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--ink);color:var(--cream);font-family:'Hanken Grotesk',sans-serif;-webkit-font-smoothing:antialiased;line-height:1.55}
  body::before{content:"";position:fixed;inset:0;z-index:-1;background:radial-gradient(800px 500px at 10% -5%,rgba(255,61,118,.12),transparent 60%)}
  a{color:inherit}
  .wrap{max-width:1100px;margin:0 auto;padding:0 22px}
  .logo{display:inline-flex;align-items:center;font-weight:800;font-size:1.5rem;letter-spacing:-.02em;text-decoration:none;color:var(--cream)}
  .logo .box{background:var(--grad);color:#1a0c10;padding:.05em .42em;border-radius:.42em;margin-left:.12em;box-shadow:0 6px 18px -6px rgba(255,61,118,.7)}
  header{position:sticky;top:0;z-index:50;backdrop-filter:blur(14px);background:rgba(12,7,8,.72);border-bottom:1px solid var(--line)}
  .nav{display:flex;align-items:center;justify-content:space-between;height:72px;gap:12px;flex-wrap:wrap}
  .navlinks{display:flex;gap:18px}
  .navlinks a{color:var(--muted);font-weight:500;font-size:.92rem;text-decoration:none;transition:color .2s}
  .navlinks a.on,.navlinks a:hover{color:var(--cream)}
  @media(max-width:680px){.navlinks{gap:12px;font-size:.85rem}}
  .authbox{display:flex;align-items:center;gap:8px}
  footer{border-top:1px solid var(--line);margin-top:48px;padding:32px 0 40px}
  footer .ft{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;color:var(--muted);font-size:.86rem}
  footer a{color:var(--muted);text-decoration:none}
  footer a:hover{color:var(--cream)}
</style>
${page.extraCSS || ''}
</head>`;

const SHARED_HEADER = `
<header>
  <div class="nav wrap">
    <a href="/" class="logo">smut<span class="box">Hub</span></a>
    <nav class="navlinks">
      <a href="/dashboard.html">Dashboard</a>
      <a href="/book/">Browse Books</a>
      <a href="/search">Add a Book</a>
      <a href="/smuthub-bookcase.html">My Bookshelf</a>
      <a href="/glossary/">Glossary</a>
    </nav>
    <div class="authbox" id="authbox"></div>
  </div>
</header>
`;

const SHARED_FOOTER = `
<footer>
  <div class="wrap ft">
    <span>© ${new Date().getFullYear()} smutHub · Romantasy, decoded.</span>
    <span><a href="/book/">All Books</a> · <a href="/glossary/">Glossary</a> · <a href="/sitemap.html">Sitemap</a></span>
  </div>
</footer>
</body></html>
`;

const BOOK_CSS = `<style>
  .crumb{padding:18px 0 0;color:var(--muted);font-size:.85rem}
  .crumb a{color:var(--muted);text-decoration:none}.crumb a:hover{color:var(--cream)}
  /* hero */
  /* Desktop: a single 2-col grid that runs from the hero all the way down through
     the plot + details. Cover stays sticky on the left while the right column
     scrolls. The related-books grids ("More in series / like this / by author")
     sit OUTSIDE this layout as full-width sections, since they need the room.
     Mobile (≤720px): single column, everything stacks linearly. */
  .book-layout{display:grid;grid-template-columns:260px 1fr;gap:34px;padding:24px 0 8px;align-items:start}
  @media(max-width:720px){.book-layout{grid-template-columns:1fr;gap:22px;max-width:460px;margin:0 auto}}
  .book-layout > .cover-col{position:sticky;top:90px}
  @media(max-width:720px){.book-layout > .cover-col{position:static;justify-self:center;width:200px}}
  .book-layout > .info-col{min-width:0}
  /* Header inside info-col — was the right half of .bookhero before. */
  .book-header{padding-bottom:22px;border-bottom:1px solid var(--line);margin-bottom:6px}
  .info-col > .book-header:only-child{border-bottom:0;padding-bottom:0;margin-bottom:0}
  /* Inside the layout, .blk sections don't need their own top padding; the grid handles spacing. */
  .info-col section.blk{padding:22px 0}
  /* Related-books stack lives below the grid — first item draws a top divider. */
  .related-stack section.blk:first-child{border-top:1px solid var(--line)}
  .cover{aspect-ratio:2/3;border-radius:14px;overflow:hidden;background:linear-gradient(160deg,#3a0d2a,#7a1238);box-shadow:0 30px 60px -24px rgba(0,0,0,.8);position:relative}
  .cover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .cover .ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:18px;text-align:center;font-family:'Fraunces',serif;font-size:1.05rem;color:var(--cream)}
  .badge{display:inline-block;background:var(--panel);border:1px solid var(--line);border-radius:99px;padding:.18em .8em;font-size:.74rem;font-weight:700;letter-spacing:.06em;color:var(--amber);text-transform:uppercase;margin-bottom:12px}
  h1{font-family:'Fraunces',serif;font-weight:600;font-size:clamp(1.9rem,4.4vw,3rem);letter-spacing:-.02em;line-height:1.06}
  .byline{margin-top:10px;font-size:1.05rem;color:var(--cream)}
  .byline a{color:var(--amber);text-decoration:none}.byline a:hover{text-decoration:underline}
  .series-line{margin-top:6px;color:var(--muted);font-size:.95rem}
  .series-line a{color:var(--muted)}.series-line a:hover{color:var(--cream)}
  /* spice meter */
  .spicemeter{margin-top:20px;display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}
  .chilis{font-size:1.15rem;letter-spacing:.08em;white-space:nowrap}
  .chilis span{filter:grayscale(1);opacity:.3}
  .chilis span.on{filter:none;opacity:1}
  .sm-tag{display:inline-flex;align-items:center;gap:6px;background:var(--panel);border:1px solid var(--line);border-radius:99px;padding:.28em .8em;font-size:.82rem;color:var(--cream)}
  .sm-tag b{color:var(--muted);font-weight:600;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em}
  /* sections */
  section.blk{padding:26px 0;border-bottom:1px solid var(--line)}
  section.blk:last-of-type{border-bottom:0}
  section.blk h2{font-family:'Fraunces',serif;font-weight:500;font-size:1.4rem;margin-bottom:14px}
  /* "What it's about" — structured paragraphs from a single blurb column.
     Conventions a writer types IN the blurb (the only data layer that knows
     a book's blurb): blank line = paragraph break, > prefix = muted publisher
     intro, ***text*** = italic pitch callout, **word** = bold .term span. */
  .sh-plot p{line-height:1.7;margin:0 0 1.05em;font-size:1.02rem;max-width:66ch}
  .sh-plot p:last-child{margin-bottom:0}
  .sh-plot .intro{color:var(--muted);font-size:.92rem;line-height:1.6}
  .sh-plot .lead{color:#fff;font-size:1.18rem;line-height:1.5;font-weight:500;letter-spacing:-.005em;margin-bottom:1.25em}
  @media(max-width:600px){.sh-plot .lead{font-size:1.06rem}}
  .sh-plot .term{color:#fff;font-weight:600}
  .sh-plot .pitch{font-style:italic;color:var(--muted);line-height:1.65;padding:6px 0 6px 18px;margin:1.6em 0 0;
    border-left:2px solid transparent;border-image:var(--grad) 1;max-width:66ch;font-size:.98rem}
  .sh-plot .pitch .term{color:var(--cream);font-style:normal;font-weight:600}
  .sh-plot .more{overflow:hidden;transition:max-height .4s ease}
  .sh-plot.collapsed .more{max-height:0}
  .sh-plot:not(.collapsed) .more{max-height:2400px}
  .sh-plot.collapsed .fade{position:relative;margin-top:-2.4em;height:2.4em;
    background:linear-gradient(180deg,rgba(12,7,8,0),var(--ink));pointer-events:none}
  .sh-plot:not(.collapsed) .fade{display:none}
  .sh-readmore{margin-top:14px;background:none;border:0;cursor:pointer;font-family:inherit;
    font-size:.88rem;font-weight:600;letter-spacing:.3px;color:var(--amber);padding:6px 0;
    display:inline-flex;align-items:center;gap:6px}
  .sh-readmore:hover{color:var(--rose)}
  .sh-empty{color:var(--muted);font-style:italic;max-width:66ch}
  .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
  .chip{display:inline-flex;align-items:center;gap:6px;background:var(--panel);border:1px solid var(--line);border-radius:99px;padding:.35em .9em;font-size:.86rem;text-decoration:none;color:var(--cream);transition:border-color .12s,transform .12s}
  a.chip:hover{border-color:var(--rose);transform:translateY(-1px)}
  .chip .c{color:var(--muted);font-size:.68rem;text-transform:uppercase;letter-spacing:.06em}
  /* content warnings */
  details.cw{margin-top:22px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:2px 16px;max-width:66ch}
  details.cw summary{cursor:pointer;list-style:none;padding:13px 0;font-weight:700;color:var(--amber);display:flex;align-items:center;gap:8px;font-size:.95rem}
  details.cw summary::-webkit-details-marker{display:none}
  details.cw summary::after{content:"▾";margin-left:auto;color:var(--muted);transition:transform .15s}
  details.cw[open] summary::after{transform:rotate(180deg)}
  details.cw .cwbody{padding:0 0 14px}
  .cw-tags{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px}
  .cw-tags span{background:var(--ink-2);border:1px solid var(--line);border-radius:99px;padding:.28em .8em;font-size:.82rem;color:var(--cream)}
  .cw-detail{color:var(--muted);font-size:.92rem;max-width:60ch}
  /* details grid */
  .dgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:14px;overflow:hidden}
  .drow{background:var(--ink-2);padding:13px 16px}
  .drow .dk{display:block;color:var(--muted);font-size:.72rem;text-transform:uppercase;letter-spacing:.07em;font-weight:700;margin-bottom:3px}
  .drow .dv{font-size:.98rem;color:var(--cream)}
  /* related grids */
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px}
  @media(max-width:600px){.grid{grid-template-columns:repeat(2,1fr);gap:12px}}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow:hidden;text-decoration:none;color:inherit;display:flex;flex-direction:column;transition:border-color .12s,transform .12s}
  .card:hover{border-color:var(--rose);transform:translateY(-2px)}
  .card .cv{aspect-ratio:2/3;position:relative;background:linear-gradient(160deg,#3a0d2a,#7a1238);overflow:hidden}
  .card .cv img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .card .cv .ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:10px;text-align:center;font-family:'Fraunces',serif;font-size:.84rem;color:var(--cream)}
  .card .m{padding:10px 12px 13px}
  .card .m .t{font-family:'Fraunces',serif;font-weight:500;line-height:1.2;font-size:.95rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:calc(1.2em * 2)}
  .card .m .a{color:var(--muted);font-size:.78rem;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  /* add to shelf */
  .shelf-control{margin-top:18px;display:flex;flex-direction:column;gap:8px}
  .shelfbtn{width:100%;background:var(--grad);color:#1a0c10;border:0;font-family:inherit;font-weight:800;font-size:.95rem;padding:.72em 1em;border-radius:12px;cursor:pointer;transition:transform .1s}
  .shelfbtn:hover{transform:translateY(-1px)}
  .shelfbtn.on{background:var(--panel);color:var(--cream);border:1px solid var(--line)}
  .statussel{width:100%;background:var(--ink-2);border:1px solid var(--line);color:var(--cream);font-family:inherit;font-weight:700;font-size:.85rem;padding:.6em;border-radius:10px;cursor:pointer}
  .shelf-note{color:var(--muted);font-size:.8rem;text-align:center}
  .shelf-note a{color:var(--amber);text-decoration:none}
</style>`;

// ── Spice meter ────────────────────────────────────────────────────────────
function spiceMeterHTML(b){
  const lvl = Math.max(0, Math.min(5, Number(b.spice_level) || 0));
  const has = b.spice_level != null || b.door || b.spice_frequency || (Array.isArray(b.heat_type) && b.heat_type.length);
  if (!has) return '';
  const chilis = [1,2,3,4,5].map(n => `<span class="${n <= lvl ? 'on' : ''}">🌶️</span>`).join('');
  const parts = [`<span class="chilis" title="Spice level ${lvl} of 5">${chilis}</span>`];
  if (b.door)            parts.push(`<span class="sm-tag"><b>Door</b>${esc(DOOR[b.door] || humanize(b.door))}</span>`);
  if (b.spice_frequency) parts.push(`<span class="sm-tag"><b>Frequency</b>${esc(FREQ[b.spice_frequency] || humanize(b.spice_frequency))}</span>`);
  for (const h of (Array.isArray(b.heat_type) ? b.heat_type : [])) parts.push(`<span class="sm-tag">${esc(humanize(h))}</span>`);
  return `<div class="spicemeter" aria-label="Spice meter">${parts.join('')}</div>`;
}

// ── Content warnings panel (collapsed — readers opt in past spoilers) ───────
function warningsHTML(b, tags){
  const warns = tags.filter(t => t.category === 'warning');
  const detail = (b.triggers_detail || '').trim();
  if (!warns.length && !detail) return '';
  return `<details class="cw">
    <summary>⚠️ Content warnings</summary>
    <div class="cwbody">
      ${warns.length ? `<div class="cw-tags">${warns.map(w => `<span>${esc(w.label)}</span>`).join('')}</div>` : ''}
      ${detail ? `<p class="cw-detail">${esc(detail)}</p>` : ''}
    </div>
  </details>`;
}

// ── The Pitch: blurb + flavour chips that link into the glossary ───────────
const CHIP_CATS = ['trope','subgenre','mood','vibe','theme','worldbuilding','setting','omegaverse','kink','representation','mc-archetype','li-archetype','culture'];
const CHIP_ORDER = Object.fromEntries(CHIP_CATS.map((c, i) => [c, i]));

// Render the blurb as structured paragraphs from a single text column.
// Conventions a writer types IN the blurb field:
//   blank line     → paragraph break
//   > prefix       → small muted publisher intro (one paragraph)
//   ***text***     → italic pitch callout (one paragraph, gradient border)
//   **word**       → bold .term span (no link — chips below already route to glossary)
// First non-intro/non-pitch paragraph is auto-promoted to .lead (larger).
// Tag labels matching the book's own taste tags are also auto-bolded as .term
// whole-word, case-insensitive — so writers don't have to manually mark them.
// Returns { html, collapsible } so the caller can decide whether to wrap in
// a collapse/read-more shell.
function renderBlurbBody(blurb, tags){
  const raw = (blurb || '').trim();
  if (!raw) return { html: `<p class="sh-empty">No blurb yet — the tags below give you the vibe.</p>`, collapsible: false };

  const termLabels = [...new Set(tags
    .filter(t => CHIP_CATS.includes(t.category))
    .map(t => (t.label || '').trim())
    .filter(l => l.length > 2))];

  // Encode emphasis as private-use placeholders BEFORE HTML-escaping, so the
  // matches can find raw blurb text (without `&amp;` etc.) and so we never
  // wrap inside an already-emitted <span>.
  // Auto-bolding is capped: FIRST occurrence per term only, MAX_AUTO_BOLDS
  // total across the whole blurb. Without these caps a blurb with 8 tags
  // can end up with 20+ bolded phrases — reads as visual noise.
  // Manual **word** markers stay unlimited (the writer was deliberate).
  const TS = String.fromCharCode(1), TE = String.fromCharCode(2);
  const MAX_AUTO_BOLDS = 5;
  let autoBoldCount = 0;
  const autoBolded = new Set();
  function emphasize(text){
    let s = text;
    const marks = [];
    const mark = w => { marks.push(w); return `${TS}${marks.length - 1}${TE}`; };
    // 1. manual **word** wins (explicit > auto)
    s = s.replace(/\*\*([^*\n]+?)\*\*/g, (_, w) => mark(w));
    // 2. auto-bold tag labels — longest first so multi-word terms (Zodiac
    //    Academy) match before sub-strings (Academy). First occurrence per
    //    term only; stop entirely once we hit MAX_AUTO_BOLDS.
    const sorted = [...termLabels].sort((a, b) => b.length - a.length);
    for (const term of sorted){
      if (autoBoldCount >= MAX_AUTO_BOLDS) break;
      const key = term.toLowerCase();
      if (autoBolded.has(key)) continue;
      const re = new RegExp(`\\b(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'i');
      let matched = false;
      s = s.replace(re, (m) => { matched = true; return mark(m); });
      if (matched){ autoBolded.add(key); autoBoldCount++; }
    }
    // 3. HTML-escape (placeholders survive — they're control chars, not HTML-special)
    s = esc(s);
    // 4. swap placeholders → real spans (escape the captured term as well)
    return s.replace(new RegExp(`${TS}(\\d+)${TE}`, 'g'), (_, i) => `<span class="term">${esc(marks[+i])}</span>`);
  }

  // Parse paragraphs from blank-line splits. Many blurbs come in as one long
  // unbroken paragraph — without a writer-provided break we can't show a
  // preview, so the section dominates the page. For single-block blurbs,
  // split at the sentence boundary CLOSEST to SPLIT_TARGET (searching both
  // before and after) so the visible hook stays short even if the first
  // sentence runs long.
  let paragraphs = raw.split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean);
  const SPLIT_TARGET = 180;
  if (paragraphs.length === 1 && paragraphs[0].length > SPLIT_TARGET + 80){
    const t = paragraphs[0];
    let cut = -1;
    const lo = Math.floor(SPLIT_TARGET * 0.55);
    const hi = Math.min(t.length - 1, Math.floor(SPLIT_TARGET * 2.2));
    for (let i = lo; i <= hi; i++){
      if (/[.!?]/.test(t[i]) && (t[i + 1] === ' ' || i === t.length - 1)){
        if (cut === -1 || Math.abs(i - SPLIT_TARGET) < Math.abs(cut - 1 - SPLIT_TARGET)) cut = i + 1;
      }
    }
    if (cut > 0) paragraphs = [t.slice(0, cut).trim(), t.slice(cut).trim()];
  }

  const blocks = paragraphs.map(p => {
    if (/^\*\*\*[\s\S]+\*\*\*$/.test(p))
      return { kind: 'pitch', text: p.replace(/^\*\*\*\s*|\s*\*\*\*$/g, '') };
    if (/^>\s*/.test(p))
      return { kind: 'intro', text: p.replace(/^>\s*/, '') };
    return { kind: 'body', text: p };
  });
  const leadIdx = blocks.findIndex(b => b.kind === 'body');
  if (leadIdx >= 0) blocks[leadIdx].kind = 'lead';

  const render = b => {
    const inner = emphasize(b.text);
    if (b.kind === 'pitch') return `<p class="pitch">${inner}</p>`;
    if (b.kind === 'intro') return `<p class="intro">${inner}</p>`;
    if (b.kind === 'lead')  return `<p class="lead">${inner}</p>`;
    return `<p>${inner}</p>`;
  };

  // Visible = the intro (if any) + the lead (the dramatic hook). Everything
  // else collapses behind Read more. Predictable: writers can see exactly what
  // shows above the fold no matter how long the rest of the blurb runs.
  let cut;
  const leadIdx2 = blocks.findIndex(b => b.kind === 'lead');
  if (leadIdx2 >= 0) cut = leadIdx2 + 1;
  else cut = blocks.length; // no lead (intro-only or pitch-only blurb) — show everything
  const shown = blocks.slice(0, cut).map(render).join('');
  const hidden = blocks.slice(cut).map(render).join('');
  return {
    html: shown + (hidden ? `<div class="more">${hidden}</div><div class="fade"></div>` : ''),
    collapsible: !!hidden,
  };
}

function pitchHTML(b, tags){
  const blurb = (b.blurb || '').trim();
  const chips = tags
    .filter(t => CHIP_CATS.includes(t.category))
    .sort((a, c) => (CHIP_ORDER[a.category] - CHIP_ORDER[c.category]) || a.label.localeCompare(c.label));
  if (!blurb && !chips.length) return '';
  const chipHTML = chips.map(t => t.href
    ? `<a class="chip" href="${escAttr(t.href)}">${esc(t.label)}</a>`
    : `<span class="chip">${esc(t.label)}</span>`
  ).join('');
  const { html: blurbHTML, collapsible } = renderBlurbBody(b.blurb, tags);
  return `<section class="blk sh-plot${collapsible ? ' collapsed' : ''}" id="shPlot">
    <h2>What it's about</h2>
    ${blurbHTML}
    ${collapsible ? `<button class="sh-readmore" id="shToggle" aria-expanded="false">Read more&nbsp;↓</button>` : ''}
    ${chips.length ? `<div class="chips">${chipHTML}</div>` : ''}
  </section>`;
}

// ── The Details grid (only rows with a value) ──────────────────────────────
function detailsHTML(b){
  const rows = [];
  const add = (k, v) => { if (v != null && v !== '') rows.push([k, v]); };
  add('Series', b.series ? (b.series_number ? `${b.series} · Book ${b.series_number}` : b.series) : (b.standalone ? 'Standalone' : ''));
  add('POV', b.pov ? (POV[b.pov] || humanize(b.pov)) : '');
  add('Pacing', b.pacing ? (PACING[b.pacing] || humanize(b.pacing)) : '');
  add('Length', b.length_feel
    ? (LENGTH[b.length_feel] || humanize(b.length_feel)) + (b.page_count ? ` · ${b.page_count} pp` : '')
    : (b.page_count ? `${b.page_count} pages` : ''));
  add('Subgenre', b.subgenre ? humanize(b.subgenre) : '');
  add('World', b.world_type ? humanize(b.world_type) : '');
  add('Setting', b.setting || '');
  add('Time period', b.time_period ? humanize(b.time_period) : '');
  add('Ending', b.ending ? (ENDING[b.ending] || humanize(b.ending)) + (b.cliffhanger && b.ending !== 'cliffhanger' ? ' · cliffhanger' : '') : (b.cliffhanger ? 'Cliffhanger' : ''));
  add('Relationship', b.relationship_type ? (REL[b.relationship_type] || humanize(b.relationship_type)) : '');
  add('Who falls first', b.who_falls_first ? (WHO[b.who_falls_first] || humanize(b.who_falls_first)) : '');
  add('Age category', b.age_category || '');
  add('Energy', b.energy ? (ENERGY[b.energy] || humanize(b.energy)) : '');
  add('Tense', b.tense ? (TENSE[b.tense] || humanize(b.tense)) : '');
  if (b.audiobook) add('Audiobook', 'Available');
  if (!rows.length) return '';
  return `<section class="blk">
    <h2>The details</h2>
    <div class="dgrid">
      ${rows.map(([k, v]) => `<div class="drow"><span class="dk">${esc(k)}</span><span class="dv">${esc(v)}</span></div>`).join('')}
    </div>
  </section>`;
}

// ── Related-book card + section ────────────────────────────────────────────
function bookCardHTML(b){
  const cov = b.cover_url
    ? `<img src="${escAttr(b.cover_url)}" alt="${escAttr(b.title)} book cover" loading="lazy">`
    : `<div class="ph">${esc(b.title)}</div>`;
  return `<a class="card" href="${escAttr(bookPath(b))}">
    <div class="cv">${cov}</div>
    <div class="m"><div class="t">${esc(b.title)}</div><div class="a">${esc(b.author || '')}</div></div>
  </a>`;
}
function relatedSection(title, list){
  if (!list.length) return '';
  return `<section class="blk">
    <h2>${esc(title)}</h2>
    <div class="grid">${list.map(bookCardHTML).join('')}</div>
  </section>`;
}

// ── Duplicate-safe identity ────────────────────────────────────────────────
// The catalog can hold two rows for the same book (a year-less seed slug
// `fourth-wing-yarros` AND an import-generated `fourth-wing-yarros-2023`).
// Keyed on slug alone, "related books" lets a book recommend its own twin — or
// itself. Identity = normalized title + author surname collapses twins so they
// are excluded and never rendered twice.
const normId = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
const surnameKey = a => { const p = String(a || '').trim().split(/\s+/); return p.length ? normId(p[p.length - 1]) : ''; };
const bookIdentity = b => normId(b.title) + '|' + surnameKey(b.author);
// Collapse a list to one row per identity, preferring a cover-bearing row.
function dedupeByIdentity(list){
  const seen = new Map();
  for (const b of list){
    const id = bookIdentity(b);
    const cur = seen.get(id);
    if (!cur || (b.cover_url && !cur.cover_url)) seen.set(id, b);
  }
  return [...seen.values()];
}

// Taste tags drive "more like this" — exclude meta/spice/warning categories so
// overlap reflects vibe, not "both books have an open door".
const TASTE_SKIP = new Set(['warning','format','pov','mechanics']);
function tasteKeys(b){
  return new Set((Array.isArray(b.tag_ids) ? b.tag_ids : []).filter(k => {
    const i = String(k).indexOf(':'); return i < 0 || !TASTE_SKIP.has(k.slice(0, i));
  }));
}
const tasteCache = new Map(books.map(b => [b.slug, tasteKeys(b)]));

function moreLikeThis(book, excludeIds){
  const mine = tasteCache.get(book.slug);
  if (!mine.size) return [];
  const selfId = bookIdentity(book);
  const scored = [];
  for (const b of books){
    const id = bookIdentity(b);
    if (id === selfId || excludeIds.has(id)) continue;
    let overlap = 0;
    for (const k of tasteCache.get(b.slug)) if (mine.has(k)) overlap++;
    if (overlap > 0) scored.push({ b, overlap });
  }
  scored.sort((x, y) => (y.overlap - x.overlap) || ((y.b.featured ? 1 : 0) - (x.b.featured ? 1 : 0)));
  return dedupeByIdentity(scored.map(x => x.b)).slice(0, 6);
}

// ── Per-book page ──────────────────────────────────────────────────────────
function renderBookPage(book){
  const tags = tagsOf(book);
  const author = (book.author || '').trim();
  const cover = absCover(book);

  // Related sets — excluded/deduped by identity (title+author) so a book never
  // recommends its own duplicate row, itself, or shows the same book twice.
  const selfId = bookIdentity(book);
  const inSeries = dedupeByIdentity(
    book.series
      ? books.filter(b => bookIdentity(b) !== selfId && b.series && b.series === book.series)
          .sort((a, c) => (Number(a.series_number) || 99) - (Number(c.series_number) || 99))
      : []
  );
  const seriesIds = new Set(inSeries.map(bookIdentity));
  const byAuthor = dedupeByIdentity(
    author
      ? books.filter(b => bookIdentity(b) !== selfId && (b.author || '').trim() === author && !seriesIds.has(bookIdentity(b)))
      : []
  ).slice(0, 6);
  const excludeIds = new Set([...inSeries, ...byAuthor].map(bookIdentity));
  const likeThis = moreLikeThis(book, excludeIds);

  // SEO
  const titleBits = [book.title, author ? `by ${author}` : ''].filter(Boolean).join(' ');
  const seoTitle = `${titleBits} — Spice, Tropes & Content Warnings | ${SITE_NAME}`;
  const tasteLabels = tags.filter(t => ['trope','mood','vibe'].includes(t.category)).slice(0, 4).map(t => t.label);
  const metaDesc = ((book.blurb || '').trim()
    || `${book.title}${author ? ` by ${author}` : ''}: spice level, content warnings, tropes${tasteLabels.length ? ` (${tasteLabels.join(', ')})` : ''}, and where it fits in the series — decoded on smutHub.`
  ).replace(/\s+/g, ' ').trim().slice(0, 158);

  const jsonld = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    url: bookURL(book),
    ...(author ? { author: { "@type": "Person", name: author } } : {}),
    ...(cover ? { image: cover } : {}),
    ...(book.blurb ? { description: book.blurb } : {}),
    ...(book.year ? { datePublished: String(book.year) } : {}),
    ...(book.isbn ? { isbn: book.isbn } : {}),
    ...(book.publisher ? { publisher: { "@type": "Organization", name: book.publisher } } : {}),
    ...(book.language ? { inLanguage: book.language } : { inLanguage: 'en' }),
    ...(book.subgenre ? { genre: humanize(book.subgenre) } : {}),
    ...(book.series ? { isPartOf: { "@type": "BookSeries", name: book.series, ...(book.series_number ? { position: Number(book.series_number) } : {}) } } : {}),
  };

  const head = SHARED_HEAD({
    title: seoTitle,
    description: metaDesc,
    canonical: bookURL(book),
    ogType: 'book',
    ogImage: cover || `${SITE}/og-image.png`,
    jsonld,
    extraCSS: BOOK_CSS,
  });

  const coverHTML = book.cover_url
    ? `<img src="${escAttr(book.cover_url)}" alt="${escAttr(book.title)} book cover">`
    : `<div class="ph">${esc(book.title)}</div>`;

  const seriesLine = book.series
    ? `<p class="series-line">${book.series_number ? `Book ${esc(book.series_number)} of ` : ''}<b>${esc(book.series)}</b>${inSeries.length ? ` · <a href="#series">see the series ↓</a>` : ''}</p>`
    : (book.standalone ? `<p class="series-line">Standalone</p>` : '');

  const body = `<body>
${SHARED_HEADER}
<div class="wrap">
  <nav class="crumb"><a href="/">Home</a> / <a href="/book/">All books</a> / <span>${esc(book.title)}</span></nav>

  <div class="book-layout">
    <aside class="cover-col">
      <div class="cover">${coverHTML}</div>
      <div class="shelf-control" id="shelfControl">
        <button class="shelfbtn" id="shelfBtn" data-act="want">＋ Add to shelf</button>
        <select class="statussel" id="shelfSel" aria-label="Add to shelf">
          <option value="" selected>Shelf as…</option>
          <option value="want">Want to Read</option>
          <option value="reading">Currently Reading</option>
          <option value="read">Read</option>
          <option value="dnf">DNF</option>
        </select>
        <p class="shelf-note" id="shelfNote"></p>
      </div>
    </aside>
    <main class="info-col">
      <header class="book-header">
        ${book.subgenre ? `<span class="badge">${esc(humanize(book.subgenre))}</span>` : ''}
        <h1>${esc(book.title)}</h1>
        <p class="byline">${author ? `by <a href="/book/?q=${encodeURIComponent(author)}">${esc(author)}</a>` : 'Author unknown'}${book.year ? ` · ${esc(book.year)}` : ''}</p>
        ${seriesLine}
        ${spiceMeterHTML(book)}
        ${warningsHTML(book, tags)}
      </header>
      ${pitchHTML(book, tags)}
      ${detailsHTML(book)}
    </main>
  </div>

  <div class="related-stack">
    ${inSeries.length ? `<section class="blk" id="series">
      <h2>More in ${esc(book.series)}</h2>
      <div class="grid">${inSeries.map(bookCardHTML).join('')}</div>
    </section>` : ''}
    ${relatedSection('More like this', likeThis)}
    ${byAuthor.length ? relatedSection(`More by ${author}`, byAuthor) : ''}
  </div>
</div>

<script>
  // Add-to-shelf — mirrors /search shelveBook(): upsert into the
  // shelf table keyed on (user_id, book_key) where book_key = this book slug.
  // Server-rendered book metadata is embedded so the shelf row carries a
  // title/author/cover snapshot.
  (function(){
    var BOOK = ${JSON.stringify({ key: book.slug, title: book.title, author: author || null, cover_url: book.cover_url || null })};
    var LABEL = { want:'Want to Read', reading:'Currently Reading', read:'Read', dnf:'DNF' };
    var btn = document.getElementById('shelfBtn');
    var sel = document.getElementById('shelfSel');
    var note = document.getElementById('shelfNote');
    var sb = null, user = null, current = null;

    function client(){
      if (window.SH && window.SH.sb) return window.SH.sb;
      var cfg = window.SMUTHUB_CONFIG || {};
      if (window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_KEY)
        return window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, { auth:{ persistSession:true } });
      return null;
    }
    function paint(){
      if (!user){ btn.textContent='＋ Add to shelf'; btn.classList.remove('on'); note.innerHTML='<a href="/dashboard.html">Log in</a> to build your shelf'; return; }
      if (current){ btn.textContent='✓ '+(LABEL[current]||'Shelved'); btn.classList.add('on'); sel.value=current; note.textContent='Tap to remove'; }
      else { btn.textContent='＋ Add to shelf'; btn.classList.remove('on'); sel.value=''; note.textContent=''; }
    }
    async function shelve(status){
      if (!user){ note.innerHTML='<a href="/dashboard.html">Log in</a> to build your shelf'; return; }
      var payload = { book_key:BOOK.key, status:status, title:BOOK.title, author:BOOK.author, cover_url:BOOK.cover_url };
      var res = await sb.from('shelf').upsert(payload, { onConflict:'user_id,book_key' });
      if (res.error && /cover_url/i.test(res.error.message||'')){ delete payload.cover_url; res = await sb.from('shelf').upsert(payload, { onConflict:'user_id,book_key' }); }
      if (res.error){ note.textContent='Save failed'; console.error('shelf save', res.error); return; }
      current = status; paint(); note.textContent='Shelved as '+(LABEL[status]||status)+' 📚';
      if (window.SH && SH.track) SH.track('shelve', { status:status, where:'book-page' });
    }
    async function remove(){
      var res = await sb.from('shelf').delete().eq('book_key', BOOK.key);
      if (res.error){ note.textContent="Couldn't remove"; console.error('shelf delete', res.error); return; }
      current = null; paint(); note.textContent='Removed from shelf';
    }
    btn.addEventListener('click', function(){ if (!user){ paint(); return; } if (current) remove(); else shelve('want'); });
    sel.addEventListener('change', function(){ if (sel.value) shelve(sel.value); });

    (async function init(){
      sb = client();
      if (!sb){ note.textContent=''; return; }
      try {
        var u = await sb.auth.getUser();
        user = u && u.data ? u.data.user : null;
        if (user){
          var r = await sb.from('shelf').select('status').eq('book_key', BOOK.key).maybeSingle();
          if (r.data) current = r.data.status;
        }
      } catch(e){ /* anon — fine */ }
      paint();
    })();
  })();
</script>

<script>
  // Plot read-more — collapses long blurbs to the first 3 paragraphs.
  // Stays a no-op if the section wasn't rendered with a collapse shell.
  (function(){
    var s = document.getElementById('shPlot'); if (!s) return;
    var b = document.getElementById('shToggle'); if (!b) return;
    b.addEventListener('click', function(){
      var open = !s.classList.toggle('collapsed');
      b.setAttribute('aria-expanded', String(open));
      b.innerHTML = open ? 'Show less&nbsp;↑' : 'Read more&nbsp;↓';
    });
  })();
</script>

${SHARED_FOOTER}`;

  return head + body;
}

// ══════════════════════════════════════════════════════════════════════════
//  /book/ — the browse index
// ══════════════════════════════════════════════════════════════════════════
//  Until this page existed the plot pages were nearly unreachable: the homepage
//  linked a handful of featured books, Search surfaced a rotating sample of the
//  catalog, and everything else could only be found by already standing on
//  another book page. This is the hub — every live book as a real, crawlable
//  <a>, with filtering done client-side so it stays one static page (and one
//  strong internal-linking hub for crawlers) rather than paginated slices.
// ══════════════════════════════════════════════════════════════════════════
const ARTICLE_RX = /^(the|a|an)\s+/i;
const sortTitle = b => String(b.title || '').replace(ARTICLE_RX, '').trim().toLowerCase();
const letterOf = b => { const c = sortTitle(b).charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : '#'; };

const INDEX_CSS = `<style>
  .ihead{padding:34px 0 6px}
  .ihead h1{font-family:'Fraunces',serif;font-weight:600;font-size:clamp(2rem,5vw,3.2rem);line-height:1.05;letter-spacing:-.02em}
  .ihead h1 em{font-style:italic;font-weight:400;color:transparent;background:var(--grad);-webkit-background-clip:text;background-clip:text}
  .ihead .sub{color:var(--muted);max-width:62ch;margin-top:12px}
  .tools{display:flex;gap:10px;flex-wrap:wrap;margin:22px 0 6px;align-items:center}
  .tools input{flex:1;min-width:200px;background:var(--panel);border:1px solid var(--line);color:var(--cream);font-family:inherit;font-size:1rem;border-radius:99px;padding:.7em 1.1em;outline:none}
  .tools input:focus{border-color:var(--rose)}
  .tools select{background:var(--panel);border:1px solid var(--line);color:var(--cream);font-family:inherit;font-size:.92rem;border-radius:99px;padding:.6em 1em;cursor:pointer}
  .tools select:focus{outline:none;border-color:var(--rose)}
  .tools button{background:none;border:1px solid var(--line);color:var(--muted);font-family:inherit;font-weight:700;font-size:.85rem;padding:.6em 1em;border-radius:99px;cursor:pointer}
  .tools button:hover{border-color:var(--rose);color:var(--cream)}
  .azbar{display:flex;flex-wrap:wrap;gap:4px;margin:10px 0 4px}
  .azbar a{color:var(--muted);text-decoration:none;font-size:.82rem;font-weight:700;padding:.28em .55em;border-radius:7px;line-height:1}
  .azbar a:hover{background:var(--panel);color:var(--amber)}
  .meter{color:var(--muted);font-size:.86rem;margin:8px 0 16px}
  /* Active-filter chip for a ?tag= arrival that has no dropdown of its own
     (kinks, warnings, archetypes …) — without it the grid would look
     mysteriously short with nothing on screen explaining why. */
  .tagchip{margin:10px 0 0}
  .tagchip .tc{display:inline-flex;align-items:center;gap:8px;background:rgba(255,171,64,.14);border:1px solid rgba(255,171,64,.45);color:var(--amber);font-size:.85rem;font-weight:700;padding:.4em .5em .4em .9em;border-radius:99px}
  .tagchip .tc button{background:none;border:0;color:inherit;font-family:inherit;font-size:.9rem;cursor:pointer;line-height:1;padding:0 .2em}
  .tagchip .tc button:hover{color:var(--cream)}
  .lgroup{padding-top:10px;scroll-margin-top:88px}
  .lgroup > h2{font-family:'Fraunces',serif;font-weight:600;font-size:1.15rem;color:var(--amber);border-bottom:1px solid var(--line);padding-bottom:6px;margin-bottom:14px}
  .bgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px;margin-bottom:10px}
  @media(max-width:600px){.bgrid{grid-template-columns:repeat(2,1fr);gap:12px}}
  .bcard{display:flex;flex-direction:column;background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow:hidden;text-decoration:none;color:inherit;transition:transform .16s,border-color .16s}
  .bcard:hover{transform:translateY(-3px);border-color:var(--rose)}
  /* Covers are fit, never cropped — the letterbox is filled by a blurred copy
     of the same image, so one URL serves both layers from one request. */
  .bcard .cover{position:relative;aspect-ratio:3/4;overflow:hidden;background:var(--ink-2);flex:0 0 auto}
  .bcard .cover img{position:absolute;inset:0;width:100%;height:100%;display:block}
  .bcard .cover-bg{object-fit:cover;filter:blur(18px) saturate(1.35) brightness(.5);transform:scale(1.25)}
  .bcard .cover-img{object-fit:contain;z-index:1}
  .bcard .ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:14px;font-family:'Fraunces',serif;font-style:italic;font-size:.95rem;line-height:1.2;color:#fff;background:linear-gradient(160deg,#3a0d2a,#7a1238)}
  .bmeta{padding:10px 12px 13px;display:flex;flex-direction:column;flex:1}
  .bmeta .bt{font-family:'Fraunces',serif;font-weight:500;font-size:.98rem;line-height:1.2;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .bmeta .ba{color:var(--muted);font-size:.78rem;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .bmeta .bs{margin-top:6px;font-size:.72rem;letter-spacing:.04em}
  .noresults{color:var(--muted);font-style:italic;padding:24px 0 40px}
</style>`;

function renderBookIndex(allBooks){
  const sorted = allBooks.filter(b => b.slug).slice()
    .sort((a, b) => sortTitle(a).localeCompare(sortTitle(b)) || String(a.slug).localeCompare(String(b.slug)));

  // Dropdown options are built only from tags a live book actually carries, so
  // a filter can never be offered that returns an empty grid. Values are full
  // "category:slug" keys, matching the data-tags on each card — which lets the
  // same matching logic serve the dropdowns AND the ?tag= deep link below.
  const optionsFor = cat => {
    const counts = new Map();
    for (const b of sorted){
      for (const t of tagsOf(b)){
        if (t.category !== cat) continue;
        const cur = counts.get(t.slug) || { label: t.label, n: 0 };
        cur.n++; counts.set(t.slug, cur);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1].n - a[1].n || a[1].label.localeCompare(b[1].label))
      .map(([slug, v]) => `<option value="${escAttr(cat + ':' + slug)}">${esc(v.label)} (${v.n})</option>`).join('');
  };
  const tropeOptions = optionsFor('trope');
  const moodOptions  = optionsFor('mood');

  // Human label for any tag key, so a ?tag= deep link can name itself in the
  // active-filter chip rather than showing a raw slug.
  const tagLabels = {};
  for (const b of sorted) for (const t of tagsOf(b)) tagLabels[t.category + ':' + t.slug] = t.label;

  const cardFor = b => {
    const author = b.author || 'Unknown';
    const spice = Math.max(0, Math.min(5, Number(b.spice_level) || 0));
    // ALL tag keys, not just tropes: every glossary term — kink, warning,
    // setting, archetype — can then deep link into this page via ?tag=.
    const tagKeys = tagsOf(b).map(t => t.category + ':' + t.slug).join(' ');
    const cover = b.cover_url
      ? `<img class="cover-bg" src="${escAttr(b.cover_url)}" alt="" aria-hidden="true" loading="lazy">`
        + `<img class="cover-img" src="${escAttr(b.cover_url)}" alt="${escAttr(b.title)} book cover" loading="lazy">`
      : `<div class="ph">${esc(b.title)}</div>`;
    return `<a class="bcard" href="${escAttr(bookPath(b))}" data-s="${escAttr((b.title + ' ' + author).toLowerCase())}" data-tags="${escAttr(tagKeys)}" data-spice="${spice}">
        <div class="cover">${cover}</div>
        <div class="bmeta">
          <div class="bt">${esc(b.title)}</div>
          <div class="ba">${esc(author)}</div>
          ${spice ? `<div class="bs">${'🌶️'.repeat(spice)}</div>` : ''}
        </div>
      </a>`;
  };

  // Grouped A–Z so the page is skimmable at 289 books and the jump bar has
  // somewhere to land.
  const groups = [];
  for (const b of sorted){
    const L = letterOf(b);
    if (!groups.length || groups[groups.length - 1].letter !== L) groups.push({ letter: L, items: [] });
    groups[groups.length - 1].items.push(b);
  }
  const groupsHTML = groups.map(g => `<section class="lgroup" id="letter-${esc(g.letter === '#' ? 'num' : g.letter)}" data-letter="${esc(g.letter)}">
      <h2>${esc(g.letter)}</h2>
      <div class="bgrid">${g.items.map(cardFor).join('')}</div>
    </section>`).join('');
  const azHTML = groups.map(g => `<a href="#letter-${esc(g.letter === '#' ? 'num' : g.letter)}">${esc(g.letter)}</a>`).join('');

  const title = `All Books — Browse ${sorted.length} Romantasy Titles | smutHub`;
  const description = `Browse every romantasy and spicy fantasy book on smutHub — ${sorted.length} titles with spice ratings, tropes, and content warnings. Filter by trope, heat level, or search by title and author.`;

  const head = SHARED_HEAD({
    title,
    description,
    canonical: `${SITE}/book/`,
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'All Books',
      url: `${SITE}/book/`,
      description,
      isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: `${SITE}/` },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: sorted.length,
        itemListElement: sorted.map((b, i) => ({
          '@type': 'ListItem', position: i + 1, url: bookURL(b), name: b.title
        }))
      }
    },
    extraCSS: INDEX_CSS
  });

  const body = `<body>
${SHARED_HEADER}

<div class="wrap ihead">
  <nav class="crumb" style="padding:18px 0 0;color:var(--muted);font-size:.85rem"><a href="/" style="color:var(--muted);text-decoration:none">Home</a> / <span>All books</span></nav>
  <h1>Every book, <em>rated</em> and ready.</h1>
  <p class="sub">All ${sorted.length} titles in the smutHub catalog — spice level, tropes and content warnings on every one. Filter below, or jump by letter.</p>

  <div class="tools">
    <input id="q" type="search" placeholder="Filter these ${sorted.length} books by title or author…" aria-label="Filter books by title or author" autocomplete="off">
    <select id="fTrope" aria-label="Filter by trope"><option value="">Any trope</option>${tropeOptions}</select>
    <select id="fMood" aria-label="Filter by mood"><option value="">Any mood</option>${moodOptions}</select>
    <select id="fSpice" aria-label="Filter by spice level">
      <option value="">Any spice</option>
      <option value="1">1+ 🌶️</option><option value="2">2+ 🌶️</option><option value="3">3+ 🌶️</option><option value="4">4+ 🌶️</option><option value="5">5 🌶️</option>
    </select>
    <button id="fClear" type="button">✕ Clear</button>
  </div>
  <div id="tagchip" class="tagchip" hidden></div>
  <nav class="azbar" aria-label="Jump to letter">${azHTML}</nav>
  <p class="meter" id="meter">${sorted.length} books · A–Z by title</p>
</div>

<div class="wrap" id="results">
${groupsHTML}
<p class="noresults" id="noresults" style="display:none">No books match those filters yet — try fewer, or clear them.</p>
</div>

<script>
  // Live filtering — pure DOM, same approach as the glossary index. Every card
  // is already in the HTML (good for crawlers and for no-JS readers); this only
  // hides and shows.
  (function(){
    var q = document.getElementById('q');
    var fTrope = document.getElementById('fTrope');
    var fMood = document.getElementById('fMood');
    var fSpice = document.getElementById('fSpice');
    var clear = document.getElementById('fClear');
    var meter = document.getElementById('meter');
    var none = document.getElementById('noresults');
    var chip = document.getElementById('tagchip');
    var groups = [].slice.call(document.querySelectorAll('.lgroup'));
    var TAG_LABELS = ${JSON.stringify(tagLabels)};
    var deepTag = '';   // set by ?tag=category:slug

    // Every active tag must be present on a card (AND, not OR), so combining
    // a trope with a mood narrows rather than widens.
    function activeTags(){
      return [fTrope.value, fMood.value, deepTag].filter(Boolean);
    }
    function hasTag(card, key){
      return (' ' + card.getAttribute('data-tags') + ' ').indexOf(' ' + key + ' ') >= 0;
    }

    function apply(){
      var term = q.value.trim().toLowerCase();
      var spice = parseInt(fSpice.value, 10) || 0;
      var tags = activeTags();
      var shown = 0;
      groups.forEach(function(g){
        var any = false;
        [].slice.call(g.querySelectorAll('.bcard')).forEach(function(card){
          var ok = (!term || card.getAttribute('data-s').indexOf(term) >= 0)
                && (!spice || parseInt(card.getAttribute('data-spice'), 10) >= spice)
                && tags.every(function(t){ return hasTag(card, t); });
          card.style.display = ok ? '' : 'none';
          if (ok){ any = true; shown++; }
        });
        g.style.display = any ? '' : 'none';
      });
      var filtered = term || spice || tags.length;
      meter.textContent = shown + ' book' + (shown === 1 ? '' : 's') + (filtered ? ' matching' : '') + ' · A–Z by title';
      none.style.display = shown ? 'none' : '';
      clear.style.display = filtered ? '' : 'none';
    }

    function paintChip(){
      if (!deepTag){ chip.hidden = true; chip.innerHTML = ''; return; }
      var label = TAG_LABELS[deepTag] || deepTag.split(':').pop().replace(/-/g, ' ');
      chip.hidden = false;
      chip.innerHTML = '<span class="tc">' + label + '<button type="button" aria-label="Remove this filter">✕</button></span>';
      chip.querySelector('button').addEventListener('click', function(){
        deepTag = '';
        paintChip();
        // Drop ?tag= from the URL so a refresh or share doesn't reapply it.
        var p = new URLSearchParams(location.search); p.delete('tag');
        history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
        apply();
      });
    }

    q.addEventListener('input', apply);
    fTrope.addEventListener('change', apply);
    fMood.addEventListener('change', apply);
    fSpice.addEventListener('change', apply);
    clear.addEventListener('click', function(){
      q.value=''; fTrope.value=''; fMood.value=''; fSpice.value=''; deepTag='';
      paintChip();
      history.replaceState(null, '', location.pathname);
      apply(); q.focus();
    });

    // Deep links from elsewhere on the site:
    //   /book/?tag=trope:fated-mates   — from any glossary term page
    //   /book/?q=Sarah%20J.%20Maas     — from a book page's author byline
    //   /book/?trope=…&spice=4         — legacy shape, still honoured
    (function(){
      var p = new URLSearchParams(location.search);
      if (p.get('q')) q.value = p.get('q');
      if (p.get('spice')) fSpice.value = p.get('spice');
      var t = p.get('tag');
      if (t){
        // If it maps onto a dropdown, drive that instead of the chip so the
        // control visibly reflects the filter the reader arrived with.
        if (t.indexOf('trope:') === 0 && [].some.call(fTrope.options, function(o){ return o.value === t; })) fTrope.value = t;
        else if (t.indexOf('mood:') === 0 && [].some.call(fMood.options, function(o){ return o.value === t; })) fMood.value = t;
        else deepTag = t;
      }
      // Legacy bare ?trope=/?mood= values, normalised to full tag keys.
      var lt = p.get('trope'); if (lt && !fTrope.value) fTrope.value = lt.indexOf(':') < 0 ? 'trope:' + lt : lt;
      var lm = p.get('mood');  if (lm && !fMood.value)  fMood.value  = lm.indexOf(':') < 0 ? 'mood:' + lm : lm;
      paintChip();
    })();
    apply();
  })();
</script>

${SHARED_FOOTER}`;

  return head + body;
}

// ══════════════════════════════════════════════════════════════════════════
//  Write everything
// ══════════════════════════════════════════════════════════════════════════
await fs.rm(BOOK_DIR, { recursive: true, force: true });
await ensureDir(BOOK_DIR);

let wrote = 0;
for (const b of books){
  if (!b.slug){ console.warn('  ⚠ skipping a book with no slug:', b.title); continue; }
  const dir = path.join(BOOK_DIR, b.slug);
  await ensureDir(dir);
  await fs.writeFile(path.join(dir, 'index.html'), renderBookPage(b));
  wrote++;
}

// The browse index — the hub that makes all of the above reachable.
await fs.writeFile(path.join(BOOK_DIR, 'index.html'), renderBookIndex(books));

// ── Update sitemap.xml — replace the BOOK-AUTO block in place ───────────────
const sitemapPath = path.join(ROOT, 'sitemap.xml');
let sitemap = await fs.readFile(sitemapPath, 'utf-8');
const START = '<!-- BOOK-AUTO-START -->';
const END = '<!-- BOOK-AUTO-END -->';
const today = new Date().toISOString().slice(0, 10);
// The browse index leads, at a higher priority than the individual books —
// it's the hub crawlers should reach first and the one that links to the rest.
const bookUrls = [`  <url><loc>${SITE}/book/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`]
  .concat(books
    .filter(b => b.slug)
    .map(b => `  <url><loc>${bookURL(b)}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`))
  .join('\n');
const newBlock = `${START}\n${bookUrls}\n  ${END}`;
const si = sitemap.indexOf(START);
const ei = sitemap.indexOf(END);
if (si >= 0 && ei >= 0 && ei > si){
  sitemap = sitemap.substring(0, si) + newBlock + sitemap.substring(ei + END.length);
} else {
  sitemap = sitemap.replace('</urlset>', `  ${newBlock}\n</urlset>`);
}
await fs.writeFile(sitemapPath, sitemap);

console.log(`✓ Wrote ${wrote} book pages → /book/<slug>/`);
console.log(`✓ Wrote the browse index → /book/`);
console.log(`✓ Updated sitemap.xml with ${books.filter(b => b.slug).length} book URLs + /book/`);
console.log(`\nNext: git add book/ sitemap.xml && git commit && git push`);
