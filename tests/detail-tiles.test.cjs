const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(options={}){
 const context={window:{},setTimeout};vm.createContext(context);vm.runInContext(fs.readFileSync('src/detail-tiles.js','utf8'),context);
 const shown=new Set();const controller=context.window.SHROOMS_DETAIL_TILES.create({load:async key=>[0,1,2].map(i=>({properties:{id:`${key}-${i}`,i}})),attach:f=>{shown.add(f);return f;},detach:f=>shown.delete(f),...options});
 return {controller,shown};
}
test('detailed rendering evicts offscreen geometry and supports revisiting tiles',async()=>{
 const f=fixture();await f.controller.update(['a'],()=>true);assert.equal(f.shown.size,3);
 await f.controller.update(['b'],f=>f.properties.i===1);assert.equal(f.shown.size,1);assert.equal([...f.shown][0].properties.id,'b-1');
 await f.controller.update(['a'],()=>true);assert.equal(f.shown.size,3);
 await f.controller.update([],()=>false);assert.equal(f.shown.size,0);
});
test('a new view cancels stale downloads and deferred drawing batches',async()=>{
 let resolve;const f=fixture({load:()=>new Promise(r=>resolve=r)});
 const pending=f.controller.update(['old'],()=>true);await f.controller.update([],()=>false);
 resolve([{properties:{id:'old'}}]);assert.equal((await pending).stale,true);assert.equal(f.shown.size,0);
 let resume;const g=fixture({batchSize:1,pause:()=>new Promise(r=>resume=r)});
 const drawing=g.controller.update(['old'],()=>true);await new Promise(r=>setImmediate(r));
 assert.equal(g.shown.size,1);g.controller.cancel();resume();assert.equal((await drawing).stale,true);assert.equal(g.shown.size,1);
});
test('failed tiles are reported and can retry without duplicate geometry',async()=>{
 let failed=true;const f=fixture({load:async()=>{if(failed)throw Error('offline');return [{properties:{id:'one'}}];}});
 assert.equal((await f.controller.update(['a'],()=>true)).failed,true);failed=false;
 await f.controller.update(['a'],()=>true);await f.controller.update(['a'],()=>true);assert.equal(f.shown.size,1);
});
