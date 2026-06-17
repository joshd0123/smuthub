// ════════════════════════════════════════════════════════════════════════
//  smutHub · rehost-cover  (Supabase Edge Function, Deno)
//
//  Admin-gated. Fetches a book's external cover image SERVER-SIDE (browsers
//  can't — Google/Amazon image hosts don't send CORS headers, so the bytes
//  can't be read client-side), stores it on Cloudflare R2 via the S3 API, and
//  points books.cover_url at the branded covers.smuthub.ca URL — preserving
//  the original in books.cover_source_url for audit.
//
//  This is the ONE server-side piece: it powers the one-time migration now
//  (scripts/migrate-covers.mjs calls it in batch mode) and can later power a
//  live "rehost on save" button in catalog-admin.
//
//  ── Request (POST JSON) ──────────────────────────────────────────────────
//    { "slug": "fourth-wing-yarros-2023" }          rehost one book (uses its
//                                                    current cover_url as source)
//    { "slug": "...", "source_url": "https://…" }   rehost one book from an
//                                                    explicit source URL
//    { "all": true, "limit": 25 }                   rehost a batch of not-yet-
//                                                    migrated books; returns
//                                                    `remaining` so the caller
//                                                    can loop until 0
//
//  ── Auth ─────────────────────────────────────────────────────────────────
//    Authorization: Bearer <a logged-in admin's access token>. The caller must
//    have profiles.is_admin = true.
//
//  ── Secrets (set via `supabase secrets set …`) ───────────────────────────
//    R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
//    R2_BUCKET          (optional, default "smuthub-covers")
//    COVERS_BASE_URL    (optional, default "https://covers.smuthub.ca")
//    SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.
// ════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID") ?? "";
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID") ?? "";
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "";
const R2_BUCKET = Deno.env.get("R2_BUCKET") ?? "smuthub-covers";
const COVERS_BASE_URL = (Deno.env.get("COVERS_BASE_URL") ?? "https://covers.smuthub.ca").replace(/\/+$/, "");

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MIN_BYTES = 1024;            // < 1 KB ⇒ almost certainly a broken/placeholder image

const CORS = {
  "Access-Control-Allow-Origin": "*", // auth is via bearer token, not cookies
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

const extFor = (ct: string) =>
  ct === "image/png" ? "png"
  : ct === "image/webp" ? "webp"
  : ct === "image/gif" ? "gif"
  : ct === "image/avif" ? "avif"
  : "jpg";

type Book = { slug: string; cover_url: string | null; cover_source_url: string | null };

interface Deps { admin: ReturnType<typeof createClient>; aws: AwsClient; }

async function rehostOne(d: Deps, book: Book, sourceOverride?: string) {
  const slug = book.slug;
  const src = (sourceOverride || book.cover_url || "").trim();
  if (!src) return { slug, ok: false, reason: "no source url" };
  if (src.startsWith(COVERS_BASE_URL)) return { slug, ok: true, skipped: "already on R2" };

  // 1. fetch the source image server-side (bypasses the browser CORS wall)
  let res: Response;
  try {
    res = await fetch(src, {
      headers: { "User-Agent": "smutHub-cover-rehost/1.0", "Referer": "https://smuthub.ca/" },
      redirect: "follow",
    });
  } catch (e) {
    return { slug, ok: false, reason: `fetch failed: ${(e as Error).message}` };
  }
  if (!res.ok) return { slug, ok: false, reason: `source returned ${res.status}` };

  const ct = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!ct.startsWith("image/")) return { slug, ok: false, reason: `not an image (content-type: ${ct || "none"})` };

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength < MIN_BYTES) return { slug, ok: false, reason: `too small (${bytes.byteLength}b) — likely broken/placeholder` };
  if (bytes.byteLength > MAX_BYTES) return { slug, ok: false, reason: `too large (${bytes.byteLength}b > 5MB)` };

  // 2. upload to R2 (S3 API, SigV4-signed by aws4fetch)
  const key = `${slug}.${extFor(ct)}`;
  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${encodeURIComponent(key)}`;
  let put: Response;
  try {
    put = await d.aws.fetch(endpoint, {
      method: "PUT",
      body: bytes,
      headers: { "Content-Type": ct, "Content-Length": String(bytes.byteLength) },
    });
  } catch (e) {
    return { slug, ok: false, reason: `r2 upload failed: ${(e as Error).message}` };
  }
  if (!put.ok) {
    const t = await put.text().catch(() => "");
    return { slug, ok: false, reason: `r2 returned ${put.status} ${t.slice(0, 200)}` };
  }

  // 3. point the DB at the branded URL; keep the original for audit (once)
  const newUrl = `${COVERS_BASE_URL}/${key}`;
  const update: Record<string, string> = { cover_url: newUrl };
  if (!book.cover_source_url) update.cover_source_url = src;
  const { error } = await d.admin.from("books").update(update).eq("slug", slug);
  if (error) return { slug, ok: false, reason: `db update failed: ${error.message}` };

  return { slug, ok: true, cover_url: newUrl, bytes: bytes.byteLength };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  // ── verify caller is an admin ──
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(401, { error: "missing Authorization bearer token" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json(401, { error: "invalid or expired token" });
  const { data: prof } = await admin.from("profiles").select("is_admin").eq("id", userData.user.id).maybeSingle();
  if (!prof?.is_admin) return json(403, { error: "admin only" });

  // ── config sanity ──
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    return json(500, { error: "R2 secrets not configured (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)" });
  }
  const aws = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
  const deps: Deps = { admin, aws };

  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  // ── batch mode ──
  if (body.all) {
    // High default so one round attempts the whole not-yet-migrated set; this
    // prevents a clump of broken sources from starving healthy books behind
    // them. Stable order keeps batching deterministic across rounds.
    const limit = Math.min(Number(body.limit) || 100, 200);
    const { data: books, error } = await admin
      .from("books")
      .select("slug,cover_url,cover_source_url")
      .not("cover_url", "is", null)
      .not("cover_url", "like", `${COVERS_BASE_URL}%`)
      .order("slug")
      .limit(limit);
    if (error) return json(500, { error: `books query failed: ${error.message}` });

    const results = [];
    for (const b of (books ?? []) as Book[]) results.push(await rehostOne(deps, b));

    const { count } = await admin
      .from("books")
      .select("slug", { count: "exact", head: true })
      .not("cover_url", "is", null)
      .not("cover_url", "like", `${COVERS_BASE_URL}%`);

    return json(200, {
      migrated: results.filter((r) => r.ok && !("skipped" in r)),
      skipped: results.filter((r) => "skipped" in r),
      failed: results.filter((r) => !r.ok),
      remaining: count ?? null,
    });
  }

  // ── single-book mode ──
  if (body.slug) {
    const { data: book, error } = await admin
      .from("books")
      .select("slug,cover_url,cover_source_url")
      .eq("slug", String(body.slug))
      .maybeSingle();
    if (error) return json(500, { error: `book query failed: ${error.message}` });
    if (!book) return json(404, { error: `book not found: ${body.slug}` });
    const r = await rehostOne(deps, book as Book, body.source_url ? String(body.source_url) : undefined);
    return json(r.ok ? 200 : 422, r);
  }

  return json(400, { error: 'provide { "slug": "…" } or { "all": true }' });
});
