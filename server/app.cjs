const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {createData}=require('./data.cjs');
const {createWeather,zurichDay}=require('./weather.cjs');
const {createAccounts,fail}=require('./accounts.cjs');
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.md':'text/plain; charset=utf-8'};
async function createApp({root=path.resolve(__dirname,'..'),staticDir=path.join(root,'_site'),storageDir=path.join(root,'.storage'),publicOrigin='',secureCookies=false,scheduler=true,fetchImpl,logger=console,now=()=>new Date(),weatherApiKey='',trustProxy=false,legacyAccounts=false}={}){
 const data=createData(root),accounts=createAccounts(storageDir);
 const points=[...data.catalog.weatherPoints];
 for(const point of data.index.weatherPoints)if(!points.some(p=>p.id===point.id))points.push(point);
 const weatherData={...data,index:{weatherPoints:points}};
 const weather=createWeather({data:weatherData,storageDir,fetchImpl,now,logger,apiKey:weatherApiKey});
 function regionalWeather(regionId){
  const regional=data.region(regionId);if(!regional)throw fail(404,'Unknown region.');
  const current=weather.getSnapshot(),keys=current.grid.split('|'),byKey=new Map(current.entries.map(([i,w])=>[keys[i],w]));
  return {...current,grid:regional.weatherPoints.map(p=>p.id).join('|'),entries:regional.weatherPoints.map((p,i)=>[i,byKey.get(p.id)||{}])};
 }
 await weather.init();if(scheduler)weather.start();
 const limits=new Map();
 function rate(req,bucket,max){
  const address=trustProxy?(req.headers['x-forwarded-for']?.split(',').at(-1).trim()||req.socket.remoteAddress):req.socket.remoteAddress;
  const key=`${address}:${bucket}`,time=now().getTime();
  if(limits.size>10000)for(const [k,v] of limits){if(v.until<time)limits.delete(k);}
  if(limits.size>10000)throw fail(429,'Server is busy. Try again shortly.');
  let value=limits.get(key);if(!value||value.until<time){value={count:0,until:time+60000};limits.set(key,value);}
  if(++value.count>max)throw fail(429,'Too many requests. Try again in a minute.');
 }
 const cookie=value=>`shrooms_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${value?2592000:0}${secureCookies?'; Secure':''}`;
 function auth(req){const raw=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('shrooms_session='))?.slice(16);return {raw,user:accounts.current(raw)};}
 function json(res,status,value,headers={}){const body=JSON.stringify(value);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(body);}
 async function body(req){
  if(req.headers['content-type']?.split(';')[0]!=='application/json')throw fail(415,'Send JSON.');
  let size=0,text='';for await(const chunk of req){size+=chunk.length;if(size>16384)throw fail(413,'Request is too large.');text+=chunk;}
  try{const value=JSON.parse(text||'{}');if(!value||Array.isArray(value)||typeof value!=='object')throw Error();return value;}catch{throw fail(400,'Invalid JSON.');}
 }
 function mutation(req,user){
  const expected=publicOrigin||`http://${req.headers.host}`;
  if(req.headers.origin!==expected)throw fail(403,'Request origin is not allowed.');
  if(user&&req.headers['x-csrf-token']!==user.csrf)throw fail(403,'Your session changed. Reload and try again.');
 }
 function score(c,species,regional,regionId){
  const snapshot=regionalWeather(regionId);
  const inputs=data.model.SHROOMS_WEATHER.usable(snapshot,regional.weatherPoints,now())?data.model.SHROOMS_WEATHER.interpolate(c,regional.weatherPoints,new Map(snapshot.entries)):undefined;
  return {...data.model.SHROOMS_SCORE.score(c,data.model.SHROOMS_SPECIES[species],inputs,now()),weather:inputs||null};
 }
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  let pathname;
  try{
   const url=new URL(req.url,'http://localhost');pathname=decodeURIComponent(url.pathname);
   const method=req.method;
   if(pathname==='/api/health'&&method==='GET')return json(res,200,{status:'ok',version:1,weather:weather.status()});
   if(pathname.startsWith('/api/')){
    rate(req,'api',240);
    if(pathname==='/api/config'&&method==='GET')return json(res,200,{apiVersion:1,accounts:legacyAccounts,region:'ch',regions:data.catalog.regions,weather:'server',cellSizeMeters:data.index.metadata.cellSizeMeters});
    if(pathname==='/api/weather'&&method==='GET')return json(res,200,{snapshot:regionalWeather(url.searchParams.get('region')||'ch'),status:weather.status()});
    if(pathname==='/api/species'&&method==='GET')return json(res,200,data.model.SHROOMS_SPECIES,{'Cache-Control':'public, max-age=3600'});
    if(pathname.startsWith('/api/data/')&&(method==='GET'||method==='HEAD')){
     const item=data.get(pathname.slice('/api/data/'.length));if(!item)throw fail(404,'Dataset not found.');
     const headers={'Cache-Control':'public, max-age=3600','ETag':item.etag,'Vary':'Accept-Encoding','Content-Type':'application/json; charset=utf-8'};
     if(req.headers['if-none-match']===item.etag){res.writeHead(304,headers);return res.end();}
     const gzip=/\bgzip\b/.test(req.headers['accept-encoding']||''),bytes=gzip?item.gzip:item.body;
     res.writeHead(200,{...headers,'Content-Length':bytes.length,...(gzip?{'Content-Encoding':'gzip'}:{})});return res.end(method==='HEAD'?undefined:bytes);
    }
    if(pathname==='/api/habitat'&&method==='GET'){
     const regionId=url.searchParams.get('region')||'ch',regional=data.region(regionId);if(!regional)throw fail(404,'Unknown region.');
     const species=url.searchParams.get('species')||'porcini';if(!Object.hasOwn(data.model.SHROOMS_SPECIES,species))throw fail(400,'Unknown species.');
     const bbox=(url.searchParams.get('bbox')||'').split(',').map(Number);
     if(bbox.length!==4||!bbox.every(Number.isFinite)||bbox[0]>=bbox[2]||bbox[1]>=bbox[3]||bbox[2]-bbox[0]>1||bbox[3]-bbox[1]>1)throw fail(400,'Provide bbox=west,south,east,north, at most one degree across.');
     const limit=Number(url.searchParams.get('limit')||100),offset=Number(url.searchParams.get('offset')||0);
     if(!Number.isInteger(limit)||limit<1||limit>200||!Number.isInteger(offset)||offset<0||offset>1000000)throw fail(400,'Invalid pagination.');
     const matches=regional.cells.filter(c=>c.lon>=bbox[0]&&c.lat>=bbox[1]&&c.lon<=bbox[2]&&c.lat<=bbox[3]);
     return json(res,200,{species,date:zurichDay(now()),total:matches.length,offset,limit,cells:matches.slice(offset,offset+limit).map(c=>({...c,score:score(c,species,regional,regionId)}))});
    }
    if(!legacyAccounts&&(pathname.startsWith('/api/auth/')||pathname.startsWith('/api/spots')||pathname==='/api/account'))return json(res,410,{error:'Accounts are retired. Saved spots now stay in your browser.'});
    const {raw,user}=auth(req);
    if(pathname==='/api/auth/me'&&method==='GET')return json(res,200,{user:user?{id:user.id,username:user.username}:null,csrf:user?.csrf||null});
    if(['/api/auth/register','/api/auth/login','/api/auth/recover'].includes(pathname)&&method==='POST'){
     rate(req,'auth',10);mutation(req,null);const input=await body(req);
     const action=pathname.split('/').pop(),result=await accounts[action](input);res.setHeader('Set-Cookie',cookie(result.token));delete result.token;
     return json(res,action==='register'?201:200,result);
    }
    if(pathname.startsWith('/api/spots')||pathname==='/api/auth/logout'||pathname==='/api/account'){
     if(!user)throw fail(401,'Sign in to continue.');
     if(!['GET','HEAD'].includes(method)){mutation(req,user);rate(req,'writes',30);}
     if(pathname==='/api/auth/logout'&&method==='POST'){accounts.logout(raw);res.setHeader('Set-Cookie',cookie(''));return json(res,200,{ok:true});}
     if(pathname==='/api/account'&&method==='DELETE'){rate(req,'auth',10);await accounts.removeUser(user.id,(await body(req)).password);res.setHeader('Set-Cookie',cookie(''));return json(res,200,{ok:true});}
     if(pathname==='/api/spots'&&method==='GET')return json(res,200,{spots:accounts.listSpots(user.id)});
     if(pathname==='/api/spots'&&method==='POST'){const input=await body(req);if(!Object.hasOwn(data.model.SHROOMS_SPECIES,input.species))throw fail(400,'Unknown species.');return json(res,201,{spot:accounts.saveSpot(user.id,input)});}
     const match=pathname.match(/^\/api\/spots\/([a-f0-9-]{36})$/);
     if(match&&method==='PUT'){const input=await body(req);if(!Object.hasOwn(data.model.SHROOMS_SPECIES,input.species))throw fail(400,'Unknown species.');return json(res,200,{spot:accounts.saveSpot(user.id,input,match[1])});}
     if(match&&method==='DELETE'){accounts.deleteSpot(user.id,match[1]);return json(res,200,{ok:true});}
    }
    throw fail(404,'API route not found.');
   }
   if(!['GET','HEAD'].includes(method))throw fail(405,'Method not allowed.');
   const relative=pathname==='/'?'index.html':pathname.slice(1);
   if(relative.split('/').some(part=>!part||part.startsWith('.')||part.includes('\\')))throw fail(404,'Not found.');
   const target=path.resolve(staticDir,relative),base=await fs.realpath(staticDir);
   let real;try{real=await fs.realpath(target);}catch{throw fail(404,'Not found.');}
   if(!real.startsWith(base+path.sep))throw fail(404,'Not found.');
   const stat=await fs.stat(real);if(!stat.isFile())throw fail(404,'Not found.');
   const etag=`"${stat.size}-${Math.floor(stat.mtimeMs)}"`,headers={'Content-Type':MIME[path.extname(real)]||'application/octet-stream','Cache-Control':relative==='index.html'?'no-cache':'public, max-age=3600','ETag':etag};
   if(req.headers['if-none-match']===etag){res.writeHead(304,headers);return res.end();}
   res.writeHead(200,{...headers,'Content-Length':stat.size});res.end(method==='HEAD'?undefined:await fs.readFile(real));
  }catch(error){
   if(res.headersSent){res.destroy();return;}
   const status=error.status||500;if(status===500)logger.error(`Request failed: ${pathname||'invalid URL'}`);
   if(status===429)res.setHeader('Retry-After','60');
   json(res,status,{error:status===500?'Something went wrong. Please try again.':error.message});
  }
 });
 server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.maxHeadersCount=50;
 const close=async()=>{weather.stop();await new Promise(resolve=>server.listening?server.close(resolve):resolve());accounts.close();};
 return {server,close,data,weather,accounts};
}
module.exports={createApp};
