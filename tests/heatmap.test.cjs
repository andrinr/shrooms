const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync('src/heatmap.js','utf8'),context);
const scale=context.window.SHROOMS_HEAT_SCALE;
test('clustered scores get contrast without outliers dominating',()=>{
 const values=[0,...Array.from({length:100},(_,i)=>60+i/5),100];
 const s=scale(values);
 assert.ok(s.low>=60&&s.high<80);
 assert.ok(s.normalize(78)-s.normalize(63)>70);
 assert.equal(s.normalize(0),0);assert.equal(s.normalize(100),100);
 for(let i=1;i<=100;i++)assert.ok(s.normalize(i)>=s.normalize(i-1));
});
test('equal and nearly equal scores are not stretched into false extremes',()=>{
 const same=scale([70,70,70]);assert.equal(same.normalize(70),50);
 const close=scale([70,71]);assert.equal(close.high-close.low,10);
 assert.ok(Math.abs(close.normalize(71)-close.normalize(70)-10)<1e-9);
 const empty=scale([]);assert.equal(empty.normalize(50),50);
});
