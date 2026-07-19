/* smutHub Companion beta — access gate, profile, contextual surfaces, and abilities. */
(function(){
  'use strict';
  if(window.SHCompanion) return;

  const localPreview=['localhost','127.0.0.1','[::1]'].includes(location.hostname)
    && new URLSearchParams(location.search).has('companion-preview');

  const C=window.SHCompanion={
    allowed:false,user:null,profile:null,busy:false,
    pageContext(){
      const path=location.pathname;
      if(path.includes('bookcase')) return 'bookshelf';
      if(path.includes('smuthub-app')) return 'search';
      if(path.includes('dashboard')) return 'dashboard';
      if(path.includes('/book/')) return 'book:'+path.split('/book/')[1].replace(/\/$/,'');
      if(path.includes('companion')) return 'companion-room';
      return path||'home';
    },
    async hasAccess(){
      if(localPreview) return true;
      if(!window.SH||!SH.sb||!SH.user) return false;
      const {data,error}=await SH.sb.from('companion_beta_access').select('user_id').eq('user_id',SH.user.id).maybeSingle();
      return !error&&!!data;
    },
    async loadProfile(){
      if(!this.allowed) return null;
      if(localPreview&&!window.SH?.user){
        this.profile={persona_key:'aren',companion_name:'Aren',archetype:'guardian',voice_style:'velvet',initiative:'contextual',flirt_level:1,spoiler_mode:'strict'};
        return this.profile;
      }
      const {data}=await SH.sb.from('companion_profiles').select('*').eq('user_id',SH.user.id).maybeSingle();
      this.profile=data||{user_id:SH.user.id,persona_key:'aren',companion_name:'Aren',archetype:'guardian',voice_style:'velvet',initiative:'contextual',flirt_level:1,spoiler_mode:'strict'};
      return this.profile;
    },
    revealSurfaces(){
      document.querySelectorAll('[data-companion-beta]').forEach(el=>el.hidden=false);
      document.querySelectorAll('[data-companion-name]').forEach(el=>el.textContent=this.profile?.companion_name||'Aren');
    },
    async boot(user){
      this.user=user||null;this.allowed=false;this.profile=null;
      document.querySelectorAll('[data-companion-beta]').forEach(el=>el.hidden=true);
      if(!user&&!localPreview){
        window.dispatchEvent(new CustomEvent('sh-companion-ready',{detail:{allowed:false,user:null}}));
        return;
      }
      this.allowed=await this.hasAccess();
      if(this.allowed){await this.loadProfile();this.revealSurfaces();}
      window.dispatchEvent(new CustomEvent('sh-companion-ready',{detail:{allowed:this.allowed,user:user||null,profile:this.profile,preview:localPreview}}));
    },
    openAbility(ability,params={}){
      const query=new URLSearchParams({tool:ability,...params});
      location.href='/companion.html?'+query.toString();
    },
    async runAbility({ability,message,parameters={}}){
      if(!this.allowed) throw new Error('Companion beta access is required.');
      if(this.busy) throw new Error('Your companion is already working on something.');
      if(localPreview&&!window.SH?.user){
        return {reply:this.previewResult(ability,message),mode:'local-preview',companion_name:this.profile?.companion_name||'Aren'};
      }
      this.busy=true;
      try{
        const {data:{session}}=await SH.sb.auth.getSession();
        if(!session) throw new Error('Please sign in again.');
        const endpoint=(window.SMUTHUB_CONFIG?.SUPABASE_URL||'').replace(/\/$/,'')+'/functions/v1/companion-chat';
        const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':window.SMUTHUB_CONFIG?.SUPABASE_KEY||''},body:JSON.stringify({ability,message,page_context:this.pageContext(),parameters})});
        const data=await res.json().catch(()=>({}));
        if(!res.ok) throw new Error(data.error||'The connection slipped.');
        return data;
      }finally{this.busy=false;}
    },
    previewResult(ability){
      const results={
        'next-read':'Tonight, I’m pulling Fourth Wing from your TBR. You asked for danger and momentum, and it is the strongest match among the books you have already saved. No plot details required—just clear the evening.',
        'book-match':'Your best shelf match is Divine Rivals: romantic tension, yearning energy, and enough momentum for a weeknight read. I kept the match strictly to mood and your own shelf data.',
        'mood-rescue':'Prescription: one emotionally intense book, a warm drink, and absolutely no productive plans after chapter three. Start with Divine Rivals from your Want to Read shelf.',
        'safe-catchup':'Spoiler shield active. I can safely orient you using only the progress you record and verified details available before that point. Add your chapter or percentage to begin.',
        'shelf-reading':'Your shelf leans toward high-stakes romance, dangerous competence, and yearning with consequences. You save broadly, but your current reads suggest pace matters more than world-building tonight.',
        'ritual':'Tonight’s ritual: dim lights, phone on Do Not Disturb, something warm to drink, and a 45-minute reading window. Your companion recommends stopping only at a natural chapter break.',
        'decider':'Decision made: read. Twenty pages, no negotiation. If the book has not caught you by then, switch without guilt.',
        'daily-brief':'Your shelf is ready for a low-friction reading night: continue your current book for 30 minutes, then decide whether it has earned another chapter.',
        'ask':'My short answer: protect the reading time first. The rest of the evening can organize itself around that.'
      };
      return results[ability]||results['next-read'];
    },
    async saveProfile(values){
      if(!this.allowed) return false;
      if(localPreview&&!SH?.user){this.profile={...this.profile,...values};return true;}
      const row={...values,user_id:SH.user.id,updated_at:new Date().toISOString()};
      const {data,error}=await SH.sb.from('companion_profiles').upsert(row,{onConflict:'user_id'}).select().single();
      if(error) throw error;this.profile=data;return true;
    }
  };

  window.addEventListener('sh-auth',e=>C.boot(e.detail&&e.detail.user));
})();
