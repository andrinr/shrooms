const fs=require('node:fs/promises');
const path=require('node:path');

function zurichDay(date=new Date()){
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zurich',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
function createWeather({data,storageDir,fetchImpl=fetch,now=()=>new Date(),refreshMs=6*3600000,retryMs=15*60000,apiKey='',logger=console}){
 const points=data.index.weatherPoints,model=data.model.SHROOMS_WEATHER;
 let snapshot=data.bundledWeather,inflight=null,timer=null,lastAttempt=null,lastError=null,nextAttempt=0,stopped=false;
 const file=path.join(storageDir,'weather.json');
 const complete=value=>value&&value.grid===points.map(p=>p.id).join('|')&&Number.isFinite(value.at)&&value.at<=now().getTime()&&/^\d{4}-\d{2}-\d{2}$/.test(value.day)&&Array.isArray(value.entries)&&value.entries.length===points.length&&value.entries.every(([id,w],i)=>id===i&&w&&['rain14','temp7','soil','humidity','sunHours7','et014'].every(k=>typeof w[k]==='number'&&Number.isFinite(w[k])));
 async function init(){
  try{const saved=JSON.parse(await fs.readFile(file,'utf8'));if(complete(saved)&&(!complete(snapshot)||saved.at>=snapshot.at))snapshot=saved;}
  catch(error){if(error.code!=='ENOENT')logger.warn('Weather cache could not be read; using bundled fallback.');}
 }
 function status(){return {available:!!snapshot,fresh:model.usable(snapshot,points,now()),day:snapshot?.day||null,updatedAt:snapshot?.at||null,refreshing:!!inflight,lastAttempt,lastError,nextAttempt:nextAttempt||null};}
 async function download(){
  const day=zurichDay(now()),entries=[];
  for(let start=0;start<points.length;start+=16){
   const batch=points.slice(start,start+16);
   const query=new URLSearchParams({latitude:batch.map(p=>p.lat).join(','),longitude:batch.map(p=>p.lon).join(','),daily:'precipitation_sum,temperature_2m_mean,sunshine_duration,et0_fao_evapotranspiration',hourly:'soil_moisture_3_to_9cm,relative_humidity_2m',past_days:'14',forecast_days:'1',timezone:'Europe/Zurich'});
   if(apiKey)query.set('apikey',apiKey);
   const host=apiKey?'customer-api.open-meteo.com':'api.open-meteo.com';
   const response=await fetchImpl(`https://${host}/v1/forecast?${query}`,{signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw new Error(`Weather provider returned HTTP ${response.status}`);
   const raw=await response.json(),items=Array.isArray(raw)?raw:[raw];
   if(items.length!==batch.length)throw new Error('Weather provider returned incomplete locations');
   items.forEach((item,i)=>entries.push([start+i,model.parse(item,day)]));
  }
  const candidate={day,at:now().getTime(),grid:points.map(p=>p.id).join('|'),source:'https://open-meteo.com/en/docs',entries};
  if(!complete(candidate))throw new Error('Weather provider returned incomplete observations');
  await fs.mkdir(storageDir,{recursive:true});
  const temporary=`${file}.${process.pid}.tmp`;
  try{await fs.writeFile(temporary,JSON.stringify(candidate)+'\n',{mode:0o600});await fs.rename(temporary,file);}
  finally{await fs.rm(temporary,{force:true}).catch(()=>{});}
  snapshot=candidate;lastError=null;
  nextAttempt=now().getTime()+refreshMs;
  logger.info('Weather snapshot refreshed.');
  return snapshot;
 }
 function refresh({force=false}={}){
  if(inflight)return inflight;
  if(!force&&now().getTime()<nextAttempt)return Promise.resolve(snapshot);
  lastAttempt=now().getTime();
  inflight=download().catch(error=>{
   // Provider error text can contain credentials; publish only our bounded messages.
   lastError=/^Weather provider returned /.test(error.message)?error.message:'Weather update failed; previous snapshot retained';
   nextAttempt=now().getTime()+retryMs;logger.warn(lastError);throw new Error(lastError);
  }).finally(()=>{inflight=null;});
  return inflight;
 }
 function tick(){
  if(stopped)return;
  if(now().getTime()>=nextAttempt&&(!model.usable(snapshot,points,now())||now().getTime()-snapshot.at>=refreshMs))refresh().catch(()=>{});
 }
 function start(){stopped=false;tick();timer=setInterval(tick,60000);timer.unref();}
 function stop(){stopped=true;if(timer)clearInterval(timer);}
 return {init,start,stop,refresh,status,getSnapshot:()=>snapshot};
}
module.exports={createWeather,zurichDay};
