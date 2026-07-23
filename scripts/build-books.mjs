#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
//  smutHub · book pages build
//
//  Generates the static "plot / about" page for every LIVE book — the
//  Goodreads-style page a reader lands on when they click a cover anywhere
//  on the site:
//    /books/<slug>/index.html
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
const BOOK_DIR = path.join(ROOT, 'books');
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
const bookPath = b => `/books/${b.slug}/`;
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
<meta property="og:image" content="${escAttr(page.ogImage || `${SITE}/og-image.jpg`)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escAttr(page.title)}">
<meta name="twitter:description" content="${escAttr(page.description)}">
<meta name="twitter:image" content="${escAttr(page.ogImage || `${SITE}/og-image.jpg`)}">
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
      <a href="/books/">Browse Books</a>
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
    <span><a href="/books/">All Books</a> · <a href="/glossary/">Glossary</a> · <a href="/sitemap.html">Sitemap</a></span>
  </div>
</footer>
</body></html>
`;

// ── "Ask First" book-page styles ──────────────────────────────────────────
// The approved prototype shipped its own palette (Georgia/Arial, #f04455 red,
// cream "paper" panels). Per the handoff's own constraint — reuse production
// colours, typography and spacing so the page reads as a native evolution
// rather than a separate microsite — the STRUCTURE and INTERACTIONS are ported
// faithfully while the skin uses smutHub's existing tokens: Fraunces headings,
// Hanken Grotesk body, --panel surfaces, --rose accent.
// Namespaced `af-` throughout so nothing collides with the existing BOOK_CSS.
const ASK_CSS = `
  .af-hero{display:grid;grid-template-columns:220px minmax(320px,1fr) minmax(300px,380px);gap:clamp(22px,3vw,44px);align-items:start;padding:22px 0 8px}
  @media(max-width:1080px){.af-hero{grid-template-columns:190px 1fr}.af-ask{grid-column:1/-1}}
  @media(max-width:720px){.af-hero{grid-template-columns:100px 1fr;gap:16px}.af-cover-col{display:contents}}

  /* ── column 1: cover, format, rate, shelf ── */
  .af-cover{position:relative;aspect-ratio:2/3;border-radius:12px;overflow:hidden;background:var(--ink-2);border:1px solid var(--line)}
  .af-cover img{position:absolute;inset:0;width:100%;height:100%;display:block}
  .af-cover .cover-bg{object-fit:cover;filter:blur(18px) saturate(1.35) brightness(.5);transform:scale(1.25)}
  .af-cover .cover-img{object-fit:contain;z-index:1}
  .af-cover .ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:14px;font-family:'Fraunces',serif;font-style:italic;color:#fff;background:linear-gradient(160deg,#3a0d2a,#7a1238)}
  .af-format{margin-top:10px;color:var(--muted);font-size:.74rem;text-transform:uppercase;letter-spacing:.1em;text-align:center}
  @media(max-width:720px){.af-format{display:none}}

  /* Compact review utility, high on the page. smutHub has no reviews table,
     so the "Finished it?" slot drives the per-reader SPICE rating that already
     exists in book_tags — an honest action rather than a dead control. */
  .af-rate{margin-top:12px;padding:11px 12px;border:1px solid var(--line);border-top:2px solid var(--rose);border-radius:10px;background:var(--ink-2)}
  .af-rate>span{display:block;color:var(--amber);font-size:.62rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
  .af-stars{margin-top:8px;display:flex;justify-content:space-between}
  .af-stars button{padding:0 1px;background:none;border:0;cursor:pointer;font-size:1.05rem;line-height:1;filter:grayscale(1);opacity:.34;transition:.15s}
  .af-stars button.on{filter:none;opacity:1}
  .af-stars button:hover{transform:scale(1.15)}
  .af-rate-note{margin-top:7px;color:var(--muted);font-size:.68rem;min-height:1em}
  .af-rate-note a{color:var(--amber)}
  @media(max-width:720px){.af-rate{grid-column:1/-1}}

  /* ── column 2: title, actions, quick facts ── */
  .af-flags{display:flex;flex-wrap:wrap;gap:7px}
  .af-flags span{padding:5px 8px;border:1px solid var(--line);border-radius:99px;color:var(--muted);font-size:.66rem;font-weight:800;letter-spacing:.11em;text-transform:uppercase}
  .af-core h1{margin:16px 0 6px;font-family:'Fraunces',serif;font-weight:600;font-size:clamp(1.9rem,4.4vw,3.1rem);line-height:1.03;letter-spacing:-.02em}
  .af-byline{margin:0;color:var(--muted);font-size:.95rem}
  .af-byline a{color:var(--cream);font-weight:700}
  .af-pulse{margin:16px 0 14px;padding:11px 0;display:flex;align-items:center;gap:12px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
  .af-pulse b{font-family:'Fraunces',serif;font-weight:600;font-size:1.4rem}
  .af-pulse small{color:var(--muted);font-size:.72rem;text-transform:uppercase;letter-spacing:.08em}
  .af-actions{display:flex;flex-wrap:wrap;gap:8px}
  .af-actions button,.af-actions select{font-family:inherit;font-weight:800;font-size:.8rem;padding:.7em 1em;border-radius:10px;cursor:pointer;border:1px solid var(--line);background:var(--ink-2);color:var(--cream)}
  .af-actions .af-primary{background:var(--grad);color:#1a0c10;border-color:transparent}
  .af-actions .af-primary.on{background:var(--panel);color:var(--cream);border-color:var(--rose)}
  .af-facts{margin:18px 0 0;display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--line);border-left:1px solid var(--line)}
  @media(max-width:720px){.af-facts{grid-column:1/-1;grid-template-columns:repeat(2,1fr)}}
  .af-facts>div{padding:11px 12px;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}
  .af-facts dt,.af-facts small{display:block;color:var(--muted);font-size:.64rem;text-transform:uppercase;letter-spacing:.1em}
  .af-facts dd{margin:6px 0 4px;font-family:'Fraunces',serif;font-weight:500;font-size:1.02rem}

  /* ── column 3: the Ask First jump menu ── */
  .af-ask{background:var(--panel);border:1px solid var(--line);border-radius:16px;overflow:hidden}
  .af-ask-head{padding:16px 18px;background:var(--ink-2);border-bottom:1px solid var(--line)}
  .af-ask-head>span{color:var(--amber);font-size:.62rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
  .af-ask-head h2{margin:9px 0 0;font-family:'Fraunces',serif;font-weight:600;font-size:1.5rem;line-height:1.05;letter-spacing:-.02em}
  .af-ask-head h2 em{font-style:italic;font-weight:400;color:transparent;background:var(--grad);-webkit-background-clip:text;background-clip:text}
  .af-ask nav a{min-height:52px;padding:10px 16px;display:grid;grid-template-columns:22px 1fr auto;align-items:center;gap:9px;text-decoration:none;color:var(--cream);border-bottom:1px solid var(--line);transition:background .16s,padding .16s}
  .af-ask nav a:last-child{border-bottom:0}
  .af-ask nav a:hover,.af-ask nav a:focus-visible{padding-left:21px;background:var(--ink-2);outline:none}
  .af-ask nav a>span{color:var(--muted);font-size:.66rem;font-variant-numeric:tabular-nums}
  .af-ask nav a>b{font-family:'Fraunces',serif;font-weight:500;font-size:1rem;line-height:1.15}
  /* The right-hand summary must stay strongly bold and legible on mobile —
     this was the specific documented feedback on the prototype. */
  .af-ask nav a>em{font-style:normal;font-weight:800;font-size:.68rem;letter-spacing:.05em;text-transform:uppercase;color:var(--amber);text-align:right}
  @media(max-width:720px){.af-ask nav a>em{font-size:.72rem}}

  /* ── answer stack ── */
  .af-answers{padding:8px 0 10px}
  .af-sec{scroll-margin-top:88px;padding:30px 0;display:grid;grid-template-columns:52px 1fr;gap:6px;border-bottom:1px solid var(--line)}
  @media(max-width:720px){.af-sec{grid-template-columns:30px 1fr;padding:24px 0}}
  .af-num{color:var(--rose);font-size:.72rem;font-weight:800;font-variant-numeric:tabular-nums;padding-top:.5em}
  .af-label{margin:0 0 10px;color:var(--muted);font-size:.7rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
  .af-sec h2{margin:0;font-family:'Fraunces',serif;font-weight:400;font-size:clamp(1.35rem,2.9vw,2.1rem);line-height:1.14;letter-spacing:-.02em;max-width:34ch}
  .af-sec p{max-width:70ch;color:var(--muted);line-height:1.62;margin-top:12px}
  .af-tags{margin-top:16px;display:flex;flex-wrap:wrap;gap:7px;max-width:900px}
  .af-tags a,.af-tags span{padding:7px 10px;border:1px solid var(--line);border-radius:99px;color:var(--cream);text-decoration:none;font-size:.76rem}
  .af-tags a:hover{border-color:var(--rose)}
  .af-tags.is-warn span,.af-tags.is-warn a{color:#ffb3a7;border-color:rgba(255,122,77,.4)}
  .af-tags.is-warn span:before,.af-tags.is-warn a:before{content:"!";margin-right:6px;color:var(--rose);font-weight:800}
  .af-seeall{margin-top:14px;padding:7px 0;background:none;border:0;border-bottom:1px solid var(--line);color:var(--cream);font-family:inherit;font-size:.74rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
  .af-seeall span{margin-left:7px;color:var(--amber)}
  .af-seeall:hover{border-color:var(--rose)}
  .af-spice{margin-top:16px;padding:14px 0;display:grid;grid-template-columns:auto 1fr 1fr;gap:16px;align-items:center;border-top:1px solid var(--line);border-bottom:1px solid var(--line);color:var(--muted);font-size:.76rem}
  @media(max-width:720px){.af-spice{grid-template-columns:1fr;gap:10px}}
  .af-spice b{display:block;margin-bottom:3px;color:var(--cream);font-size:.66rem;text-transform:uppercase;letter-spacing:.09em}
  .af-gauge{display:flex;gap:5px}
  .af-gauge i{width:30px;height:7px;border-radius:2px;background:#4f4448;display:block}
  .af-gauge i.on{background:var(--grad)}
  .af-blurb{max-width:80ch;margin-top:16px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
  .af-blurb summary{padding:14px 0;display:flex;justify-content:space-between;align-items:center;cursor:pointer;list-style:none;font-size:.72rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
  .af-blurb summary::-webkit-details-marker{display:none}
  .af-blurb summary span{color:var(--amber);font-size:1.1rem;line-height:.7;transition:transform .2s}
  .af-blurb[open] summary span{transform:rotate(45deg)}
  .af-blurb .af-blurb-body{padding-bottom:18px}
  .af-commit{max-width:900px;margin-top:18px;display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--line);border-radius:12px;overflow:hidden}
  @media(max-width:720px){.af-commit{grid-template-columns:1fr}.af-commit>div{border-right:0!important;border-bottom:1px solid var(--line)}}
  .af-commit>div{padding:16px;border-right:1px solid var(--line)}
  .af-commit>div:last-child{border-right:0}
  .af-commit span,.af-commit small{display:block;color:var(--muted);font-size:.64rem;text-transform:uppercase;letter-spacing:.1em}
  .af-commit b{display:block;margin:7px 0;font-family:'Fraunces',serif;font-weight:600;font-size:1.35rem}
  .af-more{margin-top:16px}
  .af-more summary{cursor:pointer;color:var(--muted);font-size:.74rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;padding:10px 0}
  .af-more summary::-webkit-details-marker{display:none}
  .af-more summary:hover{color:var(--cream)}

  /* ── series + related: one continuation flow, swipeable on mobile ── */
  .af-disc{padding:30px 0 6px;border-bottom:1px solid var(--line)}
  .af-disc:last-child{border-bottom:0}
  .af-disc-head{margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px}
  .af-disc-head>div>span{color:var(--amber);font-size:.64rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
  .af-disc-head h2{margin:7px 0 4px;font-family:'Fraunces',serif;font-weight:600;font-size:1.6rem}
  .af-disc-head p{margin:0;color:var(--muted);font-size:.82rem}
  .af-disc-head>a{flex:none;color:var(--muted);text-decoration:none;font-size:.7rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;border-bottom:1px solid var(--line);padding-bottom:5px}
  .af-disc-head>a:hover{color:var(--cream);border-color:var(--rose)}
  .af-rail{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}
  @media(max-width:900px){.af-rail{grid-template-columns:repeat(3,minmax(0,1fr))}}
  @media(max-width:720px){
    .af-rail{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;margin-right:-22px;padding:2px 22px 14px 0;-webkit-overflow-scrolling:touch}
    .af-rail>a{flex:0 0 142px;scroll-snap-align:start}
    .af-disc-head>a{display:none}
  }
  .af-bcard{display:flex;flex-direction:column;min-width:0;text-decoration:none;color:inherit}
  .af-bcard .cv{position:relative;aspect-ratio:2/3;border-radius:10px;overflow:hidden;background:var(--ink-2);border:1px solid var(--line);transition:transform .18s,border-color .18s}
  .af-bcard:hover .cv{transform:translateY(-4px);border-color:var(--rose)}
  .af-bcard .cv img{position:absolute;inset:0;width:100%;height:100%;display:block}
  .af-bcard .cv .cover-bg{object-fit:cover;filter:blur(16px) brightness(.5) saturate(1.3);transform:scale(1.25)}
  .af-bcard .cv .cover-img{object-fit:contain;z-index:1}
  .af-bcard .cv .ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:10px;font-family:'Fraunces',serif;font-style:italic;font-size:.82rem;color:#fff;background:linear-gradient(160deg,#3a0d2a,#7a1238)}
  .af-bcard.is-current .cv{outline:2px solid var(--rose);outline-offset:2px}
  .af-bcard .bm{padding-top:10px}
  .af-bcard .bm>span{color:var(--amber);font-size:.62rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase}
  .af-bcard .bm h3{margin:5px 0 3px;font-family:'Fraunces',serif;font-weight:500;font-size:.98rem;line-height:1.15}
  .af-bcard .bm p{margin:0;color:var(--muted);font-size:.76rem}

  /* ── drawers: full tropes / full warnings ── */
  body.af-drawer-open{overflow:hidden}
  .af-layer{position:fixed;inset:0;z-index:80;display:flex;justify-content:flex-end;background:rgba(4,2,3,.72);backdrop-filter:blur(4px);animation:af-fade .18s ease-out}
  .af-drawer{width:min(520px,94vw);height:100%;padding:26px;overflow-y:auto;background:var(--panel);border-left:1px solid var(--line);box-shadow:-20px 0 50px rgba(0,0,0,.45);animation:af-slide .26s ease-out}
  @media(max-width:720px){.af-drawer{width:100vw;padding:20px}}
  .af-drawer-head{padding-bottom:18px;display:flex;justify-content:space-between;align-items:flex-start;gap:18px;border-bottom:1px solid var(--line)}
  .af-drawer-head span{color:var(--amber);font-size:.64rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
  .af-drawer-head h2{margin:8px 0 0;font-family:'Fraunces',serif;font-weight:600;font-size:1.6rem}
  .af-drawer-head button{flex:0 0 38px;height:38px;background:none;border:1px solid var(--line);border-radius:50%;color:var(--cream);font-size:1.4rem;line-height:1;cursor:pointer}
  .af-drawer-head button:hover{border-color:var(--rose)}
  .af-drawer-note{margin:16px 0;color:var(--muted);font-size:.86rem;line-height:1.5}
  .af-drawer-list>div,.af-drawer-list>a{padding:13px 0;display:grid;grid-template-columns:30px 1fr;gap:10px;align-items:center;border-bottom:1px solid var(--line);text-decoration:none;color:inherit}
  .af-drawer-list>a:hover b{color:var(--rose)}
  .af-drawer-list span{color:var(--muted);font-size:.66rem;font-variant-numeric:tabular-nums}
  .af-drawer-list b{font-family:'Fraunces',serif;font-weight:500;font-size:1.05rem}
  .af-drawer-detail{margin-top:16px;color:var(--muted);font-size:.88rem;line-height:1.6}
  .af-drawer-done{width:100%;margin-top:22px;padding:13px;background:var(--grad);color:#1a0c10;border:0;border-radius:10px;font-family:inherit;font-size:.76rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}
  @keyframes af-slide{from{transform:translateX(100%)}to{transform:translateX(0)}}
  @keyframes af-fade{from{opacity:0}to{opacity:1}}
  @media(prefers-reduced-motion:reduce){.af-layer,.af-drawer{animation:none}}
`;

const BOOK_CSS = `<style>

  .crumb{padding:18px 0 0;color:var(--muted);font-size:.85rem}
.crumb a{color:var(--muted);text-decoration:none}
.crumb a:hover{color:var(--cream)}
  /* hero */
  /* Desktop: a single 2-col grid that runs from the hero all the way down through
     the plot + details. Cover stays sticky on the left while the right column
     scrolls. The related-books grids ("More in series / like this / by author")
     sit OUTSIDE this layout as full-width sections, since they need the room.
     Mobile (≤720px): single column, everything stacks linearly. */
  .book-layout{display:grid;grid-template-columns:260px 1fr;gap:34px;padding:24px 0 8px;align-items:start}
@media(max-width:720px){.book-layout{grid-template-columns:1fr;gap:22px;max-width:460px;margin:0 auto}}
@media(max-width:720px){.book-layout > .cover-col{position:static;justify-self:center;width:200px}}
.cover{aspect-ratio:2/3;border-radius:14px;overflow:hidden;background:linear-gradient(160deg,#3a0d2a,#7a1238);box-shadow:0 30px 60px -24px rgba(0,0,0,.8);position:relative}
.cover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cover .ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:18px;text-align:center;font-family:'Fraunces',serif;font-size:1.05rem;color:var(--cream)}
h1{font-family:'Fraunces',serif;font-weight:600;font-size:clamp(1.9rem,4.4vw,3rem);letter-spacing:-.02em;line-height:1.06}
.chilis span.on{filter:none;opacity:1}
section.blk:last-of-type{border-bottom:0}
section.blk h2{font-family:'Fraunces',serif;font-weight:500;font-size:1.4rem;margin-bottom:14px}
  /* "What it's about" — structured paragraphs from a single blurb column.
     Conventions a writer types IN the blurb (the only data layer that knows
     a book's blurb): blank line = paragraph break, > prefix = muted publisher
     intro, ***text*** = italic pitch callout, **word** = bold .term span. */
  .sh-plot p{line-height:1.7;margin:0 0 1.05em;font-size:1.02rem;max-width:66ch}
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
.sh-empty{color:var(--muted);font-style:italic;max-width:66ch}
.chip .c{color:var(--muted);font-size:.68rem;text-transform:uppercase;letter-spacing:.06em}
  /* content warnings */
  details.cw{margin-top:22px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:2px 16px;max-width:66ch}
/* details grid — still used by detailsHTML() inside "What's the commitment?" */
  .dgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.drow{background:var(--ink-2);padding:13px 16px}
.drow .dk{display:block;color:var(--muted);font-size:.72rem;text-transform:uppercase;letter-spacing:.07em;font-weight:700;margin-bottom:3px}
.drow .dv{font-size:.98rem;color:var(--cream)}
  /* related grids */
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px}
@media(max-width:600px){.grid{grid-template-columns:repeat(2,1fr);gap:12px}}
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
// ══════════════════════════════════════════════════════════════════════════
//  "Ask First" helpers
// ══════════════════════════════════════════════════════════════════════════
// Everything below derives strictly from stored fields. Where a value is
// absent the element is omitted entirely — the handoff is explicit that a
// missing fact must never become an empty card, a fabricated value, or "N/A".

// Cover with a blurred backdrop filling the letterbox (same URL, one request).
function afCover(b, alt){
  if (!b.cover_url) return `<div class="ph">${esc(b.title)}</div>`;
  return `<img class="cover-bg" src="${escAttr(b.cover_url)}" alt="" aria-hidden="true" loading="lazy">`
       + `<img class="cover-img" src="${escAttr(b.cover_url)}" alt="${escAttr(alt || (b.title + ' book cover'))}" loading="lazy">`;
}

// The "30-second answer": the opening of the stored blurb, cut at a sentence
// boundary. Not a new field and not generated prose — just the first thing the
// publisher says, surfaced before the full text.
// Abbreviations and initials that end in a period but do NOT end a sentence.
// Without this, "…for fans of E.L. James" gets cut after "E.L." and the answer
// reads as though it broke mid-thought.
// The leading class includes "." so the SECOND period of an initial pair
// ("E.L.") is recognised too — there the capital is preceded by a dot, not a space.
const NOT_SENTENCE_END = /(?:^|[\s(.])(?:[A-Z]|Mr|Mrs|Ms|Dr|St|Jr|Sr|vs|etc|no|vol|ed|Prof|Rev|Hon|Inc|Ltd|Co)$/;

function afShortAnswer(blurb){
  const raw = String(blurb || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  if (raw.length <= 190) return raw;
  const cut = raw.slice(0, 280);
  // Walk real sentence boundaries, skipping any whose preceding token is an
  // initial or abbreviation, and take the last one that leaves a usable answer.
  let best = -1;
  for (const m of cut.matchAll(/[.!?](?=\s)/g)){
    const i = m.index;
    if (m[0] === '.' && NOT_SENTENCE_END.test(cut.slice(Math.max(0, i - 6), i))) continue;
    // 60 rather than 90: once initials are excluded, the first genuine sentence
    // is often the whole hook, and a clean short sentence beats a long one that
    // has to be ellipsed.
    if (i >= 60) best = i;
  }
  if (best > 0) return cut.slice(0, best + 1);
  return cut.replace(/\s+\S*$/, '') + '…';
}

// Quick facts — only rows the book actually has a value for.
function afFacts(b){
  const f = [];
  if (b.page_count) f.push(['Length', `${b.page_count} pages`, b.audiobook ? 'Audiobook too' : '']);
  if (b.series && b.series_number) f.push(['Series', `Book ${b.series_number}`, b.series]);
  else if (b.standalone) f.push(['Series', 'Standalone', '']);
  if (b.pov) f.push(['POV', POV[b.pov] || humanize(b.pov), '']);
  if (b.relationship_type) f.push(['Pairing', REL[b.relationship_type] || humanize(b.relationship_type), 'Central romance']);
  if (b.ending) f.push(['Ending', ENDING[b.ending] || humanize(b.ending), b.cliffhanger ? 'Cliffhanger' : 'No cliffhanger']);
  else if (b.cliffhanger) f.push(['Ending', 'Cliffhanger', '']);
  if (b.pacing) f.push(['Pace', PACING[b.pacing] || humanize(b.pacing), '']);
  return f;
}

// "Is it for me?" — assembled from stored fields only. Each clause is traceable
// to a column (spice_level, pacing, ending, cliffhanger, warning tags); nothing
// is inferred about content the catalog doesn't record.
function afFit(b, tags){
  const lvl = Number(b.spice_level);
  const forYou = [];
  if (Number.isFinite(lvl) && lvl > 0){
    forYou.push(lvl >= 4 ? 'you want the heat high'
              : lvl === 3 ? 'you want real heat without it taking over'
              : 'you want tension and yearning more than explicit heat');
  }
  if (b.pacing === 'slow-burn') forYou.push('a slow burn is the point, not a problem');
  else if (b.pacing === 'fast') forYou.push('you want it to move quickly');
  if (b.ending === 'HEA') forYou.push('you need the happy ending guaranteed');
  else if (b.ending === 'HFN') forYou.push('hopeful-for-now is enough');

  const warns = tags.filter(t => t.category === 'warning').map(t => t.label.toLowerCase());
  const skip = [];
  if (warns.length){
    const list = warns.slice(0, 3).join(', ');
    skip.push(`${list}${warns.length > 3 ? ` (and ${warns.length - 3} more flagged)` : ''} ${warns.length === 1 ? 'is' : 'are'} a hard no for you`);
  }
  if (b.cliffhanger) skip.push('you need this one to resolve on its own');
  if (Number.isFinite(lvl) && lvl > 0 && lvl <= 2) skip.push('you want high heat straight away');

  const headline = forYou.length
    ? `Yes — if ${forYou.slice(0, 2).join(', and ')}.`
    : 'Depends on what you want from it.';
  const body = skip.length ? `Skip it if ${skip.slice(0, 2).join(', or ')}.` : '';
  return { headline, body };
}

// The next book in reading order — the design requires "next book is obvious".
function nextInSeries(ordered, current){
  const pos = Number(current.series_number);
  if (!Number.isFinite(pos)) return null;
  return ordered.find(b => Number(b.series_number) > pos && b.slug !== current.slug) || null;
}

function afSection({ id, num, label, headline, body }){
  return `<section class="af-sec" id="${id}">
    <span class="af-num">${num}</span>
    <div><p class="af-label">${esc(label)}</p><h2>${headline}</h2>${body || ''}</div>
  </section>`;
}

// Series / related rail. Mobile turns this into a scroll-snapping swipe rail
// via CSS; markup stays one list either way.
function afDiscovery({ id, eyebrow, heading, note, books: list, moreHref, moreLabel, currentSlug, ordered }){
  if (!list.length) return '';
  const cards = list.map(b => {
    const isCurrent = currentSlug && b.slug === currentSlug;
    const note = ordered
      ? (b.series_number ? `Book ${b.series_number}${isCurrent ? ' · You are here' : ''}` : (isCurrent ? 'You are here' : ''))
      : (b.spice_level ? `${'🌶️'.repeat(Math.min(5, Number(b.spice_level)))}` : '');
    return `<a class="af-bcard${isCurrent ? ' is-current' : ''}" href="${escAttr(bookPath(b))}"${isCurrent ? ' aria-current="page"' : ''}>
      <div class="cv">${afCover(b)}</div>
      <div class="bm">${note ? `<span>${esc(note)}</span>` : ''}<h3>${esc(b.title)}</h3><p>${esc(b.author || '')}</p></div>
    </a>`;
  }).join('');
  return `<section class="af-disc" id="${id}" aria-labelledby="${id}-h">
    <div class="af-disc-head">
      <div><span>${esc(eyebrow)}</span><h2 id="${id}-h">${esc(heading)}</h2><p>${esc(note)}</p></div>
      ${moreHref ? `<a href="${escAttr(moreHref)}">${esc(moreLabel)} →</a>` : ''}
    </div>
    <div class="af-rail">${cards}</div>
  </section>`;
}

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
  // Google truncates titles around 60 characters. The previous format
  // ("<title> by <author> — Spice, Tropes & Content Warnings | smutHub")
  // ran 79 chars at the median and clipped on ALL 289 book pages, cutting off
  // the descriptive half. Pick the richest variant that still fits: short
  // titles keep the author, long ones drop the extras rather than be cut
  // mid-word by the SERP.
  const seoTitle = (() => {
    const brand = ` | ${SITE_NAME}`;
    const variants = [
      author ? `${book.title} by ${author} — Spice & Tropes` : null,
      `${book.title} — Spice, Tropes & Warnings`,
      `${book.title} — Spice & Tropes`,
      book.title,
    ].filter(Boolean);
    return (variants.find(v => (v + brand).length <= 60) || variants[variants.length - 1]) + brand;
  })();
  const tasteLabels = tags.filter(t => ['trope','mood','vibe'].includes(t.category)).slice(0, 4).map(t => t.label);
  const metaDesc = ((book.blurb || '').trim()
    || `${book.title}${author ? ` by ${author}` : ''}: spice level, content warnings, tropes${tasteLabels.length ? ` (${tasteLabels.join(', ')})` : ''}, and where it fits in the series — decoded on smutHub.`
  ).replace(/\s+/g, ' ').trim().slice(0, 158);

  // Breadcrumbs, matching the visual trail rendered below. Without this Google
  // prints the raw URL in results; with it, "smuthub.ca › All books › Powerless".
  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "All books", item: `${SITE}/books/` },
      { "@type": "ListItem", position: 3, name: book.title, item: bookURL(book) },
    ],
  };

  // Two entities on this page (the book and its breadcrumb trail), so they ship
  // in one @graph rather than two competing <script> blocks.
  const bookEntity = {
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

  const jsonld = { "@context": "https://schema.org", "@graph": [bookEntity, breadcrumb] };

  const head = SHARED_HEAD({
    title: seoTitle,
    description: metaDesc,
    canonical: bookURL(book),
    ogType: 'book',
    ogImage: cover || `${SITE}/og-image.jpg`,
    jsonld,
    extraCSS: BOOK_CSS + `<style>${ASK_CSS}</style>`,
  });

  // ── Ask First page data ─────────────────────────────────────────────────
  const tropeTags = tags.filter(t => t.category === 'trope');
  const warnTags  = tags.filter(t => t.category === 'warning');
  const spiceLvl  = Number(book.spice_level);
  const hasSpice  = Number.isFinite(spiceLvl) && spiceLvl > 0;
  const shortAns  = afShortAnswer(book.blurb);
  const facts     = afFacts(book);
  const fit       = afFit(book, tags);
  const triggers  = (book.triggers_detail || '').trim();
  // The full series, current book included, in reading order — the design calls
  // for the current book to be identifiable and the next one obvious.
  const fullSeries = book.series
    ? dedupeByIdentity(books.filter(b => b.series === book.series))
        .sort((a, c) => (Number(a.series_number) || 99) - (Number(c.series_number) || 99))
    : [];

  // Jump menu — a row is only offered when the section it points at will exist.
  const askRows = [
    shortAns || book.blurb ? ['#af-plot', "What's it about?", '30-sec answer'] : null,
    hasSpice || book.door ? ['#af-spice', 'How spicy is it?', hasSpice ? `${spiceLvl} / 5${book.door ? ` · ${esc((DOOR[book.door] || book.door).split(' ')[0].toLowerCase())}` : ''}` : 'the details'] : null,
    tropeTags.length ? ['#af-tropes', 'Which tropes?', `${tropeTags.length} tagged`] : null,
    (warnTags.length || triggers) ? ['#af-warnings', 'Any hard nos?', warnTags.length ? `${warnTags.length} warning${warnTags.length === 1 ? '' : 's'}` : 'read first'] : null,
    ['#af-fit', 'Is it for me?', 'quick fit check'],
    (book.page_count || book.series_number || book.ending) ? ['#af-commitment', "What's the commitment?",
      [book.page_count ? `${book.page_count} pp` : '', book.series_number ? `book ${book.series_number}` : ''].filter(Boolean).join(' · ') || 'the details'] : null,
  ].filter(Boolean);

  const body = `<body>
${SHARED_HEADER}
<div class="wrap">
  <nav class="crumb"><a href="/">Home</a> / <a href="/books/">All books</a> / <span>${esc(book.title)}</span></nav>

  <!-- ── Above the fold: cover + rate, core info, Ask First menu ── -->
  <section class="af-hero">
    <div class="af-cover-col">
      <div class="af-cover">${afCover(book)}</div>
      ${book.page_count || book.audiobook ? `<p class="af-format">${[book.page_count ? `${book.page_count} pages` : '', book.audiobook ? 'audiobook' : ''].filter(Boolean).join(' · ')}</p>` : ''}

      <div class="af-rate" id="af-review">
        <span>Finished it?</span>
        <div class="af-stars" id="afStars" role="group" aria-label="Rate how spicy this book was, out of five">
          ${[1,2,3,4,5].map(n => `<button type="button" data-n="${n}" aria-label="Rate ${n} of 5 chili${n === 1 ? '' : 's'}" aria-pressed="false">🌶️</button>`).join('')}
        </div>
        <p class="af-rate-note" id="afRateNote">How spicy was it?</p>
      </div>

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
    </div>

    <div class="af-core">
      <div class="af-flags">
        ${book.series && book.series_number ? `<span>${esc(book.series)} #${esc(book.series_number)}</span>` : ''}
        ${book.subgenre ? `<span>${esc(humanize(book.subgenre))}</span>` : ''}
        ${book.age_category ? `<span>${esc(book.age_category)}</span>` : ''}
      </div>
      <h1>${esc(book.title)}</h1>
      <p class="af-byline">${author ? `by <a href="/books/?q=${encodeURIComponent(author)}">${esc(author)}</a>` : 'Author unknown'}${book.year ? ` · ${esc(book.year)}` : ''}</p>
      ${book.rating_avg ? `<div class="af-pulse"><b>${esc(Number(book.rating_avg).toFixed(2))}</b><small>average reader rating</small></div>` : ''}

      <div class="af-actions">
        <button type="button" class="af-primary" id="afWant">＋ Want to read</button>
        <button type="button" id="afRead">Mark as read</button>
        <button type="button" id="afShare" aria-label="Share this book">↗ Share</button>
      </div>

      ${facts.length ? `<dl class="af-facts" aria-label="Quick book facts">
        ${facts.map(([k, v, sub]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`).join('')}
      </dl>` : ''}
    </div>

    <aside class="af-ask" aria-labelledby="af-ask-h">
      <div class="af-ask-head">
        <span>The fastest way in</span>
        <h2 id="af-ask-h">What do you <em>actually</em> want to know?</h2>
      </div>
      <nav aria-label="Jump to an answer about this book">
        ${askRows.map(([href, q, sum], i) => `<a href="${href}"><span>${String(i + 1).padStart(2, '0')}</span><b>${esc(q)}</b><em>${esc(sum)}</em></a>`).join('')}
      </nav>
    </aside>
  </section>

  <!-- ── The answers, in the order the menu promises ── -->
  <div class="af-answers" id="af-answers">
    ${shortAns || book.blurb ? afSection({
      id: 'af-plot', num: '01', label: "What's it about?",
      headline: esc(shortAns || book.title),
      body: book.blurb ? `<details class="af-blurb">
        <summary>Read the full blurb <span>+</span></summary>
        <div class="af-blurb-body">${renderBlurbBody(book.blurb, tags).html}</div>
      </details>` : '',
    }) : ''}

    ${hasSpice || book.door || book.spice_frequency ? afSection({
      id: 'af-spice', num: '02', label: 'How spicy is it?',
      headline: hasSpice
        ? esc(`${spiceLvl} / 5${book.door ? ` — ${(DOOR[book.door] || book.door).toLowerCase()}` : ''}.`)
        : esc(DOOR[book.door] || humanize(book.door || '')),
      body: `<div class="af-spice">
        ${hasSpice ? `<span class="af-gauge" aria-label="Spice level ${spiceLvl} of 5">${[1,2,3,4,5].map(n => `<i class="${n <= spiceLvl ? 'on' : ''}"></i>`).join('')}</span>` : '<span></span>'}
        ${book.door ? `<span><b>Door</b>${esc(DOOR[book.door] || humanize(book.door))}</span>` : '<span></span>'}
        ${book.spice_frequency ? `<span><b>Frequency</b>${esc(FREQ[book.spice_frequency] || humanize(book.spice_frequency))}</span>` : '<span></span>'}
      </div>${book.spice_notes ? `<p>${esc(book.spice_notes)}</p>` : ''}`,
    }) : ''}

    ${tropeTags.length ? afSection({
      id: 'af-tropes', num: '03', label: 'Which tropes?',
      headline: esc(tropeTags.slice(0, 3).map(t => t.label).join(', ') + (tropeTags.length > 3 ? ', and more.' : '.')),
      body: `<div class="af-tags">${tropeTags.slice(0, 8).map(t => t.href
          ? `<a href="${escAttr(t.href)}">${esc(t.label)}</a>` : `<span>${esc(t.label)}</span>`).join('')}</div>
        ${tropeTags.length > 8 ? `<button type="button" class="af-seeall" data-drawer="tropes">See all ${tropeTags.length} tropes <span>→</span></button>` : ''}`,
    }) : ''}

    ${warnTags.length || triggers ? afSection({
      id: 'af-warnings', num: '04', label: 'Any hard nos?',
      headline: warnTags.length
        ? esc(`Flagged: ${warnTags.slice(0, 3).map(t => t.label.toLowerCase()).join(', ')}${warnTags.length > 3 ? ', and more.' : '.'}`)
        : 'Read the detail before you start.',
      body: `${warnTags.length ? `<div class="af-tags is-warn">${warnTags.slice(0, 6).map(t => t.href
          ? `<a href="${escAttr(t.href)}">${esc(t.label)}</a>` : `<span>${esc(t.label)}</span>`).join('')}</div>` : ''}
        ${warnTags.length > 6 || triggers ? `<button type="button" class="af-seeall" data-drawer="warnings">See all ${warnTags.length ? `${warnTags.length} warnings` : 'the detail'} <span>→</span></button>` : ''}`,
    }) : ''}

    ${afSection({
      id: 'af-fit', num: '05', label: 'Is it for me?',
      headline: esc(fit.headline),
      body: fit.body ? `<p>${esc(fit.body)}</p>` : '',
    })}

    ${book.page_count || book.series_number || book.ending ? afSection({
      id: 'af-commitment', num: '06', label: "What's the commitment?",
      headline: esc([
        book.page_count ? `${book.page_count} pages` : '',
        book.series_number ? `book ${book.series_number} of the series` : (book.standalone ? 'a standalone' : ''),
      ].filter(Boolean).join(', ') + '.'),
      body: `<div class="af-commit">
          ${book.page_count ? `<div><span>Book length</span><b>${esc(book.page_count)} pages</b>${book.audiobook ? '<small>Audiobook available</small>' : ''}</div>` : ''}
          ${book.series_number ? `<div><span>Series position</span><b>Book ${esc(book.series_number)}</b>${nextInSeries(fullSeries, book) ? `<small>Next: ${esc(nextInSeries(fullSeries, book).title)}</small>` : ''}</div>`
            : (book.standalone ? `<div><span>Series position</span><b>Standalone</b><small>Reads on its own</small></div>` : '')}
          ${book.ending ? `<div><span>Ending</span><b>${esc(ENDING[book.ending] || humanize(book.ending))}</b><small>${book.cliffhanger ? 'Ends on a cliffhanger' : 'No cliffhanger'}</small></div>` : ''}
        </div>
        ${detailsHTML(book) ? `<details class="af-more"><summary>Every recorded detail +</summary>${detailsHTML(book)}</details>` : ''}`,
    }) : ''}

    ${afDiscovery({
      id: 'af-series', eyebrow: 'Keep reading', heading: 'Books in the series',
      note: 'The full reading order, without leaving this page.',
      // Suppress the rail when the only book in the series is this one — that
      // happens whenever the catalog carries a single title from a series, and
      // a "keep reading" shelf holding just the page you're on is noise.
      books: fullSeries.some(b => b.slug !== book.slug) ? fullSeries : [],
      currentSlug: book.slug, ordered: true,
      moreHref: book.series ? `/books/?q=${encodeURIComponent(book.series)}` : '', moreLabel: 'View full series',
    })}

    ${afDiscovery({
      id: 'af-related', eyebrow: 'What next?', heading: 'Related books',
      note: 'Matched on tropes, heat and setting.',
      books: likeThis.slice(0, 5), moreHref: '/books/', moreLabel: 'See all matches',
    })}

    ${afDiscovery({
      id: 'af-author', eyebrow: 'Same author', heading: `More by ${author}`,
      note: 'Other books by this author in the catalog.',
      books: byAuthor.slice(0, 5),
      moreHref: author ? `/books/?q=${encodeURIComponent(author)}` : '', moreLabel: 'See all',
    })}
  </div>
</div>

<!-- Drawer content is server-rendered and hidden, so the complete trope and
     warning lists exist in the HTML for crawlers and for no-JS readers. -->
<template id="afDrawerTropes">${tropeTags.map((t, i) => t.href
  ? `<a href="${escAttr(t.href)}"><span>${String(i + 1).padStart(2, '0')}</span><b>${esc(t.label)}</b></a>`
  : `<div><span>${String(i + 1).padStart(2, '0')}</span><b>${esc(t.label)}</b></div>`).join('')}</template>
<template id="afDrawerWarnings">${warnTags.map((t, i) => t.href
  ? `<a href="${escAttr(t.href)}"><span>${String(i + 1).padStart(2, '0')}</span><b>${esc(t.label)}</b></a>`
  : `<div><span>${String(i + 1).padStart(2, '0')}</span><b>${esc(t.label)}</b></div>`).join('')}${triggers ? `<p class="af-drawer-detail">${esc(triggers)}</p>` : ''}</template>
<noscript>
  <div class="wrap">
    ${tropeTags.length ? `<section class="blk"><h2>All tropes</h2><div class="af-tags">${tropeTags.map(t => `<span>${esc(t.label)}</span>`).join('')}</div></section>` : ''}
    ${warnTags.length ? `<section class="blk"><h2>All content warnings</h2><div class="af-tags is-warn">${warnTags.map(t => `<span>${esc(t.label)}</span>`).join('')}</div>${triggers ? `<p>${esc(triggers)}</p>` : ''}</section>` : ''}
  </div>
</noscript>

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

    // The Ask First action row drives the same shelf routes — one source of
    // truth, so the two controls can never disagree about this book's state.
    var afWant = document.getElementById('afWant');
    var afRead = document.getElementById('afRead');
    var afShare = document.getElementById('afShare');
    function paintAsk(){
      if (!afWant) return;
      var on = current === 'want' || current === 'reading';
      afWant.textContent = current ? ('✓ ' + (LABEL[current] || 'Shelved')) : '＋ Want to read';
      afWant.classList.toggle('on', !!current);
      afWant.setAttribute('aria-pressed', current ? 'true' : 'false');
      if (afRead) afRead.textContent = current === 'read' ? '✓ Read' : 'Mark as read';
    }
    var basePaint = paint;
    paint = function(){ basePaint(); paintAsk(); };
    if (afWant) afWant.addEventListener('click', function(){
      if (!user){ note.innerHTML = '<a href="/dashboard.html">Log in</a> to build your shelf'; return; }
      if (current) remove(); else shelve('want');
    });
    if (afRead) afRead.addEventListener('click', function(){
      if (!user){ note.innerHTML = '<a href="/dashboard.html">Log in</a> to build your shelf'; return; }
      shelve('read');
    });
    if (afShare) afShare.addEventListener('click', async function(){
      var url = location.href, title = BOOK.title;
      try {
        if (navigator.share){ await navigator.share({ title: title, url: url }); }
        else { await navigator.clipboard.writeText(url); afShare.textContent = '✓ Link copied'; setTimeout(function(){ afShare.textContent = '↗ Share'; }, 1800); }
        if (window.SH && SH.track) SH.track('share', { where: 'book-page' });
      } catch(e){ /* user dismissed the share sheet — nothing to report */ }
    });

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
  // ── Tropes / warnings drawers ────────────────────────────────────────────
  // Accessible modal dialog: closes on the close button, backdrop click and
  // Escape; locks body scroll while open; traps Tab inside; and restores focus
  // to the button that opened it. Content comes from server-rendered <template>
  // elements, so the complete lists are in the HTML even before JS runs.
  (function(){
    var layer = null, lastFocus = null;
    var COPY = {
      tropes:   { eyebrow: 'Complete book data', title: 'All tropes',            note: 'Every trope recorded for this book. Tap one to see its glossary entry.' },
      warnings: { eyebrow: 'Complete book data', title: 'All content warnings',  note: 'Nothing hidden. Scan the full list before deciding if this book fits.' }
    };
    function close(){
      if (!layer) return;
      layer.remove(); layer = null;
      document.body.classList.remove('af-drawer-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function open(kind){
      var tpl = document.getElementById(kind === 'tropes' ? 'afDrawerTropes' : 'afDrawerWarnings');
      if (!tpl) return;
      lastFocus = document.activeElement;
      var c = COPY[kind];
      layer = document.createElement('div');
      layer.className = 'af-layer';
      layer.innerHTML =
        '<aside class="af-drawer" role="dialog" aria-modal="true" aria-labelledby="afDrawerTitle">'
        + '<div class="af-drawer-head"><div><span>' + c.eyebrow + '</span>'
        + '<h2 id="afDrawerTitle">' + c.title + '</h2></div>'
        + '<button type="button" class="af-close" aria-label="Close">×</button></div>'
        + '<p class="af-drawer-note">' + c.note + '</p>'
        + '<div class="af-drawer-list"></div>'
        + '<button type="button" class="af-drawer-done">Done</button></aside>';
      layer.querySelector('.af-drawer-list').appendChild(tpl.content.cloneNode(true));
      document.body.appendChild(layer);
      document.body.classList.add('af-drawer-open');
      layer.querySelector('.af-close').focus();

      layer.addEventListener('mousedown', function(e){ if (e.target === layer) close(); });
      layer.querySelector('.af-close').addEventListener('click', close);
      layer.querySelector('.af-drawer-done').addEventListener('click', close);
      if (window.SH && SH.track) SH.track('drawer-open', { kind: kind });
    }
    document.addEventListener('click', function(e){
      var t = e.target.closest ? e.target.closest('[data-drawer]') : null;
      if (t) open(t.getAttribute('data-drawer'));
    });
    document.addEventListener('keydown', function(e){
      if (!layer) return;
      if (e.key === 'Escape'){ e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      // Keep Tab inside the dialog while it's open.
      var f = layer.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    });
  })();
</script>

<script>
  // ── "Finished it?" — per-reader spice rating ─────────────────────────────
  // smutHub has no reviews table, so this drives the rating that DOES exist:
  // book_tags.spice, the same value the search grid and dashboard already read.
  (function(){
    var wrap = document.getElementById('afStars'); if (!wrap) return;
    var note = document.getElementById('afRateNote');
    var KEY = ${JSON.stringify(book.slug)};
    var btns = [].slice.call(wrap.querySelectorAll('button'));
    var sb = null, user = null, mine = 0;

    function client(){
      if (window.SH && window.SH.sb) return window.SH.sb;
      var cfg = window.SMUTHUB_CONFIG || {};
      if (window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_KEY)
        return window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, { auth:{ persistSession:true } });
      return null;
    }
    function paint(){
      btns.forEach(function(b){
        var on = Number(b.dataset.n) <= mine;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(Number(b.dataset.n) === mine));
      });
    }
    async function save(n){
      if (!user){ note.innerHTML = '<a href="/dashboard.html">Log in</a> to save your rating'; return; }
      var res = await sb.from('book_tags').upsert({ book_key: KEY, spice: n }, { onConflict:'user_id,book_key' });
      if (res.error){ note.textContent = 'Could not save'; console.error('spice save', res.error); return; }
      mine = n; paint();
      note.textContent = 'Saved — you rated it ' + n + '/5';
      if (window.SH && SH.track) SH.track('spice-rate', { n: n, where: 'book-page' });
    }
    wrap.addEventListener('click', function(e){
      var b = e.target.closest('button[data-n]'); if (b) save(Number(b.dataset.n));
    });

    (async function init(){
      sb = client(); if (!sb) return;
      try {
        var u = await sb.auth.getUser();
        user = u && u.data ? u.data.user : null;
        if (user){
          var r = await sb.from('book_tags').select('spice').eq('book_key', KEY).maybeSingle();
          if (r.data && r.data.spice){ mine = r.data.spice; paint(); note.textContent = 'You rated it ' + mine + '/5'; }
        } else {
          note.innerHTML = '<a href="/dashboard.html">Log in</a> to save your rating';
        }
      } catch(e){ /* anon — leave the prompt as-is */ }
    })();
  })();
</script>

<script>
  // ── Analytics: how readers reach and use this page ───────────────────────
  // Event reference lives in ANALYTICS.md.
  (function(){
    var SLUG = ${JSON.stringify(book.slug)};

    // Where did this view come from? A click on one of our own rails leaves a
    // hint in sessionStorage — the referrer alone cannot tell "series" from
    // "related", since both are /books/<slug>/ pages. Everything else is
    // derived from the referrer path.
    function source(){
      var hint = null;
      try { hint = sessionStorage.getItem('sh_from'); sessionStorage.removeItem('sh_from'); } catch(_){}
      if (hint) return hint;
      var r = document.referrer;
      if (!r) return 'direct';
      try {
        var u = new URL(r);
        if (u.origin !== location.origin) return 'external';
        var p = u.pathname;
        if (p === '/books/') return 'browse';
        if (p.indexOf('/books/') === 0) return 'book';
        if (p === '/search' || p === '/search.html') return 'search';
        if (p.indexOf('/dashboard') === 0) return 'dashboard';
        if (p.indexOf('/glossary/') === 0) return 'glossary';
        if (p.indexOf('/smuthub-bookcase') === 0) return 'bookshelf';
        if (p === '/' || p.indexOf('/index.html') === 0) return 'home';
        return 'internal';
      } catch(_) { return 'direct'; }
    }
    // auth.js is deferred, so SH may not exist yet during parse. Wait for it,
    // then hand off to SH.trackWhenReady, which additionally queues the event
    // until the external Umami script has loaded — otherwise this fires into a
    // no-op on cold visits and book-open under-reports exactly when it matters.
    function fireOnLoad(name, data){
      if (window.SH && SH.trackWhenReady){ SH.trackWhenReady(name, data); return; }
      var tries = 0;
      var iv = setInterval(function(){
        if (window.SH && SH.trackWhenReady){ clearInterval(iv); SH.trackWhenReady(name, data); }
        else if (++tries > 40) clearInterval(iv);          // give up after ~4s
      }, 100);
    }
    fireOnLoad('book-open', { slug: SLUG, from: source() });

    // Leave a hint for the NEXT page when a rail card is clicked, so the
    // continuation flow (series -> related -> author) can be measured.
    document.addEventListener('click', function(e){
      var card = e.target.closest ? e.target.closest('.af-bcard') : null;
      if (!card) return;
      var sec = card.closest('.af-disc');
      try { sessionStorage.setItem('sh_from', sec ? sec.id.replace('af-', '') : 'book'); } catch(_){}
    });

    // Does "answers first" work? Which of the six questions readers actually
    // pick — and whether the short answer suffices or they always open the
    // full blurb — is what says whether this hierarchy is the right one.
    document.addEventListener('click', function(e){
      var a = e.target.closest ? e.target.closest('.af-ask nav a') : null;
      if (!a) return;
      if (window.SH && SH.track) SH.track('ask-jump', { question: (a.getAttribute('href') || '').replace('#af-', ''), slug: SLUG });
    });
    var blurb = document.querySelector('.af-blurb');
    if (blurb) blurb.addEventListener('toggle', function(){
      if (blurb.open && window.SH && SH.track) SH.track('blurb-expand', { slug: SLUG });
    });
  })();
</script>

${SHARED_FOOTER}`;

  return head + body;
}

// ══════════════════════════════════════════════════════════════════════════
//  /books/ — the browse index
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
  /* This is a BROWSE page, so widen its content to /search's 1180px rather than
     inheriting the 1100px reading width the book DETAIL pages use. Only the
     index's own header + results widen; the shared nav is untouched. */
  .ihead, #results{max-width:1180px}
  /* minmax(200px) then gives exactly 5 across at ~213px — the same cover size
     as /search and the dashboard, so a book looks identical on every browse
     surface. Was minmax(150px) (~6-7 across, noticeably smaller). */
  .bgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:18px;margin-bottom:10px}
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
    canonical: `${SITE}/books/`,
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'All Books',
      url: `${SITE}/books/`,
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

    // ── Analytics ──────────────────────────────────────────────────────────
    // Which filters readers actually reach for tells us which metadata is
    // worth the tagging effort. Debounced on the text field so a typed word
    // is one event, not one per keystroke. See ANALYTICS.md.
    var qTimer = null;
    function trackFilter(type, value){
      if (!value || !(window.SH && SH.track)) return;
      SH.track('browse-filter', { type: type, value: String(value).slice(0, 60) });
    }
    q.addEventListener('input', function(){
      clearTimeout(qTimer);
      qTimer = setTimeout(function(){ trackFilter('text', q.value.trim()); }, 900);
    });
    fTrope.addEventListener('change', function(){ trackFilter('trope', fTrope.value); });
    fMood.addEventListener('change',  function(){ trackFilter('mood',  fMood.value); });
    fSpice.addEventListener('change', function(){ trackFilter('spice', fSpice.value); });
    // Arriving already filtered from a glossary term — proves those CTAs
    // convert. Fired on load, so it goes through trackWhenReady: auth.js is
    // deferred AND the Umami script is external, so a plain track() here would
    // be dropped on most cold visits.
    (function(){
      var t = new URLSearchParams(location.search).get('tag');
      if (!t) return;
      var tries = 0;
      var iv = setInterval(function(){
        if (window.SH && SH.trackWhenReady){ clearInterval(iv); SH.trackWhenReady('browse-tag-arrival', { tag: t }); }
        else if (++tries > 40) clearInterval(iv);
      }, 100);
    })();
    // Hint the book page about where the click came from.
    document.addEventListener('click', function(e){
      if (e.target.closest && e.target.closest('.bcard')){
        try { sessionStorage.setItem('sh_from', 'browse'); } catch(_){}
      }
    });

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
    //   /books/?tag=trope:fated-mates   — from any glossary term page
    //   /books/?q=Sarah%20J.%20Maas     — from a book page's author byline
    //   /books/?trope=…&spice=4         — legacy shape, still honoured
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
const bookUrls = [`  <url><loc>${SITE}/books/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`]
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

console.log(`✓ Wrote ${wrote} book pages → /books/<slug>/`);
console.log(`✓ Wrote the browse index → /books/`);
console.log(`✓ Updated sitemap.xml with ${books.filter(b => b.slug).length} book URLs + /books/`);
console.log(`\nNext: git add book/ sitemap.xml && git commit && git push`);
