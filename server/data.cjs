const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const zlib=require('node:zlib');
const crypto=require('node:crypto');

function unpack(root,key){
 const file=fs.readFileSync(path.join(root,'data',`${key}.js`),'utf8');
 // Parse only the generated envelope; data files never execute on the server.
 const prefix=`window.SHROOMS_PACKED[${JSON.stringify(key)}]=`;
 if(!file.startsWith(prefix))throw new Error(`Invalid packed data: ${key}`);
 return JSON.parse(zlib.gunzipSync(Buffer.from(JSON.parse(file.slice(prefix.length).trim().replace(/;$/,'')),'base64')));
}
function createData(root){
 const index=unpack(root,'index');
 const catalog=unpack(root,'regions');
 const regionCache=new Map([['zh',index]]);
 function region(id='ch'){
  const info=catalog.regions.find(r=>r.id===id);if(!info)return null;
  if(regionCache.has(id))return regionCache.get(id);
  const value=unpack(root,info.index);
  if(regionCache.size>=3)for(const key of regionCache.keys())if(key!=='zh'){regionCache.delete(key);break;}
  regionCache.set(id,value);return value;
 }
 const context={window:{},Intl,Date,Math,Number};vm.createContext(context);
 for(const file of ['data.js','weather.js','scoring.js'])vm.runInContext(fs.readFileSync(path.join(root,'src',file),'utf8'),context,{filename:file});
 const model=context.window;
 const tileKeys=new Set(index.tiles.map(t=>t.key));
 const cells=new Map(index.cells.map(c=>[c.id,c]));
 const cache=new Map();let cacheBytes=0;
 function get(key){
  if(!['index','protected','national-protected','regions','switzerland-map'].includes(key)&&!tileKeys.has(key)){
   const match=key.match(/^regions\/([a-z]{2})\/(index|tiles\/\d+-\d+)$/);
   if(!match)return null;const regional=region(match[1]);if(!regional||(match[2]!=='index'&&!regional.tiles.some(t=>t.key===key)))return null;
  }
  if(cache.has(key))return cache.get(key);
  const value=key==='index'?index:unpack(root,key);
  const body=Buffer.from(JSON.stringify(value)),gzip=zlib.gzipSync(body);
  const item={body,gzip,etag:`"${crypto.createHash('sha256').update(body).digest('hex').slice(0,24)}"`};
  // Geometry cache is bounded; the complete property index stays in memory.
  const bytes=body.length+gzip.length;
  while(cache.size&&(cache.size>=40||cacheBytes+bytes>64*1024*1024)){
   const oldest=cache.keys().next().value,entry=cache.get(oldest);
   cacheBytes-=entry.body.length+entry.gzip.length;cache.delete(oldest);
  }
  if(bytes<=64*1024*1024){cache.set(key,item);cacheBytes+=bytes;}return item;
 }
 return {index,catalog,region,cells,get,model,bundledWeather:unpack(root,'weather')};
}
module.exports={createData,unpack};
