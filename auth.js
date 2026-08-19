/* ════════════════════════════════════════════════════════
   smutHub shared auth — include AFTER the supabase CDN script
   and AFTER config.js. Pages just need: <div id="authbox"></div>
   Exposes: window.SH = { sb, user, profile, configured, openAuth, saveTheme }
   Fires:   window event 'sh-auth' whenever login state changes.
   ════════════════════════════════════════════════════════ */
(function(){
  const cfg = window.SMUTHUB_CONFIG || {};
  const configured = (cfg.SUPABASE_URL||"").startsWith("http") && (cfg.SUPABASE_KEY||"").length > 20;
  const SH = window.SH = { sb:null, user:null, profile:null, configured, openAuth, saveTheme, logout, openFeedback, track, trackWhenReady };

  // ── Umami analytics (self-hosted, cookieless) ────────────────────────────
  // Served over a public Cloudflare Tunnel (cloudflared on the Umami box →
  // https://analytics.smuthub.ca). The website id is public (like a GA id).
  const UMAMI = {
    src: 'https://analytics.smuthub.ca/script.js',
    websiteId: '571d3bb1-66a8-484a-9db0-1918903a2425',
  };
  // Fire a custom event. Safe no-op until the Umami script is loaded, so pages
  // can call SH.track(...) unconditionally.
  // Admin activity is excluded from analytics. The admin PAGES are already kept
  // out by mountUmami(), but curating a catalog means browsing /search, /books/
  // and the book pages constantly — exactly the pages being measured — so an
  // admin's own sessions would otherwise read as reader behaviour.
  //
  // The flag is mirrored into sessionStorage because SH.profile loads
  // asynchronously: without it, every event fired before the profile resolves
  // (page load, first click) would still be recorded on an admin's first page.
  const ADMIN_FLAG = 'sh_is_admin';
  function isAdminSession(){
    try {
      if (SH.profile && SH.profile.is_admin){ sessionStorage.setItem(ADMIN_FLAG, '1'); return true; }
      if (SH.profile && SH.profile.is_admin === false){ sessionStorage.removeItem(ADMIN_FLAG); return false; }
      return sessionStorage.getItem(ADMIN_FLAG) === '1';   // profile not loaded yet
    } catch(_) { return !!(SH.profile && SH.profile.is_admin); }
  }
  const umamiReady = () => !!(window.umami && typeof window.umami.track === 'function');
  function track(name, data){
    try {
      if (isAdminSession()) return;
      if (umamiReady()) { data ? window.umami.track(name, data) : window.umami.track(name); }
    } catch(_) {}
  }

  // Same as track(), but for events fired during page load.
  //
  // The Umami script is injected deferred from an external host, so it is
  // routinely NOT loaded yet when a page-load event fires — and track() would
  // silently drop it. Interaction events are safe (they happen long after
  // load); anything fired on load must queue and flush once the script lands,
  // or metrics like book-open would under-report on every cold visit.
  const pendingEvents = [];
  function flushPending(){
    if (!umamiReady()) return false;
    while (pendingEvents.length){ const e = pendingEvents.shift(); track(e[0], e[1]); }
    return true;
  }
  function trackWhenReady(name, data){
    try {
      if (isAdminSession()) return;
      if (umamiReady()) { track(name, data); return; }
      pendingEvents.push([name, data]);
      let tries = 0;
      const iv = setInterval(() => { if (flushPending() || ++tries > 60) clearInterval(iv); }, 100);  // ~6s
    } catch(_) {}
  }
  function mountUmami(){
    if (!/^https:\/\//.test(UMAMI.src)) return;                 // dormant until a public https URL is set
    if (/(^|\/)(admin|catalog-admin)\.html$/.test(location.pathname)) return; // keep admin usage out of the stats
    // Keep admin PEOPLE out of the stats too — not just admin pages. Umami's
    // automatic pageview is not routed through track(), so without this an
    // admin's browsing of /books, /search etc. inflates pageviews and sessions
    // even though their custom events are already suppressed. isAdminSession()
    // reads the sessionStorage mirror, so from the 2nd page of a session on it
    // is reliable; at most the first cold pageview before the profile resolves
    // slips through.
    if (isAdminSession()) return;
    if (document.querySelector('script[data-website-id]')) return;
    const s = document.createElement('script');
    s.defer = true; s.src = UMAMI.src; s.setAttribute('data-website-id', UMAMI.websiteId);
    document.head.appendChild(s);
  }

  if (configured && window.supabase) {
    // Storage probe: privacy modes/extensions can block localStorage. Without it,
    // login works on the current page (in memory) but is gone after navigation.
    let storageOK = false;
    try { localStorage.setItem('sh-probe','1'); storageOK = localStorage.getItem('sh-probe')==='1'; localStorage.removeItem('sh-probe'); } catch(e) {}
    let savedSession = 'none';
    if (storageOK) { try { savedSession = Object.keys(localStorage).some(k=>k.startsWith('sb-')&&k.includes('-auth-token')) ? 'yes' : 'none'; } catch(e) {} }
    console.log('[smuthub auth] storage:', storageOK ? 'ok' : 'BLOCKED', '| saved session:', savedSession);
    if (!storageOK) document.addEventListener('DOMContentLoaded', ()=>{
      const s = document.getElementById('setup');
      if (s) { s.textContent = "⚠️ Your browser is blocking site storage, so logins can't stick between pages. Allow site data for this site (or pause privacy extensions) and log in again."; s.classList.add('show'); }
    });

    SH.sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    let booted = false;
    SH.sb.auth.onAuthStateChange((event, session) => {
      console.log('[smuthub auth]', event, session?.user?.email || 'no session');
      if (['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT','TOKEN_REFRESHED','USER_UPDATED'].includes(event)) {
        booted = true;
        // Supabase holds an internal lock while dispatching auth events; awaiting
        // other supabase calls inside this callback can deadlock. Defer all work.
        setTimeout(async () => {
          SH.user = session ? session.user : null;
          SH.profile = SH.user ? await loadProfile() : null;
          renderAuthbox();
          window.dispatchEvent(new CustomEvent('sh-auth', { detail: { user: SH.user, profile: SH.profile } }));
          // Conversion tracking. Only a genuine login is 'SIGNED_IN' — a restored
          // session arrives as 'INITIAL_SESSION' — but SIGNED_IN can still repeat
          // across page loads, so dedupe once per browser session. A brand-new
          // account (created seconds ago) is a signup; everyone else a signin.
          // track() already no-ops for admin sessions, so our own logins are out.
          if (event === 'SIGNED_IN' && SH.user) {
            let first = true;
            try { first = !sessionStorage.getItem('sh_signin_tracked'); if (first) sessionStorage.setItem('sh_signin_tracked','1'); } catch(_) {}
            if (first) {
              // `where` = the page the account landed on after auth, so signups
              // can be attributed to the surface that drove them (home, founders,
              // a book page, the bookshelf…).
              const where = location.pathname.replace(/\/index\.html$/, '/') || '/';
              // Signup vs signin is a durable, once-per-account fact: the
              // `signup_tracked` profile flag (set true the first time we count
              // an account). The old `Date.now() - created_at < 60s` window
              // mislabelled any signup whose first *tracked* login landed later
              // than 60s after account creation, so it's now only a fallback for
              // when the profile row isn't readable yet.
              let isSignup;
              if (SH.profile && typeof SH.profile.signup_tracked !== 'undefined') {
                isSignup = !SH.profile.signup_tracked;
              } else {
                isSignup = (Date.now() - new Date(SH.user.created_at).getTime()) < 60000;
              }
              // trackWhenReady, NOT track(): this fires on the post-OAuth cold
              // load, when the deferred Umami script is usually not loaded yet.
              // track() silently drops events fired before the script lands —
              // which is exactly why past signups never recorded. Queue + flush.
              trackWhenReady(isSignup ? 'signup' : 'signin', { where });
              // Persist the flag so the account is only ever counted as a signup
              // once, on any device. Best-effort: a failed write at worst risks a
              // later login being recounted as a signup, never a lost signin.
              if (isSignup && SH.profile && !SH.profile.signup_tracked) {
                SH.profile.signup_tracked = true;
                try { SH.sb.from('profiles').update({ signup_tracked: true }).eq('id', SH.user.id).then(function(){}, function(){}); } catch(_) {}
              }
            }
          }
        }, 0);
      }
      if (location.hash.includes('access_token') || location.search.includes('code=')) {
        history.replaceState(null, '', location.pathname);
      }
    });
    setTimeout(()=>{ if(!booted){ console.warn('[smuthub auth] boot timeout'); renderAuthbox(); window.dispatchEvent(new CustomEvent('sh-auth',{detail:{user:null,profile:null}})); } }, 2500);
  } else {
    document.addEventListener('DOMContentLoaded', renderAuthbox);
  }

  async function loadProfile(){
    try{
      const { data } = await SH.sb.from('profiles').select('*').eq('id', SH.user.id).maybeSingle();
      return data || null;
    }catch(e){ console.warn('profile load', e); return null; }
  }

  // Handles nobody but us should be able to claim — brand names, roles that
  // imply authority (impersonation risk), and the site's own route words. All
  // lowercase; the check compares case-insensitively. To claim one of these for
  // an official account, set it directly via SQL (bypasses this UI guard).
  const RESERVED_HANDLES = new Set([
    // brand
    'smut','smuthub','smut_hub','smuthubapp','smuthubofficial','official','team','staff',
    // authority / support (impersonation)
    'admin','administrator','root','superuser','mod','mods','moderator','support','helpdesk',
    'help','contact','info','hello','security','abuse','legal','privacy','billing','payments',
    'sales','press','media','news','owner','founder','founders','ceo',
    // system / generic
    'api','www','mail','email','app','apps','web','home','index','null','undefined','none',
    'anonymous','anon','deleted','guest','user','users','me','you','everyone','nobody',
    'test','testing','demo','example','premium','vip','bot',
    // site routes / sections
    'books','book','bookshelf','bookcase','shelf','glossary','stores','store','dashboard',
    'search','account','settings','profile','profiles','login','logout','signin','signup',
    'register','follow','followers','following','u'
  ]);

  // The name shown in the UI. A freely-changeable display_name wins; otherwise
  // the permanent @handle (username); otherwise the email. display_name is a
  // newer column, so this safely falls back when it's absent/empty.
  function displayName(){
    const p = SH.profile || {};
    return p.display_name || p.username || (SH.user ? SH.user.email : '');
  }
  function accountHandle(){ return (SH.profile && SH.profile.username) || ''; }

  // ── shared primary navigation ───────────────────────────────────────────
  // Every public page carries a lightweight static fallback, but this is the
  // single source of truth for the rendered navigation. New links belong here
  // once—not across hundreds of generated book and glossary pages.
  function renderSharedNavigation(){
    const nav = document.querySelector('header .navlinks');
    if(!nav) return;
    const path = location.pathname.replace(/\/index\.html$/, '/');
    const active = {
      books: path.startsWith('/books/'),
      guides: path.startsWith('/guides/') || path.startsWith('/glossary/'),
      shelf: path === '/bookshelf' || path === '/bookshelf/',
      stores: path === '/stores' || path === '/stores.html',
      scan: path === '/scan' || path === '/scan.html',
      add: path === '/search' || path === '/search.html' || path === '/smuthub-app.html'
    };
    const on = key => active[key] ? ' class="on"' : '';
    nav.setAttribute('aria-label', 'Primary navigation');
    nav.innerHTML = `
      <a href="/books/"${on('books')}>Browse Books</a>
      <details class="sh-guides${active.guides ? ' on' : ''}">
        <summary><span class="sh-guides-label">Guides</span><svg class="sh-guides-chevron" aria-hidden="true" focusable="false" viewBox="0 0 12 8"><path d="M1 1.25 6 6.25 11 1.25"/></svg></summary>
        <div class="sh-guides-menu">
          <a href="/guides/"><b>All Guides</b><small>Start with the full library</small></a>
          <a href="/guides/what-is-romantasy/"><b>What Is Romantasy?</b><small>Start with the genre essentials</small></a>
          <a href="/guides/spice-levels/"><b>Spice Levels</b><small>Choose your heat with no surprises</small></a>
          <a href="/guides/romantasy-tropes/"><b>Romantasy Tropes</b><small>Choose your next read by feeling</small></a>
          <a href="/glossary/"><b>Glossary</b><small>Decode 562 romantasy terms</small></a>
          <a href="/glossary/trope/"><b>Tropes</b><small>Browse the story dynamics you love</small></a>
          <a href="/glossary/warning/"><b>Content Warnings</b><small>Check before chapter one</small></a>
        </div>
      </details>
      <a href="/bookshelf"${on('shelf')}>My Bookshelf</a>
      <a href="/stores"${on('stores')}>Find a Store</a>
      <a href="/scan"${on('scan')}>Scan</a>
      <a href="/search" class="sh-drawer-only${active.add ? ' on' : ''}">Add a Book</a>`;

    const guides = nav.querySelector('.sh-guides');
    if(guides){
      let hoverCloseTimer;
      guides.addEventListener('mouseenter', () => {
        if(window.innerWidth <= 880) return;
        clearTimeout(hoverCloseTimer);
        guides.open = true;
      });
      guides.addEventListener('mouseleave', () => {
        if(window.innerWidth <= 880) return;
        clearTimeout(hoverCloseTimer);
        hoverCloseTimer = setTimeout(() => { guides.open = false; }, 140);
      });
      document.addEventListener('click', e => { if(guides.open && !guides.contains(e.target)) guides.open = false; });
      document.addEventListener('keydown', e => { if(e.key === 'Escape' && guides.open){ guides.open = false; guides.querySelector('summary').focus(); } });
      // Close the dropdown the instant a destination is chosen — desktop nav is
      // immediate, and on mobile it stops the panel lingering over the page.
      guides.querySelectorAll('.sh-guides-menu a').forEach(a => {
        a.addEventListener('click', () => { guides.open = false; });
      });
    }
    renderNavAccount();
  }

  // ── account block inside the mobile nav drawer ──────────────────────────
  // On small screens the header avatar is hidden and the account lives here,
  // at the foot of the hamburger drawer. Re-rendered whenever auth changes.
  // No-op visually on desktop (kept display:none), where #authbox owns it.
  function renderNavAccount(){
    // The account now lives in the header avatar dropdown at every screen size
    // (rightmost), so the hamburger drawer is nav-only. This just clears any
    // stale account block; callers can still invoke it harmlessly.
    const old = document.getElementById('shNavAccount');
    if(old) old.remove();
  }

  // ── header widget ──
  function renderAuthbox(){
    const box = document.getElementById('authbox');
    if(!box) return;
    if (SH.user) {
      const name = displayName(), handle = accountHandle();
      const initial = ((name||'?').trim().charAt(0) || '?').toUpperCase();
      box.innerHTML = `
        <div style="position:relative">
          <button id="shUserBtn" class="sh-avatar" title="${esc(name)}" aria-label="Account menu" aria-haspopup="menu" aria-expanded="false">${esc(initial)}</button>
          <div id="shMenu" class="sh-account-menu" role="menu" style="display:none;position:absolute;right:0;top:125%;z-index:95;background:#150e10;border:1px solid var(--line,#2a1d22);border-radius:14px;min-width:220px;overflow:hidden;box-shadow:0 18px 40px rgba(0,0,0,.5)">
            <div style="padding:.7em 1.1em;border-bottom:1px solid var(--line,#2a1d22);color:#b69089;font-size:.78rem">Signed in as<br><b style="color:var(--amber,#ffab40);font-size:.92rem">${esc(name)}</b>${handle?`<br><span style="color:#8a6d66">@${esc(handle)}</span>`:''}</div>
            <a class="sh-menu-link" role="menuitem" href="/dashboard"><span class="sh-ico">📊</span><span>Dashboard</span></a>
            <a class="sh-menu-link" role="menuitem" href="/search"><span class="sh-ico">➕</span><span>Add a book</span></a>
            <a class="sh-menu-link" role="menuitem" href="/import/"><span class="sh-ico">📥</span><span>Import library</span></a>
            <button type="button" class="shMenuItem" role="menuitem" data-act="display"><span class="sh-ico">✏️</span><span>Edit display name</span></button>
            ${handle?'':'<button type="button" class="shMenuItem" role="menuitem" data-act="handle"><span class="sh-ico">🏷️</span><span>Claim your handle</span></button>'}
            <button type="button" class="shMenuItem" role="menuitem" data-act="logout"><span class="sh-ico">👋</span><span>Log out</span></button>
          </div>
        </div>`;
      const btn = document.getElementById('shUserBtn'), menu = document.getElementById('shMenu');
      const setMenuOpen = open => {
        menu.style.display = open ? 'block' : 'none';
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      };
      btn.onclick = (e)=>{
        e.stopPropagation();
        const opening = menu.style.display==='none';
        // close any other open header menu first (e.g. the mobile nav drawer)
        if(opening) window.dispatchEvent(new CustomEvent('sh-menu-open',{detail:{id:'shMenu'}}));
        setMenuOpen(opening);
        if(opening) document.addEventListener('click', ()=>setMenuOpen(false), { once:true });
      };
      // listen for another menu opening → close this one
      window.addEventListener('sh-menu-open', (ev)=>{ if(ev.detail && ev.detail.id!=='shMenu') setMenuOpen(false); });
      menu.querySelectorAll('.shMenuItem').forEach(mi=>{
        mi.onclick = ()=> accountAction(mi.dataset.act);   // styling + hover via CSS (.sh-account-menu .shMenuItem)
      });
      renderNavAccount();
    } else {
      box.innerHTML = `<button class="sh-login-button" onclick="SH.openAuth()" style="background:linear-gradient(100deg,#ff3d76 0%,#ff7a4d 55%,#ffab40 100%);color:#1a0c10;border:0;font-family:inherit;font-weight:800;padding:.55em 1.1em;border-radius:99px;cursor:pointer;font-size:.85rem"><span class="sh-login-full">Log in / Sign up</span><span class="sh-login-short">Join free</span></button>`;
      renderNavAccount();
    }
  }

  async function setUsername(){
    // The username is a PERMANENT handle: it's the address of the user's public
    // bookshelf (smuthub.ca/u/<handle>), so changing it would orphan any shared
    // or bookmarked link. We let it be set once, then lock it. (Follows + shelf
    // data are keyed by user id, so they're unaffected either way.) A separate
    // changeable display name can be layered on later without touching the URL.
    const existing = SH.profile && SH.profile.username;
    if(existing){
      alert("Your handle @"+existing+" is permanent — it's the web address of your public bookshelf (smuthub.ca/u/"+existing+"), so it can't be changed here. Need it changed? Email hello@smuthub.ca.");
      return;
    }
    const name = prompt("Choose your permanent handle (3–20 chars · letters, numbers, underscores).\n\nThis becomes your public bookshelf address:\nsmuthub.ca/u/yourhandle\n\nIt can't be changed later, so pick one you'll be happy with.", "");
    if(name===null) return;
    // Canonicalize to lowercase so handles are case-insensitive-unique and every
    // /u/<handle> URL resolves regardless of how it was typed. Display name keeps
    // the pretty casing. (Existing mixed-case handles still resolve — the viewers
    // match case-insensitively — but new ones are always lowercase.)
    const clean = name.trim().toLowerCase();
    if(!/^[a-z0-9_]{3,20}$/.test(clean)){ alert("3–20 characters, letters/numbers/underscores only."); return; }
    if(RESERVED_HANDLES.has(clean)){ alert("“"+clean+"” is reserved and can't be used as a handle. Please choose another."); return; }
    const { error } = await SH.sb.from('profiles').upsert({ id: SH.user.id, username: clean });
    if(error){ alert(/duplicate|unique/i.test(error.message) ? "That handle is taken — try another!" : "Error: "+error.message); return; }
    SH.profile = Object.assign(SH.profile||{}, { username: clean });
    renderAuthbox();
  }

  // Freely-changeable display name (the nickname shown on your shelf). Unlike
  // the @handle, this never appears in a URL, so it can be changed anytime.
  async function setDisplayName(){
    const cur = (SH.profile && SH.profile.display_name) || '';
    const name = prompt("Your display name — the nickname shown on your bookshelf.\n\nYou can change this anytime; it doesn't affect your bookshelf link.", cur);
    if(name===null) return;
    const clean = name.trim().replace(/\s+/g,' ');
    if(clean.length>40){ alert("Please keep your display name under 40 characters."); return; }
    const { error } = await SH.sb.from('profiles').upsert({ id: SH.user.id, display_name: clean || null });
    if(error){
      alert(/column|display_name|schema|does not exist/i.test(error.message)
        ? "Display names aren't switched on yet — the database needs a quick one-time update."
        : "Error: "+error.message);
      return;
    }
    SH.profile = Object.assign(SH.profile||{}, { display_name: clean || null });
    renderAuthbox();
  }

  // Shared dispatcher for the account-menu buttons (avatar dropdown + drawer).
  function accountAction(act){
    if(act==='logout') return logout();
    if(act==='handle') return setUsername();
    if(act==='display') return setDisplayName();
  }

  async function saveTheme(theme){
    if(!SH.user || !SH.sb) return;
    try{
      await SH.sb.from('profiles').upsert({ id: SH.user.id, theme });
      SH.profile = Object.assign(SH.profile||{}, { theme });
    }catch(e){ console.warn('theme save', e); }
  }

  async function logout(){
    try{ await Promise.race([ SH.sb.auth.signOut({scope:'local'}), new Promise(r=>setTimeout(r,1500)) ]); }catch(e){}
    Object.keys(localStorage).forEach(k=>{ if(k.includes('auth-token')||k.startsWith('sb-')) localStorage.removeItem(k); });
    location.reload();
  }

  // ── auth modal (Google only) ──
  // Google OAuth is the ONLY sign-in method: we never store a password, and the
  // only personal data we hold is the account email + the user's own shelf.
  // (Also disable the Email provider in the Supabase dashboard so password /
  // magic-link sign-up can't be used out-of-band.)
  function openAuth(){
    if(!configured){ alert("Add your Supabase keys to config.js first."); return; }
    if(document.getElementById('authModal')) return;
    const d=document.createElement('div');
    d.id='authModal';
    d.style.cssText='position:fixed;inset:0;z-index:120;background:rgba(6,3,4,.75);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:inherit';
    d.innerHTML=`<div style="background:#150e10;border:1px solid #2a1d22;border-radius:20px;max-width:380px;width:100%;padding:26px;color:#f4e8e3">
      <h3 style="font-family:Fraunces,serif;font-weight:600;font-size:1.35rem;margin:0">Welcome to the Hub</h3>
      <p style="color:#b69089;font-size:.88rem;margin:4px 0 18px">Passwordless sign-in to save your bookshelf and ratings. The only thing we store is your email and your shelf — never a password.</p>
      <button id="aGoogle" style="width:100%;padding:.85em;background:linear-gradient(100deg,#ff3d76,#ff7a4d 55%,#ffab40);color:#1a0c10;border:0;font-family:inherit;font-weight:800;border-radius:99px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><svg width="17" height="17" viewBox="0 0 24 24"><path fill="#fff" d="M12 5.04c1.62 0 3.06.56 4.2 1.64l3.12-3.12C17.46 1.8 14.96.75 12 .75 7.62.75 3.84 3.27 1.98 6.93l3.66 2.84C6.54 7.05 9.03 5.04 12 5.04z"/><path fill="#1a0c10" d="M23.49 12.27c0-.93-.08-1.61-.26-2.32H12v4.21h6.47c-.13 1.08-.84 2.71-2.4 3.8l3.57 2.77c2.14-1.97 3.85-4.87 3.85-8.46z"/><path fill="#fff" d="M5.64 14.1a7.2 7.2 0 0 1 0-4.33L1.98 6.93a11.27 11.27 0 0 0 0 10.14l3.66-2.97z"/><path fill="#1a0c10" d="M12 23.25c3.24 0 5.96-1.07 7.94-2.91l-3.57-2.77c-.97.66-2.27 1.12-4.37 1.12-2.97 0-5.46-2.01-6.36-4.72l-3.66 2.97c1.86 3.69 5.64 6.31 10.02 6.31z"/></svg> Continue with Google</button>
      <div style="display:flex;align-items:center;gap:10px;margin:14px 0;color:#7d5d5b;font-size:.72rem"><span style="flex:1;height:1px;background:#2a1d22"></span>OR<span style="flex:1;height:1px;background:#2a1d22"></span></div>
      <input id="aEmail" type="email" placeholder="you@email.com" autocomplete="email" style="width:100%;box-sizing:border-box;background:#1c1316;border:1px solid #2a1d22;color:#f4e8e3;font-family:inherit;border-radius:12px;padding:.7em 1em;outline:none">
      <button id="aMagic" style="width:100%;margin-top:8px;padding:.75em;background:none;border:1px solid #2a1d22;color:#f4e8e3;font-family:inherit;font-weight:700;border-radius:99px;cursor:pointer">✨ Email me a login link</button>
      <div id="aMsg" style="min-height:1.3em;font-size:.85rem;margin-top:10px;color:#ff9aa8;text-align:center"></div>
      <p style="color:#7d5d5b;font-size:.72rem;margin:12px 0 0;line-height:1.55;text-align:center">By continuing you agree to our <a href="/terms.html" style="color:#ffab40;text-decoration:none">Terms</a> and <a href="/privacy.html" style="color:#ffab40;text-decoration:none">Privacy Policy</a>.</p>
      <button id="aCancel" style="width:100%;margin-top:14px;padding:.6em;background:none;border:0;color:#b69089;font-family:inherit;font-weight:700;cursor:pointer">Cancel</button>
    </div>`;
    d.addEventListener('click',e=>{ if(e.target===d) d.remove(); });
    document.body.appendChild(d);
    // Funnel top: the sign-in sheet opened. `where` attributes the intent to the
    // page/CTA that drove it, so the funnel reads auth-open → oauth/magic-start →
    // signup/signin. Interaction event (user clicked to get here), so track() is
    // safe — Umami is loaded long before any modal opens.
    track('auth-open', { where: location.pathname.replace(/\/index\.html$/, '/') || '/' });
    const msg=(t,bad)=>{ const m=document.getElementById('aMsg'); m.textContent=t; m.style.color=bad?'#ff9aa8':'#ffab40'; };
    document.getElementById('aCancel').onclick=()=>d.remove();
    document.getElementById('aGoogle').onclick = async ()=>{
      // Funnel mid: chose Google and left for the OAuth redirect. Fire before the
      // await so it records even though the page is about to navigate away.
      track('oauth-start', { method: 'google' });
      msg("Redirecting to Google…");
      const {error}=await SH.sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.href}});
      if(error) msg(error.message,1);
    };
    // Passwordless email sign-in (magic link) for anyone without a Google
    // account. Still stores only the email — no password is ever set.
    const sendMagic = async ()=>{
      const email=document.getElementById('aEmail').value.trim();
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ msg("Enter a valid email first",1); return; }
      // Funnel mid: chose the passwordless email path. Distinguishes method choice
      // from oauth-start; both roll up under auth-open.
      track('magic-link-start', { method: 'email' });
      msg("Sending your link…");
      const {error}=await SH.sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.href}});
      msg(error?error.message:"Link sent — check your email 💌",!!error);
    };
    document.getElementById('aMagic').onclick = sendMagic;
    document.getElementById('aEmail').addEventListener('keydown',e=>{ if(e.key==='Enter') sendMagic(); });
  }

  function esc(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // ── feedback (members-only) ──────────────────────────────
  // Shown on every page via a floating button. Logged-out users are sent to
  // sign up first; once logged in we auto-open the feedback box (login + feedback
  // in close to one step). Submissions go to the Supabase `feedback` table.
  let pendingFeedback = false;

  function openFeedback(){
    if(!configured){ alert("Feedback needs the site's Supabase config."); return; }
    if(!SH.user){ pendingFeedback = true; openAuth(); return; }
    if(document.getElementById('fbModal')) return;
    const d=document.createElement('div');
    d.id='fbModal';
    d.style.cssText='position:fixed;inset:0;z-index:130;background:rgba(6,3,4,.75);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:inherit';
    d.innerHTML=`<div style="background:#150e10;border:1px solid #2a1d22;border-radius:20px;max-width:420px;width:100%;padding:24px;color:#f4e8e3">
      <h3 style="font-family:Fraunces,serif;font-weight:600;font-size:1.3rem;margin:0">Tell us everything 💌</h3>
      <p style="color:#b69089;font-size:.86rem;margin:4px 0 14px">Bugs, hot takes, missing tropes — members only, and we read every note.</p>
      <textarea id="fbText" rows="5" placeholder="What's on your mind?" style="width:100%;box-sizing:border-box;background:#1c1316;border:1px solid #2a1d22;color:#f4e8e3;font-family:inherit;border-radius:12px;padding:.7em 1em;outline:none;resize:vertical"></textarea>
      <div id="fbMsg" style="min-height:1.2em;font-size:.85rem;margin-top:8px;color:#ffab40"></div>
      <button id="fbSend" style="width:100%;margin-top:6px;padding:.8em;background:linear-gradient(100deg,#ff3d76,#ff7a4d 55%,#ffab40);color:#1a0c10;border:0;font-family:inherit;font-weight:800;border-radius:99px;cursor:pointer">Send feedback</button>
      <button id="fbCancel" style="width:100%;margin-top:8px;padding:.6em;background:none;border:0;color:#b69089;font-family:inherit;font-weight:700;cursor:pointer">Cancel</button>
    </div>`;
    d.addEventListener('click',e=>{ if(e.target===d) d.remove(); });
    document.body.appendChild(d);
    document.getElementById('fbCancel').onclick=()=>d.remove();
    document.getElementById('fbSend').onclick=async ()=>{
      const fbMsg=document.getElementById('fbMsg');
      const message=document.getElementById('fbText').value.trim();
      if(message.length<3){ fbMsg.style.color='#ff9aa8'; fbMsg.textContent="A few more words?"; return; }
      document.getElementById('fbSend').textContent="Sending…";
      const { error } = await SH.sb.from('feedback').insert({ user_id: SH.user.id, page: location.pathname, message });
      if(error){ fbMsg.style.color='#ff9aa8'; fbMsg.textContent="Couldn't send: "+error.message; document.getElementById('fbSend').textContent="Send feedback"; return; }
      d.querySelector('div').innerHTML='<h3 style="font-family:Fraunces,serif;font-weight:600;font-size:1.3rem;margin:0">Got it 💌</h3><p style="color:#b69089;font-size:.9rem;margin:8px 0 0">Thank you — that genuinely helps. You can close this.</p><button id="fbDone" style="width:100%;margin-top:16px;padding:.7em;background:none;border:1px solid #2a1d22;color:#f4e8e3;font-family:inherit;font-weight:700;border-radius:99px;cursor:pointer">Close</button>';
      document.getElementById('fbDone').onclick=()=>d.remove();
    };
    document.getElementById('fbText').focus();
  }

  // After login, fulfil a feedback request that was started while logged out.
  window.addEventListener('sh-auth', (e)=>{
    if(pendingFeedback && e.detail && e.detail.user){ pendingFeedback=false; setTimeout(openFeedback, 200); }
  });

  // Floating "Feedback" button — DISABLED for now. Members give feedback from the
  // dashboard, and this bubble duplicated that (and overlapped content on mobile).
  // openFeedback() is still exported, so any in-page button can re-trigger it.
  function mountFeedbackButton(){
    if(document.getElementById('shFeedbackBtn')) return;
    const b=document.createElement('button');
    b.id='shFeedbackBtn';
    b.type='button';
    b.textContent='💬 Feedback';
    b.title='Feedback (members only)';
    b.style.cssText='position:fixed;right:16px;bottom:16px;z-index:70;background:#150e10;border:1px solid #2a1d22;color:#f4e8e3;font-family:inherit;font-weight:700;font-size:.82rem;padding:.6em 1em;border-radius:99px;cursor:pointer;box-shadow:0 10px 24px rgba(0,0,0,.45)'
    b.onclick=openFeedback;
    document.body.appendChild(b);
  }

  // ── shared mobile header: compact avatar + hamburger nav (every page) ──
  function injectHeaderCSS(){
    if(document.getElementById('sh-ui-css')) return;
    const st=document.createElement('style'); st.id='sh-ui-css';
    st.textContent=`
      /* iOS Safari auto-zooms into any input with font-size < 16px when it's
         focused, then leaves the user stranded in a zoomed state with the page
         scrolled sideways. The ONLY reliable fix is to make text inputs and
         textareas ≥ 16px at touch sizes. Desktop layout is unaffected. */
      @media (max-width: 768px){
        input, textarea { font-size: 16px !important; }
      }
      /* Auto-hide header: slides away on scroll-down, returns on scroll-up, so
         search + nav are a flick away without the bar covering content. */
      header{transition:transform .28s cubic-bezier(.4,0,.2,1);will-change:transform}
      header.sh-header-hidden{transform:translateY(-100%)}
      @media(prefers-reduced-motion:reduce){header{transition:none}}
      /* Canonical header — single source of truth so every page matches the
         guides-page spacing (generous, full-width) and is sticky, so the
         auto-hide above applies uniformly everywhere. */
      header{position:sticky;top:0;z-index:60;border-bottom:1px solid var(--line,#2a1d22);
        background:rgba(18,11,18,.9);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
      header .nav{max-width:none;margin:0;min-height:74px;gap:1.25rem;justify-content:space-between;
        padding-left:clamp(1.2rem,4vw,4.25rem);padding-right:clamp(1.2rem,4vw,4.25rem)}
      header .logo,header .brand{font-size:1.4rem}
      .sh-totop{position:fixed;right:16px;bottom:16px;z-index:60;width:46px;height:46px;border-radius:50%;
        background:var(--grad,linear-gradient(100deg,#ff3d76,#ff7a4d 55%,#ffab40));color:#1a0c10;border:0;cursor:pointer;
        font-size:1.25rem;font-weight:800;line-height:1;font-family:inherit;
        opacity:0;transform:translateY(10px);transition:opacity .18s,transform .18s;pointer-events:none;
        box-shadow:0 10px 24px rgba(0,0,0,.45)}
      .sh-totop.show{opacity:1;transform:none;pointer-events:auto}
      .sh-avatar{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;
        background:var(--grad,linear-gradient(100deg,#ff3d76,#ff7a4d 55%,#ffab40));color:#1a0c10;font-weight:800;font-size:1rem;
        border:0;cursor:pointer;font-family:inherit;flex:0 0 auto}
      header .navlinks{align-items:center}
      header .navlinks>a,header .sh-guides>summary{display:flex;align-items:center;min-height:42px;color:var(--muted,#b69089);
        font-family:inherit;font-size:.92rem;font-weight:500;text-decoration:none;white-space:nowrap;cursor:pointer;transition:color .2s}
      header .navlinks>a.on,header .sh-guides.on>summary{color:var(--cream,#f4e8e3)}
      /* "Add a Book" lives only in the mobile hamburger drawer — Scan is the
         primary add action in the top nav now. Hidden on desktop; shown when the
         drawer is open on small screens. */
      header .navlinks .sh-drawer-only{display:none}
      @media(max-width:880px){ header .navlinks.sh-open .sh-drawer-only{display:flex} }
      header .sh-guides{position:relative}
      header .sh-guides>summary{position:relative;padding-right:17px;list-style:none}
      header .sh-guides>summary::-webkit-details-marker{display:none}
      /* Keep the label on its own layer so Safari can't skew it while the
         chevron re-composites on hover-open (a WebKit <details> glitch). */
      header .sh-guides-label{position:relative;z-index:1;transform:none}
      header .sh-guides-chevron{position:absolute;right:1px;top:50%;width:10px;height:7px;margin-top:-3.5px;overflow:visible;
        fill:none;stroke:var(--amber,#ffab40);stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;
        opacity:.65;transition:opacity .16s}
      header .sh-guides>summary:focus-visible .sh-guides-chevron,
      header .sh-guides[open] .sh-guides-chevron{opacity:1}
      header .sh-guides[open] .sh-guides-chevron{transform:rotate(180deg)}
      header .sh-guides-menu{position:absolute;top:calc(100% + 9px);left:50%;z-index:100;width:290px;padding:8px;
        transform:translateX(-50%);background:#150e10;border:1px solid var(--line,#2a1d22);border-radius:16px;
        box-shadow:0 22px 50px rgba(0,0,0,.55)}
      header .sh-guides-menu a{display:block;padding:10px 12px;border-radius:10px;color:var(--cream,#f4e8e3);text-decoration:none}
      header .sh-guides-menu b{display:block;font-size:.9rem;line-height:1.2}
      header .sh-guides-menu small{display:block;margin-top:3px;color:var(--muted,#b69089);font-size:.76rem;font-weight:400;line-height:1.25}
      .sh-account-menu .sh-menu-link,.sh-account-menu .shMenuItem{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;text-align:left;
        background:none;border:0;color:#f4e8e3;font-family:inherit;font-size:.9rem;font-weight:600;padding:.62em 1.05em;
        cursor:pointer;text-decoration:none}
      .sh-account-menu .sh-menu-link:hover,.sh-account-menu .shMenuItem:hover{background:#1c1316}
      .sh-account-menu .sh-ico,.sh-nav-account .sh-ico{width:1.25em;text-align:center;font-size:1rem;line-height:1;flex:0 0 auto}
      .sh-login-short{display:none}
      /* Persistent global search shortcut — always-visible icon in the header
         bar so readers can jump straight to the catalog without opening the
         hamburger. Links to /books/ (the searchable browse index). */
      .sh-search-btn{display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:12px;
        background:none;border:1px solid var(--line,#2a1d22);color:var(--cream,#f4e8e3);cursor:pointer;flex:0 0 auto;text-decoration:none;
        transition:border-color .2s,color .2s}
      .sh-search-btn svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
      .sh-search-btn:hover,.sh-search-btn.on{border-color:var(--amber,#ffab40);color:var(--amber,#ffab40)}
      /* Live type-ahead search dropdown (anchored under the header). */
      .sh-search-panel{position:absolute;z-index:120;top:calc(100% + 7px);right:10px;left:auto;
        width:min(430px,calc(100vw - 20px));background:#150e10;border:1px solid var(--line,#2a1d22);border-radius:16px;
        box-shadow:0 22px 50px rgba(0,0,0,.55);padding:10px;display:none}
      .sh-search-panel.open{display:block}
      .sh-search-input{width:100%;box-sizing:border-box;background:#1c1316;border:1px solid var(--line,#2a1d22);
        color:var(--cream,#f4e8e3);font-family:inherit;font-size:16px;border-radius:11px;padding:.72em .95em;outline:none}
      .sh-search-input:focus{border-color:var(--amber,#ffab40)}
      .sh-search-results{margin-top:8px;max-height:min(58vh,430px);overflow-y:auto;overscroll-behavior:contain}
      .sh-search-results a{display:flex;gap:11px;align-items:center;padding:8px;border-radius:10px;text-decoration:none;color:var(--cream,#f4e8e3)}
      .sh-search-results a:hover,.sh-search-results a.sh-sel{background:#1c1316}
      .sh-sr-cover{width:36px;height:52px;flex:0 0 auto;border-radius:5px;object-fit:cover;background:#241a1e;
        display:flex;align-items:center;justify-content:center;overflow:hidden;
        font-family:Fraunces,serif;font-style:italic;font-size:.62rem;color:#b69089;text-align:center;line-height:1.05;padding:2px}
      .sh-sr-cover img{width:100%;height:100%;object-fit:cover;display:block}
      .sh-sr-meta{min-width:0;flex:1}
      .sh-sr-title{display:block;font-size:.9rem;font-weight:600;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .sh-sr-author{display:block;font-size:.78rem;color:var(--muted,#b69089);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
      .sh-sr-spice{flex:0 0 auto;font-size:.72rem;color:#ff8a5c;letter-spacing:1px}
      .sh-search-hint{padding:12px 9px;color:var(--muted,#b69089);font-size:.85rem;text-align:center}
      .sh-search-hint a{color:var(--amber,#ffab40);text-decoration:none;font-weight:600}
      @media(max-width:880px){ .sh-search-panel{right:10px;left:10px;width:auto} }
      /* Account section that lives inside the mobile nav drawer (replaces the
         header avatar on small screens). Hidden on desktop, where the avatar
         in #authbox stays. */
      #shNavAccount{display:none}
      .sh-nav-account{display:flex;flex-direction:column;gap:1px}
      .sh-nav-acct-hd{display:flex;align-items:center;justify-content:center;gap:11px;padding:2px 10px 11px}
      .sh-nav-av{width:36px;height:36px;border-radius:50%;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;
        background:var(--grad,linear-gradient(100deg,#ff3d76,#ff7a4d 55%,#ffab40));color:#1a0c10;font-weight:800;font-size:1rem}
      .sh-nav-who{display:flex;flex-direction:column;line-height:1.25}
      .sh-nav-who .sh-nav-name{color:var(--cream,#f4e8e3);font-size:.98rem;font-weight:700}
      .sh-nav-who .sh-nav-at{color:var(--muted,#b69089);font-size:.8rem}
      .sh-nav-account>a,.sh-nav-account>button{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;box-sizing:border-box;
        background:none;border:0;color:var(--cream,#f4e8e3);font-family:inherit;font-size:.95rem;font-weight:600;padding:.62em .85em;border-radius:10px;
        cursor:pointer;text-decoration:none}
      .sh-nav-account>a:hover,.sh-nav-account>button:hover{background:#1c1316}
      .sh-nav-account .sh-nav-login{background:linear-gradient(100deg,#ff3d76,#ff7a4d 55%,#ffab40);color:#1a0c10;
        font-weight:800;border-radius:99px;margin-top:8px;padding:.72em .85em}
      .sh-nav-account .sh-nav-login:hover{background:linear-gradient(100deg,#ff3d76,#ff7a4d 55%,#ffab40)}
      @media(min-width:881px){
        header .navlinks>a:hover,header .sh-guides>summary:hover{color:var(--cream,#f4e8e3)}
        header .sh-guides>summary:hover .sh-guides-chevron{opacity:1}
        header .sh-guides-menu a:hover{background:rgba(255,171,64,.1)}
        /* Center the primary nav in the header on every page. The links are
           lifted out of flow and pinned to the middle, so the logo sits left,
           the search+avatar cluster sits right, and the nav is truly centered
           regardless of how wide either side is. */
        header .nav{position:relative}
        header .navlinks{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
          justify-content:center;white-space:nowrap}
        header .sh-search-btn{margin-left:auto}
      }
      .sh-hamburger{display:none;align-items:center;justify-content:center;width:42px;height:42px;border-radius:12px;
        background:none;border:1px solid var(--line,#2a1d22);color:var(--cream,#f4e8e3);font-size:1.3rem;line-height:1;cursor:pointer;flex:0 0 auto}
      @media(max-width:880px){
        header .nav{flex-wrap:nowrap;height:auto;min-height:58px;gap:8px;
          padding-left:16px;padding-right:16px;
          padding-top:calc(8px + env(safe-area-inset-top,0px));padding-bottom:8px}
        header .logo{font-size:1.45rem;margin-right:auto}
        header .sh-hamburger{width:38px;height:38px;border-radius:11px;font-size:1.15rem}
        header .sh-hamburger{display:inline-flex}
        header #authbox button:not(.sh-avatar){font-size:.78rem;padding:.52em .85em;white-space:nowrap}
        header .sh-login-full{display:none}
        header .sh-login-short{display:inline}
        header .navlinks{position:absolute;top:calc(100% - 1px);right:10px;left:10px;flex-direction:column;gap:0;
          width:auto;max-height:calc(100vh - 72px);max-height:calc(100dvh - 72px);overflow-y:auto;overscroll-behavior:contain;background:#150e10;
          border:1px solid var(--line,#2a1d22);border-radius:16px;padding:6px;
          display:none;box-shadow:0 22px 50px rgba(0,0,0,.55)}
        header .navlinks.sh-open{display:flex}
        header .navlinks>a,header .sh-guides>summary{min-height:0;padding:.68em .85em;border-radius:10px;font-size:.95rem}
        header .navlinks>a{justify-content:center}
        header .navlinks>a.on,header .sh-guides.on>summary,header .sh-guides[open]>summary{background:rgba(255,171,64,.08);color:var(--cream,#f4e8e3)}
        header .sh-guides{width:100%}
        header .sh-guides>summary{justify-content:center;padding-right:.85em}
        header .sh-guides-label{display:block;text-align:center}
        header .sh-guides-chevron{right:12px;width:11px;height:8px;margin-top:-4px;opacity:.75}
        header .sh-guides-menu{position:static;width:auto;margin:1px 8px 5px;padding:3px;transform:none;border:0;border-radius:10px;
          background:rgba(12,7,8,.45);box-shadow:none}
        header .sh-guides-menu a{padding:7px 10px}
        header .sh-guides-menu b{font-size:.86rem}
        header .sh-guides-menu small{font-size:.72rem}
        header .sh-search-btn{width:38px;height:38px;border-radius:11px}
        /* Account lives in the header avatar (rightmost) at every screen size, so
           the hamburger drawer is nav-only — the drawer account stays hidden. */
      }`;
    document.head.appendChild(st);
  }
  function enhanceHeader(){
    const nav=document.querySelector('header .nav'); if(!nav) return;
    const links=nav.querySelector('.navlinks'); if(!links || nav.querySelector('.sh-hamburger')) return;
    const burger=document.createElement('button');
    burger.className='sh-hamburger'; burger.type='button';
    burger.setAttribute('aria-label','Menu'); burger.setAttribute('aria-expanded','false');
    burger.textContent='☰';
    const setOpen=(open)=>{
      links.classList.toggle('sh-open',open);
      // Collapse the nested Guides submenu when the drawer closes, so it never
      // reopens already-expanded next time.
      if(!open){ const d=links.querySelector('.sh-guides[open]'); if(d) d.open=false; }
      burger.textContent=open?'✕':'☰'; burger.setAttribute('aria-expanded',open?'true':'false');
    };
    burger.addEventListener('click',(e)=>{
      e.stopPropagation();
      const opening = !links.classList.contains('sh-open');
      if(opening) window.dispatchEvent(new CustomEvent('sh-menu-open',{detail:{id:'shNav'}}));
      setOpen(opening);
    });
    document.addEventListener('click',(e)=>{ if(links.classList.contains('sh-open') && !nav.contains(e.target)) setOpen(false); });
    links.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setOpen(false)));
    // close the nav drawer if another header menu opens (e.g. the avatar dropdown)
    window.addEventListener('sh-menu-open',(ev)=>{ if(ev.detail && ev.detail.id!=='shNav') setOpen(false); });
    // Global search — a magnifier that opens a live type-ahead dropdown.
    // Falls back to a plain /books/ link when Supabase isn't configured.
    const search=document.createElement('a');
    search.className='sh-search-btn'; search.href='/books/';
    search.setAttribute('aria-label','Search books'); search.setAttribute('title','Search books');
    search.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l4 4"/></svg>';
    // Order (left→right): search · menu · avatar. The account avatar sits in the
    // rightmost "account corner" (convention); search + the nav menu group to its
    // left. authbox stays the last child so the avatar is always rightmost.
    const authbox=document.getElementById('authbox');
    if(authbox){ nav.insertBefore(search, authbox); nav.insertBefore(burger, authbox); }
    else { nav.appendChild(search); nav.appendChild(burger); }
    if(SH.configured) mountSearch(nav, search);
  }

  // ── live book search dropdown ────────────────────────────────────────────
  function mountSearch(nav, btn){
    const panel=document.createElement('div');
    panel.className='sh-search-panel'; panel.setAttribute('role','dialog'); panel.setAttribute('aria-label','Search books');
    panel.innerHTML='<input type="text" class="sh-search-input" placeholder="Search books or authors…" autocomplete="off" spellcheck="false" aria-label="Search books or authors">'
      +'<div class="sh-search-results" role="listbox"></div>';
    nav.appendChild(panel);
    const input=panel.querySelector('.sh-search-input');
    const results=panel.querySelector('.sh-search-results');
    let open=false, seq=0, sel=-1, rows=[];

    const setOpen=(o)=>{
      open=o; panel.classList.toggle('open',o); btn.classList.toggle('on',o);
      btn.setAttribute('aria-expanded',o?'true':'false');
      if(o){ window.dispatchEvent(new CustomEvent('sh-menu-open',{detail:{id:'shSearch'}})); setTimeout(()=>input.focus(),20); }
      else { input.value=''; results.innerHTML=''; sel=-1; rows=[]; }
    };
    btn.setAttribute('role','button'); btn.setAttribute('aria-haspopup','dialog'); btn.setAttribute('aria-expanded','false');
    btn.addEventListener('click',(e)=>{ e.preventDefault(); e.stopPropagation(); setOpen(!open); });
    // close when another header menu opens, on outside click, on Escape
    window.addEventListener('sh-menu-open',(ev)=>{ if(ev.detail && ev.detail.id!=='shSearch' && open) setOpen(false); });
    document.addEventListener('click',(e)=>{ if(open && !panel.contains(e.target) && e.target!==btn && !btn.contains(e.target)) setOpen(false); });

    const cover=(b)=> b.cover_url
      ? '<span class="sh-sr-cover"><img loading="lazy" src="'+esc(b.cover_url)+'" alt=""></span>'
      : '<span class="sh-sr-cover">'+esc((b.title||'?').slice(0,18))+'</span>';
    const spice=(n)=> n>0 ? '<span class="sh-sr-spice" title="Spice '+n+'/5">'+'🌶️'.repeat(Math.min(5,n))+'</span>' : '';

    const highlight=(i)=>{
      sel=i;
      [...results.querySelectorAll('a')].forEach((a,idx)=>a.classList.toggle('sh-sel',idx===i));
      const cur=results.querySelector('a.sh-sel'); if(cur) cur.scrollIntoView({block:'nearest'});
    };
    const render=(q)=>{
      if(!rows.length){
        results.innerHTML='<div class="sh-search-hint">No matches for “'+esc(q)+'”. <a href="/books/">Browse the full catalog →</a></div>';
        return;
      }
      results.innerHTML=rows.map(b=>
        '<a role="option" href="/books/'+esc(b.slug)+'/">'+cover(b)
        +'<span class="sh-sr-meta"><span class="sh-sr-title">'+esc(b.title||'Untitled')+'</span>'
        +'<span class="sh-sr-author">'+esc(b.author||'')+'</span></span>'+spice(b.spice_level)+'</a>'
      ).join('');
      sel=-1;
    };
    async function run(q){
      const my=++seq;
      const clean=q.trim().replace(/[,%_()]/g,' ').replace(/\s+/g,' ').trim();
      if(clean.length<2){ results.innerHTML='<div class="sh-search-hint">Type at least 2 letters…</div>'; rows=[]; return; }
      results.innerHTML='<div class="sh-search-hint">Searching…</div>';
      const like='%'+clean+'%';
      let data=[];
      try{
        const r=await SH.sb.from('books').select('slug,title,author,cover_url,spice_level,rating_avg')
          .eq('status','live').or('title.ilike.'+like+',author.ilike.'+like)
          .order('rating_avg',{ascending:false,nullsFirst:false}).limit(8);
        data=r.data||[];
      }catch(err){ console.warn('[smuthub search]',err); }
      if(my!==seq) return;           // a newer keystroke already fired
      rows=data; render(clean);
    }
    let t; input.addEventListener('input',()=>{ clearTimeout(t); const q=input.value; t=setTimeout(()=>run(q),180); });
    input.addEventListener('keydown',(e)=>{
      const links=[...results.querySelectorAll('a')];
      if(e.key==='ArrowDown'){ e.preventDefault(); if(links.length) highlight((sel+1)%links.length); }
      else if(e.key==='ArrowUp'){ e.preventDefault(); if(links.length) highlight((sel-1+links.length)%links.length); }
      else if(e.key==='Enter'){ const go=links[sel>=0?sel:0]; if(go){ e.preventDefault(); location.href=go.getAttribute('href'); } }
      else if(e.key==='Escape'){ e.preventDefault(); setOpen(false); btn.focus(); }
    });
  }
  // Floating "↑ back to top" button (every page). Appears after the user scrolls
  // ~800px down, smooth-scrolls to top on click. Visible / aria-hidden when not.
  function mountBackToTop(){
    if(document.getElementById('shToTop')) return;
    const b=document.createElement('button');
    b.id='shToTop'; b.className='sh-totop'; b.type='button';
    b.setAttribute('aria-label','Back to top');
    b.textContent='↑';
    b.onclick=()=> window.scrollTo({top:0, behavior:'smooth'});
    document.body.appendChild(b);
    const onScroll=()=>{ b.classList.toggle('show', window.scrollY > 800); };
    window.addEventListener('scroll', onScroll, {passive:true});
    onScroll();
  }
  // Auto-hide the sticky header on scroll-down, reveal it on scroll-up. Near the
  // very top it's always shown, and it never hides while a header menu is open.
  function mountHideOnScroll(){
    const header=document.querySelector('header'); if(!header) return;
    let lastY=window.scrollY||0, ticking=false;
    const TOP=80, DELTA=6;
    const anyMenuOpen=()=>!!(
      document.querySelector('header .navlinks.sh-open') ||
      document.querySelector('header .sh-guides[open]') ||
      document.querySelector('.sh-search-panel.open') ||
      (()=>{ const m=document.getElementById('shMenu'); return m && m.style.display==='block'; })()
    );
    const update=()=>{
      ticking=false;
      const y=window.scrollY||0;
      if(y<=TOP || anyMenuOpen()){ header.classList.remove('sh-header-hidden'); lastY=y; return; }
      if(Math.abs(y-lastY)<DELTA) return;
      header.classList.toggle('sh-header-hidden', y>lastY);   // down → hide, up → show
      lastY=y;
    };
    window.addEventListener('scroll',()=>{ if(!ticking){ ticking=true; requestAnimationFrame(update); } },{passive:true});
  }
  // ── Bookshelf monetization funnel ────────────────────────────────────────
  // Tracked here (delegated) rather than in the bookshelf file so that actively
  // iterated world code doesn't have to carry analytics, and we avoid merge
  // churn. Answers the two launch questions: do free readers want in, and do
  // owners actually use the world once unlocked. Selectors mirror the bookshelf
  // CTAs (data-unlock-interiors, #openLiveWorld/#openReadingWorld, #atelierUnlock).
  function mountBookshelfTracking(){
    if (!/^\/bookshelf(\/|$)/.test(location.pathname)) return;
    document.addEventListener('click', (e) => {
      const el = e.target.closest ? e.target.closest('[data-unlock-interiors],#openLiveWorld,#openReadingWorld,#atelierUnlock') : null;
      if (!el) return;
      if (el.matches('[data-unlock-interiors]')) track('world-unlock-intent', { world: 'moonlit' });
      else if (el.id === 'atelierUnlock') track('customize-unlock-intent');
      else track('world-enter', { world: 'moonlit' });
    }, true);   // capture: still fires if the bookshelf handler stops propagation
  }
  // Store-directory click tracking. DORMANT until the Find-a-Store map is wired:
  // it fires `store-click` for any element carrying a data-store-click attribute,
  // so the day the map renders real store links/CTAs they are tracked with zero
  // extra code. Nothing fires today because no such elements exist yet, and this
  // lives in the global script (not the stores.html template), so a map rebuild
  // can't drop it.
  //   Contract for wiring the map: put  data-store-click="<store id or name>"  on
  //   each store link/CTA, and optionally  data-store-action="website|directions|call".
  function mountStoreTracking(){
    document.addEventListener('click', (e) => {
      const el = e.target.closest ? e.target.closest('[data-store-click]') : null;
      if (!el) return;
      track('store-click', { store: el.getAttribute('data-store-click') || '', action: el.getAttribute('data-store-action') || 'open' });
    }, true);
  }
  function initShUI(){ injectHeaderCSS(); renderSharedNavigation(); enhanceHeader(); mountUmami(); mountBackToTop(); mountHideOnScroll(); mountBookshelfTracking(); mountStoreTracking(); /* mountFeedbackButton(); ← disabled */ }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', initShUI);
  else initShUI();
})();
