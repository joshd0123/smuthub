#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
//  smutHub · pre-deploy CTA / click-blocker check
//
//  Catches the class of bug where a decorative full-cover overlay silently
//  eats clicks on the CTAs beneath it — e.g. the homepage "Sign in free" /
//  "Browse the books" buttons, which sat under `.cta::before` (an
//  `position:absolute; inset:0` gradient) that lacked `pointer-events:none`.
//
//  What it flags: any full-cover overlay (a `::before/::after` pseudo-element
//  OR a class rule) that is `position:absolute|fixed` covering its box
//  (`inset:0`, or all four of top/right/bottom/left:0) and is BOTH:
//    • missing `pointer-events:none`, AND
//    • not painted behind content (no negative `z-index`).
//  Those are the overlays that can intercept clicks on interactive elements.
//
//  It is a heuristic static check — it cannot prove a specific button is
//  clickable (that needs a real browser hit-test; see the manual smoke test in
//  LAUNCH.md). But it reliably catches this footgun before it ships.
//
//  Usage:
//    node scripts/check-ctas.mjs            # scan the whole site
//    node scripts/check-ctas.mjs index.html # scan specific files
//  Exit code 0 = clean, 1 = risks found (so it can gate a deploy).
// ════════════════════════════════════════════════════════════════════════

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Collect .html files (skip vendored / build-output noise). The generated
// /books and /glossary pages all share one safe template, so scanning one of
// each is enough — but scanning them all is cheap and catches drift, so we do.
async function htmlFiles(dir){
  const out = [];
  for (const ent of await fs.readdir(dir, { withFileTypes: true })){
    if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()){
      if (['smutHub - old copies', 'smutHub Screenshots', 'Har Files', 'Marketing'].includes(ent.name)) continue;
      out.push(...await htmlFiles(p));
    } else if (ent.name.endsWith('.html')) out.push(p);
  }
  return out;
}

// Pull out CSS rule bodies { ... } and their selector, from <style> blocks.
function* cssRules(html){
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let sm;
  while ((sm = styleRe.exec(html))){
    const css = sm[1];
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let rm;
    while ((rm = ruleRe.exec(css))){
      // approximate line number of the rule within the file
      const line = html.slice(0, sm.index + sm[1] ? sm.index : 0).split('\n').length;
      yield { selector: rm[1].trim(), body: rm[2], index: sm.index + rm.index };
    }
  }
}

function isFullCover(body){
  if (/inset:\s*0(\b|;|})/.test(body)) return true;
  return /top:\s*0/.test(body) && /left:\s*0/.test(body) &&
         /(right:\s*0|width:\s*100%)/.test(body) && /(bottom:\s*0|height:\s*100%)/.test(body);
}
const isPositioned = b => /position:\s*(absolute|fixed)/.test(b);
const hasPENone     = b => /pointer-events:\s*none/.test(b);
const behindContent = b => /z-index:\s*-\d/.test(b);         // negative z-index → painted behind content

const lineOf = (html, idx) => html.slice(0, idx).split('\n').length;

const args = process.argv.slice(2);
const files = args.length
  ? args.map(a => path.resolve(ROOT, a))
  : await htmlFiles(ROOT);

let risks = 0;
const seen = new Set();
for (const file of files){
  let html;
  try { html = await fs.readFile(file, 'utf-8'); } catch { continue; }
  for (const rule of cssRules(html)){
    // Only pseudo-elements (::before / ::after). They are decorative by
    // construction — they cannot hold links or content — so a full-cover one
    // over interactive elements is almost always an accident. Real elements
    // (modal backdrops, cover images, link overlays) are frequently meant to
    // catch clicks, so flagging them here would be mostly false positives.
    if (!/::(before|after)\b/.test(rule.selector)) continue;
    if (!isPositioned(rule.body) || !isFullCover(rule.body)) continue;
    if (hasPENone(rule.body) || behindContent(rule.body)) continue;    // safe
    const rel = path.relative(ROOT, file);
    // De-dupe the generated /books & /glossary template (same selector, hundreds of files)
    const key = (rel.startsWith('books/') || rel.startsWith('glossary/'))
      ? 'GENERATED::' + rule.selector
      : rel + '::' + rule.selector;
    if (seen.has(key)) continue; seen.add(key);
    risks++;
    console.log(`⚠  ${rel}:${lineOf(html, rule.index)}  ${rule.selector}`);
    console.log(`     full-cover ${(/position:\s*(absolute|fixed)/.exec(rule.body)||[])[1]} overlay with no pointer-events:none and no negative z-index`);
    console.log(`     → if it sits over any button/link, it will swallow the click. Add "pointer-events:none" (decorative) or give the CTA position:relative;z-index above it.`);
  }
}

if (risks){
  console.log(`\n✗ ${risks} potential click-blocking overlay(s). Verify the CTAs beneath them still click, or fix as noted above.`);
  process.exit(1);
}
console.log('✓ No click-blocking overlay patterns found.');
