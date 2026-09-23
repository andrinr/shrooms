const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {unpack,createData}=require('../server/data.cjs');
const context={window:{},atob};vm.createContext(context);vm.runInContext(fs.readFileSync('src/soil.js','utf8'),context);
const soil=context.window.SHROOMS_SOIL,meta=unpack('.','soil/index');
test('soil lookup preserves the native grid, boundaries, missing data and pH scale',()=>{
 const [x,y]=meta.origin;
 assert.equal(soil.address(meta,x-1,y),null);assert.equal(soil.address(meta,x,y+1),null);
 assert.equal(soil.address(meta,x+meta.width*25,y),null);
 assert.equal(soil.address(meta,x+12.5,y-12.5).offset,0);
 assert.equal(soil.address(meta,x+256*25,y-256*25).key,'soil/tiles/1-1');
 assert.equal(soil.decode(meta,[255,255,255],0),null);
 assert.deepEqual(JSON.parse(JSON.stringify(soil.decode(meta,[45,30,62],0))),{ph:4.5,lower:3,upper:6.2});
});
test('bundled soil tiles retain all three channels and valid prediction intervals',()=>{
 assert.equal(meta.resolutionMeters,25);assert.equal(meta.license,'CC BY-SA 4.0');
 assert.equal(meta.tiles.length,new Set(meta.tiles).size);let present=0;
 for(const key of meta.tiles){
  const bytes=Buffer.from(unpack('.',key).values,'base64');assert.equal(bytes.length,meta.tileSize**2*3);
  for(let i=0;i<bytes.length;i+=3){if(bytes[i]===255)continue;present++;
   assert.ok(bytes[i]>=0&&bytes[i]<=140);assert.ok(bytes[i+1]===255||bytes[i+1]<=bytes[i]);assert.ok(bytes[i+2]===255||bytes[i+2]>=bytes[i]);
  }
 }
 assert.ok(present>1000000);
});
test('soil loading retries failures, and server exposes only manifest-listed tiles',async()=>{
 let failed=true;const lookup=soil.create(async key=>{if(failed)throw Error('offline');return unpack('.',key);});
 assert.equal((await lookup(2692125,1281825)).status,'error');failed=false;
 const value=await lookup(2692125,1281825);assert.ok(['ready','missing'].includes(value.status));
 const data=createData('.');assert.ok(data.get('soil/index'));assert.ok(data.get(meta.tiles[0]));assert.equal(data.get('soil/tiles/999-999'),null);assert.equal(data.get('soil/../index'),null);
});
