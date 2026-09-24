// Join native 25 m topsoil predictions at each habitat cell centre, once at build time.
// Derived soil fields retain CC BY-SA 4.0 (WSL / EnviDat 484).
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),vm=require('node:vm');
const {unpack}=require('../server/data.cjs');
const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync('src/soil.js','utf8'),context);
const meta=unpack('.','soil/index'),valid=new Set(meta.tiles),cache=new Map();
function sample(c){const at=context.window.SHROOMS_SOIL.address(meta,c.x,c.y);if(!at||!valid.has(at.key))return null;if(!cache.has(at.key)){cache.set(at.key,Buffer.from(unpack('.',at.key).values,'base64'));if(cache.size>32)cache.delete(cache.keys().next().value);}const s=context.window.SHROOMS_SOIL.decode(meta,cache.get(at.key),at.offset);return s?[s.ph,s.lower,s.upper]:null;}
function pack(key,value){fs.writeFileSync(path.join('data',key+'.js'),`window.SHROOMS_PACKED[${JSON.stringify(key)}]=${JSON.stringify(zlib.gzipSync(JSON.stringify(value)).toString('base64'))};\n`);}
let count=0,present=0;
const catalog=unpack('.','regions'),keys=new Set(['index',...catalog.regions.map(r=>r.index),...unpack('.','habitat/index').tiles.map(t=>t.key)]);
for(const key of keys){const data=unpack('.',key),cells=Array.isArray(data)?data.map(f=>f.properties):data.cells;if(!cells)continue;let changed=false;for(const c of cells){const value=sample(c);if(JSON.stringify(c.soilPh)!==JSON.stringify(value)){c.soilPh=value;changed=true;}count++;if(value)present++;}if(changed)pack(key,data);}
console.log(`Soil joined at ${present} of ${count} cell centres`);
