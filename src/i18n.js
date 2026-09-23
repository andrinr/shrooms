/* Local, deterministic UI translation. Never send text or private notes to a service. */
(function(){
 const languages={de:'Deutsch',fr:'Français',it:'Italiano',rm:'Rumantsch',en:'English'};
 let saved;try{saved=localStorage.getItem('shrooms-language');}catch{}
 const requested=new URLSearchParams(location.search).get('lang');
 const detected=(navigator.languages||[navigator.language]).map(l=>l?.split('-')[0]).find(l=>languages[l]);
 const lang=languages[requested]?requested:languages[saved]?saved:detected||'en';
 const locale={de:'de-CH',fr:'fr-CH',it:'it-CH',rm:'rm-CH',en:'en-GB'}[lang];
 const rows=window.SHROOMS_MESSAGES, column={de:1,fr:2,it:3,rm:4}[lang];
 const exact=new Map(rows.map(row=>[row[0],lang==='en'?row[0]:row[column]]));
 const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const patterns=rows.filter(row=>row[0].includes('{')).map(row=>{
  const names=[...row[0].matchAll(/\{(\w+)\}/g)].map(m=>m[1]);
  return {compound:row[0].includes(' · '),re:new RegExp('^'+row[0].split(/\{\w+\}/).map(escape).join('(.+?)')+'$'),names,value:lang==='en'?row[0]:row[column]};
 });
 function t(source){
  if(lang==='en'||!source)return source;
  const text=source.trim();let result=exact.get(text);
  if(!result){
   for(const p of patterns){if(text.includes(' · ')&&!p.compound)continue;const match=text.match(p.re);if(match){const args=Object.fromEntries(p.names.map((key,i)=>[key,t(match[i+1])]));result=p.value.replace(/\{(\w+)\}/g,(_,key)=>args[key]);break;}}
  }
  if(!result&&text.includes(' · '))result=text.split(' · ').map(part=>t(part)).join(' · ');
  if(!result)return source;
  return source.slice(0,source.indexOf(text))+result+source.slice(source.indexOf(text)+text.length);
 }
 function date(value,options){
  if(lang!=='rm')return new Intl.DateTimeFormat(locale,options).format(value);
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:options.timeZone||'Europe/Zurich',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(value).map(p=>[p.type,p.value]));
  const months=['schan.','favr.','mars','avr.','matg','zercl.','fan.','avust','sett.','oct.','nov.','dec.'];
  return [options.day?parts.day:null,options.month?months[Number(parts.month)-1]:null,options.year?parts.year:null].filter(Boolean).join(' ');
 }
 window.SHROOMS_I18N={lang,locale,t,languages,date};
 if(typeof document==='undefined')return;
 document.documentElement.lang=lang;
 document.title=t('shrooms — follow the fungi');
 const description=document.querySelector('meta[name=description]');if(description)description.content=t(description.content);
 document.addEventListener('invalid',event=>{const field=event.target;field.setCustomValidity('');const message=field.validity.valueMissing?'Please complete this field.':field.validity.tooShort?`Use at least ${field.minLength} characters.`:field.validity.patternMismatch&&field.name==='username'?'Use 3–32 letters, numbers or underscores for your username.':'Please check this field.';field.setCustomValidity(t(message));},true);
 document.addEventListener('input',event=>event.target.setCustomValidity?.(''));
 const ignore='script,style,textarea,code,[data-no-translate],.place-label,.detail-title h3,.site-name strong,.reserve-popup strong';
 function translate(root){
  if(root.nodeType===3){if(!root.parentElement?.closest(ignore)){const value=t(root.nodeValue);if(value!==root.nodeValue)root.nodeValue=value;}return;}
  if(root.nodeType!==1||root.closest(ignore))return;
  for(const name of ['aria-label','title','placeholder'])if(root.hasAttribute(name)){const value=t(root.getAttribute(name));if(value!==root.getAttribute(name))root.setAttribute(name,value);}
  for(const child of root.childNodes)translate(child);
 }
 const picker=document.createElement('select');picker.className='language-picker';picker.setAttribute('aria-label','Language');picker.setAttribute('data-no-translate','');
 for(const [id,name] of Object.entries(languages)){const option=document.createElement('option');option.value=id;option.textContent=name;option.lang=id;picker.append(option);}
 picker.value=lang;picker.setAttribute('aria-label',t('Language'));document.querySelector('header').append(picker);
 picker.addEventListener('change',()=>{try{localStorage.setItem('shrooms-language',picker.value);}catch{}const url=new URL(location.href);url.searchParams.set('lang',picker.value);location.href=url;});
 translate(document.body);
 // New map details, tooltips and account screens use the same catalog. Observe only UI text.
 const observer=new MutationObserver(records=>{observer.disconnect();for(const record of records){if(record.type==='childList')record.addedNodes.forEach(translate);else translate(record.target);}observe();});
 function observe(){observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','placeholder']});}
 observe();
})();
