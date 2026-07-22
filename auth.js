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
  // out by mountUmami(), but curating a catalog means browsing /search, /book/
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

  function displayName(){
    return (SH.profile && SH.profile.username) ? SH.profile.username : (SH.user ? SH.user.email : '');
  }

  // ── header widget ──
  function renderAuthbox(){
    const box = document.getElementById('authbox');
    if(!box) return;
    if (SH.user) {
      const name = displayName();
      const initial = ((name||'?').trim().charAt(0) || '?').toUpperCase();
      box.innerHTML = `
        <div style="position:relative">
          <button id="shUserBtn" class="sh-avatar" title="${esc(name)}" aria-label="Account menu">${esc(initial)}</button>
          <div id="shMenu" style="display:none;position:absolute;right:0;top:125%;z-index:95;background:#150e10;border:1px solid var(--line,#2a1d22);border-radius:14px;min-width:200px;overflow:hidden;box-shadow:0 18px 40px rgba(0,0,0,.5)">
            <div style="padding:.7em 1.1em;border-bottom:1px solid var(--line,#2a1d22);color:#b69089;font-size:.78rem">Signed in as<br><b style="color:var(--amber,#ffab40);font-size:.92rem">${esc(name)}</b></div>
            <button class="shMenuItem" data-act="username">✏️ Set username</button>
            <button class="shMenuItem" data-act="logout">👋 Log out</button>
          </div>
        </div>`;
      const btn = document.getElementById('shUserBtn'), menu = document.getElementById('shMenu');
      btn.onclick = (e)=>{
        e.stopPropagation();
        const opening = menu.style.display==='none';
        // close any other open header menu first (e.g. the mobile nav drawer)
        if(opening) window.dispatchEvent(new CustomEvent('sh-menu-open',{detail:{id:'shMenu'}}));
        menu.style.display = opening ? 'block' : 'none';
        if(opening) document.addEventListener('click', ()=>{ menu.style.display='none'; }, { once:true });
      };
      // listen for another menu opening → close this one
      window.addEventListener('sh-menu-open', (ev)=>{ if(ev.detail && ev.detail.id!=='shMenu') menu.style.display='none'; });
      menu.querySelectorAll('.shMenuItem').forEach(mi=>{
        mi.style.cssText = 'display:block;width:100%;text-align:left;background:none;border:0;color:#f4e8e3;font-family:inherit;font-size:.88rem;font-weight:600;padding:.75em 1.1em;cursor:pointer';
        mi.onmouseenter = ()=> mi.style.background='#1c1316';
        mi.onmouseleave = ()=> mi.style.background='none';
        mi.onclick = ()=> mi.dataset.act==='logout' ? logout() : setUsername();
      });
    } else {
      box.innerHTML = `<button onclick="SH.openAuth()" style="background:linear-gradient(100deg,#ff3d76 0%,#ff7a4d 55%,#ffab40 100%);color:#1a0c10;border:0;font-family:inherit;font-weight:800;padding:.55em 1.1em;border-radius:99px;cursor:pointer;font-size:.85rem">Log in / Sign up</button>`;
    }
  }

  async function setUsername(){
    const name = prompt("Pick a username (3–20 chars, letters/numbers/underscores):", (SH.profile&&SH.profile.username)||"");
    if(name===null) return;
    const clean = name.trim();
    if(!/^[a-zA-Z0-9_]{3,20}$/.test(clean)){ alert("3–20 characters, letters/numbers/underscores only."); return; }
    const { error } = await SH.sb.from('profiles').upsert({ id: SH.user.id, username: clean });
    if(error){ alert(/duplicate|unique/i.test(error.message) ? "That username is taken — try another!" : "Error: "+error.message); return; }
    SH.profile = Object.assign(SH.profile||{}, { username: clean });
    renderAuthbox();
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

  // ── auth modal (password-first · Google · magic link) ──
  function openAuth(){
    if(!configured){ alert("Add your Supabase keys to config.js first."); return; }
    if(document.getElementById('authModal')) return;
    const d=document.createElement('div');
    d.id='authModal';
    d.style.cssText='position:fixed;inset:0;z-index:120;background:rgba(6,3,4,.75);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:inherit';
    d.innerHTML=`<div style="background:#150e10;border:1px solid #2a1d22;border-radius:20px;max-width:380px;width:100%;padding:26px;color:#f4e8e3">
      <h3 style="font-family:Fraunces,serif;font-weight:600;font-size:1.35rem;margin:0">Welcome to the Hub</h3>
      <p style="color:#b69089;font-size:.88rem;margin:4px 0 16px">Log in or create your account — same form, we figure it out.</p>
      <input id="aEmail" type="email" placeholder="you@email.com" autocomplete="email" style="width:100%;box-sizing:border-box;background:#1c1316;border:1px solid #2a1d22;color:#f4e8e3;font-family:inherit;border-radius:12px;padding:.7em 1em;outline:none;margin-bottom:9px">
      <input id="aPass" type="password" placeholder="password (6+ characters)" autocomplete="current-password" style="width:100%;box-sizing:border-box;background:#1c1316;border:1px solid #2a1d22;color:#f4e8e3;font-family:inherit;border-radius:12px;padding:.7em 1em;outline:none">
      <div id="aMsg" style="min-height:1.3em;font-size:.85rem;margin-top:8px;color:#ffab40"></div>
      <button id="aGo" style="width:100%;margin-top:6px;padding:.8em;background:linear-gradient(100deg,#ff3d76,#ff7a4d 55%,#ffab40);color:#1a0c10;border:0;font-family:inherit;font-weight:800;border-radius:99px;cursor:pointer">Continue</button>
      <button id="aGoogle" style="width:100%;margin-top:8px;padding:.7em;background:none;border:1px solid #2a1d22;color:#f4e8e3;font-family:inherit;font-weight:700;border-radius:99px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><svg width="16" height="16" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5.04c1.62 0 3.06.56 4.2 1.64l3.12-3.12C17.46 1.8 14.96.75 12 .75 7.62.75 3.84 3.27 1.98 6.93l3.66 2.84C6.54 7.05 9.03 5.04 12 5.04z"/><path fill="#4285F4" d="M23.49 12.27c0-.93-.08-1.61-.26-2.32H12v4.21h6.47c-.13 1.08-.84 2.71-2.4 3.8l3.57 2.77c2.14-1.97 3.85-4.87 3.85-8.46z"/><path fill="#FBBC05" d="M5.64 14.1a7.2 7.2 0 0 1 0-4.33L1.98 6.93a11.27 11.27 0 0 0 0 10.14l3.66-2.97z"/><path fill="#34A853" d="M12 23.25c3.24 0 5.96-1.07 7.94-2.91l-3.57-2.77c-.97.66-2.27 1.12-4.37 1.12-2.97 0-5.46-2.01-6.36-4.72l-3.66 2.97c1.86 3.69 5.64 6.31 10.02 6.31z"/></svg> Continue with Google</button>
      <button id="aMagic" style="width:100%;margin-top:8px;padding:.7em;background:none;border:1px solid #2a1d22;color:#b69089;font-family:inherit;font-weight:700;border-radius:99px;cursor:pointer">✨ Email me a login link instead</button>
      <button id="aCancel" style="width:100%;margin-top:8px;padding:.6em;background:none;border:0;color:#b69089;font-family:inherit;font-weight:700;cursor:pointer">Cancel</button>
    </div>`;
    d.addEventListener('click',e=>{ if(e.target===d) d.remove(); });
    document.body.appendChild(d);
    const msg=(t,bad)=>{ const m=document.getElementById('aMsg'); m.textContent=t; m.style.color=bad?'#ff9aa8':'#ffab40'; };
    document.getElementById('aCancel').onclick=()=>d.remove();
    document.getElementById('aPass').addEventListener('keydown',e=>{ if(e.key==='Enter') document.getElementById('aGo').click(); });
    document.getElementById('aGo').onclick = async ()=>{
      const email=document.getElementById('aEmail').value.trim();
      const pass=document.getElementById('aPass').value;
      if(!email||pass.length<6){ msg("Enter your email and a 6+ character password",1); return; }
      msg("One sec…");
      let {error}=await SH.sb.auth.signInWithPassword({email,password:pass});
      if(!error){ d.remove(); return; }
      if(/invalid login credentials/i.test(error.message)){
        const su=await SH.sb.auth.signUp({email,password:pass,options:{emailRedirectTo:location.href}});
        if(su.error){ msg(su.error.message,1); return; }
        if(su.data.session){ d.remove(); }
        else msg("Account created! Check your email once to confirm, then log in here. 💌");
        return;
      }
      msg(error.message,1);
    };
    document.getElementById('aGoogle').onclick = async ()=>{
      const {error}=await SH.sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.href}});
      if(error) msg(error.message,1);
    };
    document.getElementById('aMagic').onclick = async ()=>{
      const email=document.getElementById('aEmail').value.trim();
      if(!email){ msg("Enter your email first",1); return; }
      const {error}=await SH.sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.href}});
      msg(error?error.message:"Link sent — check your email 💌",!!error);
    };
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
      .sh-totop{position:fixed;right:16px;bottom:16px;z-index:60;width:46px;height:46px;border-radius:50%;
        background:var(--grad,linear-gradient(100deg,#ff3d76,#ff7a4d 55%,#ffab40));color:#1a0c10;border:0;cursor:pointer;
        font-size:1.25rem;font-weight:800;line-height:1;font-family:inherit;
        opacity:0;transform:translateY(10px);transition:opacity .18s,transform .18s;pointer-events:none;
        box-shadow:0 10px 24px rgba(0,0,0,.45)}
      .sh-totop.show{opacity:1;transform:none;pointer-events:auto}
      .sh-avatar{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;
        background:var(--grad,linear-gradient(100deg,#ff3d76,#ff7a4d 55%,#ffab40));color:#1a0c10;font-weight:800;font-size:1rem;
        border:0;cursor:pointer;font-family:inherit;flex:0 0 auto}
      .sh-hamburger{display:none;align-items:center;justify-content:center;width:42px;height:42px;border-radius:12px;
        background:none;border:1px solid var(--line,#2a1d22);color:var(--cream,#f4e8e3);font-size:1.3rem;line-height:1;cursor:pointer;flex:0 0 auto}
      @media(max-width:680px){
        header .nav{flex-wrap:nowrap;height:auto;min-height:60px;gap:10px;
          padding-top:calc(12px + env(safe-area-inset-top,0px));padding-bottom:10px}
        header .logo{font-size:1.85rem;margin-right:auto}
        header .sh-hamburger{display:inline-flex}
        header #authbox button:not(.sh-avatar){font-size:.8rem;padding:.5em .9em}
        header .navlinks{position:absolute;top:calc(100% - 1px);right:10px;left:10px;flex-direction:column;gap:2px;
          background:#150e10;border:1px solid var(--line,#2a1d22);border-radius:16px;padding:8px;
          display:none;box-shadow:0 22px 50px rgba(0,0,0,.55)}
        header .navlinks.sh-open{display:flex}
        header .navlinks a{padding:.85em 1em;border-radius:10px;font-size:1.05rem}
        header .navlinks a.on,header .navlinks a:hover{background:rgba(255,171,64,.12);color:var(--cream,#f4e8e3)}
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
    const setOpen=(open)=>{ links.classList.toggle('sh-open',open); burger.textContent=open?'✕':'☰'; burger.setAttribute('aria-expanded',open?'true':'false'); };
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
    nav.appendChild(burger);   // far right
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
  function initShUI(){ injectHeaderCSS(); enhanceHeader(); mountUmami(); mountBackToTop(); /* mountFeedbackButton(); ← disabled */ }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', initShUI);
  else initShUI();
})();
