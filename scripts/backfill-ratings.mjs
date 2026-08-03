#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
//  smutHub · rating backfill (CSV generator)
//
//  Reads every LIVE book missing a rating_avg from Supabase (anon read),
//  looks up its REAL community average on OpenLibrary, and writes an
//  importer-ready CSV (slug,title,rating_avg) for /admin bulk import.
//
//  Only includes a rating when OpenLibrary has a confident match:
//    • the returned title loosely matches (guards against wrong-book hits)
//    • ratings_count >= MIN_RATINGS (no 5.0-from-3-votes noise)
//
//  Usage:  node scripts/backfill-ratings.mjs
//  Output: rating-backfill.csv (open, paste into /admin, import; then rebuild)
// ════════════════════════════════════════════════════════════════════════
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = await fs.readFile(path.join(ROOT, 'config.js'), 'utf-8');
const URL_ = (cfg.match(/SUPABASE_URL\s*:\s*['"]([^'"]+)['"]/) || [])[1];
const KEY = (cfg.match(/SUPABASE_KEY\s*:\s*['"]([^'"]+)['"]/) || [])[1];
const MIN_RATINGS = 15;

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

const res = await fetch(`${URL_}/rest/v1/books?select=slug,title,author&rating_avg=is.null&status=eq.live&order=title`,
  { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
const books = await res.json();
console.log(`Looking up ${books.length} books missing a rating…`);

const rows = ['slug,title,rating_avg'];
let found = 0, i = 0;
for (const b of books) {
  i++;
  try {
    const u = `https://openlibrary.org/search.json?title=${encodeURIComponent(b.title)}`
      + `&author=${encodeURIComponent(b.author || '')}`
      + `&fields=title,ratings_average,ratings_count&limit=1`;
    const d = await (await fetch(u)).json();
    const doc = (d.docs || [])[0];
    if (doc && doc.ratings_average && (doc.ratings_count || 0) >= MIN_RATINGS
        && norm(doc.title).includes(norm(b.title).slice(0, 18))) {
      const r = Number(doc.ratings_average).toFixed(2);
      rows.push(`${b.slug},"${b.title.replace(/"/g, '""')}",${r}`);
      found++;
    }
  } catch (e) { /* skip on network hiccup */ }
  if (i % 25 === 0) console.log(`  …${i}/${books.length} (${found} matched)`);
  await sleep(150);
}

await fs.writeFile(path.join(ROOT, 'rating-backfill.csv'), rows.join('\n') + '\n');
console.log(`\n✓ ${found}/${books.length} books got a real rating → rating-backfill.csv`);
console.log('  Next: open rating-backfill.csv → paste into /admin → Import → then say "rebuild".');
