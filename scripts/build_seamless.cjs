// Repackage existing, attributed regional data into viewport-sized bundles.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {unpack}=require('../server/data.cjs');
function pack(key,value){const dest=path.join('data',key+'.js');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,`window.SHROOMS_PACKED[${JSON.stringify(key)}]=${JSON.stringify(zlib.gzipSync(JSON.stringify(value)).toString('base64'))};\n`);}
const regions=[],tiles=[];
for(const region of unpack('.','regions').regions){
 if(region.id==='ch')continue;
 const data=unpack('.',region.index),properties=new Map(data.cells.map(c=>[c.id,c]));
 const bounds=[[90,180],[-90,-180]];
 for(const tile of data.tiles){
  const key=`habitat/tiles/${region.id}/${tile.key.split('/').at(-1)}`;
  const features=unpack('.',tile.key).map(item=>({type:'Feature',geometry:item.geometry,properties:{...properties.get(item.id),id:`${region.id}:${item.id}`,sourceId:item.id,region:region.id,tile:key,cellSizeMeters:data.metadata.cellSizeMeters,terrainResolutionMeters:data.metadata.terrainResolutionMeters,maskResolutionMeters:data.metadata.maskResolutionMeters}}));
  pack(key,features);tiles.push({key,bounds:tile.bounds,count:features.length,region:region.id});
  for(let i=0;i<2;i++){bounds[0][i]=Math.min(bounds[0][i],tile.bounds[0][i]);bounds[1][i]=Math.max(bounds[1][i],tile.bounds[1][i]);}
 }
 regions.push({id:region.id,name:region.name,bounds,metadata:data.metadata});
}
pack('habitat/index',{regions,tiles});console.log(`${tiles.length} seamless local bundles across ${regions.length} cantons`);
