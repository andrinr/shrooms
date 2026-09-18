const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');

function loader(){
 const requests=[];
 const context={window:{},Uint8Array,atob,Blob,Response,DecompressionStream,setTimeout,clearTimeout};
 context.document={createElement:()=>({remove(){}}),head:{appendChild(script){
  requests.push(script.src);
  queueMicrotask(()=>{
   try{vm.runInContext(fs.readFileSync(script.src,'utf8'),context);script.onload();}
   catch{script.onerror();}
  });
 }}};
 vm.createContext(context);
 vm.runInContext(fs.readFileSync('src/loader.js','utf8'),context);
 return {load:context.window.SHROOMS_LOAD,requests};
}

test('browser loader decompresses index, every region, and weather without network',async()=>{
 const {load,requests}=loader();
 const pending=load('index');assert.equal(load('index'),pending);
 const index=await pending;
 assert.equal(requests.length,1);
 const cells=new Map(index.cells.map(c=>[c.id,c]));
 const ids=new Set();
 for(const tile of index.tiles){
  const items=await load(tile.key);
  assert.equal(items.length,tile.count);
  assert.equal(fs.statSync(`data/${tile.key}.js`).size,tile.bytes);
  for(const item of items){
   assert.equal(cells.get(item.id)?.tile,tile.key);
   assert.ok(!ids.has(item.id));ids.add(item.id);
  }
 }
 assert.equal(ids.size,index.metadata.cellCount);
 const weather=await load('weather');
 assert.equal(weather.grid,index.weatherPoints.map(p=>p.id).join('|'));
 assert.equal(weather.entries.length,index.weatherPoints.length);
 assert.match(weather.day,/^\d{4}-\d{2}-\d{2}$/);
 assert.ok(Number.isFinite(weather.at));
 weather.entries.forEach(([id,w],i)=>{
  assert.equal(id,i);
  for(const key of ['rain14','temp7','soil','humidity','sunHours7','et014'])assert.ok(Number.isFinite(w[key]),key);
 });
 // Historical snapshots remain valid artifacts; freshness is a runtime concern.
 assert.equal(await load('index'),index);
 assert.equal(requests.length,index.tiles.length+2);
});

test('failed chunk loads reject and permit retry',async()=>{
 const {load,requests}=loader();
 await assert.rejects(load('does-not-exist'),/Could not load/);
 await assert.rejects(load('does-not-exist'),/Could not load/);
 assert.equal(requests.length,2);
});

test('HTML assets and navigation anchors resolve under a GitHub Pages subpath',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 for(const [,reference] of html.matchAll(/\b(?:src|href)="([^"]+)"/g)){
  if(/^(https?:|mailto:|data:)/.test(reference))continue;
  if(reference.startsWith('#')){assert.ok(ids.has(reference.slice(1)),reference);continue;}
  assert.ok(!reference.startsWith('/'),`Root-relative path breaks project Pages: ${reference}`);
  assert.ok(fs.existsSync(path.resolve(reference.split(/[?#]/)[0])),`Missing asset: ${reference}`);
 }
});

test('basemap is bundled, geographically bounded, and has no external SVG resources',()=>{
 const context={window:{}};vm.createContext(context);
 vm.runInContext(fs.readFileSync('data/basemap.js','utf8'),context);
 const base=context.window.SHROOMS_BASEMAP;
 assert.equal(base.projection,'EPSG:3857');
 const [[south,west],[north,east]]=base.bounds;
 assert.ok(south<north&&west<east);
 assert.ok(base.labels.length>150);
 assert.ok(base.roadSegments.motorway>50);
 assert.ok(base.roadSegments.primary>50);
 assert.ok(base.labels.every(p=>Number.isFinite(p.minZoom)));
 assert.equal(base.osmLicense,'ODbL-1.0');
 for(const label of base.labels)assert.ok(label.lat>=south&&label.lat<=north&&label.lon>=west&&label.lon<=east);
 const svg=fs.readFileSync('data/basemap.svg','utf8');
 assert.match(svg,/<svg /);assert.doesNotMatch(svg,/<script|<image|(?:href|src)=|url\(/i);
 assert.doesNotMatch(fs.readFileSync('src/app.js','utf8'),/L\.tileLayer\(/);
});

test('protected forest reserve overlay loads with named polygons and source provenance',async()=>{
 const {load}=loader();const reserves=await load('protected');
 const index=await load('index');
 assert.ok(index.cells.some(c=>c.reservePercent===100),'Forest fully inside reserves retains habitat scores');
 const includedReserveArea=index.cells.reduce((sum,c)=>sum+c.area*c.reservePercent/100/100,0);
 assert.ok(includedReserveArea/index.metadata.mappedReserveForestAreaKm2>0.99,'Mapped reserve forest remains in scored cells, allowing for small omitted cells');
 assert.equal(reserves.features.length,reserves.metadata.reserveCount);
 assert.ok(reserves.features.length>500);
 assert.equal(reserves.metadata.sourceSha256,JSON.parse(fs.readFileSync('data/sources.json','utf8')).sources['reserves.json'].sha256);
 const ids=new Set();
 for(const f of reserves.features){
  assert.ok(f.properties.name);assert.ok(!ids.has(f.properties.id));ids.add(f.properties.id);
  assert.ok(['Polygon','MultiPolygon'].includes(f.geometry.type));
  const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
  for(const polygon of polygons)for(const ring of polygon){assert.ok(ring.length>=4);assert.deepEqual(ring[0],ring[ring.length-1]);}
 }
});
