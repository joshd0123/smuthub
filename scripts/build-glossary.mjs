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
const tagsURL = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/tags?select=*&description=not.is.null&glossary_visible=eq.true&order=category,label`;
const tags = await pgGet(tagsURL);
console.log(`◇ Building ${tags.length} glossary entries`);

// ── Category display config (label + URL slug + emoji for badges) ─────────
const CATS = {
  'trope':           { label:'Tropes',          emoji:'⚔️', order:1 },
  'mood':            { label:'Moods',           emoji:'🌗', order:2 },
  'vibe':            { label:'Vibes',           emoji:'✨', order:3 },
  'theme':           { label:'Themes',          emoji:'🔭', order:4 },
  'subgenre':        { label:'Subgenres',       emoji:'📚', order:5 },
  'setting':         { label:'Settings',        emoji:'🏰', order:6 },
  'mechanics':       { label:'Spice & Door',    emoji:'🌶️', order:7 },
  'format':          { label:'Format & POV',    emoji:'📖', order:8 },
  'culture':         { label:'Reader Culture',  emoji:'💬', order:9 },
  'omegaverse':      { label:'Omegaverse',      emoji:'🐺', order:10 },
  'kink':            { label:'Kinks',           emoji:'🔥', order:11 },
  'mc-archetype':    { label:'MC Archetypes',   emoji:'👤', order:12 },
  'li-archetype':    { label:'LI Archetypes',   emoji:'👁️', order:13 },
  'representation':  { label:'Representation',  emoji:'🌈', order:14 },
  'warning':         { label:'Content Warnings', emoji:'⚠️', order:15 },
};
const catKey = c => (CATS[c] ? c : 'culture');

// ── Helpers ────────────────────────────────────────────────────────────────
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const escAttr = esc;
const termPath = t => `/glossary/${t.category}/${t.slug}/`;
const termURL = t => `${SITE}${termPath(t)}`;
const ensureDir = p => fs.mkdir(p, { recursive: true });

// Auto-related: tags that co-occur most with this one across the books table.
// For v1 we lean on manual related_tag_ids if set, else fall back to sibling
// tags within the same category. (Co-occurrence requires aggregation that
// PostgREST won't give us in one call — leaving that for a v2 enhancement
// via a DB function. Sibling-category fallback is plenty for launch.)
function relatedFor(tag){
  if (tag.related_tag_ids && tag.related_tag_ids.length){
    return tag.related_tag_ids.map(id => tags.find(t => t.id === id)).filter(Boolean).slice(0,6);
  }
  return tags
    .filter(t => t.category === tag.category && t.id !== tag.id)
    .slice(0,6);
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
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escAttr(page.title)}">
<meta name="twitter:description" content="${escAttr(page.description)}">
<meta name="twitter:image" content="${SITE}/og-image.png">
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
</style>
${page.extraCSS || ''}
</head>`;

const SHARED_HEADER = `
<header>
  <div class="nav wrap">
    <a href="/" class="logo">smut<span class="box">Hub</span></a>
    <nav class="navlinks">
      <a href="/dashboard.html">Dashboard</a>
      <a href="/smuthub-app.html">Search</a>
      <a href="/smuthub-bookcase.html">My Bookshelf</a>
      <a href="/glossary/" class="on">Glossary</a>
    </nav>
    <div class="authbox" id="authbox"></div>
  </div>
</header>
`;

const SHARED_FOOTER = `
<footer>
  <div class="wrap ft">
    <span>© ${new Date().getFullYear()} smutHub · Romantasy, decoded.</span>
    <span><a href="/glossary/">Glossary</a> · <a href="/smuthub-app.html">Search</a> · <a href="/sitemap.html">Sitemap</a></span>
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

  const seoTitle = `${tag.label} — ${cat.label.replace(/s$/,'')} Guide | ${SITE_NAME}`;
  const metaDesc = (tag.description || '').slice(0, 158);

  const jsonld = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: tag.label,
    description: tag.description,
    inDefinedTermSet: { "@type":"DefinedTermSet", name:"smutHub Romantasy Glossary", url: `${SITE}/glossary/` },
    url: termURL(tag),
    ...(tag.also_known_as && tag.also_known_as.length ? { alternateName: tag.also_known_as } : {}),
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

<div class="wrap">
  <nav class="crumb"><a href="/glossary/">Glossary</a> / <a href="/glossary/${tag.category}/">${esc(cat.label)}</a> / <span>${esc(tag.label)}</span></nav>

  <section class="hero">
    <span class="badge">${cat.emoji} ${esc(cat.label.replace(/s$/,''))}</span>
    <h1>${esc(tag.label)}</h1>
    ${tag.voice_tagline ? `<p class="tagline">${esc(tag.voice_tagline)}</p>` : ''}
    <p class="defn">${esc(tag.description)}</p>
    ${tag.also_known_as && tag.also_known_as.length ? `<p class="aka"><b>Also known as:</b> ${tag.also_known_as.map(esc).join(' · ')}</p>` : ''}
    ${tag.is_filterable ? `<a class="cta" href="/smuthub-app.html?${tag.category === 'trope' ? 'trope' : tag.category === 'mood' ? 'mood' : 'q'}=${encodeURIComponent(tag.slug)}">Find books with this ${esc(cat.label.replace(/s$/,'').toLowerCase())} →</a>` : ''}
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
    <div class="grid" id="bookGrid"><p class="empty">Loading…</p></div>
  </section>

  ${tag.origin_note ? `<section class="detail muted">
    <h2>Where the term comes from</h2>
    <p>${esc(tag.origin_note)}</p>
  </section>` : ''}

  ${related.length ? `<section class="detail">
    <h2>Related terms</h2>
    <div class="relgrid">
      ${related.map(r => `<a class="reltag" href="${escAttr(termPath(r))}"><span class="c">${esc(CATS[catKey(r.category)].label.replace(/s$/,''))}</span>${esc(r.label)}</a>`).join('')}
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
    if(!sb){ grid.innerHTML = '<p class="empty">Catalog unavailable.</p>'; return; }
    try{
      const { data, error } = await sb.from('books')
        .select('slug,title,author,cover_url,spice_level,year')
        .eq('status','live').contains('tag_ids', [tagKey])
        .order('featured', { ascending:false }).limit(12);
      if(error) throw error;
      if(!data || !data.length){ grid.innerHTML = '<p class="empty">No books shelved here yet — check back as the catalog grows.</p>'; return; }
      grid.innerHTML = data.map(function(b){
        const cov = b.cover_url ? '<img src="'+escH(b.cover_url)+'" alt="'+escH(b.title)+' book cover" loading="lazy">' : '';
        return '<a class="card" href="/smuthub-app.html?q='+encodeURIComponent(b.title||'')+'">'
          +    '<div class="cover">'+cov+'</div>'
          +    '<div class="meta"><div class="t">'+escH(b.title)+'</div><div class="a">'+escH(b.author||'')+'</div></div>'
          +    '</a>';
      }).join('');
    }catch(e){ console.error(e); grid.innerHTML = '<p class="empty">Couldn\\'t load books just now.</p>'; }
  })();
</script>

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
      .catblock{padding:18px 0;border-top:1px solid var(--line)}
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
    </style>`
  });

  // Group tags by category
  const byCat = {};
  for (const t of tags){
    const c = catKey(t.category);
    (byCat[c] = byCat[c] || []).push(t);
  }

  const catSections = ordered.map(([key, cfg]) => {
    const items = (byCat[key] || []);
    if(!items.length) return '';
    return `<div class="catblock" data-cat="${esc(key)}">
      <h2><span class="ce">${cfg.emoji}</span>${esc(cfg.label)}<span class="count">${items.length}</span></h2>
      <div class="terms">
        ${items.map(t => `<a class="term" href="${escAttr(termPath(t))}" data-label="${escAttr((t.label+' '+(t.also_known_as||[]).join(' ')).toLowerCase())}">
          <div class="n">${esc(t.label)}</div>
          <div class="d">${esc(t.description||'')}</div>
        </a>`).join('')}
      </div>
    </div>`;
  }).join('');

  const catOptions = ordered.map(([key, cfg]) => `<option value="${esc(key)}">${cfg.emoji} ${esc(cfg.label)}</option>`).join('');

  const body = `<body>
${SHARED_HEADER}

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
    </style>`
  });
  const body = `<body>${SHARED_HEADER}
<div class="wrap">
  <nav class="crumb"><a href="/glossary/">Glossary</a> / <span>${esc(cfg.label)}</span></nav>
  <div class="head">
    <h1>${cfg.emoji} <em>${esc(cfg.label)}</em></h1>
    <p class="sub">${items.length} term${items.length===1?'':'s'} in this category.</p>
  </div>
  <div class="terms">
    ${items.map(t => `<a class="term" href="${escAttr(termPath(t))}">
      <div class="n">${esc(t.label)}</div>
      <div class="d">${esc(t.description||'')}</div>
    </a>`).join('')}
  </div>
</div>
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
// Category landing pages
for (const [cat, items] of Object.entries(byCat)){
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
  Object.keys(byCat).map(c =>
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

console.log(`✓ Wrote ${wrote} term pages + ${Object.keys(byCat).length} category pages + index`);
console.log(`✓ Updated sitemap.xml with ${tags.length + Object.keys(byCat).length + 1} URLs`);
console.log(`\nNext: git add glossary/ sitemap.xml && git commit && git push`);
