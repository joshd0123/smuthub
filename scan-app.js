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
      window.SH.sb.from("shelf").select("status").eq("book_key", book.catalogKey).maybeSingle(),
      window.SH.sb.from("book_tags").select("spice").eq("book_key", book.catalogKey).maybeSingle()
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

  try {
    const response = await fetch(`https://openlibrary.org/isbn/${normalized}.json`);
    if (!response.ok) throw new Error("Not found");
    const data = await response.json();
    const workKey = data.works?.[0]?.key;
    let work = {};
    if (workKey) {
      const workResponse = await fetch(`https://openlibrary.org${workKey}.json`);
      if (workResponse.ok) work = await workResponse.json();
    }
    const authorKeys = [
      ...(data.authors || []).map((entry) => entry.key),
      ...(work.authors || []).map((entry) => entry.author?.key || entry.key)
    ].filter(Boolean);
    let author = "Author unavailable";
    if (authorKeys[0]) {
      const authorResponse = await fetch(`https://openlibrary.org${authorKeys[0]}.json`);
      if (authorResponse.ok) author = (await authorResponse.json()).name || author;
    }
    const title = work.title || data.title;
    const bookId = workKey || `isbn-${normalized}`;
    const coverId = data.covers?.find((id) => id > 0) || work.covers?.find((id) => id > 0);
    const matchQuality = title && author !== "Author unavailable" ? "identified" : "partial";
    const scannedEdition = {
      isbn: normalized,
      bookId,
      format: data.physical_format || "This edition",
      publisher: data.publishers?.[0] || "Publisher unavailable",
      cover: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : `https://covers.openlibrary.org/b/isbn/${normalized}-L.jpg`
    };

    // An ISBN can be absent from our catalog row even when its parent title is
    // already present. Resolve the canonical title after public metadata fills
    // in the title/author; this is the path that connects collector editions.
    if (window.SH?.sb && title && author !== "Author unavailable") {
      try {
        const catalogLookupTitle = title.split(":")[0].trim().replace(/[%_]/g, "");
        const { data: titleMatches } = await window.SH.sb.from("books")
          .select("slug,title,author,cover_url,series,series_number,isbn,publisher,spice_level,rating_avg")
          .ilike("title", `${catalogLookupTitle}%`).eq("status", "live").limit(5);
        const authorSurname = author.toLowerCase().split(/\s+/).pop();
        const canonical = (titleMatches || []).find((row) => String(row.author || "").toLowerCase().includes(authorSurname)) || titleMatches?.[0];
        if (canonical) {
          const book = catalogBookFromRow(canonical);
          scannedEdition.bookId = book.id;
          if (!coverId && canonical.cover_url) scannedEdition.cover = canonical.cover_url;
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

    return {
      book: {
        id: bookId,
        title: title || "Title unavailable",
        author,
        series: data.series?.[0] || "Book identified by ISBN",
        rating: "—",
        ratingCount: "Community details are being added",
        communitySpice: "?",
        friends: "You found a new book for the Hub",
        friendDetail: "You can save it now while we prepare its full community profile"
      },
      edition: scannedEdition,
      context: emptyUserContext(),
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
    return { icon: "⌁", label: "Already on your shelf", detail: `Saved to Want to Read · ${context.savedDate}`, state: "Want to read", action: "Mark as purchased", notes: false };
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
  $("#shelfButton").disabled = false;
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
  if (!requestScanAccess()) return;
  setFeedback("ISBN found — matching edition…", 2200);
  const match = await findBook(isbn);
  stopCamera();
  if (match) renderBook(match);
  else {
    notifyCatalogReview({
      book: { title: "Unknown title", author: "Unknown author" },
      edition: { isbn: isbn10to13(normalizeIsbn(isbn)), publisher: "Unknown publisher" },
      catalogStatus: "unmatched"
    }, "isbn-not-found");
    toast("Barcode read, but this ISBN isn’t in our book data yet. No scan used.");
    setFeedback("No scan used — we sent the ISBN for review", 3200);
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
    button.addEventListener("click", () => {
      const match = resolveLocalEdition(item.isbn);
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
  let message = "Added to Want to Read";
  if (context.readingStatus === "finished") message = `Added the ${edition.format} to your library`;
  if (context.readingStatus === "want") message = "Marked as purchased";
  toast(`${message} · Undo`);
  $("#shelfButton").textContent = "✓ Saved";
  $("#shelfButton").disabled = true;
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
