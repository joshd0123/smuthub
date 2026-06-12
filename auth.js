/* ════════════════════════════════════════════════════════
   smutHub shared auth — include AFTER the supabase CDN script
   and AFTER config.js. Pages just need: <div id="authbox"></div>
   Exposes: window.SH = { sb, user, profile, configured, openAuth, saveTheme }
   Fires:   window event 'sh-auth' whenever login state changes.
   ════════════════════════════════════════════════════════ */
(function(){
  const cfg = window.SMUTHUB_CONFIG || {};
  const configured = (cfg.SUPABASE_URL||"").startsWith("http") && (cfg.SUPABASE_KEY||"").length > 20;
  const SH = window.SH = { sb:null, user:null, profile:null, configured, openAuth, saveTheme, logout };

  if (configured && window.supabase) {
    SH.sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);
    let booted = false;
    SH.sb.auth.onAuthStateChange(async (event, session) => {
      console.log('[smuthub auth]', event, session?.user?.email || 'no session');
      if (['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT','TOKEN_REFRESHED','USER_UPDATED'].includes(event)) {
        booted = true;
        SH.user = session ? session.user : null;
        SH.profile = SH.user ? await loadProfile() : null;
        renderAuthbox();
        window.dispatchEvent(new CustomEvent('sh-auth', { detail: { user: SH.user, profile: SH.profile } }));
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
      box.innerHTML = `
        <div style="position:relative">
          <button id="shUserBtn" style="display:flex;align-items:center;gap:7px;background:none;border:1px solid var(--line,#2a1d22);color:var(--cream,#f4e8e3);font-family:inherit;font-weight:700;font-size:.85rem;padding:.5em 1em;border-radius:99px;cursor:pointer">
            <span style="color:var(--amber,#ffab40)">${esc(displayName())}</span> ▾
          </button>
          <div id="shMenu" style="display:none;position:absolute;right:0;top:110%;z-index:95;background:#150e10;border:1px solid var(--line,#2a1d22);border-radius:14px;min-width:190px;overflow:hidden;box-shadow:0 18px 40px rgba(0,0,0,.5)">
            <button class="shMenuItem" data-act="username">✏️ Set username</button>
            <button class="shMenuItem" data-act="logout">👋 Log out</button>
          </div>
        </div>`;
      const btn = document.getElementById('shUserBtn'), menu = document.getElementById('shMenu');
      btn.onclick = (e)=>{
        e.stopPropagation();
        const opening = menu.style.display==='none';
        menu.style.display = opening ? 'block' : 'none';
        if(opening) document.addEventListener('click', ()=>{ menu.style.display='none'; }, { once:true });
      };
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
})();
