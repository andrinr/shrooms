const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(){
 const fills=[],events={},active=new Set();let redraws=0;
 const ctx={scale(){},fillRect(...a){fills.push(a);}};
 const context={window:{devicePixelRatio:2},document:{createElement:()=>({getContext:()=>ctx})}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('src/overview.js','utf8'),context);
 function Grid(){}Grid.prototype.onAdd=function(){};Grid.prototype.onRemove=function(){};
 Grid.extend=methods=>{function Layer(){Object.assign(this,methods);this.redraw=()=>redraws++;}return Layer;};
 const map={project:([lat,lon])=>({x:lon,y:lat}),getZoom:()=>10,hasLayer:l=>active.has(l),on:(e,fn)=>events[e]=fn,off:e=>delete events[e]};
 const layer=context.window.SHROOMS_OVERVIEW.create({GridLayer:Grid},map);active.add(layer);layer.onAdd(map);
 return {layer,map,events,fills,redraws:()=>redraws};
}
test('overview raster draws squares across tile seams and preserves click selection',()=>{
 const f=fixture(),items=[{lat:128,lon:255,value:50}];let selected;
 f.layer.setData(items,1000,()=> '#fff',s=>selected=s,'heat:0:100');
 f.layer.createTile({x:0,y:0,z:10});f.layer.createTile({x:1,y:0,z:10});
 assert.equal(f.fills.length,2);assert.equal(f.fills[0][0],250);assert.equal(f.fills[1][0],-6);
 f.events.click({latlng:[128,255]});assert.equal(selected,items[0]);
 f.layer.onRemove(f.map);assert.equal(f.events.click,undefined);
});
test('panning with unchanged data and scale does not redraw the overview; recoloring does',()=>{
 const f=fixture(),items=[{lat:128,lon:128}];
 f.layer.setData(items,1000,()=> '#fff',()=>{},'heat:0:100');const count=f.redraws();
 f.layer.setData(items,1000,()=> '#fff',()=>{},'heat:0:100');assert.equal(f.redraws(),count);
 f.layer.setData(items,1000,()=> '#000',()=>{},'heat:30:70');assert.equal(f.redraws(),count+1);
});
