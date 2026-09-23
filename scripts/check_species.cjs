const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function validateSpecies(species,messages){
 const errors=[],fields=new Set(['name','local','latin','months','temp','host','requiredTree','canopy','note','unmapped','sources']);
 const translated=new Map(messages.map(row=>[row[0],row]));
 const text=v=>typeof v==='string'&&v.trim().length>0;
 const seen=new Set();
 for(const [id,s] of Object.entries(species)){
  const check=(valid,message)=>{if(!valid)errors.push(`${id}: ${message}`);};
  check(/^[a-z][a-z0-9_]*$/.test(id),'use a stable lowercase species ID');
  if(!s||typeof s!=='object'){check(false,'profile must be an object');continue;}
  for(const key of Object.keys(s))check(fields.has(key),`unsupported field ${key}; adding a field does not add an indicator to the model`);
  for(const key of ['name','local','latin','note'])check(text(s[key]),`${key} must be non-empty`);
  check(!seen.has(s.latin),'duplicate scientific name');seen.add(s.latin);
  check(Array.isArray(s.months)&&s.months.length>0&&new Set(s.months).size===s.months.length&&s.months.every(m=>Number.isInteger(m)&&m>=1&&m<=12),'months must be unique integers from 1 to 12');
  check(Array.isArray(s.temp)&&s.temp.length===2&&s.temp.every(t=>Number.isFinite(t)&&t>=-30&&t<=50)&&s.temp[0]<s.temp[1],'temp must be an increasing Celsius pair between -30 and 50');
  check(['open','closed'].includes(s.canopy),'canopy must be open or closed');
  if(s.host!==null){
   check(s.host&&typeof s.host==='object'&&!Array.isArray(s.host)&&Object.keys(s.host).sort().join(',')==='beech,conifer,oak,other','host needs exactly beech, oak, conifer and other');
   check(s.host&&Object.values(s.host).every(v=>Number.isFinite(v)&&v>=0&&v<=1)&&Object.values(s.host).some(v=>v>0),'host preferences must be 0–1, with at least one positive');
  }
  if(s.requiredTree!==undefined){check(['pine','spruce','beech','oak','fir'].includes(s.requiredTree),'requiredTree must have a measured dataset field');check(s.host!==null,'requiredTree requires a host profile');}
  check(Array.isArray(s.unmapped)&&s.unmapped.every(text),'unmapped must list missing indicators as strings');
  check(Array.isArray(s.sources)&&s.sources.length>0,'at least one ecological source is required');
  for(const source of Array.isArray(s.sources)?s.sources:[]){
   let safe=false;try{const url=new URL(source.url);safe=url.protocol==='https:'&&!url.username&&!url.password;}catch{}
   check(text(source.title)&&safe,'sources need a title and an HTTPS URL without credentials');
  }
  for(const key of [s.name,s.note,...(Array.isArray(s.unmapped)?s.unmapped:[])])check(translated.get(key)?.length===5&&translated.get(key).every(text),`missing five-language entry: ${key}`);
 }
 return errors;
}
function loadProfiles(){const context={window:{}};vm.createContext(context);for(const file of ['data.js','locales.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),context);return context.window;}
function checkProfiles(){const data=loadProfiles(),errors=validateSpecies(data.SHROOMS_SPECIES,data.SHROOMS_MESSAGES);if(errors.length)throw new Error(errors.join('\n'));return Object.keys(data.SHROOMS_SPECIES).length;}
if(require.main===module){try{console.log(`Species profiles valid: ${checkProfiles()}`);}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={validateSpecies,loadProfiles,checkProfiles};
