// Run with Node 18+: fetch once at preparation time, never from visitors by default.
const fs=require('node:fs'),vm=require('node:vm'),zlib=require('node:zlib');
const context={window:{SHROOMS_PACKED:{}}};vm.createContext(context);
for(const p of ['data/index.js','src/weather.js'])vm.runInContext(fs.readFileSync(p,'utf8'),context);
const data=JSON.parse(zlib.gunzipSync(Buffer.from(context.window.SHROOMS_PACKED.index,'base64')));
const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zurich',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
(async()=>{
 const entries=[];
 for(let start=0;start<data.weatherPoints.length;start+=16){
  const points=data.weatherPoints.slice(start,start+16);
  const params=new URLSearchParams({latitude:points.map(p=>p.lat).join(','),longitude:points.map(p=>p.lon).join(','),daily:'precipitation_sum,temperature_2m_mean,sunshine_duration,et0_fao_evapotranspiration',hourly:'soil_moisture_3_to_9cm,relative_humidity_2m',past_days:'14',forecast_days:'1',timezone:'Europe/Zurich'});
  const response=await fetch(`https://api.open-meteo.com/v1/forecast?${params}`,{signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error(`Open-Meteo ${response.status}`);
  const body=await response.json(),items=Array.isArray(body)?body:[body];
  if(items.length!==points.length)throw new Error('Location count mismatch');
  items.forEach((item,i)=>{
   const parsed=context.window.SHROOMS_WEATHER.parse(item,day);
   if(!parsed||Object.values(parsed).some(v=>v===null))throw new Error('Incomplete weather snapshot; previous file preserved');
   entries.push([start+i,parsed]);
  });
 }
 const snapshot={day,at:Date.now(),grid:data.weatherPoints.map(p=>p.id).join('|'),source:'https://open-meteo.com/en/docs',entries};
 const payload=zlib.gzipSync(JSON.stringify(snapshot)).toString('base64');
 fs.writeFileSync('data/weather.js',`window.SHROOMS_PACKED.weather=${JSON.stringify(payload)};\n`);
 console.log(`Saved ${entries.length} weather anchors for ${day}`);
})().catch(error=>{console.error(error);process.exitCode=1;});
