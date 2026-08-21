#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
//  smutHub · pre-import catalog CSV validator
//
//  Run this on a books CSV BEFORE bulk-importing it into the `books` table.
//  It catches the failure modes we've actually hit in past imports so a bad
//  sheet is fixed on disk instead of half-failing (or silently "leaking")
//  once it's in Supabase.
//
//  Two severities:
//    ERROR — the row WILL fail the import (a CHECK constraint, a type cast, a
//            duplicate primary key). Exit code 1. Fix before importing.
//    WARN  — imports fine but is wrong for the app: a cover that will 404, a
//            slug off-convention, an enum value the filters won't match.
//
//  What it checks:
//    • slug        — unique (PK); follows <title>-<surname>-<year>
//    • cover_url    — host is covers.smuthub.ca; filename === "<slug>.(jpg|png)"
//    • status       — in (draft, live, archived)      [CHECK constraint]
//    • spice_level  — whole integer, no half-steps     [int column]
//    • page_count / year / popularity — whole integers [int columns]
//    • created_at / updated_at — non-blank             [timestamptz insert]
//    • door         — in (open, fade, closed)
//    • age_category — in (YA, NA, Adult)
//    • duplicate (title, author) pairs
//
//  It adapts to the columns present: a template CSV (no slug/timestamps) skips
//  the checks that don't apply, so it works on both round-trip exports and
//  fresh import sheets.
//
//  Usage:
//    node scripts/validate-catalog-csv.mjs path/to/books.csv
//  Exit code 0 = clean (warnings allowed), 1 = at least one ERROR.
// ════════════════════════════════════════════════════════════════════════

import fs from 'fs/promises';

const COVER_HOST = 'covers.smuthub.ca';
const STATUS_OK  = new Set(['draft', 'live', 'archived']);
const DOOR_OK    = new Set(['open', 'fade', 'closed']);
const AGE_OK     = new Set(['YA', 'NA', 'Adult']);
const INT_COLS   = ['spice_level', 'page_count', 'year', 'popularity'];

// ── minimal RFC-4180 CSV parser (quotes, escaped "", embedded newlines) ──
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* skip */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

// ── site slug convention: lowercase, drop apostrophes and '&', hyphenate ──
const kebab = s => s.toLowerCase().replace(/&/g, ' ').replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
const surname = a => {
  const first = String(a || '').split(',')[0].replace(/[.,]/g, ' ');
  const toks = first.split(/\s+/).filter(Boolean);
  return toks.length ? kebab(toks[toks.length - 1]) : '';
};
const isWholeInt = v => {
  const s = String(v).trim();
  if (s === '') return true;           // blank → NULL, fine for nullable int
  const n = Number(s);
  return Number.isFinite(n) && Number.isInteger(n);
};

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/validate-catalog-csv.mjs <books.csv>'); process.exit(2); }

const rows = parseCSV(await fs.readFile(file, 'utf8'));
if (rows.length < 2) { console.error('CSV has no data rows'); process.exit(2); }
const hdr = rows[0];
const col = Object.fromEntries(hdr.map((h, n) => [h.trim(), n]));
const has = c => c in col;
const get = (r, c) => (has(c) ? (r[col[c]] ?? '').trim() : '');
const data = rows.slice(1);

const errors = [], warns = [];
const seenSlug = new Map();     // slug -> first row#
const seenTA = new Map();       // title|author -> first row#

data.forEach((r, idx) => {
  const line = idx + 2;         // 1-based, +1 for header → matches spreadsheet row
  const slug = get(r, 'slug');
  const title = get(r, 'title');
  const author = get(r, 'author');
  const tag = slug || title || `row ${line}`;
  const E = m => errors.push(`  row ${line}  [${tag}]  ${m}`);
  const W = m => warns.push(`  row ${line}  [${tag}]  ${m}`);

  // required
  if (!title) E('missing title (NOT NULL)');
  if (has('slug') && !slug) E('missing slug (primary key)');

  // duplicate slug (hard PK collision)
  if (slug) {
    if (seenSlug.has(slug)) E(`duplicate slug — also row ${seenSlug.get(slug)}`);
    else seenSlug.set(slug, line);
  }
  // duplicate title+author (soft — likely a re-add)
  if (title && author) {
    const k = (title + '|' + author).toLowerCase();
    if (seenTA.has(k)) W(`duplicate title+author — also row ${seenTA.get(k)}`);
    else seenTA.set(k, line);
  }

  // status CHECK constraint
  if (has('status')) {
    const s = get(r, 'status');
    if (!STATUS_OK.has(s)) E(`status "${s || '(blank)'}" violates CHECK (draft|live|archived)`);
  }

  // integer columns
  for (const c of INT_COLS) if (has(c) && !isWholeInt(get(r, c)))
    E(`${c} "${get(r, c)}" is not a whole integer (${c} is an int column)`);

  // timestamps must be present on insert
  for (const c of ['created_at', 'updated_at'])
    if (has(c) && !get(r, c)) E(`${c} is blank (empty string won't cast to timestamptz)`);

  // enum vocab (leaks, not errors)
  if (has('door')) { const d = get(r, 'door'); if (d && !DOOR_OK.has(d)) W(`door "${d}" off-vocab (open|fade|closed)`); }
  if (has('age_category')) { const a = get(r, 'age_category'); if (a && !AGE_OK.has(a)) W(`age_category "${a}" off-vocab (YA|NA|Adult)`); }

  // slug convention: <title>-<surname>-<year>
  if (slug && title && author) {
    const y = get(r, 'year').split('.')[0];
    const expect = `${kebab(title)}-${surname(author)}${y ? '-' + y : ''}`;
    if (slug !== expect) W(`slug off-convention — expected "${expect}"`);
  }

  // cover_url host + filename must match slug
  if (has('cover_url')) {
    const u = get(r, 'cover_url');
    if (u) {
      let host = '', base = '';
      try { const p = new URL(u); host = p.host; base = p.pathname.split('/').pop() || ''; } catch { W(`cover_url is not a valid URL: "${u}"`); }
      if (host && host !== COVER_HOST)
        W(`cover_url host "${host}" — use ${COVER_HOST} (external hosts hotlink-break/404)`);
      if (host === COVER_HOST && slug) {
        const stem = base.replace(/\.(jpe?g|png|webp)$/i, '');
        if (stem !== slug) W(`cover_url file "${base}" ≠ slug "${slug}" (cover will 404)`);
      }
    }
  }
});

// ── report ──
const bar = '─'.repeat(60);
console.log(`\n${bar}\n  Validating ${file}\n  ${data.length} data rows · ${hdr.length} columns\n${bar}`);
if (errors.length) { console.log(`\n❌ ERRORS (${errors.length}) — these rows WILL fail import:`); console.log(errors.join('\n')); }
if (warns.length)  { console.log(`\n⚠️  WARNINGS (${warns.length}) — import OK but wrong for the app:`); console.log(warns.join('\n')); }
if (!errors.length && !warns.length) console.log('\n✅ clean — no errors, no warnings.');
console.log(`\n${bar}\n  ${errors.length} error(s), ${warns.length} warning(s)\n${bar}\n`);
process.exit(errors.length ? 1 : 0);
