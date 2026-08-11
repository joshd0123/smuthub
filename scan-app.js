const FREE_SCAN_LIMIT = 5;
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;
const STORAGE_KEY = "smuthub.scan.prototype.v3";

const canonicalBooks = {
  "book-fourth-wing": {
    id: "book-fourth-wing",
    catalogKey: "fourth-wing-yarros",
    title: "Fourth Wing",
    author: "Rebecca Yarros",
    series: "The Empyrean · Book 1",
    rating: "4.6",
    ratingCount: "2.1M ratings",
    communitySpice: 3,
    friends: "3 friends read this",
    friendDetail: "Amy rated it 5 ★ · Sarah is reading"
  },
  "book-acotar": {
    id: "book-acotar",
    catalogKey: "a-court-of-thorns-and-roses-maas",
    title: "A Court of Thorns and Roses",
    author: "Sarah J. Maas",
    series: "A Court of Thorns and Roses · Book 1",
    rating: "4.2",
    ratingCount: "3.4M ratings",
    communitySpice: 3,
    friends: "5 friends read this",
    friendDetail: "Kelly and 2 others rated it 5 ★"
  },
  "book-evelyn-hugo": {
    id: "book-evelyn-hugo",
    title: "The Seven Husbands of Evelyn Hugo",
    author: "Taylor Jenkins Reid",
    series: "Standalone novel",
    rating: "4.4",
    ratingCount: "3.6M ratings",
    communitySpice: 1,
    friends: "8 friends read this",
    friendDetail: "Average friend rating: 4.7 ★"
  }
};

const editions = {
  "9781649374042": {
    isbn: "9781649374042",
    bookId: "book-fourth-wing",
    format: "US hardcover",
    publisher: "Red Tower Books",
    cover: "https://covers.openlibrary.org/b/isbn/9781649374042-L.jpg"
  },
  "9780349437002": {
    isbn: "9780349437002",
    bookId: "book-fourth-wing",
    format: "UK paperback",
    publisher: "Piatkus",
    cover: "https://covers.openlibrary.org/b/isbn/9780349437002-L.jpg"
  },
  "9781635575569": {
    isbn: "9781635575569",
    bookId: "book-acotar",
    format: "US paperback",
    publisher: "Bloomsbury",
    cover: "https://covers.openlibrary.org/b/isbn/9781635575569-L.jpg"
  },
  "9781501161933": {
    isbn: "9781501161933",
    bookId: "book-evelyn-hugo",
    format: "US paperback",
    publisher: "Atria Books",
    cover: "https://covers.openlibrary.org/b/isbn/9781501161933-L.jpg"
  }
};

// High-traffic Canadian/US editions that public ISBN services commonly miss.
// They resolve to the canonical SmutHub title; this is deliberately edition
// data, not a second book catalog.
const catalogIsbnAliases = {
  "9781538774199": { slug: "quicksilver-hart-2024", format: "US/Canada hardcover", publisher: "Forever" },
  "9781538774212": { slug: "quicksilver-hart-2024", format: "US/Canada paperback", publisher: "Grand Central Publishing" },
  "9798328436045": { slug: "quicksilver-hart-2024", format: "Independently published edition", publisher: "Callie Hart" },
  "9781538774229": { slug: "brimstone-hart-2025", format: "US/Canada hardcover", publisher: "Forever" },
  "9781538774243": { slug: "brimstone-hart-2025", format: "Ebook edition", publisher: "Grand Central Publishing" },
  "9781538776001": { slug: "brimstone-hart-2025", format: "Standard hardcover", publisher: "Forever" },
  "9780593975183": { slug: "the-bridge-kingdom-jensen-2019", format: "US/Canada paperback", publisher: "Random House Worlds" },
  "9781733090308": { slug: "the-bridge-kingdom-jensen-2019", format: "Original paperback", publisher: "Context Literary Agency" },
  "9798228269088": { slug: "skyshade-aster-2025", format: "US/Canada hardcover", publisher: "Amulet Books" },
  "9781419773785": { slug: "skyshade-aster-2025", format: "US/Canada hardcover", publisher: "Amulet Books" },
  "9781419790942": { slug: "skyshade-aster-2025", format: "Collector's edition", publisher: "Amulet Books" },
  "9781952457258": { slug: "the-crown-of-gilded-bones-armentrout-2021", format: "Hardcover", publisher: "Blue Box Press" },
  "9781952457265": { slug: "the-crown-of-gilded-bones-armentrout-2021", format: "Hardcover", publisher: "Blue Box Press" },
  "9781952457630": { slug: "the-crown-of-gilded-bones-armentrout-2021", format: "Hardcover", publisher: "Blue Box Press" },
  "9781952457784": { slug: "the-crown-of-gilded-bones-armentrout-2021", format: "Paperback", publisher: "Blue Box Press" },
  "9781952457593": { slug: "the-crown-of-gilded-bones-armentrout-2021", format: "Indigo exclusive paperback", publisher: "Evil Eye Concepts" },
  "9781963135633": { slug: "the-crown-of-gilded-bones-armentrout-2021", format: "2024 edition", publisher: "Blue Box Press" }
};

const pendingIsbnAliases = {
  "9780063479791": { title: "Starside", author: "Alex Aster", format: "Standard hardcover", publisher: "Avon" },
  "9780063462434": { title: "Starside", author: "Alex Aster", format: "Deluxe limited edition", publisher: "HarperCollins" },
  "9780063489967": { title: "Starside", author: "Alex Aster", format: "Indigo exclusive hardcover", publisher: "HarperCollins" },
  "9780063475564": { title: "Starside", author: "Alex Aster", format: "Large print hardcover", publisher: "HarperCollins" },
  "9781037204654": { title: "Starside", author: "Alex Aster", format: "UK special edition", publisher: "Bloomsbury Publishing" }
};

const userBookState = {
  "book-fourth-wing": {
    readingStatus: "finished",
    readDate: "June 2024",
    rating: 4.5,
    spice: 3,
    note: "The tension was immaculate.",
    shelves: ["Read", "Favourites"],
    ownedEditions: ["9781649374042"]
  },
  "book-acotar": {
    readingStatus: "want",
    savedDate: "March 12",
    rating: null,
    spice: null,
    note: null,
    shelves: ["Want to Read"],
    ownedEditions: []
  },
  "book-evelyn-hugo": {
    readingStatus: "none",
    rating: null,
    spice: null,
    note: null,
    shelves: [],
    ownedEditions: []
  }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const cameraVideo = $("#cameraVideo");
const cameraStage = $("#cameraStage");
const cameraButton = $("#cameraButton");
const imageInput = $("#imageInput");
const resultDialog = $("#resultDialog");
const manualDialog = $("#manualDialog");
const helpDialog = $("#helpDialog");
const paywallDialog = $("#paywallDialog");
let activeMode = "isbn";
let cameraStream = null;
let scanTimer = null;
let zxingControls = null;
let currentMatch = null;
let demoIndex = 0;
let scanInProgress = false;

function defaultPrototypeState() {
  return { freeScansUsed: 0, lifetimeUnlocked: false, scanEvents: [], recent: [] };
}

function loadPrototypeState() {
  try {
    return { ...defaultPrototypeState(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return defaultPrototypeState();
  }
}

let prototypeState = loadPrototypeState();

function savePrototypeState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prototypeState));
  } catch {
    /* The demo still works in privacy modes that block persistent storage. */
  }
  updateQuotaUi();
  renderRecent();
}

function normalizeIsbn(value) {
  return value.replace(/[^0-9X]/gi, "").toUpperCase();
}

function validIsbn(value) {
  const isbn = normalizeIsbn(value);
  if (!/^\d{13}$/.test(isbn) && !/^\d{9}[\dX]$/.test(isbn)) return false;
  if (isbn.length === 13) {
    const sum = [...isbn].reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
    return sum % 10 === 0;
  }
  const sum = [...isbn].reduce((total, digit, index) => total + (digit === "X" ? 10 : Number(digit)) * (10 - index), 0);
  return sum % 11 === 0;
}

function isbn10to13(isbn) {
  if (isbn.length !== 10) return isbn;
  const core = `978${isbn.slice(0, 9)}`;
  const sum = [...core].reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
  return `${core}${(10 - (sum % 10)) % 10}`;
}

function setFeedback(message, duration = 1600) {
  const feedback = $("#scanFeedback");
  feedback.textContent = message;
  feedback.classList.add("show");
  window.setTimeout(() => feedback.classList.remove("show"), duration);
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  window.clearTimeout(el.toastTimer);
  el.toastTimer = window.setTimeout(() => el.classList.remove("show"), 2400);
}

function updateQuotaUi() {
  const chip = $("#quotaChip");
  chip.classList.remove("low", "unlocked");
  if (prototypeState.lifetimeUnlocked) {
    chip.textContent = "∞ scans unlocked";
    chip.classList.add("unlocked");
    return;
  }
  const remaining = Math.max(0, FREE_SCAN_LIMIT - prototypeState.freeScansUsed);
  chip.textContent = `${remaining} free scan${remaining === 1 ? "" : "s"}`;
  if (remaining <= 2) chip.classList.add("low");
}

function requestScanAccess() {
  if (prototypeState.lifetimeUnlocked || prototypeState.freeScansUsed < FREE_SCAN_LIMIT) return true;
  stopCamera();
  if (!paywallDialog.open) paywallDialog.showModal();
  return false;
}

function shouldCountScan(isbn) {
  if (prototypeState.lifetimeUnlocked) return false;
  const cutoff = Date.now() - DEDUPE_WINDOW_MS;
  return !prototypeState.scanEvents.some((event) => event.isbn === isbn && event.createdAt > cutoff);
}

function hasUsefulBookIdentity(match) {
  const title = match?.book?.title?.trim();
  const author = match?.book?.author?.trim();
  return Boolean(
    validIsbn(match?.edition?.isbn || "") &&
    title &&
    author &&
    !/^unknown author$|^author unavailable$/i.test(author) &&
    match.matchQuality !== "partial"
  );
}

function contextSummary(context) {
  if (context.readingStatus === "finished") return "Read · Your rating saved";
  if (context.readingStatus === "want") return "On Want to Read";
  return "New to you";
}

function recordSuccessfulScan(match) {
  if (!hasUsefulBookIdentity(match)) return false;
  const { edition, book, context } = match;
  if (shouldCountScan(edition.isbn)) {
    prototypeState.freeScansUsed = Math.min(FREE_SCAN_LIMIT, prototypeState.freeScansUsed + 1);
    prototypeState.scanEvents.unshift({ isbn: edition.isbn, bookId: book.id, createdAt: Date.now() });
    prototypeState.scanEvents = prototypeState.scanEvents.slice(0, 20);
  }
  prototypeState.recent = [
    { bookId: book.id, isbn: edition.isbn, title: book.title, cover: edition.cover, summary: contextSummary(context) },
    ...prototypeState.recent.filter((item) => item.bookId !== book.id)
  ].slice(0, 3);
  savePrototypeState();
  return true;
}

function emptyUserContext() {
  return { readingStatus: "none", rating: null, spice: null, note: null, shelves: [], ownedEditions: [] };
}

function safeCatalogKey(value) {
  return String(value || "book")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function canonicalTitle(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(?:collector'?s?|special|deluxe|exclusive|limited|signed|illustrated) edition\b.*$/i, "")
    .split(":")[0]
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function authorSurname(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().split(/\s+/).pop() || "";
}

async function fetchJson(url, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function catalogBookFromRow(data) {
  return {
    id: `catalog-${data.slug}`,
    catalogKey: data.slug,
    title: data.title,
    author: data.author || "Author unavailable",
    series: data.series ? `${data.series}${data.series_number ? ` · Book ${data.series_number}` : ""}` : "Matched in SmutHub",
    rating: data.rating_avg || "—",
    ratingCount: "SmutHub catalog",
    communitySpice: data.spice_level ?? "?",
    friends: "Friend activity coming soon",
    friendDetail: "Your private shelf is checked first"
  };
}

async function notifyCatalogReview(match, reason = "new-book") {
  const isbn = normalizeIsbn(match?.edition?.isbn || "");
  if (!isbn) return false;
  const notificationKey = `smuthub.scan.catalog-notified.${isbn}`;
  try { if (localStorage.getItem(notificationKey)) return true; } catch { /* Send without local dedupe. */ }

  const title = match?.book?.title || "Unknown title";
  const author = match?.book?.author || "Unknown author";
  const publisher = match?.edition?.publisher || "Unknown publisher";
  const reviewUrl = new URL("/catalog-admin.html", location.origin);
  reviewUrl.searchParams.set("scan_review", "1");
  reviewUrl.searchParams.set("isbn", isbn);
  reviewUrl.searchParams.set("title", title);
  reviewUrl.searchParams.set("author", author);
  reviewUrl.searchParams.set("publisher", publisher);
  if (match?.edition?.cover) reviewUrl.searchParams.set("cover", match.edition.cover);
  const message = [
    "Scanner catalog review request",
    `Reason: ${reason}`,
    `ISBN: ${isbn}`,
    `Title: ${title}`,
    `Author: ${author}`,
    `Publisher: ${publisher}`,
    `Source: ${match?.catalogStatus || "unmatched"}`,
    `Review and approve: ${reviewUrl}`
  ].join("\n");
  const jobs = [];

  if (window.SH?.sb && window.SH?.user) {
    jobs.push(window.SH.sb.from("feedback").insert({
      user_id: window.SH.user.id,
      page: "/scan/catalog-review",
      message
    }).then(({ error }) => { if (error) throw error; }));
  }

  const accessKey = window.SMUTHUB_CONFIG?.WEB3FORMS_KEY;
  if (accessKey) {
    jobs.push(fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: accessKey,
        subject: `SmutHub scanner: review ISBN ${isbn}`,
        from_name: "SmutHub Scanner",
        message
      })
    }).then((response) => { if (!response.ok) throw new Error("Notification failed"); }));
  }

  if (!jobs.length) return false;
  const results = await Promise.allSettled(jobs);
  const delivered = results.some((result) => result.status === "fulfilled");
  if (delivered) {
    try { localStorage.setItem(notificationKey, String(Date.now())); } catch { /* Notification already sent. */ }
  }
  return delivered;
}

function resolveLocalEdition(isbn, useDemoContext = false) {
  const edition = editions[isbn];
  if (!edition) return null;
  const sourceBook = canonicalBooks[edition.bookId];
  const book = useDemoContext ? sourceBook : { ...sourceBook, friends: "Friend activity coming soon", friendDetail: "Private friend matching is not enabled in this field test" };
  const context = useDemoContext ? (userBookState[book.id] || emptyUserContext()) : emptyUserContext();
  return { book, edition, context, catalogStatus: "smuthub", matchQuality: "full" };
}

async function liveUserContext(book) {
  if (!window.SH?.sb || !window.SH?.user || !book.catalogKey) return emptyUserContext();
  try {
    const [{ data: shelf }, { data: tags }] = await Promise.all([
      window.SH.sb.from("shelf").select("status").eq("user_id", window.SH.user.id).eq("book_key", book.catalogKey).maybeSingle(),
      window.SH.sb.from("book_tags").select("spice").eq("user_id", window.SH.user.id).eq("book_key", book.catalogKey).maybeSingle()
    ]);
    const status = shelf?.status || "none";
    const readingStatus = status === "read" ? "finished" : status === "reading" ? "reading" : status === "want" ? "want" : status === "dnf" ? "abandoned" : "none";
    return {
      ...emptyUserContext(),
      readingStatus,
      spice: tags?.spice || null,
      shelves: status === "none" ? [] : [status === "read" ? "Read" : status === "reading" ? "Currently Reading" : status === "dnf" ? "Did Not Finish" : "Want to Read"]
    };
  } catch {
    return emptyUserContext();
  }
}

async function findCatalogTitle(title, author) {
  if (!window.SH?.sb || !title) return null;
  const lookup = canonicalTitle(title).replace(/[%_]/g, "");
  if (!lookup) return null;
  const lookupPrefix = String(title).split(":")[0].split("(")[0].trim().replace(/[%_]/g, "");
  const { data, error } = await window.SH.sb.from("books")
    .select("slug,title,author,cover_url,series,series_number,isbn,publisher,spice_level,rating_avg")
    .ilike("title", `${lookupPrefix}%`).eq("status", "live").limit(8);
  if (error || !data?.length) return null;
  const exactTitle = data.filter((row) => canonicalTitle(row.title) === lookup);
  const pool = exactTitle.length ? exactTitle : data;
  const surname = authorSurname(author);
  return (surname && pool.find((row) => authorSurname(row.author) === surname || String(row.author || "").toLowerCase().includes(surname))) || pool[0];
}

async function resolveCatalogAlias(isbn) {
  const alias = catalogIsbnAliases[isbn];
  if (!alias || !window.SH?.sb) return null;
  const { data, error } = await window.SH.sb.from("books")
    .select("slug,title,author,cover_url,series,series_number,isbn,publisher,spice_level,rating_avg")
    .eq("slug", alias.slug).eq("status", "live").maybeSingle();
  if (error || !data) return null;
  const book = catalogBookFromRow(data);
  return {
    book,
    edition: {
      isbn,
      bookId: book.id,
      format: alias.format,
      publisher: alias.publisher || data.publisher || "Publisher unavailable",
      cover: data.cover_url || `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
    },
    context: await liveUserContext(book),
    catalogStatus: "smuthub",
    matchQuality: "full"
  };
}

async function resolvePendingAlias(isbn) {
  const alias = pendingIsbnAliases[isbn];
  if (!alias) return null;
  const book = {
    id: `isbn-${isbn}`,
    catalogKey: `pending-isbn-${isbn}-${safeCatalogKey(alias.title)}`,
    title: alias.title,
    author: alias.author,
    series: "New title awaiting SmutHub catalog review",
    rating: "—",
    ratingCount: "Community details are being added",
    communitySpice: "?",
    friends: "You found a new book for the Hub",
    friendDetail: "You can save it now while we prepare its full community profile"
  };
  return {
    book,
    edition: {
      isbn,
      bookId: book.id,
      format: alias.format,
      publisher: alias.publisher,
      cover: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
    },
    context: await liveUserContext(book),
    catalogStatus: "external",
    matchQuality: "identified"
  };
}

async function googleBooksMetadata(isbn) {
  const key = window.SMUTHUB_CONFIG?.GOOGLE_BOOKS_KEY;
  const params = new URLSearchParams({ q: `isbn:${isbn}`, maxResults: "5", printType: "books" });
  if (key) params.set("key", key);
  let data = await fetchJson(`https://www.googleapis.com/books/v1/volumes?${params}`);
  // A misconfigured browser key must not disable Google's normal anonymous
  // allowance. Retry without it before moving to Open Library and aliases.
  if (!data?.items?.length && key) {
    params.delete("key");
    data = await fetchJson(`https://www.googleapis.com/books/v1/volumes?${params}`);
  }
  const item = data?.items?.find((entry) => entry.volumeInfo?.industryIdentifiers?.some((id) => normalizeIsbn(id.identifier) === isbn)) || data?.items?.[0];
  if (!item?.volumeInfo?.title) return null;
  const info = item.volumeInfo;
  return {
    title: info.title,
    author: info.authors?.[0] || "Author unavailable",
    publisher: info.publisher || "Publisher unavailable",
    format: info.printType === "BOOK" ? "Google Books edition" : "This edition",
    series: info.subtitle || "Book identified by ISBN",
    cover: (info.imageLinks?.large || info.imageLinks?.medium || info.imageLinks?.thumbnail || "").replace(/^http:/, "https:"),
    sourceId: item.id
  };
}

async function openLibraryMetadata(isbn) {
  const edition = await fetchJson(`https://openlibrary.org/isbn/${isbn}.json`);
  if (edition) {
    const workKey = edition.works?.[0]?.key;
    const work = workKey ? (await fetchJson(`https://openlibrary.org${workKey}.json`) || {}) : {};
    const authorKey = [...(edition.authors || []), ...(work.authors || [])]
      .map((entry) => entry.author?.key || entry.key).find(Boolean);
    const authorData = authorKey ? await fetchJson(`https://openlibrary.org${authorKey}.json`) : null;
    const coverId = edition.covers?.find((id) => id > 0) || work.covers?.find((id) => id > 0);
    return {
      title: work.title || edition.title,
      author: authorData?.name || "Author unavailable",
      publisher: edition.publishers?.[0] || "Publisher unavailable",
      format: edition.physical_format || "This edition",
      series: edition.series?.[0] || "Book identified by ISBN",
      cover: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : "",
      sourceId: workKey || edition.key
    };
  }
  const search = await fetchJson(`https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&limit=5`);
  const doc = search?.docs?.[0];
  if (!doc?.title) return null;
  return {
    title: doc.title,
    author: doc.author_name?.[0] || "Author unavailable",
    publisher: doc.publisher?.[0] || "Publisher unavailable",
    format: "Open Library edition",
    series: doc.series?.[0] || "Book identified by ISBN",
    cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : "",
    sourceId: doc.key
  };
}

async function findBook(rawIsbn) {
  const normalized = isbn10to13(normalizeIsbn(rawIsbn));
  const localMatch = resolveLocalEdition(normalized);
  if (localMatch) {
    localMatch.context = await liveUserContext(localMatch.book);
    return localMatch;
  }

  if (window.SH?.sb) {
    try {
      const { data } = await window.SH.sb.from("books")
        .select("slug,title,author,cover_url,series,series_number,isbn,publisher,spice_level,rating_avg")
        .eq("isbn", normalized).eq("status", "live").maybeSingle();
      if (data) {
        const book = catalogBookFromRow(data);
        return {
          book,
          edition: { isbn: normalized, bookId: book.id, format: "Catalog edition", publisher: data.publisher || "Publisher unavailable", cover: data.cover_url || `https://covers.openlibrary.org/b/isbn/${normalized}-L.jpg` },
          context: await liveUserContext(book),
          catalogStatus: "smuthub",
          matchQuality: "full"
        };
      }
    } catch { /* Continue to the public metadata fallback. */ }
  }

  const aliasMatch = await resolveCatalogAlias(normalized);
  if (aliasMatch) return aliasMatch;
  const pendingMatch = await resolvePendingAlias(normalized);
  if (pendingMatch) return pendingMatch;

  try {
    const [google, openLibrary] = await Promise.all([
      googleBooksMetadata(normalized),
      openLibraryMetadata(normalized)
    ]);
    const metadata = google || openLibrary;
    if (!metadata?.title) return null;
    const title = metadata.title;
    const author = metadata.author !== "Author unavailable" ? metadata.author : (openLibrary?.author || google?.author || "Author unavailable");
    const bookId = metadata.sourceId || `isbn-${normalized}`;
    const matchQuality = title && author !== "Author unavailable" ? "identified" : "partial";
    const scannedEdition = {
      isbn: normalized,
      bookId,
      format: metadata.format || openLibrary?.format || google?.format || "This edition",
      publisher: metadata.publisher || openLibrary?.publisher || google?.publisher || "Publisher unavailable",
      cover: metadata.cover || openLibrary?.cover || google?.cover || `https://covers.openlibrary.org/b/isbn/${normalized}-L.jpg`
    };

    // An ISBN can be absent from our catalog row even when its parent title is
    // already present. Resolve the canonical title after public metadata fills
    // in the title/author; this is the path that connects collector editions.
    if (window.SH?.sb && title && author !== "Author unavailable") {
      try {
        const canonical = await findCatalogTitle(title, author);
        if (canonical) {
          const book = catalogBookFromRow(canonical);
          scannedEdition.bookId = book.id;
          if (!metadata.cover && canonical.cover_url) scannedEdition.cover = canonical.cover_url;
          return {
            book,
            edition: scannedEdition,
            context: await liveUserContext(book),
            catalogStatus: "smuthub",
            matchQuality: "full"
          };
        }
      } catch { /* Keep the public match and queue it for catalog review. */ }
    }

    const externalBook = {
        id: bookId,
        catalogKey: `pending-isbn-${normalized}-${safeCatalogKey(title)}`,
        title: title || "Title unavailable",
        author,
        series: metadata.series || "Book identified by ISBN",
        rating: "—",
        ratingCount: "Community details are being added",
        communitySpice: "?",
        friends: "You found a new book for the Hub",
        friendDetail: "You can save it now while we prepare its full community profile"
    };
    return {
      book: externalBook,
      edition: scannedEdition,
      context: await liveUserContext(externalBook),
      catalogStatus: "external",
      matchQuality
    };
  } catch {
    return null;
  }
}

function readingPresentation(context) {
  if (context.readingStatus === "finished") {
    const details = context.readDate && context.rating
      ? `Finished ${context.readDate} · You rated it ${context.rating} ★`
      : context.rating ? `You rated it ${context.rating} ★` : "Marked as read on your SmutHub shelf";
    return { icon: "✓", label: "You’ve read this book", detail: details, state: "Finished", action: "Add this edition", notes: Boolean(context.note) };
  }
  if (context.readingStatus === "reading") return { icon: "↻", label: "You’re currently reading this", detail: "Already on your Currently Reading shelf", state: "Reading", action: "View progress", notes: Boolean(context.note) };
  if (context.readingStatus === "abandoned") return { icon: "×", label: "You did not finish this book", detail: "Previously marked Did Not Finish", state: "DNF", action: "Try it again", notes: Boolean(context.note) };
  if (context.readingStatus === "want") {
    return { icon: "⌁", label: "Already on your shelf", detail: context.savedDate ? `Saved to Want to Read · ${context.savedDate}` : "Saved to Want to Read", state: "Want to read", action: "✓ On want to read", notes: false };
  }
  return { icon: "+", label: "This book is new to you", detail: "No reading history or shelf activity yet", state: "Not started", action: "Add to want to read", notes: false };
}

function renderEditionRelationship(match) {
  const { edition, context } = match;
  const notice = $("#editionNotice");
  const ownedEdition = context.ownedEditions.map((isbn) => editions[isbn]).find(Boolean);
  const ownsScannedEdition = context.ownedEditions.includes(edition.isbn);
  notice.classList.toggle("same-edition", ownsScannedEdition);
  notice.classList.toggle("external-book", match.catalogStatus === "external");
  notice.querySelector(":scope > span").textContent = ownsScannedEdition ? "✓" : "↗";

  if (match.catalogStatus === "external") {
    notice.querySelector(":scope > span").textContent = match.matchQuality === "partial" ? "!" : "+";
    $("#editionHeadline").textContent = match.matchQuality === "partial" ? "We’re checking this ISBN — no scan used" : "Full profile is on its way";
    $("#editionDetail").textContent = match.matchQuality === "partial"
      ? "We notified the catalog team because the public book information is incomplete."
      : "Save it now. The catalog team has been notified to review and complete its SmutHub page.";
  } else if (ownsScannedEdition) {
    $("#editionHeadline").textContent = "This exact edition is in your library";
    $("#editionDetail").textContent = `${edition.format} · ${edition.publisher}`;
  } else if (ownedEdition) {
    $("#editionHeadline").textContent = "You know this book — different edition";
    $("#editionDetail").textContent = `You own the ${ownedEdition.format}. You’re scanning the ${edition.format}.`;
  } else if (context.readingStatus === "finished") {
    $("#editionHeadline").textContent = "You read this title in another format";
    $("#editionDetail").textContent = `This scan is the ${edition.format}; your reading history still carries across editions.`;
  } else {
    $("#editionHeadline").textContent = "Edition identified";
    $("#editionDetail").textContent = `${edition.format} · ${edition.publisher}`;
  }
}

function renderBook(match, { countScan = true } = {}) {
  currentMatch = match;
  const { book, edition, context } = match;
  const acceptedResult = !countScan || recordSuccessfulScan(match);
  const presentation = readingPresentation(context);
  const ownsScannedEdition = context.ownedEditions.includes(edition.isbn);

  $("#resultCover").src = edition.cover;
  $("#resultCover").alt = `${book.title} cover`;
  $("#resultSeries").textContent = book.series;
  $("#resultTitle").textContent = book.title;
  $("#resultAuthor").textContent = `by ${book.author}`;
  $("#resultRating").textContent = book.rating;
  $("#ratingCount").textContent = book.ratingCount;
  $("#spiceBadge").textContent = context.spice ? `Your 🌶 ${context.spice}` : `🌶 ${book.communitySpice}`;
  const externalMatch = match.catalogStatus === "external";
  $("#matchPill").classList.toggle("external", externalMatch && match.matchQuality !== "partial");
  $("#matchPill").classList.toggle("partial", match.matchQuality === "partial");
  $("#matchIcon").textContent = match.matchQuality === "partial" ? "!" : externalMatch ? "+" : "✓";
  $("#matchText").textContent = match.matchQuality === "partial" ? "Checking this book · no scan used" : externalMatch ? "Book identified" : "Book found";
  $("#friendHeadline").textContent = book.friends;
  $("#friendDetail").textContent = book.friendDetail;
  $("#isbnMeta").textContent = `${edition.format} matched via ISBN ${edition.isbn}`;
  $("#memoryIcon").textContent = presentation.icon;
  $("#memoryLabel").textContent = presentation.label;
  $("#memoryDetail").textContent = presentation.detail;
  $("#readingState").textContent = presentation.state;
  $("#ownershipState").textContent = ownsScannedEdition ? "Own this edition" : context.ownedEditions.length ? "Own another edition" : "Don’t own";
  $("#shelfState").textContent = context.shelves[0] || "No shelf";
  $("#shelfButton").textContent = presentation.action;
  $("#shelfButton").disabled = context.readingStatus === "want";
  if (match.matchQuality === "partial") {
    $("#shelfButton").textContent = "Sent for catalog review ✓";
    $("#shelfButton").disabled = true;
  }
  $("#detailsButton").textContent = externalMatch ? "Profile requested ✓" : "View book details";
  $("#detailsButton").disabled = externalMatch;
  $("#notesButton").hidden = !presentation.notes;
  renderEditionRelationship(match);
  if (!resultDialog.open) resultDialog.showModal();
  if (countScan && !acceptedResult) toast("Incomplete match — you still have all your scans.");
  if (externalMatch) notifyCatalogReview(match, match.matchQuality === "partial" ? "incomplete-metadata" : "new-book");
}

async function processIsbn(isbn) {
  if (scanInProgress || !requestScanAccess()) return;
  scanInProgress = true;
  setFeedback("ISBN found — matching edition…", 2200);
  try {
    const match = await findBook(isbn);
    stopCamera();
    if (match) renderBook(match);
    else {
      notifyCatalogReview({
        book: { title: "Unknown title", author: "Unknown author" },
        edition: { isbn: isbn10to13(normalizeIsbn(isbn)), publisher: "Unknown publisher" },
        catalogStatus: "unmatched"
      }, "isbn-not-found");
      toast("Barcode read. We sent this ISBN for review—no scan used.");
      setFeedback("No scan used — try again or type the ISBN", 3200);
    }
  } finally {
    scanInProgress = false;
  }
}

async function startCamera() {
  if (!requestScanAccess()) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    toast("Camera isn’t available here. Choose a photo or type the ISBN.");
    return;
  }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    const videoTrack = cameraStream.getVideoTracks()[0];
    const capabilities = videoTrack?.getCapabilities?.();
    if (capabilities?.focusMode?.includes?.("continuous")) {
      await videoTrack.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
    }
    cameraVideo.srcObject = cameraStream;
    await cameraVideo.play();
    cameraStage.classList.add("camera-on");
    cameraButton.querySelector("span").textContent = "Close camera";
    if (activeMode === "isbn") startBarcodeDetection();
    else setFeedback("Hold the front cover inside the frame");
  } catch {
    toast("Camera permission was blocked. You can upload a photo or type the ISBN.");
  }
}

function stopCamera() {
  window.clearInterval(scanTimer);
  scanTimer = null;
  zxingControls?.stop();
  zxingControls = null;
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  cameraVideo.srcObject = null;
  cameraStage.classList.remove("camera-on");
  cameraButton.querySelector("span").textContent = "Open camera";
}

async function startBarcodeDetection() {
  if (!("BarcodeDetector" in window)) {
    return startZxingDetection();
  }
  let detector;
  try {
    const supported = await BarcodeDetector.getSupportedFormats();
    const formats = ["ean_13", "ean_8", "upc_a", "upc_e"].filter((format) => supported.includes(format));
    if (!formats.length) return startZxingDetection();
    detector = new BarcodeDetector({ formats });
  } catch {
    return startZxingDetection();
  }
  scanTimer = window.setInterval(async () => {
    if (cameraVideo.readyState < 2) return;
    try {
      const codes = await detector.detect(cameraVideo);
      const isbn = codes.map((code) => normalizeIsbn(code.rawValue)).find((value) => value.length === 13 && (value.startsWith("978") || value.startsWith("979")));
      if (isbn) {
        window.clearInterval(scanTimer);
        navigator.vibrate?.(80);
        processIsbn(isbn);
      }
    } catch { /* Individual video frames can fail while scanning continues. */ }
  }, 450);
}

async function startZxingDetection() {
  if (!window.ZXingBrowser?.BrowserMultiFormatOneDReader) {
    setFeedback("Live scan unavailable — take a photo or type the ISBN", 3200);
    return;
  }
  setFeedback("Scanner ready — hold the barcode steady", 2400);
  try {
    const reader = new ZXingBrowser.BrowserMultiFormatOneDReader();
    let matched = false;
    zxingControls = await reader.decodeFromStream(cameraStream, cameraVideo, (result, error, controls) => {
      if (!result || matched) return;
      const raw = typeof result.getText === "function" ? result.getText() : result.text;
      const isbn = normalizeIsbn(raw || "");
      if (isbn.length === 13 && (isbn.startsWith("978") || isbn.startsWith("979"))) {
        matched = true;
        controls.stop();
        navigator.vibrate?.(80);
        processIsbn(isbn);
      }
    });
  } catch {
    setFeedback("Couldn’t start live detection — try a photo", 2800);
  }
}

async function detectIsbnFromPhoto(file) {
  if ("BarcodeDetector" in window) {
    try {
      const bitmap = await createImageBitmap(file);
      const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a"] });
      const codes = await detector.detect(bitmap);
      const isbn = codes.map((code) => normalizeIsbn(code.rawValue)).find((value) => value.startsWith("978") || value.startsWith("979"));
      if (isbn) return isbn;
    } catch { /* Try the cross-browser decoder next. */ }
  }
  if (window.ZXingBrowser?.BrowserMultiFormatOneDReader) {
    const imageUrl = URL.createObjectURL(file);
    try {
      const reader = new ZXingBrowser.BrowserMultiFormatOneDReader();
      const result = await reader.decodeFromImageUrl(imageUrl);
      const raw = typeof result.getText === "function" ? result.getText() : result.text;
      const isbn = normalizeIsbn(raw || "");
      if (isbn.startsWith("978") || isbn.startsWith("979")) return isbn;
    } catch { /* Report a friendly no-match below. */ }
    finally { URL.revokeObjectURL(imageUrl); }
  }
  return null;
}

function updateModeUi() {
  $$(".mode").forEach((button) => {
    const selected = button.dataset.mode === activeMode;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  cameraStage.classList.toggle("cover-mode", activeMode === "cover");
  $("#cameraPlaceholder strong").textContent = activeMode === "isbn" ? "Point at the ISBN barcode" : "Frame the entire front cover";
  $("#cameraPlaceholder small").textContent = activeMode === "isbn" ? "Fit the full barcode inside the wide frame" : "Good lighting improves the match";
  if (cameraStream) {
    window.clearInterval(scanTimer);
    if (activeMode === "isbn") startBarcodeDetection();
    else setFeedback("Cover recognition preview");
  }
}

function renderRecent() {
  const section = $("#recentSection");
  const list = $("#recentList");
  list.replaceChildren();
  section.hidden = prototypeState.recent.length === 0;
  prototypeState.recent.forEach((item) => {
    const button = document.createElement("button");
    button.className = "recent-book";
    button.type = "button";
    const image = document.createElement("img");
    image.src = item.cover;
    image.alt = "";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.title;
    const summary = document.createElement("span");
    summary.textContent = item.summary;
    copy.append(title, summary);
    button.append(image, copy);
    button.addEventListener("click", async () => {
      const match = await findBook(item.isbn);
      if (match) renderBook(match, { countScan: false });
    });
    list.append(button);
  });
}

$$(".mode").forEach((button) => button.addEventListener("click", () => {
  activeMode = button.dataset.mode;
  updateModeUi();
}));

cameraButton.addEventListener("click", () => cameraStream ? stopCamera() : startCamera());
$("#photoButton").addEventListener("click", () => { if (requestScanAccess()) imageInput.click(); });
$("#manualButton").addEventListener("click", () => { if (requestScanAccess()) manualDialog.showModal(); });
$("#closeManual").addEventListener("click", () => manualDialog.close());
$("#helpButton").addEventListener("click", () => helpDialog.showModal());
$("#closeHelp").addEventListener("click", () => helpDialog.close());
$("#closeResult").addEventListener("click", () => resultDialog.close());
$("#closePaywall").addEventListener("click", () => paywallDialog.close());

$("#isbnForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const isbn = normalizeIsbn($("#isbnInput").value);
  if (!validIsbn(isbn)) {
    $("#isbnError").textContent = "Check the number — this doesn’t look like a valid ISBN.";
    return;
  }
  $("#isbnError").textContent = "";
  manualDialog.close();
  await processIsbn(isbn);
});

imageInput.addEventListener("change", async () => {
  const file = imageInput.files?.[0];
  if (!file || !requestScanAccess()) return;
  if (activeMode === "isbn") {
    const isbn = await detectIsbnFromPhoto(file);
    if (isbn) {
      imageInput.value = "";
      return processIsbn(isbn);
    }
    toast("No ISBN found in that photo. Try a sharper image or type it in.");
  } else if (activeMode === "cover") {
    setFeedback("Matching cover…", 1800);
    window.setTimeout(() => renderBook(resolveLocalEdition("9781635575569", true)), 900);
  }
  imageInput.value = "";
});

$("#demoButton").addEventListener("click", () => {
  if (!requestScanAccess()) return;
  const demoIsbns = ["9780349437002", "9781635575569", "9781501161933"];
  const isbn = demoIsbns[demoIndex % demoIsbns.length];
  demoIndex += 1;
  setFeedback("ISBN found — matching edition…", 1900);
  window.setTimeout(() => renderBook(resolveLocalEdition(isbn, true)), 500);
});

$("#shelfButton").addEventListener("click", async () => {
  if (!currentMatch) return;
  const { context, edition, book } = currentMatch;
  if (!window.SH?.user || !window.SH?.sb) {
    toast("Sign in to save this book to your shelf");
    window.SH?.openAuth?.();
    return;
  }
  const bookKey = book.catalogKey || `pending-isbn-${edition.isbn}-${safeCatalogKey(book.title)}`;
  const shelfStatus = context.readingStatus === "finished" ? "read" : context.readingStatus === "reading" ? "reading" : "want";
  const payload = {
    user_id: window.SH.user.id,
    book_key: bookKey,
    status: shelfStatus,
    title: book.title,
    author: book.author,
    cover_url: edition.cover || null
  };
  if (shelfStatus === "read") payload.finished_at = new Date().toISOString();
  let { error } = await window.SH.sb.from("shelf").upsert(payload, { onConflict: "user_id,book_key" });
  if (error && /cover_url/i.test(error.message || "")) {
    delete payload.cover_url;
    ({ error } = await window.SH.sb.from("shelf").upsert(payload, { onConflict: "user_id,book_key" }));
  }
  if (error) {
    toast(`Couldn’t save this book: ${error.message}`);
    return;
  }
  const { data: saved, error: verifyError } = await window.SH.sb.from("shelf")
    .select("book_key,status")
    .eq("user_id", window.SH.user.id)
    .eq("book_key", bookKey)
    .maybeSingle();
  if (verifyError || !saved || saved.status !== shelfStatus) {
    toast("The shelf did not confirm the save. Please try again.");
    return;
  }
  book.catalogKey = bookKey;
  currentMatch.context = await liveUserContext(book);
  let message = "Added to Want to Read";
  if (context.readingStatus === "finished") message = `Added the ${edition.format} to your library`;
  if (context.readingStatus === "want") message = "Marked as purchased";
  toast(`${message} · Undo`);
  $("#shelfButton").textContent = "✓ Saved";
  $("#shelfButton").disabled = true;
  $("#memoryLabel").textContent = currentMatch.context.readingStatus === "finished" ? "You’ve read this book" : "Already on your shelf";
  $("#memoryDetail").textContent = currentMatch.context.readingStatus === "finished" ? "Marked as read on your SmutHub shelf" : "Saved to Want to Read";
  $("#readingState").textContent = currentMatch.context.readingStatus === "finished" ? "Finished" : "Want to read";
  $("#shelfState").textContent = currentMatch.context.shelves[0] || "Want to Read";
});

$("#notesButton").addEventListener("click", () => toast(`Your note: “${currentMatch?.context.note || "No note yet"}”`));
$("#detailsButton").addEventListener("click", () => toast("Full canonical book profile would open here"));
$("#clearRecentButton").addEventListener("click", () => {
  prototypeState.recent = [];
  savePrototypeState();
  toast("Recent scans cleared");
});

$("#previewPaywallButton").addEventListener("click", () => {
  prototypeState.freeScansUsed = FREE_SCAN_LIMIT;
  prototypeState.lifetimeUnlocked = false;
  savePrototypeState();
  helpDialog.close();
  paywallDialog.showModal();
});

$("#resetPrototypeButton").addEventListener("click", () => {
  prototypeState = defaultPrototypeState();
  savePrototypeState();
  helpDialog.close();
  toast("Prototype reset: 5 free scans available");
});

$("#unlockButton").addEventListener("click", () => {
  prototypeState.lifetimeUnlocked = true;
  savePrototypeState();
  paywallDialog.close();
  toast("Prototype unlocked forever — no payment taken");
});

document.addEventListener("visibilitychange", () => { if (document.hidden) stopCamera(); });
updateQuotaUi();
renderRecent();
