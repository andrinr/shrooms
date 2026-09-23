const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {unpack}=require('../server/data.cjs');
const root=path.resolve(__dirname,'..');
test('all Swiss cantons have bounded, traceable regional habitat and valid tile references',()=>{
 const catalog=unpack(root,'regions');assert.equal(catalog.regions.length,27);assert.equal(new Set(catalog.regions.map(r=>r.id)).size,27);
 let total=0;
 for(const region of catalog.regions){
  const data=unpack(root,region.index),keys=new Set(data.tiles.map(t=>t.key));
  assert.equal(data.metadata.cellSizeMeters,region.cellSizeMeters);assert.equal(data.metadata.cellCount,data.cells.length);assert.ok(data.cells.length>0);
  let count=0;
  for(const tile of data.tiles){assert.ok(fs.existsSync(path.join(root,'data',tile.key+'.js')));count+=tile.count;}
  assert.equal(count,data.cells.length);
  for(const c of data.cells){
   assert.ok(c.lat>45.7&&c.lat<47.9&&c.lon>5.8&&c.lon<10.7,`${region.id} ${c.id}`);
   assert.ok(keys.has(c.tile));assert.ok(c.area>0&&c.area<=(region.cellSizeMeters/100)**2);
   assert.ok(c.slope===null||(c.slope>=0&&c.slope<90));
   assert.ok(c.weather>=0&&c.weather<data.weatherPoints.length);
   if(region.id!=='zh'){assert.equal(c.canopy,null);assert.equal(c.pine,null);assert.equal(data.metadata.terrainResolutionMeters,200);}
  }
  if(region.id!=='ch')total+=data.cells.length;
 }
 assert.ok(total>1000000);
});
test('national weather and protection overlays load without inventing coverage',()=>{
 const index=unpack(root,'regions/ch/index'),weather=unpack(root,'national-weather'),protectedAreas=unpack(root,'national-protected');
 assert.equal(weather.grid,index.weatherPoints.map(p=>p.id).join('|'));assert.equal(weather.entries.length,index.weatherPoints.length);
 assert.match(protectedAreas.metadata.coverage,/Partial/);
 for(const f of protectedAreas.features)assert.ok(['Polygon','MultiPolygon'].includes(f.geometry.type));
 const basemap=unpack(root,'switzerland-map');assert.ok(basemap.labels.length>500);
 const svg=fs.readFileSync(path.join(root,'data/switzerland.svg'),'utf8');assert.doesNotMatch(svg,/<script|<image|(?:href|src)=|url\(/i);
});
