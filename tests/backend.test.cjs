const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../server/app.cjs');
const {createWeather}=require('../server/weather.cjs');
const {createData}=require('../server/data.cjs');

test('accounts, private spots, CSRF, recovery, persistence and public API work end to end',async()=>{
 const storage=await fs.mkdtemp(path.join(os.tmpdir(),'shrooms-server-'));
 let app=await createApp({legacyAccounts:true,storageDir:storage,scheduler:false,logger:{info(){},warn(){},error(){}}});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 let base=`http://127.0.0.1:${app.server.address().port}`;
 async function call(route,{method='GET',body,cookie,csrf,origin=base,headers={}}={}){
  const response=await fetch(base+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{}),Origin:origin,...headers},body:body?JSON.stringify(body):undefined});
  const value=response.status===304?null:await response.json();return {status:response.status,value,cookie:response.headers.get('set-cookie')?.split(';')[0],headers:response.headers};
 }
 try{
  assert.equal((await call('/api/health')).status,200);
  assert.equal((await call('/api/config')).value.accounts,true);
  assert.equal((await call('/api/habitat?bbox=8.5,47.25,8.51,47.26&region=zh&limit=2')).value.cells.length,2);
  assert.equal((await call('/api/habitat?bbox=bad')).status,400);
  const packed=await call('/api/data/regions');assert.equal(packed.value.regions.length,27);
  assert.equal((await call('/api/data/regions',{headers:{'If-None-Match':packed.headers.get('etag')}})).status,304);
  assert.equal((await call('/api/auth/register',{method:'POST',body:{username:'alice',password:'a long secret password'},origin:'https://evil.invalid'})).status,403);
  const alice=await call('/api/auth/register',{method:'POST',body:{username:'alice',password:'a long secret password'}});assert.equal(alice.status,201);assert.ok(alice.value.recoveryCode);assert.match(alice.headers.get('set-cookie'),/HttpOnly/);
  const bob=await call('/api/auth/register',{method:'POST',body:{username:'bob',password:'another long password'}});assert.equal(bob.status,201);
  const a={cookie:alice.cookie,csrf:alice.value.csrf},b={cookie:bob.cookie,csrf:bob.value.csrf};
  assert.equal((await call('/api/auth/me',a)).value.user.username,'alice');
  assert.equal((await call('/api/spots',{method:'POST',cookie:alice.cookie,body:{}})).status,403);
  const spot={name:'Quiet forest',lat:47.3,lon:8.55,species:'spruce_milkcap',notes:'Private note',cellId:'zh:10-10'};
  const saved=await call('/api/spots',{...a,method:'POST',body:spot});assert.equal(saved.status,201);const id=saved.value.spot.id;
  assert.equal((await call('/api/spots',b)).value.spots.length,0);
  assert.equal((await call(`/api/spots/${id}`,{...b,method:'PUT',body:spot})).status,404);
  assert.equal((await call(`/api/spots/${id}`,{...b,method:'DELETE'})).status,404);
  assert.equal((await call(`/api/spots/${id}`,{...a,method:'PUT',body:{...spot,name:'Updated'}})).value.spot.name,'Updated');
  const recovery=await call('/api/auth/recover',{method:'POST',body:{username:'alice',recoveryCode:alice.value.recoveryCode,password:'a replacement password'}});assert.equal(recovery.status,200);
  assert.equal((await call('/api/spots',a)).status,401);
  assert.equal((await call('/api/auth/recover',{method:'POST',body:{username:'alice',recoveryCode:alice.value.recoveryCode,password:'a replacement password'}})).status,401);
  await app.close();app=await createApp({legacyAccounts:true,storageDir:storage,scheduler:false,logger:{info(){},warn(){},error(){}}});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${app.server.address().port}`;
  const login=await call('/api/auth/login',{method:'POST',body:{username:'alice',password:'a replacement password'}});assert.equal(login.status,200);
  const auth={cookie:login.cookie,csrf:login.value.csrf};assert.equal((await call('/api/spots',auth)).value.spots[0].name,'Updated');
  assert.equal((await call('/api/account',{...auth,method:'DELETE',body:{password:'a replacement password'}})).status,200);
  assert.equal((await call('/api/spots',auth)).status,401);
  assert.equal((await fetch(base+'/.env')).status,404);assert.equal((await fetch(base+'/server/app.cjs')).status,404);
 }finally{await app.close();await fs.rm(storage,{recursive:true,force:true});}
});

test('weather refresh deduplicates requests, persists only complete snapshots and backs off after failure',async()=>{
 const real=createData(path.resolve(__dirname,'..')),points=real.index.weatherPoints.slice(0,2),storage=await fs.mkdtemp(path.join(os.tmpdir(),'shrooms-weather-'));
 const now=()=>new Date('2026-09-23T12:00:00Z');let calls=0,broken=false;
 const days=Array.from({length:14},(_,i)=>`2026-09-${String(i+9).padStart(2,'0')}`);
 const item={daily:{time:days,precipitation_sum:days.map(()=>2),temperature_2m_mean:days.map(()=>15),sunshine_duration:days.map(()=>36000),et0_fao_evapotranspiration:days.map(()=>2)},hourly:{time:Array.from({length:24},(_,i)=>`2026-09-22T${String(i).padStart(2,'0')}:00`),soil_moisture_3_to_9cm:Array(24).fill(.3),relative_humidity_2m:Array(24).fill(80)}};
 const data={...real,index:{weatherPoints:points}};
 const cache=createWeather({data,storageDir:storage,now,logger:{info(){},warn(){}},fetchImpl:async()=>{calls++;await new Promise(r=>setTimeout(r,5));return {ok:true,json:async()=>broken?[item]:[item,item]};}});
 try{
  await cache.init();await Promise.all([cache.refresh(),cache.refresh()]);assert.equal(calls,1);assert.equal(cache.status().fresh,true);assert.equal(cache.getSnapshot().entries[0][1].rain14,28);
  const previous=await fs.readFile(path.join(storage,'weather.json'),'utf8');broken=true;
  await assert.rejects(cache.refresh({force:true}));assert.equal(await fs.readFile(path.join(storage,'weather.json'),'utf8'),previous);assert.equal(cache.status().fresh,true);
  await cache.refresh();assert.equal(calls,2,'Failure retry interval prevents amplification');
  const restored=createWeather({data,storageDir:storage,now,logger:{info(){},warn(){}}});await restored.init();assert.equal(restored.status().fresh,true);
 }finally{cache.stop();await fs.rm(storage,{recursive:true,force:true});}
});


test('a recovery code can only be redeemed once even with concurrent requests',async()=>{
 const storage=await fs.mkdtemp(path.join(os.tmpdir(),'shrooms-recovery-'));
 const {createAccounts}=require('../server/accounts.cjs'),accounts=createAccounts(storage);
 try{
  const created=await accounts.register({username:'concurrent',password:'original test password'});
  const input={username:'concurrent',recoveryCode:created.recoveryCode,password:'replacement test password'};
  const attempts=await Promise.allSettled([accounts.recover(input),accounts.recover(input)]);
  assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(attempts.find(r=>r.status==='rejected').reason.status,401);
  assert.equal(accounts.current(created.token),null);
 }finally{accounts.close();await fs.rm(storage,{recursive:true,force:true});}
});

test('default server retires account endpoints while preserving existing storage',async()=>{
 const storage=await fs.mkdtemp(path.join(os.tmpdir(),'shrooms-retired-'));
 const app=await createApp({storageDir:storage,scheduler:false,logger:{info(){},warn(){},error(){}}});
 try{await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${app.server.address().port}`;
 assert.equal((await (await fetch(base+'/api/config')).json()).accounts,false);
 for(const [route,method] of [['/api/auth/register','POST'],['/api/auth/me','GET'],['/api/spots','GET'],['/api/account','DELETE']])assert.equal((await fetch(base+route,{method})).status,410);
 }finally{await app.close();await fs.rm(storage,{recursive:true,force:true});}
});
