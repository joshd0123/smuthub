(function () {
  'use strict';

  var BATCH_SIZE = 100;
  var CATALOG_PAGE_SIZE = 1000;
  var ISBN_CONCURRENCY = 4;
  var MAX_FILE_BYTES = 50 * 1024 * 1024;
  var MAX_ROWS = 10000;
  var MAX_ISBNS = 1000;
  var SAMPLE_CSV = [
    'Book Id,Title,Author,ISBN,ISBN13,My Rating,Exclusive Shelf,My Review,Date Read',
    '1,Seven Days in June,Tia Williams,153871910X,9781538719107,5,read,Sharp and tender.,2025/05/18',
    '2,The Kiss Quotient,Helen Hoang,0451490800,9780451490803,4,read,,2025/01/12',
    '3,Funny Story,Emily Henry,0593441281,9780593441282,0,to-read,,,',
    '4,The Paradise Problem,Christina Lauren,1668017725,9781668017724,0,currently-reading,,,',
    '5,Get a Life Chloe Brown,Talia Hibbert,0062941208,9780062941206,5,read,Loved this one.,2024/10/03',
    '6,The Pairing,Casey McQuiston,1250862744,9781250862747,0,to-read,,,'
  ].join('\n');

  var SOURCE_DETAILS = {
    goodreads: {
      name: 'Goodreads',
      mark: 'g',
      steps: ['Open Goodreads and go to My Books', 'Choose Import and export under Tools', 'Select Export Library, then upload the CSV here'],
      link: 'https://www.goodreads.com/review/import'
    },
    storygraph: {
      name: 'The StoryGraph',
      mark: 'sg',
      steps: ['Open The StoryGraph and go to Manage account', 'Choose Manage your data, then Export', 'Download the CSV and upload it here']
    },
    generic: {
      name: 'a spreadsheet',
      mark: 'csv',
      steps: ['Export your library as CSV, TSV, or semicolon-delimited text', 'Keep a Title column; Author, ISBN, Shelf, Rating, and Review are optional', 'Upload it here — we’ll match common column names automatically']
    },
    isbn: { name: 'an ISBN list', mark: '#' }
  };

  var state = {
    step: 'boot',
    source: 'goodreads',
    fileName: '',
    books: [],
    skipped: 0,
    invalid: 0,
    selected: new Set(),
    shelf: [],
    catalog: [],
    catalogByIsbn: new Map(),
    catalogByTitleAuthor: new Map(),
    existingKeys: new Set(),
    existingIdentity: new Set(),
    ready: false,
    userId: null,
    renderLimit: 200,
    importPayloads: [],
    importIndex: 0,
    savedCount: 0,
    importing: false
  };

  function $(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }
  function normalizeText(value) {
    return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  }
  function cap(value, length) { return String(value == null ? '' : value).trim().slice(0, length); }
  function safeCoverUrl(value) {
    var raw = cap(value, 2048);
    if (!raw) return null;
    try {
      var url = new URL(raw);
      if (url.protocol !== 'https:') return null;
      return url.href.slice(0, 2048);
    } catch (_) { return null; }
  }
  function identityKey(title, author) { return normalizeText(title) + '|' + normalizeText(author); }
  function cleanIsbn(value) {
    return String(value || '').trim()
      .replace(/^=\s*["'“‘]?|["'”’]$/g, '')
      .replace(/[^0-9Xx]/g, '').toUpperCase();
  }
  function validIsbn(value) {
    var isbn = cleanIsbn(value);
    if (/^\d{13}$/.test(isbn)) {
      var sum13 = 0;
      for (var i = 0; i < 12; i++) sum13 += Number(isbn[i]) * (i % 2 ? 3 : 1);
      return (10 - (sum13 % 10)) % 10 === Number(isbn[12]);
    }
    if (/^\d{9}[\dX]$/.test(isbn)) {
      var sum10 = 0;
      for (var j = 0; j < 10; j++) sum10 += (10 - j) * (isbn[j] === 'X' ? 10 : Number(isbn[j]));
      return sum10 % 11 === 0;
    }
    return false;
  }
  function stableHash(value) {
    var h = 2166136261;
    for (var i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }
  function fallbackKey(book) {
    var seed = book.isbn ? 'isbn:' + book.isbn : identityKey(book.title, book.author);
    return 'import:' + stableHash(seed);
  }
  function detectDelimiter(text) {
    var sample = String(text || '').replace(/^\uFEFF/, '').slice(0, 20000);
    var candidates = [',', '\t', ';'];
    var best = ',', bestScore = -1;
    candidates.forEach(function (delimiter) {
      var counts = [], count = 0, quoted = false;
      for (var i = 0; i < sample.length && counts.length < 12; i++) {
        var char = sample[i], next = sample[i + 1];
        if (char === '"' && quoted && next === '"') { i++; continue; }
        if (char === '"') quoted = !quoted;
        else if (char === delimiter && !quoted) count++;
        else if ((char === '\n' || char === '\r') && !quoted) {
          if (char === '\r' && next === '\n') i++;
          if (count || counts.length) counts.push(count);
          count = 0;
        }
      }
      if (count) counts.push(count);
      if (!counts.length) return;
      var common = counts.slice(0, 8).sort(function (a, b) { return a - b; })[Math.floor(Math.min(counts.length, 8) / 2)] || 0;
      var consistency = counts.filter(function (n) { return n === common; }).length;
      var score = common * 10 + consistency;
      if (score > bestScore) { bestScore = score; best = delimiter; }
    });
    return best;
  }
  function parseDelimited(text, delimiter) {
    text = String(text == null ? '' : text).replace(/^\uFEFF/, '');
    delimiter = delimiter || detectDelimiter(text);
    var rows = [], row = [], cell = '', quoted = false;
    for (var i = 0; i < text.length; i++) {
      var char = text[i], next = text[i + 1];
      if (char === '"' && quoted && next === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = !quoted;
      else if (char === delimiter && !quoted) { row.push(cell); cell = ''; }
      else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && next === '\n') i++;
        row.push(cell); cell = '';
        if (row.some(function (value) { return String(value).trim(); })) rows.push(row);
        row = [];
      } else cell += char;
    }
    if (quoted) throw new Error('The file contains an unclosed quoted field.');
    row.push(cell);
    if (row.some(function (value) { return String(value).trim(); })) rows.push(row);
    if (!rows.length) return [];
    var headers = rows.shift().map(function (header, index) {
      var clean = String(header).trim();
      return clean || 'Column ' + (index + 1);
    });
    return rows.map(function (values) {
      var object = {};
      headers.forEach(function (header, index) { object[header] = String(values[index] == null ? '' : values[index]).trim(); });
      return object;
    });
  }
  function firstField(row, names) {
    var keys = Object.keys(row);
    for (var i = 0; i < names.length; i++) {
      var wanted = normalizeText(names[i]);
      var found = keys.find(function (key) { return normalizeText(key) === wanted; });
      if (found && String(row[found]).trim()) return String(row[found]).trim();
    }
    return '';
  }
  function detectSource(rows) {
    var headers = Object.keys(rows[0] || {}).map(normalizeText);
    if (headers.indexOf('book id') >= 0 && headers.indexOf('exclusive shelf') >= 0) return 'goodreads';
    if (headers.indexOf('read status') >= 0 || headers.indexOf('star rating') >= 0) return 'storygraph';
    return 'generic';
  }
  function normalizeStatus(value) {
    var status = normalizeText(value).replace(/\s+/g, '-');
    if (/^dnf$|did-not-finish|abandoned|not-finished/.test(status)) return 'dnf';
    if (/currently-reading|reading-now|in-progress|reading/.test(status)) return 'reading';
    if (/to-read|want|tbr|up-next|planned|owned|not-started/.test(status)) return 'want';
    if (/read|finished|complete/.test(status)) return 'read';
    return 'want';
  }
  function parseCsv(text, requestedSource) {
    var rows = parseDelimited(text);
    if (rows.length > MAX_ROWS) throw new Error('This file has more than 10,000 rows. Split it into smaller files and import them one at a time.');
    var source = requestedSource && requestedSource !== 'isbn' ? requestedSource : detectSource(rows);
    var skipped = 0;
    var books = [];
    rows.forEach(function (row, index) {
      var title = cap(firstField(row, ['Title', 'Book Title', 'Name']), 300);
      if (!title) { skipped++; return; }
      var author = cap(firstField(row, ['Author', 'Authors', 'Primary Author', 'Author l-f', 'Author Name']) || 'Unknown author', 200);
      var rawRating = firstField(row, ['My Rating', 'Star Rating', 'Rating']);
      var ratingNumber = rawRating === '' ? null : Number(String(rawRating).replace(',', '.'));
      var isbn = cleanIsbn(firstField(row, ['ISBN13', 'ISBN 13', 'ISBN', 'ISBN/UID', 'ISBN UID']));
      if (!validIsbn(isbn)) isbn = '';
      books.push({
        id: source + ':' + stableHash((isbn || identityKey(title, author)) + ':' + index),
        title: title,
        author: author,
        isbn: isbn || null,
        cover_url: safeCoverUrl(firstField(row, ['Cover URL', 'Cover', 'Image URL'])),
        status: normalizeStatus(firstField(row, ['Exclusive Shelf', 'Read Status', 'Shelf', 'Bookshelves', 'Status'])),
        rating: Number.isFinite(ratingNumber) && ratingNumber > 0 ? Math.max(0, Math.min(5, ratingNumber)) : null,
        review: cap(firstField(row, ['My Review', 'Review', 'Review Text']), 4000) || null,
        source: source
      });
    });
    return { books: books, skipped: skipped, source: source };
  }
  function parseIsbnTokens(text) {
    var tokens = String(text || '').split(/[\s,;|]+/).filter(function (token) { return token.trim(); });
    var valid = [], invalid = [], seen = new Set();
    tokens.forEach(function (rawToken) {
      var token = cleanIsbn(rawToken);
      if (!validIsbn(token)) { invalid.push(cap(rawToken, 40)); return; }
      if (!seen.has(token)) { seen.add(token); valid.push(token); }
    });
    return { valid: valid, invalid: invalid, duplicates: tokens.length - valid.length - invalid.length };
  }
  function googleCover(imageLinks) {
    if (!imageLinks) return null;
    var url = imageLinks.thumbnail || imageLinks.smallThumbnail || null;
    return url ? url.replace(/^http:/, 'https:').replace(/&zoom=\d/, '&zoom=2') : null;
  }
  async function fetchGoogleBook(isbn) {
    var cfg = window.SMUTHUB_CONFIG || {};
    var url = 'https://www.googleapis.com/books/v1/volumes?q=' + encodeURIComponent('isbn:' + isbn) + '&maxResults=1&printType=books';
    if (cfg.GOOGLE_BOOKS_KEY) url += '&key=' + encodeURIComponent(cfg.GOOGLE_BOOKS_KEY);
    var response = await fetch(url);
    if (!response.ok) throw new Error('Google Books lookup returned ' + response.status + '.');
    var data = await response.json();
    var item = data.items && data.items[0];
    if (!item) return null;
    var volume = item.volumeInfo || {};
    var identifier = (volume.industryIdentifiers || []).find(function (entry) { return entry.type === 'ISBN_13'; })
      || (volume.industryIdentifiers || []).find(function (entry) { return entry.type === 'ISBN_10'; });
    return {
      id: 'isbn:' + isbn,
      title: cap(volume.title || ('ISBN ' + isbn), 300),
      author: cap((volume.authors || []).join(', ') || 'Unknown author', 200),
      isbn: cleanIsbn(identifier ? identifier.identifier : isbn),
      cover_url: safeCoverUrl(googleCover(volume.imageLinks)),
      status: 'want',
      rating: null,
      review: null,
      source: 'isbn',
      lookupMissing: false
    };
  }
  async function lookupIsbns(isbns, onProgress) {
    var results = new Array(isbns.length);
    var cursor = 0, completed = 0;
    async function worker() {
      while (true) {
        var index = cursor++;
        if (index >= isbns.length) return;
        var isbn = isbns[index];
        try {
          results[index] = await fetchGoogleBook(isbn);
        } catch (error) {
          results[index] = null;
        }
        if (!results[index]) {
          results[index] = {
            id: 'isbn:' + isbn, title: 'ISBN ' + isbn, author: 'Metadata not found', isbn: isbn,
            cover_url: null, status: 'want', rating: null, review: null, source: 'isbn', lookupMissing: true
          };
        }
        completed++;
        if (onProgress) onProgress(completed, isbns.length);
      }
    }
    var workers = [];
    for (var i = 0; i < Math.min(ISBN_CONCURRENCY, isbns.length); i++) workers.push(worker());
    await Promise.all(workers);
    return results;
  }
  function statusLabel(status) {
    return status === 'reading' ? 'Reading now' : status === 'read' ? 'Finished' : status === 'dnf' ? 'Did not finish' : 'Want to read';
  }
  function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  async function loadAllCatalogRows(sb) {
    var all = [], start = 0;
    while (true) {
      var result = await sb.from('books').select('slug,title,author,cover_url,isbn').eq('status', 'live').range(start, start + CATALOG_PAGE_SIZE - 1);
      if (result.error) throw result.error;
      var page = result.data || [];
      all = all.concat(page);
      if (page.length < CATALOG_PAGE_SIZE) break;
      start += CATALOG_PAGE_SIZE;
    }
    return all;
  }
  function buildIndexes() {
    state.catalogByIsbn = new Map();
    state.catalogByTitleAuthor = new Map();
    state.existingKeys = new Set();
    state.existingIdentity = new Set();
    state.catalog.forEach(function (book) {
      var isbn = cleanIsbn(book.isbn);
      if (isbn && !state.catalogByIsbn.has(isbn)) state.catalogByIsbn.set(isbn, book);
      var identity = identityKey(book.title, book.author);
      if (identity !== '|' && !state.catalogByTitleAuthor.has(identity)) state.catalogByTitleAuthor.set(identity, book);
    });
    state.shelf.forEach(function (book) {
      if (book.book_key) state.existingKeys.add(book.book_key);
      state.existingIdentity.add(identityKey(book.title, book.author));
      var catalogBook = state.catalog.find(function (candidate) { return candidate.slug === book.book_key; });
      if (catalogBook && catalogBook.isbn) state.existingIdentity.add('isbn:' + cleanIsbn(catalogBook.isbn));
    });
  }
  async function loadLibraryData() {
    if (!window.SH || !window.SH.sb || !window.SH.user) throw new Error('Your account session is not ready.');
    var sb = window.SH.sb;
    var results = await Promise.allSettled([
      sb.from('shelf').select('book_key,title,author,cover_url,status,sort_order'),
      loadAllCatalogRows(sb)
    ]);
    if (results[0].status === 'rejected') throw results[0].reason;
    var shelfResult = results[0].value;
    if (shelfResult.error) throw shelfResult.error;
    state.shelf = shelfResult.data || [];
    if (results[1].status === 'fulfilled') {
      state.catalog = results[1].value || [];
    } else {
      state.catalog = [];
      console.warn('Catalog matching unavailable:', results[1].reason);
    }
    buildIndexes();
    state.ready = true;
  }
  function enrichAndMark(books) {
    var incomingSeen = new Set();
    return books.map(function (raw) {
      var book = Object.assign({}, raw);
      var catalog = book.isbn ? state.catalogByIsbn.get(cleanIsbn(book.isbn)) : null;
      if (!catalog) catalog = state.catalogByTitleAuthor.get(identityKey(book.title, book.author));
      if (catalog) {
        book.book_key = catalog.slug;
        book.title = cap(catalog.title || book.title, 300);
        book.author = cap(catalog.author || book.author, 200);
        book.cover_url = safeCoverUrl(catalog.cover_url) || safeCoverUrl(book.cover_url);
        book.catalogMatch = true;
      } else {
        book.book_key = fallbackKey(book);
        book.catalogMatch = false;
      }
      var identity = identityKey(book.title, book.author);
      var isbnIdentity = book.isbn ? 'isbn:' + cleanIsbn(book.isbn) : '';
      book.duplicate = state.existingKeys.has(book.book_key) || state.existingIdentity.has(identity)
        || (isbnIdentity && state.existingIdentity.has(isbnIdentity)) || incomingSeen.has(book.book_key) || incomingSeen.has(identity);
      incomingSeen.add(book.book_key);
      incomingSeen.add(identity);
      return book;
    });
  }

  function showScreen(name) {
    ['bootScreen', 'loginScreen', 'sourceScreen', 'uploadScreen', 'reviewScreen', 'importingScreen', 'doneScreen'].forEach(function (id) {
      $(id).hidden = id !== name + 'Screen';
    });
    state.step = name;
    $('utilityRow').hidden = ['boot', 'login', 'done', 'importing'].indexOf(name) >= 0;
    document.querySelectorAll('[data-step-marker]').forEach(function (marker) {
      var rank = { source: 0, upload: 1, review: 2 };
      marker.classList.toggle('on', rank[name] >= rank[marker.dataset.stepMarker]);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function setUploadError(message) {
    $('uploadError').textContent = message || '';
    $('uploadError').hidden = !message;
  }
  function setReviewWarning(message) {
    $('reviewWarning').textContent = message || '';
    $('reviewWarning').hidden = !message;
  }
  function chooseSource(source) {
    state.source = source;
    setUploadError('');
    $('filePanel').hidden = source === 'isbn';
    $('isbnPanel').hidden = source !== 'isbn';
    $('uploadLede').textContent = source === 'isbn'
      ? 'Paste ISBN-10 or ISBN-13 codes below, one per line or separated by commas.'
      : 'Upload your export from ' + SOURCE_DETAILS[source].name + '. We’ll take it from there.';
    if (source !== 'isbn') renderHowTo(source);
    showScreen('upload');
  }
  function renderHowTo(source) {
    var detail = SOURCE_DETAILS[source];
    $('howTo').innerHTML = '<div class="how-head"><span class="source-mark ' + esc(source) + '">' + esc(detail.mark) + '</span><span><b>How to export from ' + esc(detail.name) + '</b><small>Usually takes less than a minute</small></span></div>'
      + '<ol>' + detail.steps.map(function (step) { return '<li>' + esc(step) + '</li>'; }).join('') + '</ol>'
      + (detail.link ? '<a href="' + esc(detail.link) + '" target="_blank" rel="noopener">Open Goodreads export →</a>' : '');
  }
  function prepareReview(parsed, fileName) {
    state.books = enrichAndMark(parsed.books);
    state.skipped = parsed.skipped || 0;
    state.fileName = fileName;
    state.selected = new Set(state.books.filter(function (book) { return !book.duplicate && !book.lookupMissing; }).map(function (book) { return book.id; }));
    state.renderLimit = 200;
    $('searchInput').value = '';
    $('statusFilter').value = 'all';
    renderReview();
    showScreen('review');
    if (window.SH && window.SH.track) window.SH.track('library-import-parsed', { count: state.books.length, source: state.source });
  }
  function reviewCounts() {
    return state.books.reduce(function (counts, book) {
      counts[book.status] = (counts[book.status] || 0) + 1;
      if (book.rating) counts.rating++;
      if (book.duplicate) counts.duplicate++;
      if (book.lookupMissing) counts.lookupMissing++;
      return counts;
    }, { want: 0, reading: 0, read: 0, dnf: 0, rating: 0, duplicate: 0, lookupMissing: 0 });
  }
  function updateSelectedCount() {
    document.querySelectorAll('.selected-count').forEach(function (node) { node.textContent = state.selected.size.toLocaleString(); });
    document.querySelectorAll('.import-button').forEach(function (button) { button.disabled = !state.selected.size || state.importing; });
  }
  function visibleBooks() {
    var query = normalizeText($('searchInput').value);
    var filter = $('statusFilter').value;
    return state.books.filter(function (book) {
      var matchesQuery = !query || normalizeText(book.title + ' ' + book.author + ' ' + (book.isbn || '')).indexOf(query) >= 0;
      var matchesFilter = filter === 'all' || (filter === 'duplicate' ? book.duplicate : book.status === filter);
      return matchesQuery && matchesFilter;
    });
  }
  function coverHtml(book) {
    if (book.cover_url) return '<img class="mini-cover" src="' + esc(book.cover_url) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'mini-cover placeholder\',textContent:\'Cover unavailable\'}))">';
    return '<span class="mini-cover placeholder" aria-hidden="true">' + esc(book.title.split(/\s+/).slice(0, 3).join(' ')) + '</span>';
  }
  function noteHtml(book) {
    if (book.duplicate) return '<span class="duplicate">Already on your bookshelf</span>';
    var notes = [];
    if (book.catalogMatch) notes.push('<span class="matched">Matched to SmutHub</span>');
    if (book.lookupMissing) notes.push('Metadata not found · not importable');
    if (book.rating) notes.push('<b>' + esc(book.rating) + '★</b> preview');
    if (book.review) notes.push('Review preview');
    if (!notes.length) notes.push('Ready to import');
    return notes.join(' · ');
  }
  function renderRows() {
    var books = visibleBooks();
    var shown = books.slice(0, state.renderLimit);
    $('bookRows').innerHTML = shown.map(function (book) {
      var unavailable = book.duplicate || book.lookupMissing;
      return '<div class="table-row' + (unavailable ? ' is-duplicate' : '') + '" role="row">'
        + '<span role="cell"><input class="book-check" type="checkbox" data-book-id="' + esc(book.id) + '" aria-label="Import ' + esc(book.title) + '" ' + (state.selected.has(book.id) ? 'checked ' : '') + (unavailable ? 'disabled ' : '') + '></span>'
        + '<span class="book-cell" role="cell">' + coverHtml(book) + '<span><b>' + esc(book.title) + '</b><small>' + esc(book.author) + (book.isbn ? ' · ' + esc(book.isbn) : '') + '</small></span></span>'
        + '<span role="cell">' + (book.duplicate ? '<span class="duplicate-pill">Already here</span>' : book.lookupMissing ? '<span class="duplicate-pill">Unavailable</span>' : '<span class="shelf-pill ' + esc(book.status) + '">' + esc(statusLabel(book.status)) + '</span>') + '</span>'
        + '<span class="row-notes" role="cell">' + noteHtml(book) + '</span></div>';
    }).join('');
    if (books.length > shown.length) {
      var more = document.createElement('div');
      more.className = 'empty-rows';
      more.innerHTML = '<button class="quiet" type="button" id="showMoreButton">Show ' + Math.min(200, books.length - shown.length).toLocaleString() + ' more of ' + books.length.toLocaleString() + '</button>';
      $('bookRows').appendChild(more);
      $('showMoreButton').addEventListener('click', function () { state.renderLimit += 200; renderRows(); });
    }
    $('emptyRows').hidden = books.length > 0;
    $('bookRows').querySelectorAll('.book-check').forEach(function (checkbox) {
      checkbox.addEventListener('change', function () {
        if (checkbox.checked) state.selected.add(checkbox.dataset.bookId);
        else state.selected.delete(checkbox.dataset.bookId);
        updateSelectedCount();
      });
    });
  }
  function renderReview() {
    var counts = reviewCounts();
    $('reviewLede').innerHTML = 'We found <b>' + state.books.length.toLocaleString() + ' books</b> in ' + esc(state.fileName) + '. Pick what comes over.';
    $('totalCount').textContent = state.books.length.toLocaleString();
    $('wantCount').textContent = counts.want.toLocaleString();
    $('readingCount').textContent = counts.reading.toLocaleString();
    $('readCount').textContent = counts.read.toLocaleString();
    $('dnfCount').textContent = counts.dnf.toLocaleString();
    $('ratingCount').textContent = counts.rating.toLocaleString();
    var warnings = [];
    if (counts.duplicate) warnings.push(counts.duplicate.toLocaleString() + ' already on your bookshelf');
    if (state.skipped) warnings.push(state.skipped.toLocaleString() + ' row' + (state.skipped === 1 ? '' : 's') + ' skipped because no title was found');
    if (state.invalid) warnings.push(state.invalid.toLocaleString() + ' invalid ISBN' + (state.invalid === 1 ? '' : 's') + ' skipped');
    if (counts.lookupMissing) warnings.push(counts.lookupMissing.toLocaleString() + ' ISBN lookup' + (counts.lookupMissing === 1 ? '' : 's') + ' had no metadata');
    if (!state.catalog.length) warnings.push('Catalog matching is temporarily unavailable; title and author duplicate checks still ran');
    setReviewWarning(warnings.join(' · '));
    updateSelectedCount();
    renderRows();
  }

  async function readFile(file) {
    setUploadError('');
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { setUploadError('That file is over 50 MB. Split it into smaller files and import them one at a time.'); return; }
    if (!/\.(csv|tsv|txt)$/i.test(file.name)) { setUploadError('Choose a CSV, TSV, or plain-text export.'); return; }
    try {
      var parsed = parseCsv(await file.text(), state.source);
      if (!parsed.books.length) throw new Error('We couldn’t find a Title column or any book titles in this file.');
      prepareReview(parsed, file.name);
    } catch (error) {
      setUploadError(error && error.message ? error.message : 'We couldn’t read that file. Try the original export again.');
    } finally {
      $('fileInput').value = '';
    }
  }
  async function reviewIsbns() {
    setUploadError('');
    var parsed = parseIsbnTokens($('isbnText').value);
    state.invalid = parsed.invalid.length;
    if (!parsed.valid.length) { setUploadError('Add at least one valid ISBN-10 or ISBN-13, including its check digit.'); return; }
    if (parsed.valid.length > MAX_ISBNS) { setUploadError('Paste no more than 1,000 ISBNs at a time. You can run another import when this one finishes.'); return; }
    var button = $('isbnReviewButton');
    button.disabled = true;
    button.textContent = 'Looking up 0 of ' + parsed.valid.length.toLocaleString() + '…';
    try {
      var books = await lookupIsbns(parsed.valid, function (done, total) {
        button.textContent = 'Looking up ' + done.toLocaleString() + ' of ' + total.toLocaleString() + '…';
      });
      prepareReview({ books: books, skipped: 0 }, 'Pasted ISBNs');
    } finally {
      button.disabled = false;
      button.innerHTML = 'Find &amp; review books <span aria-hidden="true">→</span>';
    }
  }
  function buildPayloads() {
    var maxSort = state.shelf.reduce(function (max, row) {
      var value = Number(row.sort_order);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, -1);
    return state.books.filter(function (book) { return state.selected.has(book.id) && !book.duplicate && !book.lookupMissing; }).map(function (book, index) {
      return {
        book_key: book.book_key,
        title: cap(book.title, 300),
        author: cap(book.author, 200),
        cover_url: safeCoverUrl(book.cover_url),
        status: book.status,
        sort_order: maxSort + index + 1
      };
    });
  }
  function setProgress(saved, total) {
    var percent = total ? Math.round(saved / total * 100) : 0;
    $('progressBar').style.width = percent + '%';
    $('progressCopy').textContent = saved.toLocaleString() + ' of ' + total.toLocaleString() + ' books saved';
    var shell = document.querySelector('.progress-shell');
    shell.setAttribute('aria-valuenow', String(percent));
  }
  async function runImport() {
    if (state.importing) return;
    if (!window.SH || !window.SH.user || !window.SH.sb) {
      if (window.SH && window.SH.openAuth) window.SH.openAuth();
      return;
    }
    if (!state.importPayloads.length) {
      state.importPayloads = buildPayloads();
      state.importIndex = 0;
      state.savedCount = 0;
    }
    if (!state.importPayloads.length) return;
    state.importing = true;
    if (state.importIndex === 0 && window.SH.track) window.SH.track('library-import-start', { count: state.importPayloads.length, source: state.source });
    $('retryButton').hidden = true;
    $('importError').hidden = true;
    $('importingTitle').textContent = 'Building your library…';
    showScreen('importing');
    setProgress(state.savedCount, state.importPayloads.length);
    try {
      while (state.importIndex < state.importPayloads.length) {
        var end = Math.min(state.importIndex + BATCH_SIZE, state.importPayloads.length);
        $('importingMessage').textContent = 'Saving books ' + (state.importIndex + 1).toLocaleString() + '–' + end.toLocaleString() + '…';
        var batch = state.importPayloads.slice(state.importIndex, end);
        var result = await window.SH.sb.from('shelf').upsert(batch, { onConflict: 'user_id,book_key' });
        if (result.error) throw result.error;
        state.importIndex = end;
        state.savedCount = end;
        setProgress(state.savedCount, state.importPayloads.length);
      }
      state.importing = false;
      $('doneCount').textContent = state.savedCount.toLocaleString() + ' book' + (state.savedCount === 1 ? '' : 's');
      if (window.SH.track) window.SH.track('library-import-complete', { count: state.savedCount, source: state.source });
      showScreen('done');
    } catch (error) {
      state.importing = false;
      $('importingTitle').textContent = 'The import paused.';
      $('importingMessage').textContent = 'Everything saved before this point is safe.';
      $('importError').textContent = 'We couldn’t save the next batch: ' + ((error && error.message) || 'Unknown error') + ' Retry to continue without duplicating books.';
      $('importError').hidden = false;
      $('retryButton').hidden = false;
      if (window.SH.track) window.SH.track('library-import-error', { source: state.source, message: String((error && error.message) || 'Unknown error').slice(0, 160) });
    }
  }
  function resetImport() {
    state.books = [];
    state.selected = new Set();
    state.fileName = '';
    state.skipped = 0;
    state.invalid = 0;
    state.importPayloads = [];
    state.importIndex = 0;
    state.savedCount = 0;
    $('isbnText').value = '';
    $('isbnCount').textContent = '0 ISBNs entered';
    showScreen('source');
  }
  async function handleAuth(event) {
    var user = event && event.detail ? event.detail.user : (window.SH && window.SH.user);
    if (!user) {
      state.userId = null;
      state.ready = false;
      if (!state.importing) showScreen('login');
      return;
    }
    if (state.ready && state.userId === user.id) return;
    state.userId = user.id;
    showScreen('boot');
    try {
      await loadLibraryData();
      showScreen('source');
    } catch (error) {
      $('bootScreen').innerHTML = '<p class="eyebrow">IMPORT UNAVAILABLE</p><h1>We couldn’t open your library.</h1><div class="alert error">' + esc((error && error.message) || error) + '</div><button class="primary" id="loadRetryButton" type="button">Try again</button>';
      $('loadRetryButton').addEventListener('click', handleAuth);
    }
  }
  function bindEvents() {
    document.querySelectorAll('[data-source]').forEach(function (button) {
      button.addEventListener('click', function () { chooseSource(button.dataset.source); });
    });
    $('loginButton').addEventListener('click', function () { if (window.SH && window.SH.openAuth) window.SH.openAuth(); });
    $('backButton').addEventListener('click', function () {
      if (state.step === 'review') showScreen('upload');
      else if (state.step === 'upload') showScreen('source');
    });
    $('chooseFileButton').addEventListener('click', function () { $('fileInput').click(); });
    $('fileInput').addEventListener('change', function () { readFile($('fileInput').files[0]); });
    ['dragenter', 'dragover'].forEach(function (name) {
      $('dropZone').addEventListener(name, function (event) { event.preventDefault(); $('dropZone').classList.add('dragging'); });
    });
    ['dragleave', 'drop'].forEach(function (name) {
      $('dropZone').addEventListener(name, function (event) { event.preventDefault(); $('dropZone').classList.remove('dragging'); });
    });
    $('dropZone').addEventListener('drop', function (event) { readFile(event.dataTransfer.files[0]); });
    $('sampleButton').addEventListener('click', function () {
      state.invalid = 0;
      prepareReview(parseCsv(SAMPLE_CSV, 'goodreads'), 'goodreads_library_export.csv');
    });
    $('isbnText').addEventListener('input', function () {
      var count = String($('isbnText').value).split(/[\s,;|]+/).filter(Boolean).length;
      $('isbnCount').textContent = count.toLocaleString() + ' ISBN' + (count === 1 ? '' : 's') + ' entered';
    });
    $('isbnReviewButton').addEventListener('click', reviewIsbns);
    $('searchInput').addEventListener('input', function () { state.renderLimit = 200; renderRows(); });
    $('statusFilter').addEventListener('change', function () { state.renderLimit = 200; renderRows(); });
    $('selectAllButton').addEventListener('click', function () {
      var available = state.books.filter(function (book) { return !book.duplicate && !book.lookupMissing; });
      var allSelected = available.length && available.every(function (book) { return state.selected.has(book.id); });
      available.forEach(function (book) { if (allSelected) state.selected.delete(book.id); else state.selected.add(book.id); });
      $('selectAllButton').textContent = allSelected ? 'Select available' : 'Clear available';
      updateSelectedCount();
      renderRows();
    });
    document.querySelectorAll('.import-button').forEach(function (button) { button.addEventListener('click', runImport); });
    $('retryButton').addEventListener('click', runImport);
    $('restartButton').addEventListener('click', async function () {
      showScreen('boot');
      try { await loadLibraryData(); resetImport(); }
      catch (error) { handleAuth(); }
    });
    window.addEventListener('sh-auth', handleAuth);
  }
  function init() {
    bindEvents();
    if (window.SH && !window.SH.configured) $('setup').classList.add('show');
    if (window.SH && window.SH.user) handleAuth();
    else wait(2800).then(function () {
      if (state.step === 'boot' && (!window.SH || !window.SH.user)) showScreen('login');
    });
  }

  window.SMUTHUB_IMPORT_TESTS = {
    detectDelimiter: detectDelimiter,
    parseDelimited: parseDelimited,
    parseCsv: parseCsv,
    parseIsbnTokens: parseIsbnTokens,
    normalizeStatus: normalizeStatus,
    normalizeText: normalizeText,
    stableHash: stableHash,
    fallbackKey: fallbackKey
  };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})();
