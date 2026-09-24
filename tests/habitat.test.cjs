const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {unpack,createData}=require('../server/data.cjs');
const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync('src/habitat.js','utf8'),context);
const {create,intersects}=context.window.SHROOMS_HABITAT;
test('a viewport across source boundaries loads both local datasets without ID collisions',async()=>{
 const manifest={tiles:[{key:'zh',bounds:[[0,0],[1,1]]},{key:'ag',bounds:[[0,1],[1,2]]},{key:'ti',bounds:[[3,3],[4,4]]}]},calls=[];
 const stream=create(manifest,async key=>{calls.push(key);return [{properties:{id:key+':1-1',lat:.5,lon:key==='zh'?.8:1.2,cellSizeMeters:key==='zh'?50:100}}];});
 const result=await stream.view([[.4,.7],[.6,1.3]]);assert.equal(result.stale,false);assert.equal(result.features.length,2);assert.deepEqual(calls.sort(),['ag','zh']);
 assert.notEqual(result.features[0].properties.id,result.features[1].properties.id);
 assert.equal(intersects([[0,0],[1,1]],[[1,1],[2,2]]),true);
});
test('obsolete view requests are cancelled and failed tiles retry',async()=>{
 let finish;const manifest={tiles:[{key:'a',bounds:[[0,0],[1,1]]}]};
 const stream=create(manifest,()=>new Promise(r=>finish=r));const pending=stream.view([[0,0],[1,1]]);stream.cancel();finish([]);assert.equal((await pending).stale,true);
 let count=0;const retry=create(manifest,async()=>{if(!count++)throw Error('offline');return [];});
 assert.equal((await retry.view([[0,0],[1,1]])).failed,true);assert.equal((await retry.view([[0,0],[1,1]])).failed,false);
});
test('seamless bundles retain regional resolution, geometry, provenance and saved-spot identities',()=>{
 const manifest=unpack('.','habitat/index');assert.equal(manifest.regions.length,26);
 let count=0;const ids=new Set();
 for(const tile of manifest.tiles){
  const features=unpack('.',tile.key);assert.equal(features.length,tile.count);count+=features.length;
  for(const f of features){const c=f.properties;assert.ok(!ids.has(c.id));ids.add(c.id);assert.equal(c.id,`${tile.region}:${c.sourceId}`);assert.equal(c.tile,tile.key);assert.equal(c.cellSizeMeters,50);assert.ok(c.area>0&&c.area<=.25);assert.ok(c.lat>45.7&&c.lat<47.9&&c.lon>5.8&&c.lon<10.7);assert.ok(c.broadleaf===null||(c.broadleaf>=0&&c.broadleaf<=100));assert.ok(c.slope===null||(c.slope>=0&&c.slope<90));if(tile.region!=='zh'){assert.equal(c.maskResolutionMeters,25);assert.equal(c.terrainResolutionMeters,200);assert.equal(c.forestSource,'swissTLM3D 2026-02');assert.equal(c.area,c.forest/100*.25)};assert.ok(f.geometry.coordinates.length);assert.ok(c.terrainResolutionMeters>0);}
 }
 const expected=manifest.regions.reduce((n,r)=>n+r.metadata.cellCount,0);assert.equal(count,expected);assert.ok(count>4000000);
 const api=createData('.');assert.ok(api.get('habitat/index'));assert.ok(api.get(manifest.tiles[0].key));assert.equal(api.get('habitat/tiles/zh/9999-9999'),null);
});

test('legacy saved coordinates resolve to nearby new fine cells without mutating saved spots',()=>{
 const cells=[{id:'new',lat:46,lon:9},{id:'far',lat:47,lon:9}];
 assert.equal(context.window.SHROOMS_HABITAT.nearest(cells,46.0002,9,150).id,'new');
 assert.equal(context.window.SHROOMS_HABITAT.nearest(cells,45,9,150),null);
});
