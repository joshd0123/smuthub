/* smutHub Companion beta — shared launcher, drawer, access gate, and chat. */
(function(){
  'use strict';
  if(window.SHCompanion) return;

  const C = window.SHCompanion = {
    allowed:false, user:null, profile:null, drawer:null, busy:false,
    pageContext(){
      const path=location.pathname;
      if(path.includes('bookcase')) return 'bookshelf';
      if(path.includes('smuthub-app')) return 'search';
      if(path.includes('dashboard')) return 'dashboard';
      if(path.includes('/book/')) return 'book:'+path.split('/book/')[1].replace(/\/$/,'');
      if(path.includes('companion')) return 'companion-room';
      return path || 'home';
    },
    async hasAccess(){
      if(!window.SH||!SH.sb||!SH.user) return false;
      const {data,error}=await SH.sb.from('companion_beta_access').select('user_id').eq('user_id',SH.user.id).maybeSingle();
      return !error && !!data;
    },
    async loadProfile(){
      if(!this.allowed) return null;
      const {data}=await SH.sb.from('companion_profiles').select('*').eq('user_id',SH.user.id).maybeSingle();
      this.profile=data||{user_id:SH.user.id,companion_name:'Aren',archetype:'guardian',voice_style:'velvet',initiative:'contextual',flirt_level:1,spoiler_mode:'strict'};
      return this.profile;
    },
    async boot(user){
      this.user=user||null; this.allowed=false;
      document.querySelectorAll('.shc-launcher,.shc-drawer').forEach(el=>el.remove());
      const room=document.getElementById('companionRoom'); if(room) room.hidden=true;
      if(!user) { window.dispatchEvent(new CustomEvent('sh-companion-ready',{detail:{allowed:false,user:null}})); return; }
      this.allowed=await this.hasAccess();
      if(this.allowed){ await this.loadProfile(); this.mount(); if(room) room.hidden=false; }
      window.dispatchEvent(new CustomEvent('sh-companion-ready',{detail:{allowed:this.allowed,user,profile:this.profile}}));
    },
    mount(){
      if(location.pathname.includes('companion.html')) return;
      const name=this.profile?.companion_name||'Aren';
      const launcher=document.createElement('button'); launcher.className='shc-launcher'; launcher.type='button'; launcher.setAttribute('aria-label','Open '+name); launcher.innerHTML='<img src="/companion-aren.png" alt="">';
      const drawer=document.createElement('section'); drawer.className='shc-drawer'; drawer.setAttribute('aria-label',name+' companion drawer');
      drawer.innerHTML=`<header class="shc-head"><img src="/companion-aren.png" alt=""><div class="shc-head-copy"><b>${this.esc(name)}</b><small>Present · spoiler shield on</small></div><div class="shc-head-actions"><button data-act="room" title="Open full room">↗</button><button data-act="close" title="Close">×</button></div></header><div class="shc-messages" aria-live="polite"></div><div><div class="shc-suggestions"><button>Pick from my TBR</button><button>What fits my mood?</button><button>Tell me about my shelf</button></div><form class="shc-form"><textarea rows="1" maxlength="1000" placeholder="Ask ${this.esc(name)} anything…" aria-label="Message ${this.esc(name)}"></textarea><button aria-label="Send">↑</button></form><div class="shc-beta">Private beta · uses your SmutHub shelf</div></div>`;
      document.body.append(launcher,drawer); this.drawer=drawer;
      launcher.onclick=()=>this.toggle(); drawer.querySelector('[data-act="close"]').onclick=()=>this.close(); drawer.querySelector('[data-act="room"]').onclick=()=>location.href='/companion.html';
      drawer.querySelectorAll('.shc-suggestions button').forEach(btn=>btn.onclick=()=>this.ask(btn.textContent));
      const form=drawer.querySelector('form'), input=drawer.querySelector('textarea');
      form.onsubmit=e=>{e.preventDefault();this.ask(input.value);input.value='';};
      input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit();}};
      this.addMessage(`I’m here. I can see your shelf, not your secrets—and I won’t wander past your spoiler boundary.`, 'assistant', drawer.querySelector('.shc-messages'));
    },
    toggle(){ if(!this.drawer)return; this.drawer.classList.toggle('shc-open'); if(this.drawer.classList.contains('shc-open')) this.drawer.querySelector('textarea').focus(); },
    close(){this.drawer&&this.drawer.classList.remove('shc-open');},
    esc(value){return String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
    addMessage(text,role,container){
      if(!container)return null; const el=document.createElement('div'); el.className='shc-bubble '+role; el.textContent=text; container.appendChild(el); container.scrollTop=container.scrollHeight; return el;
    },
    setTyping(container,on){
      const old=container&&container.querySelector('.shc-typing'); if(old)old.remove();
      if(on&&container){const el=document.createElement('div');el.className='shc-bubble assistant shc-typing';el.innerHTML='<i></i><i></i><i></i>';container.appendChild(el);container.scrollTop=container.scrollHeight;}
    },
    async ask(raw, container){
      const message=String(raw||'').trim(); if(!message||this.busy||!this.allowed)return;
      container=container||this.drawer?.querySelector('.shc-messages'); this.addMessage(message,'user',container); this.busy=true; this.setTyping(container,true);
      try{
        const {data:{session}}=await SH.sb.auth.getSession(); if(!session)throw new Error('Please sign in again.');
        const endpoint=(window.SMUTHUB_CONFIG?.SUPABASE_URL||'').replace(/\/$/,'')+'/functions/v1/companion-chat';
        const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':window.SMUTHUB_CONFIG?.SUPABASE_KEY||''},body:JSON.stringify({message,page_context:this.pageContext()})});
        const data=await res.json().catch(()=>({})); if(!res.ok)throw new Error(data.error||'The connection slipped.');
        this.setTyping(container,false); this.addMessage(data.reply||'I lost that thought. Try me again.','assistant',container);
      }catch(err){this.setTyping(container,false);this.addMessage(err.message||'The connection slipped. Try again.','assistant',container);}
      finally{this.busy=false;}
    },
    async saveProfile(values){
      if(!this.allowed)return false; const row={...values,user_id:SH.user.id,updated_at:new Date().toISOString()};
      const {data,error}=await SH.sb.from('companion_profiles').upsert(row,{onConflict:'user_id'}).select().single();
      if(error)throw error; this.profile=data; return true;
    },
    open(){ if(!this.allowed)return; if(location.pathname.includes('companion.html'))return; this.drawer?.classList.add('shc-open'); }
  };

  window.addEventListener('sh-auth',e=>C.boot(e.detail&&e.detail.user));
})();
