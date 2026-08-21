#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
//  smutHub · cover fetcher (offline re-source for missing R2 covers)
//
//  For each book in the input CSV, finds a cover image from Google Books
//  (then OpenLibrary as fallback), validates it's a real image, and writes it
//  to <out>/<slug>.jpg — the exact object key the smuthub-covers R2 bucket
//  needs. Drop the whole output folder into the bucket in one go.
//
//  Use this when a book's cover 404s on covers.smuthub.ca AND its saved
//  cover_source_url is gone (so the rehost-cover Edge Function can't help —
//  it has nothing external to fetch). This script re-sources from scratch by
//  title + author, so no ISBN or prior source URL is required.
//
//  Input CSV needs at least: slug, title, author   (year, isbn used if present)
//
//  Usage:
//    node scripts/fetch-covers.mjs <worklist.csv> [outDir]
//    node scripts/fetch-covers.mjs ~/Downloads/covers_worklist_65.csv ~/Downloads/covers-out
//
//  • Resumable: skips any slug whose file already exists in outDir.
//  • Writes <outDir>/_FAILED.txt listing books it couldn't auto-source, so you
//    can hand-grab just those.
//  Exit 0 always (partial success is normal); check the summary + _FAILED.txt.
// ════════════════════════════════════════════════════════════════════════

import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';

const MIN_BYTES = 5_000;         // reject tiny placeholder/blank thumbnails
const MAX_BYTES = 6_000_000;     // sanity ceiling
const CONCURRENCY = 4;
const UA = 'smuthub-cover-fetcher/1.0 (+https://smuthub.ca)';

const [csvPath, outDir = 'covers-out'] = process.argv.slice(2);
if (!csvPath) { console.error('usage: node scripts/fetch-covers.mjs <worklist.csv> [outDir]'); process.exit(2); }

// Google Books needs a key server-side (keyless requests get 429). Prefer an
// env var, else lift the site's key out of config.js.
let GB_KEY = process.env.GOOGLE_BOOKS_KEY || '';
try {
  if (!GB_KEY) {
    const cfg = await fs.readFile(new URL('../config.js', import.meta.url), 'utf8');
    GB_KEY = (cfg.match(/GOOGLE_BOOKS_KEY:\s*["']([^"']+)["']/) || [])[1] || '';
  }
} catch {}

// title match guard — strip a leading article, compare alphanumerics only, and
// allow either to be a prefix of the other (subtitles / dropped "A"/"The").
const normT = s => s.toLowerCase().replace(/^(a|an|the)\s+/, '').replace(/[^a-z0-9]+/g, '');
const titleMatches = (want, got) => {
  const a = normT(want), b = normT(got);
  return a.length >= 5 && (a === b || a.startsWith(b) || b.startsWith(a));
};

// ── tiny CSV parser (quotes, escaped "", embedded newlines) ──
function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\r') {}
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

const fetchBuf = async (url, ms = 20000) => {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ac.signal, redirect: 'follow' });
    if (!r.ok) return { err: `HTTP ${r.status}` };
    const ct = r.headers.get('content-type') || '';
    const buf = Buffer.from(await r.arrayBuffer());
    return { ct, buf };
  } catch (e) { return { err: e.name === 'AbortError' ? 'timeout' : e.message }; }
  finally { clearTimeout(t); }
};
const fetchJson = async (url, ms = 15000) => {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try { const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ac.signal }); return r.ok ? await r.json() : null; }
  catch { return null; } finally { clearTimeout(t); }
};

const validImage = ({ ct, buf }) =>
  buf && /^image\//i.test(ct || '') && buf.byteLength >= MIN_BYTES && buf.byteLength <= MAX_BYTES;

// Google's imageLinks.thumbnail is a ~128px zoom=1 crop. The frontcover
// content endpoint serves the same cover far larger at higher zoom (zoom=3 is
// ~100kb / full-res), so build from the volume id and step down if needed.
// Google serves an identical grayscale "preview not available" PNG placeholder
// at high zoom when the real cover isn't public. Real romantasy covers are
// always colour, so treat any grayscale PNG (IHDR colour-type 0 or 4) as a
// placeholder and reject it — otherwise we'd upload 21 identical gray boxes.
function isPlaceholder(buf) {
  const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 26 || !PNG_SIG.every((b, i) => buf[i] === b)) return false;
  const colourType = buf[25];               // IHDR colour type
  return colourType === 0 || colourType === 4;   // grayscale / grayscale+alpha
}
async function googleHiRes(id) {
  for (const z of [3, 2, 1]) {
    const got = await fetchBuf(`https://books.google.com/books/content?id=${id}&printsec=frontcover&img=1&zoom=${z}&source=gbs_api`);
    if (validImage(got) && !isPlaceholder(got.buf)) return got;
  }
  return null;
}

async function googleCover({ title, author, isbn }) {
  // Build q with the operators (+ and :) kept LITERAL — only the values are
  // percent-encoded. Encoding the whole string turns "+" into %2B and breaks
  // Google's term-join, which is why an earlier version got zero Google hits.
  const enc = s => encodeURIComponent(s);
  const key = GB_KEY ? `&key=${GB_KEY}` : '';
  const queries = [];
  if (isbn) queries.push(`isbn:${enc(isbn)}`);
  queries.push(`intitle:${enc(title)}+inauthor:${enc(author)}`);
  queries.push(`${enc(title)}+${enc(author)}`);          // looser keyword fallback
  for (const q of queries) {
    const j = await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=10&printType=books&langRestrict=en&country=US${key}`);
    for (const it of (j?.items || [])) {
      if (!it.volumeInfo?.imageLinks) continue;   // no cover art for this edition
      // guard against attaching a same-search-different-book cover
      if (!titleMatches(title, it.volumeInfo?.title || '')) continue;
      const got = await googleHiRes(it.id);
      if (got) return { ...got, via: 'google' };
    }
  }
  return null;
}
async function openLibCover({ title, author, isbn }) {
  if (isbn) {
    const got = await fetchBuf(`https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`);
    if (validImage(got)) return { ...got, via: 'openlibrary-isbn' };
  }
  const j = await fetchJson(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=5`);
  for (const d of (j?.docs || [])) {
    if (!d.cover_i) continue;
    if (!titleMatches(title, d.title || '')) continue;   // don't grab a wrong-book cover
    const got = await fetchBuf(`https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg?default=false`);
    if (validImage(got)) return { ...got, via: 'openlibrary' };
  }
  return null;
}

// ── main ──
const rows = parseCSV(await fs.readFile(csvPath, 'utf8'));
const hdr = rows[0].map(h => h.trim());
const col = Object.fromEntries(hdr.map((h, n) => [h, n]));
for (const req of ['slug', 'title', 'author']) if (!(req in col)) { console.error(`CSV missing column: ${req}`); process.exit(2); }
const books = rows.slice(1).map(r => ({
  slug: (r[col.slug] || '').trim(), title: (r[col.title] || '').trim(),
  author: (r[col.author] || '').trim(), isbn: ('isbn' in col ? r[col.isbn] : '').trim(),
})).filter(b => b.slug && b.title);

await fs.mkdir(outDir, { recursive: true });
console.log(`\nFetching covers for ${books.length} books → ${outDir}\n`);

const results = [];
let next = 0;
async function worker() {
  while (next < books.length) {
    const b = books[next++];
    const dest = path.join(outDir, `${b.slug}.jpg`);
    try { await fs.access(dest); results.push({ b, ok: true, via: 'exists (skipped)' }); console.log(`  ⏭  ${b.slug}`); continue; } catch {}
    const hit = await openLibCover(b) || await googleCover(b);   // OL first: real, higher-res
    if (hit) {
      await fs.writeFile(dest, hit.buf);
      results.push({ b, ok: true, via: hit.via });
      console.log(`  ✅ ${b.slug}  (${hit.via}, ${(hit.buf.byteLength / 1024 | 0)}kb)`);
    } else {
      results.push({ b, ok: false });
      console.log(`  ❌ ${b.slug}  — no cover found`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// Source-agnostic placeholder catch: two real book covers are never byte-for-
// byte identical, so any image that appears 2+ times is a "not available"
// placeholder that slipped past the per-source checks. Drop them all.
const byHash = new Map();
for (const r of results.filter(r => r.ok)) {
  const dest = path.join(outDir, `${r.b.slug}.jpg`);
  try { const h = createHash('md5').update(await fs.readFile(dest)).digest('hex'); (byHash.get(h) || byHash.set(h, []).get(h)).push(r); } catch {}
}
for (const group of byHash.values()) {
  if (group.length < 2) continue;
  for (const r of group) {
    r.ok = false; r.placeholder = true;
    await fs.rm(path.join(outDir, `${r.b.slug}.jpg`), { force: true });
    console.log(`  🗑  ${r.b.slug}  — dropped (identical placeholder ×${group.length})`);
  }
}

const ok = results.filter(r => r.ok), failed = results.filter(r => !r.ok);
if (failed.length) {
  const lines = ['Books with no auto-sourced cover — hand-grab these and save as <slug>.jpg:\n',
    ...failed.map(r => `${r.b.slug}\t${r.b.title} — ${r.b.author}`)];
  await fs.writeFile(path.join(outDir, '_FAILED.txt'), lines.join('\n') + '\n');
}
const bar = '─'.repeat(60);
console.log(`\n${bar}\n  ${ok.length}/${books.length} covers ready in ${outDir}`);
if (failed.length) console.log(`  ${failed.length} not found — see ${path.join(outDir, '_FAILED.txt')}`);
console.log(`${bar}\n  Next: drag the *.jpg files in ${outDir} into the smuthub-covers R2 bucket.\n${bar}\n`);
