const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const zlib=require('node:zlib');
const context={window:{SHROOMS_PACKED:{}},Intl,Date,Math,Number};vm.createContext(context);
for(const file of ['src/data.js','src/scoring.js','src/weather.js','data/index.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
const {SHROOMS_SPECIES:species,SHROOMS_SCORE:model,SHROOMS_WEATHER:weather}=context.window;
const unpack=key=>JSON.parse(zlib.gunzipSync(Buffer.from(context.window.SHROOMS_PACKED[key],'base64')));
const data=unpack('index');
const properties=new Map(data.cells.map(c=>[c.id,c]));
data.features=data.tiles.flatMap(tile=>{
 vm.runInContext(fs.readFileSync(`data/${tile.key}.js`,'utf8'),context);
 return unpack(tile.key).map(item=>({type:'Feature',properties:properties.get(item.id),geometry:item.geometry}));
});
const autumn=new Date('2026-09-18T12:00:00Z');
const cell={forest:90,canopy:85,canopyKnown:1,treeKnown:1,conifer:30,broadleaf:70,beech:60,oak:10,slope:8,aspect:0};
const wet={rain14:55,soil:.32,humidity:85,temp7:15};

test('dry weather meaningfully lowers the same forest score',()=>{
 const good=model.score(cell,species.porcini,wet,autumn);
 const dry=model.score(cell,species.porcini,{rain14:0,soil:.1,humidity:35,temp7:15},autumn);
 assert.ok(good.value-dry.value>30);
});
test('horn of plenty responds to measured tree composition',()=>{
 const broadleaf=model.score({...cell,conifer:0,broadleaf:100,beech:100,oak:0},species.horn,wet,autumn);
 const conifer=model.score({...cell,conifer:100,broadleaf:0,beech:0,oak:0},species.horn,wet,autumn);
 assert.ok(broadleaf.value>conifer.value+15);
});
test('missing weather is omitted rather than fabricated as zero',()=>{
 const result=model.score(cell,species.porcini,null,autumn);
 assert.equal(result.factors.moisture.value,null);assert.equal(result.factors.temperature.value,null);
 assert.equal(result.completeness,.5);assert.ok(Number.isFinite(result.value));assert.equal(result.live,false);
});
test('steep southern slopes have a lower terrain moisture proxy',()=>{
 assert.ok(model.score({...cell,slope:4},species.porcini,wet,autumn).factors.terrain.value>model.score({...cell,slope:40,aspect:180},species.porcini,wet,autumn).factors.terrain.value);
});
test('weather aggregation excludes today and future forecasts',()=>{
 const time=Array.from({length:16},(_,i)=>`2026-09-${String(i+4).padStart(2,'0')}`);
 const item={daily:{time,precipitation_sum:time.map((_,i)=>i<14?2:999),temperature_2m_mean:time.map((_,i)=>i<14?15:99)},hourly:{time:['2026-09-17T12:00','2026-09-18T12:00'],soil_moisture_3_to_9cm:[.3,.99],relative_humidity_2m:[80,1]}};
 const result=weather.parse(item,'2026-09-18');
 assert.equal(result.rain14,28);assert.equal(result.temp7,15);assert.equal(result.soil,.3);assert.equal(result.humidity,80);
 item.daily.precipitation_sum[0]=null;assert.equal(weather.parse(item,'2026-09-18').rain14,null);
});
test('all generated cells have valid, bounded source values and scores',()=>{
 assert.equal(data.features.length,data.metadata.cellCount);assert.ok(data.features.length>49000);assert.equal(data.metadata.cellSizeMeters,50);
 assert.ok(Math.abs(data.cells.reduce((sum,c)=>sum+c.area/100,0)-data.metadata.forestAreaKm2)<0.01,'Fine grid preserves the mapped forest area');
 const ids=new Set();
 for(const feature of data.features){
  const c=feature.properties;assert.ok(!ids.has(c.id));ids.add(c.id);
  assert.ok(c.lat>47.1&&c.lat<47.8&&c.lon>8.2&&c.lon<9.1);
  assert.ok(c.area===.25);assert.ok(c.forest>=0&&c.forest<=100);
  assert.ok(c.weather>=0&&c.weather<data.weatherPoints.length);
  assert.ok(c.slope===null||(c.slope>=0&&c.slope<90));
  for(const s of Object.values(species)){
   const score=model.score(c,s,wet,autumn).value;assert.ok(Number.isFinite(score)&&score>=0&&score<=100);
  }
  const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
  for(const polygon of polygons)for(const ring of polygon){assert.ok(ring.length>=4);assert.deepEqual(ring[0],ring[ring.length-1]);}
 }
});

test('weather snapshots reject stale, future, incomplete and mismatched grids',()=>{
 const points=[{id:'a'}],now=new Date('2026-09-18T12:00:00Z');
 const snapshot={at:now.getTime()-3600000,grid:'a',entries:[[0,wet]]};
 assert.ok(weather.usable(snapshot,points,now));
 for(const change of [{at:now.getTime()-49*3600000},{at:now.getTime()+1000},{grid:'b'},{entries:[]}])assert.equal(weather.usable({...snapshot,...change},points,now),false);
});
test('compressed assets retain all source geometry and fit small chunks',()=>{
 assert.equal(new Set(data.features.map(f=>f.properties.id)).size,data.cells.length);
 for(const tile of data.tiles)assert.ok(tile.bytes<40000);
});

test('saffron milkcap distinguishes pine from other conifers and omits unknown pine',()=>{
 const pine=model.score({...cell,pine:70},species.saffron,wet,autumn);
 const spruce=model.score({...cell,pine:0},species.saffron,wet,autumn);
 assert.ok(pine.value>spruce.value+20);
 assert.equal(model.score({...cell,pine:null},species.saffron,wet,autumn).factors.tree.value,null);
});
test('reference evaporation lowers moisture while missing evaporation preserves rain-only behavior',()=>{
 const low=model.score(cell,species.porcini,{...wet,et014:0},autumn);
 const high=model.score(cell,species.porcini,{...wet,et014:60},autumn);
 assert.ok(low.factors.moisture.value>high.factors.moisture.value);
 assert.equal(low.value,model.score(cell,species.porcini,wet,autumn).value);
});
test('sunshine and evaporation use complete past days and convert seconds to hours',()=>{
 const time=Array.from({length:15},(_,i)=>`2026-09-${String(i+4).padStart(2,'0')}`);
 const daily={time,sunshine_duration:time.map((_,i)=>i<14?3600:999999),et0_fao_evapotranspiration:time.map((_,i)=>i<14?2:999)};
 const parsed=weather.parse({daily},'2026-09-18');
 assert.equal(parsed.sunHours7,7);assert.equal(parsed.et014,28);
 daily.sunshine_duration[13]=null;daily.et0_fao_evapotranspiration[0]=null;
 assert.equal(weather.parse({daily},'2026-09-18'),null);
});

test('regional weather interpolation removes nearest-anchor steps and omits missing inputs',()=>{
 const points=[{id:'0:0'},{id:'10000:0'}];
 const entries=new Map([[0,{rain14:10,soil:.2}],[1,{rain14:50,soil:null}]]);
 const middle=weather.interpolate({x:5000,y:0},points,entries);
 assert.ok(Math.abs(middle.rain14-30)<1e-9);assert.ok(Math.abs(middle.soil-.2)<1e-9);assert.equal(middle.temp7,null);
 const left=weather.interpolate({x:4999,y:0},points,entries),right=weather.interpolate({x:5001,y:0},points,entries);
 assert.ok(Math.abs(left.rain14-right.rain14)<.1);
 assert.ok(Math.abs(weather.interpolate({x:0,y:0},points,entries).rain14-10)<.001);
 assert.equal(weather.interpolate({x:0,y:0},points,new Map()),undefined);
});

test('factor weights and multipliers reconstruct the species score',()=>{
 for(const profile of Object.values(species))for(const c of [cell,{forest:90}, {...cell,soilPh:[5,4,6]}]){
  const result=model.score(c,profile,wet,autumn),factors=Object.values(result.factors);
  assert.ok(Math.abs(factors.reduce((sum,f)=>sum+f.share,0)-1)<1e-10);
  assert.equal(Math.round(100*factors.reduce((product,f)=>product*f.multiplier,1)),result.value);
  for(const f of factors)if(f.value===null){assert.equal(f.share,0);assert.equal(f.multiplier,1);}
 }
});
