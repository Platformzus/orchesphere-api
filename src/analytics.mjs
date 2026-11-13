// Consented aggregate usage only. Callers supply a fixed origin and page allowlist.
export function analyticsController(config,{read=()=>null,save=()=>{},privacy=()=>false,send=()=>{},stop=()=>{},now=Date.now}={}){
 const origin=new URL(config.origin);
 if(origin.protocol!=='https:'||origin.href!==origin.origin+'/'||origin.username||origin.password||!/^G-[A-Z0-9]{6,20}$/.test(config.measurementId))throw Error('Invalid analytics destination.');
 const path=typeof config.path==='string'&&config.path.startsWith('/')&&!config.path.startsWith('//')?config.path.split(/[?#]/,1)[0]:null;
 const allowed=Array.isArray(config.allowedPaths)&&config.allowedPaths.includes(path)&&/^\/[A-Za-z0-9/_-]*$/.test(path||'');
 let choice=null,lastSent=false;
 function restore(){let v;try{v=read();if(typeof v==='string')v=JSON.parse(v);}catch{}choice=v?.version===1&&['accepted','declined'].includes(v.choice)&&Number.isFinite(v.expires)&&v.expires>now()&&(v.choice==='declined'||v.gaId===config.measurementId)?v.choice:null;}
 const state=()=>({choice,privacyDisabled:Boolean(privacy()),available:Boolean(allowed)});
 function refresh(){restore();const s=state();if(!s.available||s.privacyDisabled||choice!=='accepted'){stop();lastSent=false;return s;}if(!lastSent){send({page_location:origin.origin+path,page_title:path,page_referrer:''});lastSent=true;}return s;}
 function choose(value){if(!['accepted','declined'].includes(value))return state();choice=value;try{save({version:1,choice:value,gaId:config.measurementId,expires:now()+180*86400000});}catch{}const s=state();if(value==='accepted'&&!s.privacyDisabled&&s.available&&!lastSent){send({page_location:origin.origin+path,page_title:path,page_referrer:''});lastSent=true;}else if(value==='declined'||s.privacyDisabled){stop();lastSent=false;}return s;}
 refresh();return {state,refresh,choose};
}

const initialized=new Set();
export function mountConsentedAnalytics(config,{window:w=globalThis.window,document:d=globalThis.document,navigator:n=globalThis.navigator}={}){
 if(!w||!d||w.location.origin!==config.origin)return ()=>{};
 const id=config.measurementId,key=config.storageKey;
 const privacy=()=>n?.doNotTrack==='1'||w.doNotTrack==='1'||n?.globalPrivacyControl===true;
 const stop=()=>{w['ga-disable-'+id]=true;if(w.gtag)w.gtag('consent','update',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});};
 const send=fields=>{
  w['ga-disable-'+id]=false;w.dataLayer=w.dataLayer||[];w.gtag=w.gtag||function(){w.dataLayer.push(arguments);};
  w.gtag('set',{...fields,allow_google_signals:false,allow_ad_personalization_signals:false});
  if(!initialized.has(id)){
   w.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
   w.gtag('consent','update',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
   w.gtag('js',new Date());w.gtag('config',id,{send_page_view:false,...fields,allow_google_signals:false,allow_ad_personalization_signals:false});
   const script=d.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+id;script.referrerPolicy='no-referrer';script.dataset.platformzAnalytics=id;d.head.appendChild(script);initialized.add(id);
  }
  w.gtag('consent','update',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});w.gtag('event','page_view',{send_to:id,...fields});
 };
 const controller=analyticsController(config,{read:()=>w.localStorage.getItem(key),save:v=>w.localStorage.setItem(key,JSON.stringify(v)),privacy,send,stop});
 if(!controller.state().available)return stop;
 const root=d.createElement('div');root.className='usage-analytics';d.body.appendChild(root);let open=false;
 function element(tag,text){const e=d.createElement(tag);if(text)e.textContent=text;return e;}
 function button(text,action){const b=element('button',text);b.type='button';b.addEventListener('click',action);return b;}
 function render(){const s=controller.state();root.replaceChildren();if(!open&&(s.choice||s.privacyDisabled)){root.appendChild(button(s.privacyDisabled?'Analytics disabled':'Privacy choices',()=>{open=true;render();}));return;}
  const panel=element('section');panel.setAttribute('role','region');panel.setAttribute('aria-label','Analytics privacy choices');panel.appendChild(element('h2',s.privacyDisabled?'Your privacy signal is respected.':'May we measure visits?'));
  panel.appendChild(element('p',s.privacyDisabled?'Analytics stays off while Do Not Track or Global Privacy Control is enabled.':config.message||'With your permission, Google Analytics measures aggregate visits. Page queries, search terms and account details are not sent.'));
  const a=element('a','Privacy policy');a.href=config.privacyUrl;panel.appendChild(a);
  const actions=element('div');actions.className='usage-analytics-actions';if(!s.privacyDisabled){for(const [label,value] of [['Decline analytics','declined'],['Accept analytics','accepted']])actions.appendChild(button(label,()=>{controller.choose(value);open=false;render();}));}if(s.choice||s.privacyDisabled)actions.appendChild(button('Close',()=>{open=false;render();}));panel.appendChild(actions);root.appendChild(panel);
 }
 const refresh=()=>{controller.refresh();render();};w.addEventListener('focus',refresh);w.addEventListener('storage',refresh);render();
 return ()=>{stop();root.remove();w.removeEventListener('focus',refresh);w.removeEventListener('storage',refresh);};
}
