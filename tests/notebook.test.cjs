const test=require('node:test'),assert=require('node:assert/strict');
const {create,key}=require('../src/notebook-store.js');
const spot={name:'Forest',notes:'Private <notes>',lat:47,lon:8,species:'porcini',cellId:'zh:1'};
function memory(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};}
test('notebook persists edits and deletions without an account',()=>{const storage=memory(),a=create(storage);const saved=a.save(spot);const b=create(storage);assert.equal(b.read()[0].notes,spot.notes);b.save({...saved,name:'Renamed'});assert.equal(a.read().length,1);assert.equal(a.read()[0].name,'Renamed');a.remove(saved.id);assert.deepEqual(b.read(),[]);});
test('backup import validates the entire file, merges and supports old spot exports',()=>{const a=create(memory());a.save(spot);const backup=a.export();a.import(backup);assert.equal(a.read().length,1);a.import(JSON.stringify({spots:[{...spot,name:'Second'}]}));assert.equal(a.read().length,2);assert.throws(()=>a.import(JSON.stringify({spots:[spot,{...spot,lat:'bad'}]})));assert.equal(a.read().length,2);assert.throws(()=>a.import('{'));assert.throws(()=>a.import(JSON.stringify({version:2,spots:[]})));});
test('unavailable, full or corrupt storage never reports a successful save',()=>{const storage=memory(),a=create(storage);a.save(spot);const prior=storage.getItem(key);storage.setItem=()=>{throw Error('QuotaExceededError');};assert.throws(()=>a.save({...spot,name:'New'}));assert.equal(storage.getItem(key),prior);const broken=create({getItem:()=>'{',setItem:()=>assert.fail('must not overwrite corrupt data')});assert.throws(()=>broken.save(spot));});

test('successful writes notify map listeners; failed writes do not',()=>{
 const fs=require('node:fs'),vm=require('node:vm');let events=0;
 const context={crypto:globalThis.crypto,Event,dispatchEvent:e=>{assert.equal(e.type,'shrooms:notebook-change');events++;}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('src/notebook-store.js','utf8'),context);
 const storage=memory(),store=context.SHROOMS_NOTEBOOK.create(storage);const saved=store.save(spot);assert.equal(events,1);
 store.remove(saved.id);assert.equal(events,2);storage.setItem=()=>{throw Error('full');};assert.throws(()=>store.save(spot));assert.equal(events,2);
});
