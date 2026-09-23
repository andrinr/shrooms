// Refresh both static snapshots using the same complete-batch validation as the server.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib');
const {createData}=require('../server/data.cjs'),{createWeather}=require('../server/weather.cjs');
(async()=>{
 const data=createData(path.resolve(__dirname,'..')),points=[...data.catalog.weatherPoints];
 for(const p of data.index.weatherPoints)if(!points.some(other=>other.id===p.id))points.push(p);
 const storage=await fs.mkdtemp(path.join(os.tmpdir(),'shrooms-prefetch-'));
 const weather=createWeather({data:{...data,index:{weatherPoints:points}},storageDir:storage,apiKey:process.env.OPEN_METEO_API_KEY||''});
 try{
  const snapshot=await weather.refresh(),byId=new Map(snapshot.entries.map(([i,w])=>[points[i].id,w]));
  for(const [key,grid] of [['weather',data.index.weatherPoints],['national-weather',data.catalog.weatherPoints]]){
   const regional={...snapshot,grid:grid.map(p=>p.id).join('|'),entries:grid.map((p,i)=>[i,byId.get(p.id)])};
   const packed=zlib.gzipSync(JSON.stringify(regional)).toString('base64');
   await fs.writeFile(path.join('data',`${key}.js.tmp`),`window.SHROOMS_PACKED[${JSON.stringify(key)}]=${JSON.stringify(packed)};\n`);
  }
  for(const key of ['weather','national-weather'])await fs.rename(`data/${key}.js.tmp`,`data/${key}.js`);
  console.log(`Saved ${points.length} regional weather anchors for ${snapshot.day}`);
 }finally{weather.stop();await fs.rm(storage,{recursive:true,force:true});}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
