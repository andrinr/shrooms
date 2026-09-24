const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const polygon={type:'MultiPolygon',coordinates:[[[[250,120],[260,120],[260,140],[250,140],[250,120]],[[253,125],[257,125],[257,130],[253,130],[253,125]]]]};
function fixture(){
 const fills=[],events={},active=new Set(),loaded=[];let redraws=0;
 const ctx={scale(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(rule){fills.push(rule);},stroke(){}};
 const context={window:{devicePixelRatio:2},document:{createElement:()=>({getContext:()=>ctx})}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('src/overview.js','utf8'),context);
 function Grid(){}Grid.prototype.onAdd=function(){};Grid.prototype.onRemove=function(){};
 Grid.extend=methods=>{function Layer(){Object.assign(this,methods);this.redraw=()=>redraws++;}return Layer;};
 const map={project:([lat,lon])=>({x:lon,y:-lat}),unproject:([x,y])=>({lng:x,lat:-y}),getZoom:()=>10,hasLayer:l=>active.has(l),on:(e,fn)=>events[e]=fn,off:e=>delete events[e]};
 const layer=context.window.SHROOMS_OVERVIEW.create({GridLayer:Grid},map,{manifest:{tiles:[{key:'fine',coarseKey:'coarse',bounds:[[120,250],[140,260]]}]},load:async key=>{loaded.push(key);return [{id:'a',geometry:polygon}];}});active.add(layer);layer.onAdd(map);
 return {layer,map,events,fills,loaded,contains:context.window.SHROOMS_OVERVIEW.contains,redraws:()=>redraws};
}
test('forest-shaped overview renders across tile seams and respects holes when clicked',async()=>{
 const f=fixture(),items=[{members:['a'],value:50}];let selected;
 f.layer.setData(items,1000,()=> '#fff',s=>selected=s,'heat:0:100');
 await Promise.all([0,1].map(x=>new Promise(resolve=>f.layer.createTile({x,y:-1,z:10},resolve))));
 assert.equal(f.fills.length,2);assert.equal(f.fills[0],'evenodd');assert.deepEqual(f.loaded,['coarse']);
 await f.events.click({latlng:{lat:127,lng:255}});assert.equal(selected,undefined);
 await f.events.click({latlng:{lat:135,lng:255}});assert.equal(selected,items[0]);
 f.layer.onRemove(f.map);assert.equal(f.events.click,undefined);
});
test('nearby views use detailed outlines; panning does not force recoloring',async()=>{
 const f=fixture(),items=[{members:['a']}];f.layer.setData(items,500,()=> '#fff',()=>{},'heat:0:100');const count=f.redraws();
 f.layer.setData(items,500,()=> '#fff',()=>{},'heat:0:100');assert.equal(f.redraws(),count);
 await new Promise(resolve=>f.layer.createTile({x:0,y:-1,z:12},resolve));assert.deepEqual(f.loaded,['fine']);
 f.layer.setData(items,500,()=> '#000',()=>{},'heat:30:70');assert.equal(f.redraws(),count+1);
});
test('late outline downloads cannot paint an obsolete species view',async()=>{
 let resolve;const f=fixture(),items=[{members:['a']}];f.layer.setData(items,1000,()=> '#fff',()=>{},'one');
 const done=new Promise(r=>{resolve=r;});f.layer.createTile({x:0,y:-1,z:10},resolve);f.layer.setData(items,1000,()=> '#000',()=>{},'two');await done;assert.equal(f.fills.length,0);
});

test('bundled outlines reference real overview cells and stay inside their spatial bounds',()=>{
 const {unpack}=require('../server/data.cjs'),manifest=unpack('.','overview-forest/index'),ids=new Set(unpack('.','regions/ch/index').cells.map(c=>c.id));let count=0;
 for(const tile of manifest.tiles)for(const key of [tile.key,tile.coarseKey])for(const f of unpack('.',key)){
  assert.ok(ids.has(f.id));assert.equal(f.geometry.type,'MultiPolygon');count++;
  for(const poly of f.geometry.coordinates)for(const ring of poly){assert.ok(ring.length>=4);assert.deepEqual(ring[0],ring.at(-1));for(const [lon,lat] of ring){assert.ok(Number.isFinite(lon)&&Number.isFinite(lat));assert.ok(lat>=tile.bounds[0][0]-.00001&&lat<=tile.bounds[1][0]+.00001&&lon>=tile.bounds[0][1]-.00001&&lon<=tile.bounds[1][1]+.00001);}}
 }
 assert.ok(count>150000);
});
