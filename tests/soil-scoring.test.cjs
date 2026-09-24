const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{},Intl,Date,Math,Number};vm.createContext(context);for(const file of ['data','scoring','soil'])vm.runInContext(fs.readFileSync(`src/${file}.js`,'utf8'),context);
const {SHROOMS_SCORE:model,SHROOMS_SPECIES:species}=context.window;
const date=new Date('2026-09-18T12:00:00Z'),cell={forest:90,canopy:80,canopyKnown:1,treeKnown:1,conifer:50,broadleaf:50,slope:5},weather={soil:.3,rain14:45,humidity:80,temp7:15};
const score=(soilPh,speciesId='chanterelle',base=cell,w=weather)=>model.score({...base,soilPh},species[speciesId],w,date);
test('acid-preferring species respond modestly and unsupported species remain unchanged',()=>{
 for(const id of ['chanterelle','bay','porcini']){const acid=score([4,3.8,4.2],id),alkaline=score([7,6.8,7.2],id);assert.ok(acid.value>alkaline.value);assert.ok(acid.value-alkaline.value<=3);}
 assert.equal(score([4,3.8,4.2],'horn').value,score([7,6.8,7.2],'horn').value);
 assert.equal(score([5.5,5.5,5.5],'porcini').factors.soil.value>score([5.5,5.5,5.5],'bay').factors.soil.value,true);
});
test('missing or malformed predictions have zero influence',()=>{
 const baseline=score(undefined);for(const bad of [null,[5,null,6],[5,6,4],[NaN,4,6],[7,8,9],[-1,-2,0]]){const s=score(bad);assert.equal(s.value,baseline.value);assert.equal(s.factors.soil.value,null);assert.equal(s.factors.soil.weight,0);}
});
test('uncertainty attenuates influence and missing other factors cannot amplify soil beyond five percent',()=>{
 const narrow=score([6,5.9,6.1]),wide=score([6,5,7]);assert.ok(wide.factors.soil.weight<narrow.factors.soil.weight);const veryWide=score([6,2,10]);assert.ok(veryWide.factors.soil.weight<narrow.factors.soil.weight/50);
 for(const base of [cell,{forest:90}])for(const w of [weather,undefined]){const s=model.score({...base,soilPh:[6,6,6]},species.chanterelle,w,date);assert.ok(s.factors.soil.weight/s.completeness<=.050000001);}
});
test('bundled soil samples match native raster values in overview and local tiles',()=>{
 const {unpack}=require('../server/data.cjs'),meta=unpack('.','soil/index'),habitat=unpack('.','habitat/index');const cache=new Map();
 const check=c=>{const at=context.window.SHROOMS_SOIL.address(meta,c.x,c.y);let expected=null;if(at&&meta.tiles.includes(at.key)){if(!cache.has(at.key))cache.set(at.key,Buffer.from(unpack('.',at.key).values,'base64'));const v=context.window.SHROOMS_SOIL.decode(meta,cache.get(at.key),at.offset);expected=v?[v.ph,v.lower,v.upper]:null;}assert.deepEqual(c.soilPh,expected);};
 const national=unpack('.','regions/ch/index');for(let i=0;i<national.cells.length;i+=3000)check(national.cells[i]);
 for(const region of habitat.regions){const tile=habitat.tiles.find(t=>t.region===region.id);for(const f of unpack('.',tile.key).filter((_,i)=>i%1000===0))check(f.properties);}
});
