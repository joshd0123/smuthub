const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ??
  Deno.env.get("search-trope-openAI-key") ??
  "";
const BOOK_SEARCH_MODEL = Deno.env.get("BOOK_SEARCH_MODEL") ?? "gpt-5.6-luna";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";

const ALLOWED_ORIGINS = new Set([
  "https://smuthub.ca",
  "https://www.smuthub.ca",
  "null",
]);

const DISCOVERY_CATEGORIES = new Set([
  "trope",
  "mood",
  "vibe",
  "theme",
  "warning",
  "setting",
  "kink",
  "mc-archetype",
  "li-archetype",
]);

type TagRow = { category: string; slug: string; label: string | null };
type BookRow = {
  slug: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  series: string | null;
  series_number: number | null;
  blurb: string | null;
  spice_level: number | null;
  pacing: string | null;
  ending: string | null;
  cliffhanger: boolean | null;
  triggers_detail: string | null;
  tag_ids: string[] | null;
  rating_avg: number | null;
  popularity: number | null;
  featured: boolean | null;
};

type Preferences = {
  wanted_tags: string[];
  avoided_tags: string[];
  spice_min: number;
  spice_max: number;
  avoid_cliffhanger: boolean;
  requires_hea: boolean;
  pace: "any" | "slow" | "steady" | "fast";
  summary: string;
};

let taxonomyCache: { expiresAt: number; tags: TagRow[] } | null = null;

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin)
      ? origin
      : "https://smuthub.ca",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

const json = (
  status: number,
  body: unknown,
  origin: string | null = null,
  extraHeaders: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin),
      ...extraHeaders,
    },
  });

function requestIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return req.headers.get("cf-connecting-ip") ??
    forwarded ??
    req.headers.get("x-real-ip") ??
    "unknown";
}

async function hmacSha256(value: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function visitorIdentifier(req: Request) {
  if (!SUPABASE_SERVICE_ROLE_KEY) return "";
  return await hmacSha256(requestIp(req), SUPABASE_SERVICE_ROLE_KEY);
}

async function supabaseGet<T>(path: string): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Accept": "application/json",
    },
  });
  if (!response.ok) throw new Error(`Supabase read failed: ${response.status}`);
  return await response.json() as T;
}

async function checkRateLimit(visitorHash: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Book search rate limiting is not configured");
    return { allowed: false, retry_after: 60, reason: "not_configured" };
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/check_trope_search_rate_limit`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_visitor_hash: visitorHash }),
    },
  );

  if (!response.ok) {
    console.error("Book search rate-limit check failed", response.status);
    return { allowed: false, retry_after: 60, reason: "check_failed" };
  }

  return await response.json() as {
    allowed: boolean;
    retry_after: number;
    remaining_hour?: number;
    reason?: string;
  };
}

function extractOutputText(data: Record<string, unknown>) {
  if (typeof data.output_text === "string") return data.output_text.trim();
  const output = Array.isArray(data.output) ? data.output : [];
  return output.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const content = (item as Record<string, unknown>).content;
    return Array.isArray(content) ? content : [];
  }).filter((part) => {
    if (!part || typeof part !== "object") return false;
    const value = part as Record<string, unknown>;
    return value.type === "output_text" && typeof value.text === "string";
  }).map((part) => String((part as Record<string, unknown>).text)).join("\n")
    .trim();
}

async function discoveryTags() {
  if (taxonomyCache && taxonomyCache.expiresAt > Date.now()) {
    return taxonomyCache.tags;
  }
  const rows = await supabaseGet<TagRow[]>(
    "tags?select=category,slug,label&order=category.asc,slug.asc&limit=1000",
  );
  const tags = rows.filter((tag) =>
    DISCOVERY_CATEGORIES.has(tag.category) && tag.slug && tag.label
  );
  taxonomyCache = { tags, expiresAt: Date.now() + 10 * 60 * 1000 };
  return tags;
}

function cleanTagList(value: unknown, allowed: Set<string>) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter((tag) => typeof tag === "string" && allowed.has(tag)),
    ),
  ].slice(0, 8);
}

function boundedSpice(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 5
    ? number
    : fallback;
}

function safeSummary(value: unknown) {
  return String(value ?? "Books closest to the feeling you described.")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

async function interpretQuery(
  query: string,
  visitorHash: string,
  tags: TagRow[],
) {
  const tagKeys = tags.map((tag) => `${tag.category}:${tag.slug}`);
  const taxonomy = tags.map((tag) =>
    `${tag.category}:${tag.slug} = ${tag.label}`
  ).join("\n");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  const clientRequestId = crypto.randomUUID();

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "X-Client-Request-Id": clientRequestId,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: BOOK_SEARCH_MODEL,
        instructions:
          `Turn a reader's natural-language request into structured preferences for the smutHub book catalogue.
Choose only keys from the supplied discovery taxonomy. Use wanted_tags for desired tropes, moods, settings, themes, archetypes, or kinks. Use avoided_tags for anything after no, not, without, avoid, skip, but not, or never.
Respect exclusions literally. Do not infer cruelty, possessiveness, darkness, high spice, or traumatic content unless requested.
Set spice_min and spice_max from 0 to 5. If spice is not mentioned, use 0 and 5.
Set avoid_cliffhanger only when the reader asks for a completed or non-cliffhanger ending. Set requires_hea only when they explicitly ask for a happily-ever-after.
Use pace only when the reader clearly asks for slow, steady, or fast pacing; otherwise use any.
Write summary as one short, natural sentence describing the requested reading feeling. Do not recommend or invent book titles.

DISCOVERY TAXONOMY
${taxonomy}`,
        input: query,
        reasoning: { effort: "none" },
        text: {
          format: {
            type: "json_schema",
            name: "smuthub_book_preferences",
            strict: true,
            schema: {
              type: "object",
              properties: {
                wanted_tags: {
                  type: "array",
                  minItems: 0,
                  maxItems: 8,
                  items: { type: "string", enum: tagKeys },
                },
                avoided_tags: {
                  type: "array",
                  minItems: 0,
                  maxItems: 8,
                  items: { type: "string", enum: tagKeys },
                },
                spice_min: { type: "integer", minimum: 0, maximum: 5 },
                spice_max: { type: "integer", minimum: 0, maximum: 5 },
                avoid_cliffhanger: { type: "boolean" },
                requires_hea: { type: "boolean" },
                pace: {
                  type: "string",
                  enum: ["any", "slow", "steady", "fast"],
                },
                summary: { type: "string" },
              },
              required: [
                "wanted_tags",
                "avoided_tags",
                "spice_min",
                "spice_max",
                "avoid_cliffhanger",
                "requires_hea",
                "pace",
                "summary",
              ],
              additionalProperties: false,
            },
          },
        },
        max_output_tokens: 400,
        store: false,
        // The HMAC is already pseudonymous and stable. Keep the identifier at
        // 64 characters so the Responses API accepts it without exposing an IP.
        safety_identifier: visitorHash || undefined,
      }),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException &&
      error.name === "AbortError";
    throw new Error(
      timedOut ? "OpenAI request timed out" : "OpenAI unavailable",
    );
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => ({})) as Record<
    string,
    unknown
  >;
  if (!response.ok) {
    const providerError = data.error as Record<string, unknown> | undefined;
    console.error("Book search OpenAI error", {
      status: response.status,
      diagnostic: String(
        providerError?.code ?? providerError?.type ?? "openai_error",
      ).slice(0, 80),
      clientRequestId,
      openAIRequestId: response.headers.get("x-request-id") ?? "unavailable",
    });
    throw new Error("OpenAI rejected the preference request");
  }

  const outputText = extractOutputText(data);
  if (!outputText) throw new Error("OpenAI returned no preferences");
  const raw = JSON.parse(outputText) as Record<string, unknown>;
  const allowed = new Set(tagKeys);
  const wanted = cleanTagList(raw.wanted_tags, allowed);
  const avoided = cleanTagList(raw.avoided_tags, allowed);
  const avoidedSet = new Set(avoided);
  const spiceMin = boundedSpice(raw.spice_min, 0);
  const spiceMax = Math.max(spiceMin, boundedSpice(raw.spice_max, 5));

  return {
    preferences: {
      wanted_tags: wanted.filter((tag) => !avoidedSet.has(tag)),
      avoided_tags: avoided,
      spice_min: spiceMin,
      spice_max: spiceMax,
      avoid_cliffhanger: raw.avoid_cliffhanger === true,
      requires_hea: raw.requires_hea === true,
      pace: ["slow", "steady", "fast"].includes(String(raw.pace))
        ? raw.pace as Preferences["pace"]
        : "any",
      summary: safeSummary(raw.summary),
    } satisfies Preferences,
  };
}

const BOOK_FIELDS = [
  "slug",
  "title",
  "author",
  "cover_url",
  "series",
  "series_number",
  "blurb",
  "spice_level",
  "pacing",
  "ending",
  "cliffhanger",
  "triggers_detail",
  "tag_ids",
  "rating_avg",
  "popularity",
  "featured",
].join(",");

async function fetchCandidates(preferences: Preferences) {
  const searchTags = preferences.wanted_tags.filter((tag) =>
    !tag.startsWith("warning:")
  );
  const params = new URLSearchParams({
    status: "eq.live",
    select: BOOK_FIELDS,
    cover_url: "not.is.null",
    blurb: "not.is.null",
    order: "featured.desc,popularity.desc,rating_avg.desc",
    limit: "80",
  });
  if (searchTags.length) {
    params.set("tag_ids", `ov.{${searchTags.join(",")}}`);
  }
  let books = await supabaseGet<BookRow[]>(`books?${params.toString()}`);

  if (books.length < 18) {
    params.delete("tag_ids");
    const broader = await supabaseGet<BookRow[]>(`books?${params.toString()}`);
    const merged = new Map(books.map((book) => [book.slug, book]));
    broader.forEach((book) => merged.set(book.slug, book));
    books = [...merged.values()];
  }
  return books;
}

function paceMatches(bookPace: string | null, wanted: Preferences["pace"]) {
  if (wanted === "any" || !bookPace) return false;
  const value = bookPace.toLowerCase();
  if (wanted === "slow") return value.includes("slow");
  if (wanted === "fast") {
    return value.includes("fast") || value.includes("quick");
  }
  return value.includes("steady") || value.includes("medium");
}

function exclusionInDetails(
  book: BookRow,
  avoided: string[],
  labels: Map<string, string>,
) {
  const details = String(book.triggers_detail ?? "").toLowerCase();
  if (!details) return false;
  return avoided.some((tag) => {
    if (!tag.startsWith("warning:")) return false;
    const slugPhrase = tag.split(":")[1].replace(/-/g, " ");
    const label = String(labels.get(tag) ?? "").toLowerCase();
    return (slugPhrase.length > 3 && details.includes(slugPhrase)) ||
      (label.length > 3 && details.includes(label));
  });
}

function queryWords(query: string) {
  const ignored = new Set([
    "with",
    "that",
    "this",
    "book",
    "read",
    "want",
    "give",
    "something",
    "lots",
    "very",
    "really",
    "from",
    "have",
    "but",
    "not",
    "without",
  ]);
  return query.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/)
    .filter((word) => word.length > 3 && !ignored.has(word));
}

function rankBooks(
  books: BookRow[],
  preferences: Preferences,
  tags: TagRow[],
  query: string,
) {
  const labels = new Map(tags.map((tag) => [
    `${tag.category}:${tag.slug}`,
    tag.label ?? tag.slug.replace(/-/g, " "),
  ]));
  const wanted = new Set(preferences.wanted_tags);
  const avoided = new Set(preferences.avoided_tags);
  const words = queryWords(query);

  const ranked = books.flatMap((book) => {
    const bookTags = new Set(book.tag_ids ?? []);
    if ([...avoided].some((tag) => bookTags.has(tag))) return [];
    if (exclusionInDetails(book, [...avoided], labels)) return [];
    if (
      book.spice_level !== null &&
      (book.spice_level < preferences.spice_min ||
        book.spice_level > preferences.spice_max)
    ) return [];
    const ending = String(book.ending ?? "").toLowerCase();
    if (
      preferences.avoid_cliffhanger &&
      (book.cliffhanger === true || ending.includes("cliff"))
    ) return [];
    if (preferences.requires_hea && !/(^|\b)hea(\b|$)/i.test(ending)) return [];

    const matched = [...wanted].filter((tag) => bookTags.has(tag));
    let score = matched.reduce((total, tag) => {
      if (tag.startsWith("trope:")) return total + 12;
      if (tag.startsWith("mood:") || tag.startsWith("vibe:")) return total + 9;
      return total + 7;
    }, 0);
    if (paceMatches(book.pacing, preferences.pace)) score += 5;
    if (book.featured) score += 2;
    score += Math.min(2, Number(book.rating_avg ?? 0) / 2.5);
    score += Math.min(
      2,
      Math.log10(Math.max(1, Number(book.popularity ?? 0) + 1)),
    );

    const searchable = `${book.title} ${book.blurb} ${
      (book.tag_ids ?? []).join(" ")
    }`.toLowerCase();
    score += words.filter((word) => searchable.includes(word)).length * 0.75;
    if (preferences.wanted_tags.length && !matched.length) score -= 8;

    return [{ book, matched, score, labels }];
  }).sort((a, b) =>
    b.score - a.score || a.book.title.localeCompare(b.book.title)
  );

  const selected: typeof ranked = [];
  const authors = new Set<string>();
  for (const item of ranked) {
    const author = String(item.book.author ?? "").toLowerCase();
    if (author && authors.has(author)) continue;
    selected.push(item);
    if (author) authors.add(author);
    if (selected.length === 3) break;
  }
  if (selected.length < 3) {
    for (const item of ranked) {
      if (selected.includes(item)) continue;
      selected.push(item);
      if (selected.length === 3) break;
    }
  }

  return selected.map(({ book, matched, labels: labelMap }) => {
    const matchedLabels = matched.map((tag) =>
      labelMap.get(tag) ?? tag.split(":")[1]
    )
      .slice(0, 3);
    const fit = matchedLabels.length
      ? `It brings together ${humanList(matchedLabels)}.`
      : "It is one of the closest available matches in the current catalogue.";
    const heat = book.spice_level === null
      ? ""
      : ` The catalogue rates it ${book.spice_level}/5 for spice.`;
    return {
      slug: book.slug,
      title: book.title,
      author: book.author ?? "Author unavailable",
      cover_url: book.cover_url,
      series: book.series,
      series_number: book.series_number,
      spice_level: book.spice_level,
      ending: book.ending,
      matched_tags: matched,
      reason: `${fit}${heat}`,
    };
  });
}

function humanList(values: string[]) {
  if (values.length < 2) return values[0] ?? "the feeling you described";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json(403, { error: "Origin not allowed" }, origin);
  }
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" }, origin);
  }
  if (!OPENAI_API_KEY) {
    return json(503, { error: "Book search is not configured" }, origin);
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > 2_048) {
    return json(413, { error: "Request is too large" }, origin);
  }

  let body: Record<string, unknown>;
  try {
    const bodyText = await req.text();
    if (new TextEncoder().encode(bodyText).byteLength > 2_048) {
      return json(413, { error: "Request is too large" }, origin);
    }
    body = JSON.parse(bodyText);
  } catch {
    return json(400, { error: "Send a valid JSON request" }, origin);
  }

  const query = String(body.query ?? "").replace(/\s+/g, " ").trim();
  if (query.length < 3) {
    return json(400, { error: "Describe the kind of read you want" }, origin);
  }
  if (query.length > 280) {
    return json(
      400,
      { error: "Keep your search under 280 characters" },
      origin,
    );
  }

  const visitorHash = await visitorIdentifier(req);
  const rateLimit = await checkRateLimit(visitorHash);
  if (!rateLimit.allowed) {
    const retryAfter = String(
      Math.max(1, Math.ceil(rateLimit.retry_after || 60)),
    );
    return json(
      429,
      { error: "Too many searches. Please try again shortly." },
      origin,
      {
        "Retry-After": retryAfter,
      },
    );
  }

  try {
    const tags = await discoveryTags();
    if (!tags.length) throw new Error("Discovery taxonomy is empty");
    const { preferences } = await interpretQuery(query, visitorHash, tags);
    const candidates = await fetchCandidates(preferences);
    const books = rankBooks(candidates, preferences, tags, query);
    return json(
      200,
      {
        books,
        summary: preferences.summary,
        mode: "ai-catalogue",
      },
      origin,
      {
        "X-RateLimit-Remaining-Hour": String(rateLimit.remaining_hour ?? ""),
      },
    );
  } catch (error) {
    console.error("Book search failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return json(
      502,
      { error: "Book search is temporarily unavailable" },
      origin,
    );
  }
});
