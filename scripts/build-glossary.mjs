#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
//  smutHub · glossary build
//
//  Generates the static glossary pages from the Supabase `tags` table:
//    /glossary/index.html                       — A-Z index + category filter + live search
//    /glossary/<category>/<slug>/index.html     — one per glossary-visible tag
//
//  Each per-term page is FULLY SERVER-RENDERED HTML (no SPA, no JS framework)
//  with unique title / meta description / Open Graph / Twitter Card / canonical,
//  and Schema.org `DefinedTerm` structured data — built for SEO from the ground up.
//  Books featured under each term load via a small client-side fetch at runtime
//  so the catalog and glossary stay in sync without rebuilding the site.
//
//  Usage:
//    node scripts/build-glossary.mjs
//
//  Then: git add glossary/ && git commit && git push
//  (Manual local build per the agreed workflow. No CI, no surprises.)
//
//  No dependencies — uses Node's built-in fetch + fs. Reads anon Supabase
//  creds from config.js (public, anon-key only — tags table is public-read).
// ════════════════════════════════════════════════════════════════════════

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GLOSSARY_DIR = path.join(ROOT, 'glossary');
const SITE = 'https://smuthub.ca';
const SITE_NAME = 'smutHub';

// ── Read Supabase creds from the static config.js (anon key — public) ──────
const cfgRaw = await fs.readFile(path.join(ROOT, 'config.js'), 'utf-8');
const SUPABASE_URL = (cfgRaw.match(/SUPABASE_URL\s*:\s*['"]([^'"]+)['"]/) || [])[1];
const SUPABASE_KEY = (cfgRaw.match(/SUPABASE_KEY\s*:\s*['"]([^'"]+)['"]/) || [])[1];
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('✗ Could not parse SUPABASE_URL/SUPABASE_KEY from config.js'); process.exit(1); }

// ── Fetch all glossary entries (description not null AND glossary_visible) ──
async function pgGet(url){
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Accept: 'application/json' } });
  if(!r.ok) throw new Error(`PostgREST ${r.status}: ${await r.text()}`);
  return r.json();
}
// Fetch ALL glossary-visible tags (with OR without description).
//   Tier 1+2: has_page=true AND description → gets a /glossary/<cat>/<slug>/ page
//             AND appears as a card on both the index AND the category landing
//   Tier 3:   has_page=false (often with a brief description) → NO glossary URL,
//             but appears as a card on the category landing (no link)
const tagsURL = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/tags?select=*&glossary_visible=eq.true&order=category,label`;
const allTags = await pgGet(tagsURL);
const tags = allTags.filter(t => (t.has_page !== false) && t.description);
const tier3Tags = allTags.filter(t => !((t.has_page !== false) && t.description));
console.log(`◇ Building ${tags.length} term pages + ${tier3Tags.length} tier-3 cards (no own URL)`);

// Which "category:slug" keys does at least one LIVE book actually carry? The
// "Find books with this …" CTA links into /book/?tag=<key>, and that page
// filters the static catalog — so a CTA for a key no book uses lands on an
// empty grid. (This is common: the glossary defines far more terms than the
// catalog has been tagged with yet, and a few glossary slugs differ from the
// book slug, e.g. kink:praise-kink vs kink:praise.) Gate the CTA on real usage
// so every "Find books" button leads somewhere. The per-term page still lists
// its own books client-side and shows a friendly empty state regardless.
const usedTagKeys = new Set();
// tagKey -> live books carrying it, best first. Used to SERVER-RENDER each
// term's book list. Previously that grid was fetched client-side, which meant
// crawlers saw an empty div: 356 term pages carried zero links to /book/ pages
// and sat at ~155 words, reading as thin content at scale. Rendering at build
// time turns each term into a real landing page for its own query and creates
// thousands of internal links into the catalog.
const booksByTag = new Map();
try {
  const usedBooks = await pgGet(`${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/books?select=slug,title,author,cover_url,spice_level,year,featured,tag_ids&status=eq.live&order=featured.desc,title.asc`);
  for (const b of usedBooks){
    for (const k of (b.tag_ids || [])){
      usedTagKeys.add(k);
      if (!booksByTag.has(k)) booksByTag.set(k, []);
      booksByTag.get(k).push(b);
    }
  }
  console.log(`  · ${usedTagKeys.size} tag keys carried by at least one live book (server-rendering their lists)`);
} catch (e) {
  console.log('  (could not load books — term pages will fall back to the client-side fetch)');
}
// When the usage set is unavailable, don't suppress every CTA — fall back to
// showing them (old behaviour) rather than hiding all of them.
const tagHasBooks = key => usedTagKeys.size === 0 || usedTagKeys.has(key);

// Server-rendered book cards for a term. Mirrors the markup the client-side
// loader produces, so the runtime refresh can replace it seamlessly — but this
// version exists in the HTML, which is what crawlers and no-JS readers get.
const BOOKS_PER_TERM = 12;
function serverBookCards(tagKey){
  const list = (booksByTag.get(tagKey) || []).slice(0, BOOKS_PER_TERM);
  if (!list.length) return `<p class="empty">No books shelved here yet — check back as the catalog grows.</p>`;
  return list.map(b => {
    const cov = b.cover_url
      ? `<img src="${escAttr(b.cover_url)}" alt="${escAttr(b.title)} book cover" loading="lazy">`
      : '';
    return `<a class="card" href="/book/${encodeURIComponent(b.slug)}/">`
      + `<div class="cover">${cov}</div>`
      + `<div class="meta"><div class="t">${esc(b.title)}</div><div class="a">${esc(b.author || '')}</div></div>`
      + `</a>`;
  }).join('');
}

// ── Editorial tag relations (optional; falls back to sibling tags if empty) ──
const tagById = Object.fromEntries(tags.map(t => [t.id, t]));
let relations = [];
try {
  relations = await pgGet(`${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/tag_relations?select=tag_id,related_tag_id,relation_type,strength`);
} catch (e) {
  // tag_relations table not created yet — that's fine, related-terms falls back
  console.log('  (no tag_relations table yet — using sibling-category fallback for related terms)');
}
const relByTag = {};
for (const r of relations) { (relByTag[r.tag_id] = relByTag[r.tag_id] || []).push(r); }
const REL_LABEL = { 'similar':'Similar', 'often-paired':'Often with', 'parent':'Broader', 'child':'Narrower', 'opposite':'Opposite' };

// ── Category display config (label + URL slug + emoji for badges) ─────────
const CATS = {
  'trope':           { label:'Tropes',          emoji:'⚔️', order:1 },
  'mood':            { label:'Moods',           emoji:'🌗', order:2 },
  'vibe':            { label:'Vibes',           emoji:'✨', order:3 },
  'theme':           { label:'Themes',          emoji:'🔭', order:4 },
  'subgenre':        { label:'Subgenres',       emoji:'📚', order:5 },
  'worldbuilding':   { label:'Worldbuilding',   emoji:'🗺️', order:6 },
  'setting':         { label:'Settings',        emoji:'🏰', order:7 },
  // 'time-period' and 'sport' carry live tags and generate term pages, but were
  // missing here — so their category landing pages were never built and all 18
  // of their term pages linked to a 404. Grouped with Settings as the
  // "where and when" block.
  'time-period':     { label:'Time Periods',    emoji:'🕰️', order:8 },
  'sport':           { label:'Sports',          emoji:'🏅', order:9 },
  'mechanics':       { label:'Spice & Door',    emoji:'🌶️', order:10 },
  'format':          { label:'Format',          emoji:'📖', order:11 },
  'pov':             { label:'POV',             emoji:'👁️', order:12 },
  'culture':         { label:'Reader Culture',  emoji:'💬', order:13 },
  'omegaverse':      { label:'Omegaverse',      emoji:'🐺', order:14 },
  'kink':            { label:'Kinks',           emoji:'🔥', order:15 },
  'mc-archetype':    { label:'MC Archetypes',   emoji:'👤', order:16 },
  'li-archetype':    { label:'LI Archetypes',   emoji:'💖', order:17 },
  'representation':  { label:'Representation',  emoji:'🌈', order:18 },
  'warning':         { label:'Content Warnings', emoji:'⚠️', order:19 },
};
const catKey = c => (CATS[c] ? c : 'culture');

// ── Helpers ────────────────────────────────────────────────────────────────
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const escAttr = esc;
const termPath = t => `/glossary/${t.category}/${t.slug}/`;
// "affinity-magic" -> "Affinity Magic". Used to disambiguate two tags that
// share a label inside one category, so their <title>s stay unique.
const humanizeSlug = s => String(s || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const termURL = t => `${SITE}${termPath(t)}`;
const ensureDir = p => fs.mkdir(p, { recursive: true });

// Auto-related: tags that co-occur most with this one across the books table.
// For v1 we lean on manual related_tag_ids if set, else fall back to sibling
// tags within the same category. (Co-occurrence requires aggregation that
// PostgREST won't give us in one call — leaving that for a v2 enhancement
// via a DB function. Sibling-category fallback is plenty for launch.)
function relatedFor(tag){
  // 1. Editorial relations from tag_relations (best) — only those that have a
  //    glossary page (are in the fetched set), strongest first.
  const edits = (relByTag[tag.id] || [])
    .map(r => ({ t: tagById[r.related_tag_id], rel: r.relation_type, strength: r.strength || 5 }))
    .filter(x => x.t)
    .sort((a,b) => b.strength - a.strength)
    .slice(0,8)
    .map(x => ({ ...x.t, _rel: x.rel }));
  if (edits.length) return edits;
  // 2. Manual related_tag_ids[] override (legacy/simple path)
  if (tag.related_tag_ids && tag.related_tag_ids.length){
    return tag.related_tag_ids.map(id => tagById[id]).filter(Boolean).slice(0,6);
  }
  // 3. Fallback: other tags in the same category
  return tags.filter(t => t.category === tag.category && t.id !== tag.id).slice(0,6);
}

// ── Shared shell (header / CSS / footer) ──────────────────────────────────
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
<meta property="og:image" content="${SITE}/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escAttr(page.title)}">
<meta name="twitter:description" content="${escAttr(page.description)}">
<meta name="twitter:image" content="${SITE}/og-image.jpg">
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
  /* shared header */
  .logo{display:inline-flex;align-items:center;font-weight:800;font-size:1.5rem;letter-spacing:-.02em;text-decoration:none;color:var(--cream)}
  .logo .box{background:var(--grad);color:#1a0c10;padding:.05em .42em;border-radius:.42em;margin-left:.12em;box-shadow:0 6px 18px -6px rgba(255,61,118,.7)}
  header{position:sticky;top:0;z-index:50;backdrop-filter:blur(14px);background:rgba(12,7,8,.72);border-bottom:1px solid var(--line)}
  .nav{display:flex;align-items:center;justify-content:space-between;height:72px;gap:12px;flex-wrap:wrap}
  .navlinks{display:flex;gap:18px}
  .navlinks a{color:var(--muted);font-weight:500;font-size:.92rem;text-decoration:none;transition:color .2s}
  .navlinks a.on,.navlinks a:hover{color:var(--cream)}
  @media(max-width:680px){.navlinks{gap:12px;font-size:.85rem}}
  .authbox{display:flex;align-items:center;gap:8px}
  /* footer (slim) */
  footer{border-top:1px solid var(--line);margin-top:48px;padding:32px 0 40px}
  footer .ft{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;color:var(--muted);font-size:.86rem}
  footer a{color:var(--muted);text-decoration:none}
  footer a:hover{color:var(--cream)}
  /* left rail — sticky category nav for inner glossary pages.
     Hidden on mobile (hamburger handles nav); shown ≥900px. Hover/focus opens
     the panel; on touch ≥900px a tap on the strip toggles it via the click
     handler at the bottom of this file. */
  .sh-rail{position:fixed;left:0;top:50%;transform:translateY(-50%);z-index:45;display:none}
  @media(min-width:900px){.sh-rail{display:flex;align-items:center}}
  .sh-rail-strip{display:flex;flex-direction:column;gap:6px;padding:14px 9px;background:rgba(28,19,22,.92);border:1px solid var(--line);border-left:0;border-radius:0 12px 12px 0;backdrop-filter:blur(8px);cursor:pointer;transition:background .15s}
  .sh-rail:hover .sh-rail-strip,.sh-rail.open .sh-rail-strip{background:rgba(40,28,32,.96)}
  .sh-rail-strip i{display:block;width:22px;height:2px;background:var(--muted);border-radius:1px;transition:background .15s,width .15s}
  .sh-rail:hover .sh-rail-strip i,.sh-rail.open .sh-rail-strip i{background:var(--amber)}
  .sh-rail-strip i:nth-child(odd){width:16px}
  .sh-rail-panel{position:absolute;left:100%;top:50%;transform:translate(-12px,-50%);background:var(--ink-2);border:1px solid var(--line);border-radius:14px;padding:14px;min-width:260px;max-height:80vh;overflow-y:auto;opacity:0;pointer-events:none;transition:opacity .15s,transform .15s;box-shadow:0 22px 50px rgba(0,0,0,.55);margin-left:8px}
  /* Invisible bridge across the 8px gap between strip and panel. Without it the
     pointer crosses dead space that belongs to neither element, the rail loses
     :hover mid-reach and the panel snaps shut — which is why the rail felt like
     it only worked on click. The bridge is part of the panel, so travelling it
     keeps the rail hovered. */
  .sh-rail-panel::before{content:"";position:absolute;left:-16px;top:0;bottom:0;width:16px}
  /* Opening is driven by the .open class (JS hover-intent) rather than raw
     :hover, so a pointer merely sweeping past the strip doesn't fling the panel
     open. :focus-within keeps the keyboard path working with no JS. */
  .sh-rail.open .sh-rail-panel,.sh-rail:focus-within .sh-rail-panel{opacity:1;pointer-events:auto;transform:translate(0,-50%)}
  .sh-rail-panel h3{font-size:.68rem;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:10px;padding:0 8px}
  .sh-rail-panel a{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:7px 10px;border-radius:9px;color:var(--cream);text-decoration:none;font-size:.93rem;line-height:1.2}
  .sh-rail-panel a:hover{background:var(--panel)}
  .sh-rail-panel a.active{background:var(--panel);color:var(--amber)}
  .sh-rail-panel a .lbl{display:flex;align-items:center;gap:8px}
  .sh-rail-panel a .ct{color:var(--muted);font-size:.78rem;font-variant-numeric:tabular-nums}
  .sh-rail-panel hr{border:0;border-top:1px solid var(--line);margin:8px 0}
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
      <a href="/glossary/" class="on">Glossary</a>
    </nav>
    <div class="authbox" id="authbox"></div>
  </div>
</header>
`;

// Group tags by category once — drives the rail panel + index ordering.
// Page-eligible (Tier 1+2 only — what appears on the main /glossary/ index).
const byCatPage = {};
for (const t of tags){ const k = catKey(t.category); (byCatPage[k] = byCatPage[k] || []).push(t); }
// All visible (page + tier-3) — used only for category-page totals + which categories
// to render category landings for.
const byCatAll = {};
for (const t of allTags){ const k = catKey(t.category); (byCatAll[k] = byCatAll[k] || []).push(t); }
// Tier-3 (no page) tags, grouped by category for inline rendering on category landings.
const tier3ByCat = {};
for (const t of tier3Tags){ const k = catKey(t.category); (tier3ByCat[k] = tier3ByCat[k] || []).push(t); }

// Left rail: sticky category-navigator on the left edge of glossary pages.
// `activeCat` highlights the row for the page you're on. Counts only page-eligible
// tags (Tier 1+2) — matches what's clickable from the index.
function renderRail(activeCat){
  const ordered = Object.entries(CATS)
    .filter(([k]) => (byCatPage[k] || []).length > 0)
    .sort((a,b) => a[1].order - b[1].order);
  const items = ordered.map(([key, cfg]) => {
    const n = (byCatPage[key] || []).length;
    const cls = key === activeCat ? ' class="active"' : '';
    return `<a href="/glossary/${key}/"${cls}><span class="lbl">${cfg.emoji} ${esc(cfg.label)}</span><span class="ct">${n}</span></a>`;
  }).join('');
  return `<aside class="sh-rail" id="shRail" tabindex="0" aria-label="Glossary categories">
    <div class="sh-rail-strip" role="button" aria-expanded="false" aria-controls="shRailPanel" aria-label="Open glossary categories">
      <i></i><i></i><i></i><i></i><i></i>
    </div>
    <div class="sh-rail-panel" id="shRailPanel">
      <h3>Browse glossary</h3>
      <a href="/glossary/"${!activeCat ? ' class="active"' : ''}><span class="lbl">📖 All terms</span><span class="ct">${tags.length}</span></a>
      <hr>
      ${items}
    </div>
  </aside>`;
}

// Rail behaviour: hover-intent open/close, click toggle (the only path that
// works on a touch screen wide enough to show the rail), full keyboard support,
// and — on the glossary index only — same-page anchoring instead of navigation.
const RAIL_SCRIPT = `<script>(function(){
  var rail = document.getElementById('shRail'); if(!rail) return;
  var strip = rail.querySelector('.sh-rail-strip');
  var openT, closeT;

  function setOpen(on){
    rail.classList.toggle('open', on);
    strip.setAttribute('aria-expanded', on ? 'true' : 'false');
  }
  // Asymmetric delays: a short one before opening so a pointer travelling past
  // the strip doesn't trigger it, and a longer one before closing so the
  // diagonal move from strip into the panel is forgiven.
  function hoverOpen(){ clearTimeout(closeT); openT = setTimeout(function(){ setOpen(true); }, 120); }
  function hoverClose(){ clearTimeout(openT); closeT = setTimeout(function(){ setOpen(false); }, 250); }
  rail.addEventListener('mouseenter', hoverOpen);
  rail.addEventListener('mouseleave', hoverClose);

  // Click still toggles. Required on touch devices >=900px (no hover exists
  // there at all) and preferred by readers who don't want hover-triggered UI.
  strip.addEventListener('click', function(e){
    e.stopPropagation(); clearTimeout(openT); clearTimeout(closeT);
    setOpen(!rail.classList.contains('open'));
  });

  // Keyboard: rail is focusable; focus anywhere inside holds it open, Esc closes.
  rail.addEventListener('focusin', function(){ clearTimeout(closeT); setOpen(true); });
  rail.addEventListener('focusout', function(){ if(!rail.contains(document.activeElement)) setOpen(false); });
  rail.addEventListener('keydown', function(e){ if(e.key === 'Escape'){ setOpen(false); strip.focus(); } });
  document.addEventListener('click', function(e){ if(!rail.contains(e.target)) setOpen(false); });

  // ── Same-page anchoring (glossary index only) ────────────────────────────
  // The index already renders every category as a .catblock, so following
  // /glossary/<cat>/ from here would be a full page load to reach content
  // that is already on screen. Where the matching block exists, scroll to it
  // instead. On inner category pages no block matches and every link stays
  // ordinary navigation — so the markup is identical and crawlable either way.
  var links = [].slice.call(rail.querySelectorAll('.sh-rail-panel a[href^="/glossary/"]'));
  var targets = [];
  links.forEach(function(a){
    var m = a.getAttribute('href').match(/^\\/glossary\\/([^/]+)\\/$/);
    var block = m && document.getElementById('cat-' + m[1]);
    if(!block) return;
    targets.push({ link:a, block:block });
    a.addEventListener('click', function(e){
      // Never hijack modified clicks — cmd/ctrl/shift/middle must still open a tab.
      if(e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      e.preventDefault();
      var startY = window.scrollY;
      block.scrollIntoView({ behavior:'smooth', block:'start' });
      // Safety net: some renderers (and reduced-motion setups) treat a smooth
      // scroll request as a no-op rather than falling back to an instant one.
      // Since this click has already been preventDefault'ed, that would leave
      // the reader with a dead link. If nothing moved, jump outright.
      setTimeout(function(){
        if(Math.abs(window.scrollY - startY) < 4) block.scrollIntoView({ block:'start' });
      }, 400);
      history.replaceState(null, '', '#cat-' + m[1]);
      setOpen(false);
    });
  });

  // Scroll-spy so the rail reflects the section actually being read.
  // Deliberately a rAF-throttled scroll listener rather than an
  // IntersectionObserver: this is ~17 getBoundingClientRect calls at most once
  // per frame, and it behaves the same everywhere. Some embedded renderers
  // never deliver IO callbacks at all, which would silently kill the highlight
  // with nothing in the console to explain it.
  if(targets.length){
    var allTerms = rail.querySelector('.sh-rail-panel a[href="/glossary/"]');
    var ticking = false;
    function syncSpy(){
      ticking = false;
      // The active section is the last one whose heading has crossed a line
      // just below the sticky header. A fixed offset rather than a percentage
      // of the viewport: a percentage sits too far down the page and overshoots
      // short categories, so jumping to a 5-term section would highlight
      // whichever longer section happened to follow it. Blocks are in document
      // order, so the first one starting below the line ends the search.
      var line = 140, current = null;
      for(var i = 0; i < targets.length; i++){
        if(targets[i].block.getBoundingClientRect().top <= line) current = targets[i];
        else break;
      }
      targets.forEach(function(t){ t.link.classList.toggle('active', t === current); });
      // Nothing has scrolled past yet → the reader is still at the top.
      if(allTerms) allTerms.classList.toggle('active', !current);
    }
    // Throttled with a timer rather than requestAnimationFrame so the highlight
    // still updates in contexts that don't paint frames on a normal schedule.
    window.addEventListener('scroll', function(){
      if(ticking) return;
      ticking = true;
      setTimeout(syncSpy, 80);
    }, { passive:true });
    syncSpy();
  }
})();</script>`;

const SHARED_FOOTER = `
<footer>
  <div class="wrap ft">
    <span>© ${new Date().getFullYear()} smutHub · Romantasy, decoded.</span>
    <span><a href="/book/">All Books</a> · <a href="/glossary/">Glossary</a> · <a href="/sitemap.html">Sitemap</a></span>
  </div>
</footer>
</body></html>
`;

// ══════════════════════════════════════════════════════════════════════════
//  Per-term page
// ══════════════════════════════════════════════════════════════════════════
function renderTermPage(tag){
  const cat = CATS[catKey(tag.category)];
  const tagKey = `${tag.category}:${tag.slug}`;
  const related = relatedFor(tag);

  // Two tags can share a label within a category (e.g. worldbuilding has two
  // rows both labelled "Magic System"), which would ship duplicate <title>s.
  // Fall back to the slug to keep every title unique.
  const dupLabel = tags.some(t => t !== tag && t.category === tag.category && t.label === tag.label);
  const titleName = dupLabel ? `${tag.label} (${humanizeSlug(tag.slug)})` : tag.label;
  const seoTitle = `${titleName} — ${cat.label.replace(/s$/,'')} Guide | ${SITE_NAME}`;

  // Short definitions made for thin, low-value snippets. Append what the page
  // actually offers so the description earns its place in a result.
  const bookCount = (booksByTag.get(tagKey) || []).length;
  const metaDesc = (() => {
    const base = (tag.description || '').trim();
    const suffix = bookCount
      ? ` See ${bookCount} romantasy book${bookCount === 1 ? '' : 's'} tagged ${tag.label.toLowerCase()} on smutHub.`
      : ` A ${cat.label.replace(/s$/,'').toLowerCase()} term in the smutHub romantasy glossary.`;
    return (base.length < 90 ? base + suffix : base).slice(0, 158);
  })();

  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "DefinedTerm",
        name: tag.label,
        description: tag.description,
        inDefinedTermSet: { "@type":"DefinedTermSet", name:"smutHub Romantasy Glossary", url: `${SITE}/glossary/` },
        url: termURL(tag),
        ...(tag.also_known_as && tag.also_known_as.length ? { alternateName: tag.also_known_as } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Glossary", item: `${SITE}/glossary/` },
          { "@type": "ListItem", position: 3, name: cat.label, item: `${SITE}/glossary/${catKey(tag.category)}/` },
          { "@type": "ListItem", position: 4, name: tag.label, item: termURL(tag) },
        ],
      },
    ],
  };

  const extraCSS = `<style>
    .crumb{padding:18px 0 0;color:var(--muted);font-size:.85rem}
    .crumb a{color:var(--muted);text-decoration:none}.crumb a:hover{color:var(--cream)}
    .hero{padding:24px 0 28px;border-bottom:1px solid var(--line);margin-bottom:28px}
    .badge{display:inline-block;background:var(--panel);border:1px solid var(--line);border-radius:99px;padding:.18em .8em;font-size:.78rem;font-weight:700;letter-spacing:.06em;color:var(--amber);text-transform:uppercase;margin-bottom:14px}
    h1{font-family:'Fraunces',serif;font-weight:600;font-size:clamp(2rem,5vw,3.3rem);letter-spacing:-.02em;line-height:1.05}
    .tagline{margin-top:14px;font-family:'Fraunces',serif;font-style:italic;font-weight:400;font-size:clamp(1.05rem,2vw,1.35rem);color:transparent;background:var(--grad);-webkit-background-clip:text;background-clip:text;max-width:46ch}
    .defn{margin-top:18px;font-size:1.08rem;max-width:62ch}
    .cta{display:inline-block;margin-top:22px;background:var(--grad);color:#1a0c10;font-weight:800;padding:.65em 1.4em;border-radius:99px;text-decoration:none;font-size:.95rem}
    .cta:hover{transform:translateY(-1px)}
    .aka{margin-top:18px;color:var(--muted);font-size:.86rem}
    .aka b{color:var(--cream);font-weight:600}
    section.detail{padding:14px 0}
    section.detail h2{font-family:'Fraunces',serif;font-weight:500;font-size:1.45rem;margin-bottom:10px}
    section.detail p{max-width:65ch;color:var(--cream)}
    section.detail.muted p{color:var(--muted)}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;padding:14px 0}
    @media(max-width:600px){.grid{grid-template-columns:repeat(2,1fr);gap:10px}}
    .card{background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow:hidden;text-decoration:none;color:inherit;display:flex;flex-direction:column;height:100%}
    .cover{aspect-ratio:3/4;position:relative;background:linear-gradient(160deg,#3a0d2a,#7a1238);overflow:hidden}
    .cover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .meta{padding:10px 12px 12px}
    .meta .t{font-family:'Fraunces',serif;font-weight:500;line-height:1.2;font-size:.96rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:calc(1.2em * 2)}
    .meta .a{color:var(--muted);font-size:.78rem;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .relgrid{display:flex;flex-wrap:wrap;gap:8px;padding-top:6px}
    .reltag{display:inline-block;background:var(--panel);border:1px solid var(--line);border-radius:99px;padding:.35em .85em;font-size:.85rem;text-decoration:none;color:var(--cream)}
    .reltag:hover{border-color:var(--rose);color:var(--cream)}
    .reltag .c{color:var(--muted);font-size:.72rem;margin-right:5px;text-transform:uppercase;letter-spacing:.06em}
    .empty{color:var(--muted);font-style:italic;font-size:.92rem;padding:8px 0}
  </style>`;

  const head = SHARED_HEAD({
    title: seoTitle,
    description: metaDesc,
    canonical: termURL(tag),
    ogType: 'article',
    jsonld,
    extraCSS,
  });

  // Body — progressive disclosure: 5-second answer above, depth below
  const body = `<body>
${SHARED_HEADER.replace('class="on"','')
              .replace('href="/glossary/"','href="/glossary/" class="on"')}
${renderRail(catKey(tag.category))}

<div class="wrap">
  <nav class="crumb"><a href="/glossary/">Glossary</a> / <a href="/glossary/${tag.category}/">${esc(cat.label)}</a> / <span>${esc(tag.label)}</span></nav>

  <section class="hero">
    <span class="badge">${cat.emoji} ${esc(cat.label.replace(/s$/,''))}</span>
    <h1>${esc(tag.label)}</h1>
    ${tag.voice_tagline ? `<p class="tagline">${esc(tag.voice_tagline)}</p>` : ''}
    <p class="defn">${esc(tag.description)}</p>
    ${tag.also_known_as && tag.also_known_as.length ? `<p class="aka"><b>Also known as:</b> ${tag.also_known_as.map(esc).join(' · ')}</p>` : ''}
    ${tag.is_filterable && tagHasBooks(tag.category + ':' + tag.slug) ? `<a class="cta" href="/book/?tag=${encodeURIComponent(tag.category + ':' + tag.slug)}">Find books with this ${esc(cat.label.replace(/s$/,'').toLowerCase())} →</a>` : ''}
  </section>

  ${tag.why_it_works ? `<section class="detail">
    <h2>Why readers love it</h2>
    <p>${esc(tag.why_it_works)}</p>
  </section>` : ''}

  ${tag.beginner_blurb ? `<section class="detail muted">
    <h2>New to romantasy?</h2>
    <p>${esc(tag.beginner_blurb)}</p>
  </section>` : ''}

  <section class="detail" id="books">
    <h2>Books featuring this ${esc(cat.label.replace(/s$/,'').toLowerCase())}</h2>
    <div class="grid" id="bookGrid">${serverBookCards(tagKey)}</div>
  </section>

  ${tag.origin_note ? `<section class="detail muted">
    <h2>Where the term comes from</h2>
    <p>${esc(tag.origin_note)}</p>
  </section>` : ''}

  ${related.length ? `<section class="detail">
    <h2>Related terms</h2>
    <div class="relgrid">
      ${related.map(r => `<a class="reltag" href="${escAttr(termPath(r))}"><span class="c">${esc(r._rel ? (REL_LABEL[r._rel] || r._rel) : CATS[catKey(r.category)].label.replace(/s$/,''))}</span>${esc(r.label)}</a>`).join('')}
    </div>
  </section>` : ''}
</div>

<script>
  // Load books for this tag from the catalog at runtime — keeps the glossary
  // and the catalog in sync without rebuilding the site every time a book is
  // added. Anonymous Supabase client; the public RLS policy lets us read live books.
  (async function loadBooks(){
    const tagKey = ${JSON.stringify(tagKey)};
    const grid = document.getElementById('bookGrid');
    function escH(s){ return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    let sb = window.SH && window.SH.sb;
    if(!sb){
      const cfg = window.SMUTHUB_CONFIG || {};
      if(window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_KEY){
        sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, { auth:{ persistSession:false } });
      }
    }
    // The grid is already SERVER-RENDERED at build time; this fetch only
    // refreshes it so books added since the last build appear without a
    // rebuild. Every failure path therefore leaves the existing markup alone
    // rather than replacing good content with an error message.
    if(!sb) return;
    try{
      const { data, error } = await sb.from('books')
        .select('slug,title,author,cover_url,spice_level,year')
        .eq('status','live').contains('tag_ids', [tagKey])
        .order('featured', { ascending:false }).limit(12);
      if(error) throw error;
      if(!data || !data.length) return;   // keep whatever was built in
      grid.innerHTML = data.map(function(b){
        const cov = b.cover_url ? '<img src="'+escH(b.cover_url)+'" alt="'+escH(b.title)+' book cover" loading="lazy">' : '';
        return '<a class="card" href="/book/'+encodeURIComponent(b.slug)+'/">'
          +    '<div class="cover">'+cov+'</div>'
          +    '<div class="meta"><div class="t">'+escH(b.title)+'</div><div class="a">'+escH(b.author||'')+'</div></div>'
          +    '</a>';
      }).join('');
    }catch(e){ console.error(e); /* keep the server-rendered cards */ }
  })();
</script>

${RAIL_SCRIPT}
${SHARED_FOOTER}`;

  return head + body;
}

// ══════════════════════════════════════════════════════════════════════════
//  Glossary index page
// ══════════════════════════════════════════════════════════════════════════
function renderIndexPage(){
  const ordered = Object.entries(CATS).sort((a,b)=> a[1].order - b[1].order);

  const jsonld = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: "smutHub Romantasy Glossary",
    description: "An encyclopedia of romantasy tropes, moods, archetypes, reader culture, and worldbuilding terms — every entry connected to live books from the smutHub catalog.",
    url: `${SITE}/glossary/`,
    hasDefinedTerm: tags.slice(0,50).map(t => ({
      "@type":"DefinedTerm", name: t.label, url: termURL(t), description: (t.description||'').slice(0,200)
    }))
  };

  const head = SHARED_HEAD({
    title: 'Romantasy Glossary & Encyclopedia | smutHub',
    description: 'Romantasy decoded: every trope, archetype, spice scale, BookTok shorthand and worldbuilding term — connected to real books you can shelf. Welcome to the cheekiest reference in the romantasy internet.',
    canonical: `${SITE}/glossary/`,
    jsonld,
    extraCSS: `<style>
      .head{padding:36px 0 14px}
      h1{font-family:'Fraunces',serif;font-weight:600;font-size:clamp(2.2rem,5vw,3.6rem);line-height:1.05;letter-spacing:-.02em}
      h1 em{font-style:italic;font-weight:400;color:transparent;background:var(--grad);-webkit-background-clip:text;background-clip:text}
      .sub{color:var(--muted);max-width:62ch;margin-top:14px;font-size:1.04rem}
      .tools{display:flex;gap:10px;flex-wrap:wrap;margin:24px 0 8px;align-items:center}
      .tools input{flex:1;min-width:200px;background:var(--panel);border:1px solid var(--line);color:var(--cream);font-family:inherit;font-size:1rem;border-radius:99px;padding:.7em 1.1em;outline:none}
      .tools input:focus{border-color:var(--rose)}
      .tools select{background:var(--panel);border:1px solid var(--line);color:var(--cream);font-family:inherit;font-size:.92rem;border-radius:99px;padding:.6em 1em;cursor:pointer}
      .meter{color:var(--muted);font-size:.86rem;margin:6px 0 18px}
      /* scroll-margin-top clears the 72px sticky header when the left rail
         anchors to a category, so the heading isn't hidden underneath it. */
      .catblock{padding:18px 0;border-top:1px solid var(--line);scroll-margin-top:88px}
      .catblock:first-of-type{border-top:0}
      .catblock h2{font-family:'Fraunces',serif;font-weight:600;font-size:1.3rem;margin-bottom:10px}
      .catblock h2 .ce{margin-right:6px}
      .catblock .count{color:var(--muted);font-weight:400;font-size:.84rem;margin-left:6px}
      .terms{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px}
      .term{display:block;background:var(--ink-2);border:1px solid var(--line);border-radius:12px;padding:12px 14px;text-decoration:none;color:inherit;transition:border-color .12s,transform .12s}
      .term:hover{border-color:var(--rose);transform:translateY(-1px)}
      .term .n{font-family:'Fraunces',serif;font-weight:500;font-size:1.05rem;line-height:1.2}
      .term .d{color:var(--muted);font-size:.84rem;margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .empty{color:var(--muted);font-style:italic;padding:8px 0}
      .see-more{margin-top:14px;padding:0 6px}
      .see-more a{color:var(--muted);font-size:.84rem;text-decoration:none;font-style:italic}
      .see-more a:hover{color:var(--amber)}
    </style>`
  });

  // Group tags by category
  const byCat = {};
  for (const t of tags){
    const c = catKey(t.category);
    (byCat[c] = byCat[c] || []).push(t);
  }

  // Index page shows page-eligible (Tier 1+2) terms only — no inline tier-3 lists.
  // Tier-3 filter-only tags live on their category landing page instead.
  const catSections = ordered.map(([key, cfg]) => {
    const items = (byCat[key] || []);
    if(!items.length) return '';
    const tier3Count = (tier3ByCat[key] || []).length;
    // id is the scroll target for the left rail's same-page anchoring.
    return `<div class="catblock" id="cat-${esc(key)}" data-cat="${esc(key)}">
      <h2><span class="ce">${cfg.emoji}</span>${esc(cfg.label)}<span class="count">${items.length}</span></h2>
      <div class="terms">
        ${items.map(t => `<a class="term" href="${escAttr(termPath(t))}" data-label="${escAttr((t.label+' '+(t.also_known_as||[]).join(' ')).toLowerCase())}">
          <div class="n">${esc(t.label)}</div>
          <div class="d">${esc(t.description||'')}</div>
        </a>`).join('')}
      </div>
      ${tier3Count ? `<p class="see-more"><a href="/glossary/${esc(key)}/">+ ${tier3Count} more filterable in ${esc(cfg.label.toLowerCase())} →</a></p>` : ''}
    </div>`;
  }).join('');

  const catOptions = ordered.map(([key, cfg]) => `<option value="${esc(key)}">${cfg.emoji} ${esc(cfg.label)}</option>`).join('');

  const body = `<body>
${SHARED_HEADER}
${renderRail(null)}

<div class="wrap head">
  <h1>The romantasy <em>encyclopedia</em>.</h1>
  <p class="sub">Romantasy is overwhelming — tropes, moods, content warnings, abbreviations, reading orders, BookTok shorthand. This is your decoder. Every term connects to real books you can shelf, so you don''t just learn what a "shadow daddy" is — you find five of them.</p>

  <div class="tools">
    <input id="q" type="search" placeholder="Search any term, alias, or definition…" autocomplete="off">
    <select id="catFilter"><option value="">All categories</option>${catOptions}</select>
  </div>
  <div class="meter" id="meter">${tags.length} terms · A–Z within each category</div>
</div>

<div class="wrap">
  ${catSections}
</div>

<script>
  // Live filter — pure DOM, no framework.
  (function(){
    const q = document.getElementById('q');
    const cf = document.getElementById('catFilter');
    const meter = document.getElementById('meter');
    const blocks = [...document.querySelectorAll('.catblock')];
    const filter = ()=>{
      const term = q.value.trim().toLowerCase();
      const cat = cf.value;
      let shown = 0;
      for(const block of blocks){
        const c = block.dataset.cat;
        const inCat = !cat || c === cat;
        let any = false;
        for(const t of block.querySelectorAll('.term')){
          const lbl = t.dataset.label || '';
          const def = t.querySelector('.d').textContent.toLowerCase();
          const match = !term || lbl.includes(term) || def.includes(term);
          const show = inCat && match;
          t.style.display = show ? '' : 'none';
          if(show){ any = true; shown++; }
        }
        block.style.display = any ? '' : 'none';
      }
      meter.textContent = shown + ' term' + (shown===1?'':'s') + (term || cat ? ' matching' : '') + ' · A–Z within each category';
    };
    q.addEventListener('input', filter);
    cf.addEventListener('change', filter);
  })();
</script>

${RAIL_SCRIPT}
${SHARED_FOOTER}`;

  return head + body;
}

// ══════════════════════════════════════════════════════════════════════════
//  Category index pages (/glossary/<category>/) — a thin landing per category
// ══════════════════════════════════════════════════════════════════════════
function renderCategoryPage(catSlug, items){
  const cfg = CATS[catKey(catSlug)];
  const head = SHARED_HEAD({
    title: `${cfg.label} — Romantasy Glossary | ${SITE_NAME}`,
    description: `Every ${cfg.label.toLowerCase()} term in romantasy, decoded — with the books that feature them.`,
    canonical: `${SITE}/glossary/${catSlug}/`,
    extraCSS: `<style>
      .head{padding:30px 0 12px}
      h1{font-family:'Fraunces',serif;font-weight:600;font-size:clamp(2rem,4.5vw,3rem)}
      h1 em{font-style:italic;font-weight:400;color:transparent;background:var(--grad);-webkit-background-clip:text;background-clip:text}
      .sub{color:var(--muted);margin-top:10px}
      .crumb{padding:18px 0 0;color:var(--muted);font-size:.86rem}
      .crumb a{color:var(--muted);text-decoration:none}.crumb a:hover{color:var(--cream)}
      .terms{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;padding:18px 0 40px}
      .term{display:block;background:var(--ink-2);border:1px solid var(--line);border-radius:12px;padding:14px 16px;text-decoration:none;color:inherit;transition:border-color .12s,transform .12s}
      .term:hover{border-color:var(--rose);transform:translateY(-1px)}
      .term .n{font-family:'Fraunces',serif;font-weight:500;font-size:1.1rem}
      .term .d{color:var(--muted);font-size:.86rem;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      /* Tier-3 cards: visually identical to .term but non-interactive (no URL). */
      div.term{cursor:default}
      div.term:hover{border-color:var(--line);transform:none}
    </style>`
  });
  const tier3 = (tier3ByCat[catKey(catSlug)] || []);
  // Merge page-eligible + tier-3 into one alphabetized card list.
  // <a> for page-eligible (links to /glossary/<cat>/<slug>/), <div> for tier-3 (no URL).
  const merged = [
    ...items.map(t => ({...t, _href: termPath(t)})),
    ...tier3.map(t => ({...t, _href: null})),
  ].sort((a,b) => (a.label||'').localeCompare(b.label||''));
  const total = merged.length;
  const body = `<body>${SHARED_HEADER}
${renderRail(catSlug)}
<div class="wrap">
  <nav class="crumb"><a href="/glossary/">Glossary</a> / <span>${esc(cfg.label)}</span></nav>
  <div class="head">
    <h1>${cfg.emoji} <em>${esc(cfg.label)}</em></h1>
    <p class="sub">${total} term${total===1?'':'s'} in this category.</p>
  </div>
  <div class="terms">
    ${merged.map(t => t._href
      ? `<a class="term" href="${escAttr(t._href)}">
          <div class="n">${esc(t.label)}</div>
          <div class="d">${esc(t.description||'')}</div>
        </a>`
      : `<div class="term">
          <div class="n">${esc(t.label)}</div>
          <div class="d">${esc(t.description||'')}</div>
        </div>`
    ).join('')}
  </div>
</div>
${RAIL_SCRIPT}
${SHARED_FOOTER}`;
  return head + body;
}

// ══════════════════════════════════════════════════════════════════════════
//  Write everything
// ══════════════════════════════════════════════════════════════════════════
await fs.rm(GLOSSARY_DIR, { recursive: true, force: true });
await ensureDir(GLOSSARY_DIR);

// Per-term pages
const byCat = {};
for (const t of tags){ (byCat[catKey(t.category)] = byCat[catKey(t.category)] || []).push(t); }
let wrote = 0;
for (const t of tags){
  const dir = path.join(GLOSSARY_DIR, t.category, t.slug);
  await ensureDir(dir);
  await fs.writeFile(path.join(dir, 'index.html'), renderTermPage(t));
  wrote++;
}
// Category landing pages — render every category that has ANY tags (page-eligible
// OR tier-3 only). renderCategoryPage handles the tier-3 inline block from the
// global tier3ByCat lookup, so a category with only filter-only tags still gets a page.
const allCategoriesWithTags = new Set([...Object.keys(byCat), ...Object.keys(tier3ByCat)]);
for (const cat of allCategoriesWithTags){
  const items = byCat[cat] || [];
  const dir = path.join(GLOSSARY_DIR, cat);
  await ensureDir(dir);
  await fs.writeFile(path.join(dir, 'index.html'), renderCategoryPage(cat, items));
}
// Top-level index
await fs.writeFile(path.join(GLOSSARY_DIR, 'index.html'), renderIndexPage());

// ── Update sitemap.xml — replace the glossary block in place ───────────────
const sitemapPath = path.join(ROOT, 'sitemap.xml');
let sitemap = await fs.readFile(sitemapPath, 'utf-8');
const start = '<!-- GLOSSARY-AUTO-START -->';
const end = '<!-- GLOSSARY-AUTO-END -->';
const today = new Date().toISOString().slice(0, 10);
const glossaryUrls =
  `  <url><loc>${SITE}/glossary/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n` +
  [...allCategoriesWithTags].map(c =>
    `  <url><loc>${SITE}/glossary/${c}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`
  ).join('\n') + '\n' +
  tags.map(t =>
    `  <url><loc>${termURL(t)}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`
  ).join('\n');
const newBlock = `${start}\n${glossaryUrls}\n  ${end}`;

const si = sitemap.indexOf(start);
const ei = sitemap.indexOf(end);
if (si >= 0 && ei >= 0 && ei > si) {
  // replace existing block (including the markers)
  sitemap = sitemap.substring(0, si) + newBlock + sitemap.substring(ei + end.length);
} else {
  // first run — insert before </urlset>
  sitemap = sitemap.replace('</urlset>', `  ${newBlock}\n</urlset>`);
}
await fs.writeFile(sitemapPath, sitemap);

console.log(`✓ Wrote ${wrote} term pages + ${allCategoriesWithTags.size} category pages + index (+ ${tier3Tags.length} tier-3 tags listed inline, no own pages)`);
console.log(`✓ Updated sitemap.xml with ${tags.length + allCategoriesWithTags.size + 1} URLs`);
console.log(`\nNext: git add glossary/ sitemap.xml && git commit && git push`);
