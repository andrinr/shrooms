const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync('src/basemap.js','utf8'),context);
 const active=new Set(),created=[],panes={},changes=[];
 const map={createPane(name){return panes[name]={style:{}};},removeLayer(layer){active.delete(layer);}};
 const L={tileLayer(url,options){const handlers={};const layer={url,options,handlers,on(event,fn){handlers[event]=fn;return this;},addTo(){active.add(this);return this;}};created.push(layer);return layer;}};
 return {controller:context.window.SHROOMS_BASEMAP_TILES.mount(L,map,(...args)=>changes.push(args)),active,created,panes,changes};
}
test('Swiss map uses zoom-dependent HTTPS tiles with reusable cartographic ink above the heatmap',()=>{
 const {controller,active,created,panes}=setup();controller.mode(true);
 assert.equal(active.size,2);assert.equal(created[0].url,created[1].url);
 assert.match(created[0].url,/https:\/\/wmts\.geo\.admin\.ch\/.*3857\/\{z\}\/\{x\}\/\{y\}\.jpeg$/);
 assert.equal(panes.swissInk.style.mixBlendMode,'multiply');assert.ok(panes.swissInk.style.zIndex>410&&panes.swissInk.style.zIndex<450);
 assert.equal(created[0].options.updateWhenZooming,false);assert.equal(created[0].options.keepBuffer,1);
 controller.overlays(false);assert.equal(active.size,1);controller.overlays(true);assert.equal(active.size,2);
 controller.mode(false);assert.equal(active.size,0);
});
test('failed tiles fall back once, retry works, and old requests cannot disable a newer map',()=>{
 const {controller,active,created,changes}=setup();controller.mode(true);
 const old=created[0];old.handlers.tileerror();assert.equal(active.size,0);assert.deepEqual(changes.at(-1),[false,true]);
 controller.mode(true);old.handlers.tileerror();assert.equal(active.size,2);assert.deepEqual(changes.at(-1),[true,false]);
 controller.mode(false);created.at(-1).handlers.tileerror();assert.deepEqual(changes.at(-1),[false,false]);
});
