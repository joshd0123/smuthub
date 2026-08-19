(function () {
  'use strict';

  const signals = [
    { slug:'enemies-to-lovers', name:'Enemies to lovers', tags:['enemy','enemies','rival','opposing','hate','hostile','conflict','banter','sparring','betrayal','tension'] },
    { slug:'slow-burn', name:'Slow burn', tags:['slow','burn','yearning','pining','longing','tension','gradual','patient','payoff','glances','ache'] },
    { slug:'fated-mates', name:'Fated mates', tags:['fated','mate','mates','destiny','bond','inevitable','soul','soulmate','supernatural','devotion'] },
    { slug:'forced-proximity', name:'Forced proximity', tags:['forced','proximity','trapped','journey','prisoner','captive','storm','room','bed','close','together','travel'] },
    { slug:'grumpy-sunshine', name:'Grumpy × sunshine', tags:['grumpy','sunshine','opposites','warm','soft','guarded','cheerful','banter','comfort','cozy'] },
    { slug:'found-family', name:'Found family', tags:['found','family','belonging','friendship','friends','crew','team','loyalty','home','community','comfort','warm'] },
    { slug:'touch-her-and-die', name:'Touch her and die', tags:['touch','protective','protect','possessive','devotion','dangerous','threat','hurt','die','feral','jealous'] },
    { slug:'morally-grey', name:'Morally grey', tags:['morally','grey','gray','villain','dark','dangerous','ruthless','antihero','questionable','shadow','red','flag'] },
    { slug:'marriage-of-convenience', name:'Marriage of convenience', tags:['marriage','convenience','bargain','contract','fake','arrangement','political','wedding','spouse','deal'] },
    { slug:'arranged-marriage', name:'Arranged marriage', tags:['arranged','marriage','duty','alliance','kingdom','political','royal','strangers','wedding','obligation'] },
    { slug:'fae', name:'Fae', tags:['fae','fairy','faerie','court','immortal','magic','bargain','curse','realm','kingdom','prince'] },
    { slug:'court-intrigue', name:'Court intrigue', tags:['court','politics','political','intrigue','scheme','kingdom','royal','crown','alliance','betrayal','power','danger'] }
  ];

  const stopWords = new Set(['i','me','my','a','an','the','and','or','but','with','without','something','book','read','want','give','lots','of','to','that','is','not','too','no']);
  const form = document.querySelector('#trope-search-form');
  if (!form) return;
  const input = document.querySelector('#trope-query');
  const results = document.querySelector('#search-results');
  const status = document.querySelector('#search-status');
  const submit = form.querySelector('[type="submit"]');
  const rememberedResultsKey = 'smuthub:last-book-search:v1';
  const rememberedResultsMaxAge = 2 * 60 * 60 * 1000;

  function tokenize(query) {
    return query.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(word => word.length > 1 && !stopWords.has(word));
  }

  function exclusionWords(query) {
    return [...query.toLowerCase().matchAll(/(?:no|not|without|avoid|skip|never)\s+([^,.;]+)/g)]
      .flatMap(match => tokenize(match[1]));
  }

  function localIntent(query) {
    const tokens = tokenize(query);
    const phrase = query.toLowerCase();
    const excluded = new Set(exclusionWords(query));
    return signals.map(item => {
      const hits = item.tags.filter(tag => tokens.includes(tag) || (tag.length > 4 && phrase.includes(tag)));
      const blocked = item.tags.some(tag => excluded.has(tag));
      return { ...item, score:hits.length * 3 - (blocked ? 20 : 0), hits };
    }).filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  }

  function spiceRange(query) {
    const phrase = query.toLowerCase();
    if (/no spice|closed door|fade.to.black|not spicy|low spice|sweet romance/.test(phrase)) return [0, 2];
    if (/very spicy|high spice|extra spicy|hot|steamy|explicit/.test(phrase)) return [3, 5];
    return [0, 5];
  }

  function endingPreferences(query) {
    const phrase = query.toLowerCase();
    return {
      avoidCliffhanger:/\b(no|avoid|without)\s+(a\s+)?cliffhanger\b|\bnon[- ]?cliffhanger\b|\bcompleted ending\b/.test(phrase),
      requiresHea:/\bhea\b|\bhappily ever after\b/.test(phrase)
    };
  }

  function humanList(values) {
    if (values.length < 2) return values[0] || 'the feeling you described';
    if (values.length === 2) return `${values[0]} and ${values[1]}`;
    return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
  }

  async function booksWithPages(books, limit = 18) {
    const checked = await Promise.all(books.slice(0, limit).map(async book => {
      try {
        const response = await fetch(bookHref(book.slug), { method:'HEAD', cache:'no-store' });
        return response.ok ? book : null;
      } catch (_) {
        return null;
      }
    }));
    return checked.filter(Boolean);
  }

  async function fallbackBooks(query) {
    const config = window.SMUTHUB_CONFIG || {};
    if (!config.SUPABASE_URL || !config.SUPABASE_KEY) return [];
    const intent = localIntent(query);
    const wanted = intent.map(item => `trope:${item.slug}`);
    const params = new URLSearchParams({
      status:'eq.live',
      select:'slug,title,author,cover_url,blurb,spice_level,ending,cliffhanger,triggers_detail,tag_ids,featured,popularity,rating_avg',
      order:'featured.desc,popularity.desc,rating_avg.desc',
      limit:'60'
    });
    if (wanted.length) params.set('tag_ids', `ov.{${wanted.join(',')}}`);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(`${config.SUPABASE_URL}/rest/v1/books?${params}`, {
        headers:{ apikey:config.SUPABASE_KEY, Accept:'application/json' },
        signal:controller.signal
      });
      if (!response.ok) return [];
      const books = await response.json();
      const excluded = exclusionWords(query);
      const [spiceMin, spiceMax] = spiceRange(query);
      const endingRules = endingPreferences(query);
      const ranked = books.flatMap(book => {
        const bookTags = Array.isArray(book.tag_ids) ? book.tag_ids : [];
        const warningText = `${bookTags.join(' ')} ${book.triggers_detail || ''}`.toLowerCase().replace(/-/g, ' ');
        if (excluded.some(word => word.length > 3 && warningText.includes(word))) return [];
        if (Number.isFinite(book.spice_level) && (book.spice_level < spiceMin || book.spice_level > spiceMax)) return [];
        const ending = String(book.ending || '').toLowerCase();
        if (endingRules.avoidCliffhanger && (book.cliffhanger === true || ending.includes('cliff'))) return [];
        if (endingRules.requiresHea && !/(^|\b)hea(\b|$)/i.test(ending)) return [];
        const matched = intent.filter(item => bookTags.includes(`trope:${item.slug}`));
        const score = matched.reduce((total, item) => total + item.score, 0) + (book.featured ? 2 : 0);
        return [{ ...book, matched, score }];
      }).sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title)));

      const pageReady = await booksWithPages(ranked);
      const eligible = pageReady.length >= 3 ? pageReady : ranked;
      const chosen = [];
      const authors = new Set();
      for (const book of eligible) {
        const author = String(book.author || '').toLowerCase();
        if (author && authors.has(author)) continue;
        chosen.push(book);
        if (author) authors.add(author);
        if (chosen.length === 3) break;
      }
      return chosen.map(book => {
        const labels = book.matched.map(item => item.name).slice(0, 3);
        return {
          slug:book.slug,
          title:book.title,
          author:book.author || 'Author unavailable',
          cover_url:book.cover_url,
          spice_level:book.spice_level,
          ending:book.ending,
          reason:`It brings together ${humanList(labels)}.${Number.isFinite(book.spice_level) ? ` The catalogue rates it ${book.spice_level}/5 for spice.` : ''}`
        };
      });
    } catch (_) {
      return [];
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function validBook(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (!/^[a-z0-9-]+$/.test(String(raw.slug || '')) || !raw.title || !raw.author) return null;
    return {
      slug:String(raw.slug),
      title:String(raw.title).slice(0, 180),
      author:String(raw.author).slice(0, 140),
      cover_url:/^https:\/\//.test(String(raw.cover_url || '')) ? String(raw.cover_url) : '',
      spice_level:Number.isInteger(raw.spice_level) ? raw.spice_level : null,
      ending:raw.ending ? String(raw.ending).slice(0, 40) : '',
      reason:String(raw.reason || 'A close match for the feeling you described.').replace(/\s+/g, ' ').slice(0, 260)
    };
  }

  async function search(query) {
    const config = window.SMUTHUB_CONFIG || {};
    const endpoint = config.BOOK_SEARCH_URL;
    if (endpoint) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 11000);
      try {
        const headers = { 'Content-Type':'application/json' };
        if (config.SUPABASE_KEY) headers.apikey = config.SUPABASE_KEY;
        const response = await fetch(endpoint, { method:'POST', headers, body:JSON.stringify({ query }), signal:controller.signal });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.books)) {
            const pageReady = await booksWithPages(data.books.map(validBook).filter(Boolean), 3);
            if (pageReady.length === 3) {
              return { books:pageReady, mode:'ai-catalogue', summary:data.summary || '' };
            }
          }
        }
      } catch (_) {
        // The public catalogue fallback below still returns real books.
      } finally {
        window.clearTimeout(timeout);
      }
    }
    return { books:await fallbackBooks(query), mode:'catalogue-fallback', summary:'' };
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  }

  function bookHref(slug) {
    return `/books/${encodeURIComponent(slug)}/`;
  }

  function render(books, mode, summary) {
    if (!books.length) {
      results.hidden = true;
      status.textContent = 'No strong book match yet. Try adding a trope, mood, spice level, or something you want to avoid.';
      return;
    }
    results.innerHTML = books.map((book, index) => {
      const metadata = [Number.isInteger(book.spice_level) ? `Spice ${book.spice_level}/5` : '', book.ending].filter(Boolean);
      return `<article class="book-result-card">
        <div class="book-result-card__hero">
          ${book.cover_url ? `<img class="book-result-card__banner" src="${escapeHtml(book.cover_url)}" alt="" aria-hidden="true" loading="lazy">` : ''}
          <span class="book-result-card__shade" aria-hidden="true"></span>
          <a class="book-result-card__cover" href="${bookHref(book.slug)}" aria-label="Open ${escapeHtml(book.title)}">
            ${book.cover_url ? `<img src="${escapeHtml(book.cover_url)}" alt="Cover of ${escapeHtml(book.title)}" loading="lazy">` : '<span aria-hidden="true">No cover</span>'}
          </a>
          <span class="result-rank">0${index + 1}</span>
        </div>
        <div class="book-result-card__copy">
          <small>${index === 0 ? 'YOUR CLOSEST MATCH' : 'ANOTHER BOOK FOR THIS MOOD'}</small>
          <h3>${escapeHtml(book.title)}</h3>
          <p class="book-result-card__author">by ${escapeHtml(book.author)}</p>
          ${metadata.length ? `<p class="book-result-card__meta">${metadata.map(escapeHtml).join('<span aria-hidden="true"> · </span>')}</p>` : ''}
          <p class="result-reason">${escapeHtml(book.reason)}</p>
          <a class="book-result-card__link" href="${bookHref(book.slug)}">See why this book fits <span>→</span></a>
        </div>
      </article>`;
    }).join('');
    results.hidden = false;
    status.textContent = summary || (mode === 'catalogue-fallback'
      ? 'Three real books from the catalogue, chosen from the closest matches available.'
      : 'Three real books from the smutHub catalogue, chosen for the feeling you described.');
  }

  function forgetResults() {
    try {
      window.sessionStorage.removeItem(rememberedResultsKey);
    } catch (_) {
      // Search still works when browser storage is unavailable.
    }
  }

  function rememberResults(books, mode, summary) {
    try {
      window.sessionStorage.setItem(rememberedResultsKey, JSON.stringify({
        savedAt:Date.now(),
        books,
        mode,
        summary
      }));
    } catch (_) {
      // Search still works when browser storage is unavailable.
    }
  }

  function restoreResults() {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(rememberedResultsKey) || 'null');
      if (!saved || Date.now() - Number(saved.savedAt || 0) > rememberedResultsMaxAge) {
        forgetResults();
        return;
      }
      const books = Array.isArray(saved.books) ? saved.books.map(validBook).filter(Boolean).slice(0, 3) : [];
      if (books.length !== 3) {
        forgetResults();
        return;
      }
      render(books, saved.mode === 'ai-catalogue' ? 'ai-catalogue' : 'catalogue-fallback', String(saved.summary || ''));
    } catch (_) {
      forgetResults();
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const query = input.value.trim();
    if (query.length < 3) {
      status.textContent = 'Add a little more detail so we can find a useful book match.';
      return;
    }
    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    submit.querySelector('span').textContent = 'Finding your books…';
    status.textContent = 'Reading your mood and searching the catalogue…';
    results.hidden = true;
    forgetResults();
    try {
      const response = await search(query);
      render(response.books, response.mode, response.summary);
      if (response.books.length === 3) rememberResults(response.books, response.mode, response.summary);
      if (window.SH && typeof window.SH.track === 'function') {
        window.SH.track('book-feeling-search', { mode:response.mode, matches:response.books.length });
      }
    } finally {
      submit.disabled = false;
      form.removeAttribute('aria-busy');
      submit.querySelector('span').textContent = 'Find my books';
    }
  });

  document.querySelectorAll('[data-search-example]').forEach(button => button.addEventListener('click', () => {
    input.value = button.dataset.searchExample;
    input.focus();
  }));

  restoreResults();
})();
