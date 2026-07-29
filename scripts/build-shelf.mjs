#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
//  smutHub · public bookshelf build  (Discovery Surface v1 — lane 1)
//
//  Generates the founder's PUBLIC, logged-out-browsable bookshelf as a
//  fully server-rendered static page:
//    /bookshelf/<handle>/index.html
//
//  This is the cheapest MVP of "people-powered discovery": a stranger lands
//  on a real human's shelf, browses real books grouped by shelf status, and
//  clicks any cover through to that book's detail page (/books/<slug>/).
//
//  Anatomy (v1 — clean, fast, mobile-first cover grid; NOT the immersive
//  two-level-zoom themed world, which is Shelf Season):
//    • Header hero   — whose shelf, book count, book-vocabulary copy
//    • 4 status groups in locked order:
//         Want to Read 📌 · Currently Reading 📖 · Read ✓ · DNF 🪦
//      DNF is collapsed by default (<details>) and rendered grayscale.
//    • Every cover is a real <a> → /books/<slug>/ (crawlable HTML).
//
//  WHY A BUILD SCRIPT (not a runtime read): the `shelf` and `profiles`
//  tables are RLS-locked to auth.uid(), so the public anon key returns
//  nothing. We read them ONCE at build time with the Supabase service_role
//  key and freeze the result into static HTML — which also gives us the
//  crawlable view-source the discovery surface needs. No schema change, no
//  public RLS policy, no runtime secret in the browser.
//
//  ── Service key (never committed, never shipped to the browser) ──────────
//  Put it in a gitignored .env file at the repo root (`.env*` is already in
//  .gitignore).  One line:
//      SUPABASE_SERVICE_KEY=your_service_role_key_here
//  (Optional overrides in the same file:)
//      FOUNDER_EMAIL=joshd0123@gmail.com     # whose shelf to publish
//      FOUNDER_HANDLE=josh                   # force the URL handle
//
//  Usage:
//    node scripts/build-shelf.mjs
//  Then: git add bookshelf/ sitemap.xml && git commit && git push
//  (Manual local build — same workflow as build-books.mjs. No CI.)
//
//  No dependencies — Node built-in fetch + fs.
// ════════════════════════════════════════════════════════════════════════

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
// Per-user public pages live under /bookshelf/<handle>/ — a deeper folder than
// the existing immersive /bookshelf/ page, so there is no collision.
const BOOKSHELF_DIR = path.join(ROOT, 'bookshelf');
const SITE = 'https://smuthub.ca';
const SITE_NAME = 'smutHub';
const COVERS = 'https://covers.smuthub.ca';

// ── Load a gitignored .env (KEY=VALUE per line) so the service key never has
//    to be typed on the command line. Silently ignored if absent. ───────────
async function loadEnvFile(){
  for (const name of ['.env', '.env.local']) {
    try {
      const raw = await fs.readFile(path.join(ROOT, name), 'utf-8');
      for (const line of raw.split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    } catch { /* no such file — fine */ }
  }
}
await loadEnvFile();

// ── Public anon creds (for the config.js the page loads) live in config.js;
//    the privileged READ uses the service_role key from the environment. ─────
const cfgRaw = await fs.readFile(path.join(ROOT, 'config.js'), 'utf-8');
const SUPABASE_URL = (cfgRaw.match(/SUPABASE_URL\s*:\s*['"]([^'"]+)['"]/) || [])[1];
if (!SUPABASE_URL) { console.error('✗ Could not parse SUPABASE_URL from config.js'); process.exit(1); }

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  console.error('✗ SUPABASE_SERVICE_KEY is not set.');
  console.error('  Put it in a gitignored .env at the repo root:');
  console.error('      SUPABASE_SERVICE_KEY=your_service_role_key_here');
  console.error('  (It is used only to READ the founder shelf at build time; it is never');
  console.error('   committed and never shipped to the browser.)');
  process.exit(1);
}

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || 'joshd0123@gmail.com';
const FORCE_HANDLE = (process.env.FOUNDER_HANDLE || '').trim().toLowerCase();

const BASE = SUPABASE_URL.replace(/\/+$/, '');
const REST = BASE + '/rest/v1';
const svcHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Accept: 'application/json' };

async function pgGet(url){
  const r = await fetch(url, { headers: svcHeaders });
  if(!r.ok) throw new Error(`PostgREST ${r.status}: ${await r.text()}`);
  return r.json();
}

// ── Resolve the founder's auth user id from their email (admin API) ─────────
async function resolveFounderId(email){
  // /auth/v1/admin/users is paginated; walk until we find the email.
  for (let page = 1; page <= 20; page++){
    const r = await fetch(`${BASE}/auth/v1/admin/users?per_page=200&page=${page}`, { headers: svcHeaders });
    if(!r.ok) throw new Error(`admin/users ${r.status}: ${await r.text()}`);
    const body = await r.json();
    const users = body.users || body || [];
    const hit = users.find(u => (u.email || '').toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (users.length < 200) break; // last page
  }
  return null;
}

console.log(`◇ Resolving founder (${FOUNDER_EMAIL}) …`);
const founderId = await resolveFounderId(FOUNDER_EMAIL);
if (!founderId) { console.error(`✗ No auth user found for ${FOUNDER_EMAIL}.`); process.exit(1); }

// ── Read the founder's profile, shelf, and per-book spice ratings ───────────
const [profileRows, shelfRows, tagRows, liveBooks] = await Promise.all([
  pgGet(`${REST}/profiles?id=eq.${founderId}&select=*`),
  pgGet(`${REST}/shelf?user_id=eq.${founderId}&select=*`),
  pgGet(`${REST}/book_tags?user_id=eq.${founderId}&select=book_key,spice`),
  pgGet(`${REST}/books?select=slug,title,author,spice_level,cover_url&status=eq.live`),
]);

const profile = profileRows[0] || {};
const handle = FORCE_HANDLE || (profile.username || '').trim().toLowerCase();
if (!handle) {
  console.error('✗ The founder profile has no `username` to route on.');
  console.error('  Set a username on the account (in the app), or pass FOUNDER_HANDLE=... in .env.');
  process.exit(1);
}

// ── Reconcile shelf entries to the catalog ──────────────────────────────────
// A shelf row's `book_key` is a catalog slug ONLY for books shelved from the
// catalog. Books shelved from external search carry a Google Books (`gb:…`) or
// OpenLibrary (`/works/…`) key instead — even when the SAME book exists in our
// catalog. So we match those to a catalog book by normalized title, which lets
// them link through to the real /books/<slug>/ page and use the branded cover.
const norm = s => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
// Author last name — the most stable token to disambiguate a shared title.
const lastName = a => { const t = norm(a).split(' ').filter(Boolean); return t[t.length - 1] || ''; };
const catalogBySlug = new Map(liveBooks.map(b => [b.slug, b]));
const catalogByTitle = new Map();
for (const b of liveBooks) { const k = norm(b.title); if (k && !catalogByTitle.has(k)) catalogByTitle.set(k, b); }

// Given a shelf row, return the matching catalog book (or null). Three tiers,
// most-precise first; memoized per row:
//   1. direct slug hit (book shelved from the catalog)
//   2. exact normalized-title match
//   3. subtitle match: a catalog title that CONTAINS the shelf title AND shares
//      the author's last name — recovers e.g. shelf "The Awakening" (Peckham)
//      → catalog "Zodiac Academy: The Awakening" (Peckham), without letting a
//      bare title collide with a same-titled book by a different author.
function catalogFor(row){
  if (row.__cat !== undefined) return row.__cat;
  let hit = catalogBySlug.get(row.book_key) || catalogByTitle.get(norm(row.title)) || null;
  if (!hit) {
    const t = norm(row.title), a = lastName(row.author);
    // Author surname must appear among the catalog author's tokens — catalog
    // books can list co-authors (e.g. "Peckham, Valenti"), so match any token,
    // not just the last one.
    if (t.length > 3 && a) {
      hit = liveBooks.find(b => norm(b.author).split(' ').includes(a) &&
        (norm(b.title).includes(t) || t.includes(norm(b.title)))) || null;
    }
  }
  return (row.__cat = hit);
}
const userSpice = {};
tagRows.forEach(t => { if (t.spice) userSpice[t.book_key] = t.spice; });

// The shelf must never render empty — a zero result is a bug, not a state.
if (!shelfRows.length) {
  console.error(`✗ Founder shelf (${FOUNDER_EMAIL}) returned ZERO books. Refusing to build an empty shelf.`);
  console.error('  Seed real books across statuses first, then re-run.');
  process.exit(1);
}

// ── Group by status in the LOCKED order ─────────────────────────────────────
const STATUS_META = [
  { key: 'want',    icon: '📌', label: 'Want to Read' },
  { key: 'reading', icon: '📖', label: 'Currently Reading' },
  { key: 'read',    icon: '✓',  label: 'Read' },
  { key: 'dnf',     icon: '🪦', label: 'Did Not Finish' },
];

function shelfCmp(a, b){
  const ao = a.sort_order, bo = b.sort_order;
  if (ao == null && bo == null) return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  if (ao == null) return -1;
  if (bo == null) return 1;
  return ao - bo;
}
const byStatus = Object.fromEntries(STATUS_META.map(s => [s.key, []]));
for (const row of shelfRows) if (byStatus[row.status]) byStatus[row.status].push(row);
for (const k of Object.keys(byStatus)) byStatus[k].sort(shelfCmp);

// ── Helpers ─────────────────────────────────────────────────────────────────
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const escAttr = esc;
const ensureDir = p => fs.mkdir(p, { recursive: true });

// A shelf row's cover: prefer the branded catalog cover for matched books,
// else the row's own denormalized cover_url, else an OpenLibrary id, else null.
function coverSrc(row){
  const cat = catalogFor(row);
  if (cat && cat.cover_url) return cat.cover_url;
  if (row.cover_url) return row.cover_url;
  if (row.cover_i) return `https://covers.openlibrary.org/b/id/${row.cover_i}-L.jpg`;
  return null;
}
// Where a cover links: matched → its detail page; unmatched → search for it
// (so every cover is still actionable and the click lands somewhere real).
function linkFor(row){
  const cat = catalogFor(row);
  if (cat) return `/books/${cat.slug}/`;
  const q = encodeURIComponent(row.title || '');
  return `/search?q=${q}`;
}
const spiceFor = row => userSpice[row.book_key] || (catalogFor(row)?.spice_level) || 0;

function cardHTML(row){
  const cat = catalogFor(row);
  const src = coverSrc(row);
  const href = linkFor(row);
  const curated = !!cat;
  const title = row.title || 'Untitled';
  const author = row.author || '';
  const sp = spiceFor(row);
  const cover = src
    ? `<img class="cov" src="${escAttr(src)}" alt="${escAttr(title)}${author ? ' by ' + escAttr(author) : ''} — book cover" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="ph" style="display:none">${esc(title)}</div>`
    : `<div class="ph">${esc(title)}</div>`;
  const spice = sp ? `<span class="spice" title="${sp} out of 5 spice">${'🌶️'.repeat(Math.min(sp,5))}</span>` : '';
  const off = curated ? '' : '<span class="off" title="Not in the smutHub catalog yet">find</span>';
  // Umami click tracking (auto-fired on data-umami-event; beacons before nav).
  // Matched covers report which book was clicked through to — the metric that
  // shows the discovery surface is actually sending readers into book pages.
  const track = curated
    ? ` data-umami-event="bookshelf-book-click" data-umami-event-book="${escAttr(cat.slug)}"`
    : ` data-umami-event="bookshelf-search-click"`;
  return `<li class="card">`
    + `<a href="${escAttr(href)}"${curated ? '' : ' data-off="1"'}${track}>`
    + `<span class="frame">${cover}${spice}${off}</span>`
    + `<span class="meta"><span class="t">${esc(title)}</span>${author ? `<span class="a">${esc(author)}</span>` : ''}</span>`
    + `</a></li>`;
}

function groupHTML(meta){
  const rows = byStatus[meta.key];
  if (!rows.length) return '';
  const n = rows.length;
  const grid = `<ul class="grid">${rows.map(cardHTML).join('')}</ul>`;
  if (meta.key === 'dnf') {
    // DNF: collapsed by default, grayscale, inline expand.
    return `<section class="group dnf" aria-label="${escAttr(meta.label)}">`
      + `<details>`
      + `<summary><span class="ico">${meta.icon}</span> ${esc(meta.label)} <span class="count">${n}</span></summary>`
      + grid
      + `</details></section>`;
  }
  return `<section class="group" aria-label="${escAttr(meta.label)}">`
    + `<h2><span class="ico">${meta.icon}</span> ${esc(meta.label)} <span class="count">${n}</span></h2>`
    + grid
    + `</section>`;
}

// ── Display name + book-vocabulary-heavy SEO copy ───────────────────────────
const rawName = (profile.display_name || profile.username || handle || 'A reader');
const displayName = String(rawName).charAt(0).toUpperCase() + String(rawName).slice(1);
const possessive = /s$/i.test(displayName) ? `${displayName}'` : `${displayName}'s`;
const total = shelfRows.length;
const readCount = byStatus.read.length;

// A few real titles to seed the meta description with book vocabulary.
const sampleTitles = shelfRows
  .slice()
  .sort(shelfCmp)
  .map(r => r.title)
  .filter(Boolean)
  .slice(0, 6);

const canonical = `${SITE}/bookshelf/${handle}/`;
const pageTitle = `${possessive} Bookshelf — ${total} Romantasy & Spicy Books to Read | ${SITE_NAME}`;
const pageDesc = `Browse ${possessive.replace(/&/g,'and')} public bookshelf on smutHub: ${total} romantasy and spicy romance books they want to read, are currently reading, have read, and did not finish`
  + (sampleTitles.length ? ` — including ${sampleTitles.join(', ')}. ` : '. ')
  + `Discover your next book to read by browsing a real reader's shelf.`;
// OG image: the first real cover if we have one, else the site card.
const firstCover = shelfRows.map(coverSrc).find(Boolean);
const ogImage = firstCover && /^https?:\/\//.test(firstCover) ? firstCover : `${SITE}/og-image.jpg`;

const jsonld = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      'name': `${possessive} Bookshelf`,
      'url': canonical,
      'description': `A public bookshelf of ${total} romantasy and spicy romance books on smutHub.`,
      'isPartOf': { '@type': 'WebSite', 'name': SITE_NAME, 'url': SITE + '/' },
    },
    {
      '@type': 'ItemList',
      'name': `${possessive} bookshelf`,
      'numberOfItems': total,
      'itemListElement': shelfRows.slice(0, 100).map((r, i) => ({
        '@type': 'ListItem',
        'position': i + 1,
        'name': r.title || 'Untitled',
        ...(catalogFor(r) ? { 'url': `${SITE}/books/${catalogFor(r).slug}/` } : {}),
      })),
    },
    {
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': SITE + '/' },
        { '@type': 'ListItem', 'position': 2, 'name': 'Books', 'item': SITE + '/books/' },
        { '@type': 'ListItem', 'position': 3, 'name': `${possessive} Bookshelf`, 'item': canonical },
      ],
    },
  ],
};

// ── Shared shell (mirrors build-books.mjs head/header/footer) ───────────────
const sharedHeader = `
<header>
  <div class="nav wrap">
    <a href="/" class="logo">smut<span class="box">Hub</span></a>
    <nav class="navlinks" aria-label="Primary navigation">
      <a href="/books/">Browse Books</a>
      <details class="sh-guides">
        <summary>Guides</summary>
        <div>
          <a href="/guides/">All Guides</a>
          <a href="/guides/spice-levels/">Spice Levels</a>
          <a href="/glossary/">Glossary</a>
          <a href="/glossary/trope/">Tropes</a>
          <a href="/glossary/warning/">Content Warnings</a>
        </div>
      </details>
      <a href="/bookshelf">My Bookshelf</a>
      <a href="/stores">Find a Store</a>
      <a href="/search">Add a Book</a>
    </nav>
    <div class="authbox" id="authbox"></div>
  </div>
</header>`;

const sharedFooter = `
<footer>
  <div class="wrap ft">
    <span>© ${new Date().getFullYear()} smutHub · Romantasy, decoded.</span>
    <span><a href="/books/">All Books</a> · <a href="/glossary/">Glossary</a> · <a href="/about.html">About</a> · <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a> · <a href="/sitemap.html">Sitemap</a></span>
  </div>
</footer>`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${escAttr(pageDesc)}">
<link rel="canonical" href="${escAttr(canonical)}">
<meta name="theme-color" content="#0c0708">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${escAttr(pageTitle)}">
<meta property="og:description" content="${escAttr(pageDesc)}">
<meta property="og:url" content="${escAttr(canonical)}">
<meta property="og:image" content="${escAttr(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escAttr(pageTitle)}">
<meta name="twitter:description" content="${escAttr(pageDesc)}">
<meta name="twitter:image" content="${escAttr(ogImage)}">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
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
  .wrap{max-width:1180px;margin:0 auto;padding:0 22px}
  .logo{display:inline-flex;align-items:center;font-weight:800;font-size:1.5rem;letter-spacing:-.02em;text-decoration:none;color:var(--cream)}
  .logo .box{background:var(--grad);color:#1a0c10;padding:.05em .42em;border-radius:.42em;margin-left:.12em;box-shadow:0 6px 18px -6px rgba(255,61,118,.7)}
  header{position:sticky;top:0;z-index:50;backdrop-filter:blur(14px);background:rgba(12,7,8,.72);border-bottom:1px solid var(--line)}
  .nav{display:flex;align-items:center;justify-content:space-between;height:72px;gap:12px;flex-wrap:wrap}
  .navlinks{display:flex;gap:18px;align-items:center}
  .navlinks a{color:var(--muted);font-weight:500;font-size:.92rem;text-decoration:none;transition:color .2s}
  .navlinks a:hover{color:var(--cream)}
  .sh-guides{position:relative}
  .sh-guides>summary{list-style:none;cursor:pointer;color:var(--muted);font-weight:500;font-size:.92rem}
  .sh-guides>summary::-webkit-details-marker{display:none}
  .sh-guides[open]>summary{color:var(--cream)}
  .sh-guides>div{position:absolute;top:130%;left:0;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px;min-width:190px;box-shadow:0 20px 50px -20px rgba(0,0,0,.8);z-index:60}
  .sh-guides>div a{white-space:nowrap}
  @media(max-width:680px){.navlinks{gap:12px;font-size:.85rem}}
  footer{border-top:1px solid var(--line);margin-top:56px;padding:32px 0 40px}
  footer .ft{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;color:var(--muted);font-size:.86rem}
  footer a{color:var(--muted);text-decoration:none}
  footer a:hover{color:var(--cream)}

  /* ── Shelf hero ── */
  .crumb{padding:20px 0 0;color:var(--muted);font-size:.85rem}
  .crumb a{color:var(--muted);text-decoration:none}
  .crumb a:hover{color:var(--cream)}
  .hero{padding:26px 0 6px}
  .hero .eyebrow{color:var(--amber);font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:.72rem}
  .hero h1{font-family:'Fraunces',serif;font-weight:600;font-size:clamp(1.9rem,6vw,2.9rem);line-height:1.08;margin:.3em 0 .25em}
  .hero h1 em{font-style:italic;background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  .hero p{color:var(--muted);max-width:60ch}
  .stat{display:inline-flex;gap:6px;align-items:baseline;color:var(--muted);font-size:.9rem;margin-top:10px}
  .stat b{color:var(--cream);font-weight:700}

  /* ── Status groups ── */
  .group{margin-top:34px}
  .group>h2,.group summary{font-family:'Fraunces',serif;font-weight:600;font-size:1.35rem;display:flex;align-items:center;gap:.5rem;margin-bottom:16px}
  .group .ico{font-style:normal}
  .group .count{font-family:'Hanken Grotesk',sans-serif;font-size:.8rem;font-weight:700;color:var(--muted);background:var(--ink-2);border:1px solid var(--line);border-radius:999px;padding:.15em .6em}
  .group.dnf details>summary{cursor:pointer;list-style:none;color:var(--muted)}
  .group.dnf details>summary::-webkit-details-marker{display:none}
  .group.dnf details>summary::after{content:"▾";margin-left:.4rem;font-size:.9em;transition:transform .2s}
  .group.dnf details[open]>summary::after{transform:rotate(180deg)}
  .group.dnf .grid{margin-top:16px;filter:grayscale(1);opacity:.72}

  .grid{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:20px 18px}
  @media(max-width:680px){.grid{grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:16px 12px}}
  .card a{display:flex;flex-direction:column;gap:9px;text-decoration:none}
  .frame{position:relative;aspect-ratio:2/3;border-radius:10px;overflow:hidden;background:var(--panel);border:1px solid var(--line);box-shadow:0 12px 28px -14px rgba(0,0,0,.75);transition:transform .18s ease,box-shadow .18s ease}
  .card a:hover .frame{transform:translateY(-4px);box-shadow:0 18px 36px -14px rgba(255,61,118,.45);border-color:#43222c}
  .cov{width:100%;height:100%;object-fit:cover;display:block}
  .ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:10px;font-family:'Fraunces',serif;font-size:.85rem;color:var(--muted);background:linear-gradient(160deg,#241318,#160d10)}
  .spice{position:absolute;left:6px;bottom:6px;font-size:.7rem;background:rgba(12,7,8,.72);backdrop-filter:blur(4px);border-radius:6px;padding:.1em .35em;letter-spacing:-.05em}
  .off{position:absolute;right:6px;top:6px;font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--amber);background:rgba(12,7,8,.72);border:1px solid var(--line);border-radius:6px;padding:.15em .4em}
  .meta{display:flex;flex-direction:column;gap:1px}
  .meta .t{font-weight:700;font-size:.86rem;color:var(--cream);line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .meta .a{font-size:.76rem;color:var(--muted)}
  .empty{margin-top:40px;color:var(--muted)}
</style>
</head>
<body>
${sharedHeader}
<main class="wrap">
  <nav class="crumb" aria-label="Breadcrumb"><a href="/">Home</a> · <a href="/books/">Books</a> · ${possessive} Bookshelf</nav>
  <section class="hero">
    <div class="eyebrow">A reader's bookshelf</div>
    <h1>${esc(possessive)} <em>Bookshelf</em></h1>
    <p>A public bookshelf of romantasy and spicy romance books — what ${esc(displayName)} wants to read, is reading now, has read, and put down. Tap any book cover to read its spice rating, tropes, and content notes.</p>
    <div class="stat"><b>${total}</b> books&nbsp; · &nbsp;<b>${readCount}</b> read</div>
  </section>
  ${STATUS_META.map(groupHTML).join('\n  ')}
</main>
${sharedFooter}
</body>
</html>`;

// ── Write /bookshelf/<handle>/index.html ────────────────────────────────────
const outDir = path.join(BOOKSHELF_DIR, handle);
await ensureDir(outDir);
await fs.writeFile(path.join(outDir, 'index.html'), html);

// ── Update sitemap.xml — replace the SHELF-AUTO block in place ──────────────
const sitemapPath = path.join(ROOT, 'sitemap.xml');
let sitemap = await fs.readFile(sitemapPath, 'utf-8');
const START = '<!-- SHELF-AUTO-START -->';
const END = '<!-- SHELF-AUTO-END -->';
const today = new Date().toISOString().slice(0, 10);
const shelfUrls = `  <url><loc>${canonical}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
const newBlock = `${START}\n${shelfUrls}\n  ${END}`;
const si = sitemap.indexOf(START);
const ei = sitemap.indexOf(END);
if (si >= 0 && ei >= 0 && ei > si){
  sitemap = sitemap.substring(0, si) + newBlock + sitemap.substring(ei + END.length);
} else {
  sitemap = sitemap.replace('</urlset>', `  ${newBlock}\n</urlset>`);
}
await fs.writeFile(sitemapPath, sitemap);

console.log(`✓ Founder: ${displayName} (@${handle}) · ${total} books`);
STATUS_META.forEach(m => console.log(`    ${m.icon} ${m.label}: ${byStatus[m.key].length}`));
const linked = shelfRows.filter(catalogFor).length;
console.log(`✓ Clickable (matched to a /books/ page): ${linked}/${total}` + (linked < total
  ? `  ·  ${total - linked} link to search: ${shelfRows.filter(r => !catalogFor(r)).map(r => r.title).join(', ')}`
  : ''));
console.log(`✓ Wrote /bookshelf/${handle}/index.html`);
console.log(`✓ Updated sitemap.xml (SHELF-AUTO block)`);
console.log(`\nNext: git add bookshelf/ sitemap.xml && git commit && git push`);
