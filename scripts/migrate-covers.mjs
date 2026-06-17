#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
//  smutHub · one-time cover migration runner
//
//  Repeatedly calls the `rehost-cover` Edge Function in batch mode until every
//  external book cover has been rehosted onto Cloudflare R2 (covers.smuthub.ca).
//  Idempotent and safe to re-run — already-migrated books are skipped, and new
//  books added later get picked up on the next run.
//
//  Prerequisites (see migrations/R2-COVERS.md for the full runbook):
//    1. R2 bucket created + covers.smuthub.ca custom domain attached
//    2. migrations/2026-06-17-cover-source-url.sql applied
//    3. rehost-cover Edge Function deployed with its R2 secrets set
//
//  Usage:
//    FUNCTION_URL="https://<project-ref>.supabase.co/functions/v1/rehost-cover" \
//    ADMIN_TOKEN="<an admin user's access token>" \
//    node scripts/migrate-covers.mjs
//
//  Getting ADMIN_TOKEN — log into smutHub as your admin account, then in the
//  browser devtools console run:
//    JSON.parse(localStorage.getItem(
//      Object.keys(localStorage).find(k => k.endsWith('-auth-token'))
//    )).access_token
//  (Access tokens expire ~1h; if the run errors with 401, grab a fresh one.)
// ════════════════════════════════════════════════════════════════════════

const FUNCTION_URL = process.env.FUNCTION_URL;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const BATCH = Number(process.env.BATCH || 100);

if (!FUNCTION_URL || !ADMIN_TOKEN) {
  console.error("✗ Set FUNCTION_URL and ADMIN_TOKEN env vars. See the header of this file.");
  process.exit(1);
}

let round = 0, totalOk = 0, totalFail = 0, totalSkip = 0, prevRemaining = Infinity;

while (true) {
  round++;
  let res, data;
  try {
    res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ all: true, limit: BATCH }),
    });
    data = await res.json();
  } catch (e) {
    console.error(`✗ request failed: ${e.message}`);
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`✗ function error ${res.status}:`, JSON.stringify(data));
    if (res.status === 401) console.error("  (token likely expired — grab a fresh ADMIN_TOKEN and re-run; already-migrated books are skipped)");
    process.exit(1);
  }

  const ok = (data.migrated || []).length;
  const sk = (data.skipped || []).length;
  const fail = (data.failed || []).length;
  totalOk += ok; totalSkip += sk; totalFail += fail;

  console.log(`round ${round}: +${ok} migrated · ${sk} skipped · ${fail} failed · ${data.remaining ?? "?"} remaining`);
  for (const m of (data.migrated || [])) console.log(`   ✓ ${m.slug} (${m.bytes}b)`);
  for (const f of (data.failed || [])) console.log(`   ✗ ${f.slug}: ${f.reason}`);

  // stop when nothing remains, or remaining stopped dropping (only failures left)
  const remaining = data.remaining ?? 0;
  if (remaining <= 0) break;
  if (remaining >= prevRemaining) {
    console.log("\n⚠ No progress this round — the remaining books are all failing (see ✗ reasons above). Re-source those covers manually, then re-run.");
    break;
  }
  prevRemaining = remaining;
  if (round > 200) { console.error("safety stop after 200 rounds"); break; }
}

console.log(`\nDone. ${totalOk} migrated, ${totalSkip} skipped, ${totalFail} failed across ${round} round(s).`);
if (totalFail > 0) console.log("Failed books kept their original cover_url — re-source them in Manage catalog, then re-run this script.");
