const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync('src/adaptive.js','utf8'),context);
const adaptive=context.window.SHROOMS_ADAPTIVE;
test('zoom levels move from canton overview to the original fine cells',()=>{
 assert.equal(adaptive.resolution(8),1000);assert.equal(adaptive.resolution(10),1000);
 assert.equal(adaptive.resolution(11),500);assert.equal(adaptive.resolution(12),500);assert.equal(adaptive.resolution(13),500);assert.equal(adaptive.resolution(14),100);
});
test('overview groups preserve all cells and weight scores by actual forest area',()=>{
 const cells=[{id:'0-0',area:1,lat:47,lon:8,treeKnown:1,conifer:100,broadleaf:0},{id:'2-2',area:.25,lat:48,lon:9,treeKnown:1,conifer:0,broadleaf:100},{id:'20-0',area:1,lat:49,lon:9,treeKnown:1,conifer:50,broadleaf:50}];
 const groups=adaptive.group(cells,1000);assert.equal(groups.length,2);assert.equal(groups.flat().length,cells.length);
 const scores=new Map([['0-0',{value:80}],['2-2',{value:20}],['20-0',{value:50}]]);
 const summary=adaptive.summarize(groups[0],scores);assert.equal(summary.value,68);assert.equal(summary.conifer,80);assert.equal(summary.count,2);
 scores.set('0-0',{value:30});assert.equal(adaptive.summarize(groups[0],scores).value,28);
});
test('summary factors weight forest area and omit missing values rather than treating them as zero',()=>{
 const cells=[{id:'a',area:3},{id:'b',area:1}];
 const keys=['tree','canopy','moisture','temperature','terrain','season'];
 const scores=new Map([['a',{factors:Object.fromEntries(keys.map(k=>[k,{value:k==='moisture'?null:.8}]))}],['b',{factors:Object.fromEntries(keys.map(k=>[k,{value:k==='moisture'?null:.4}]))}]]);
 const result=adaptive.factors(cells,scores);assert.ok(Math.abs(result.tree-.7)<1e-10);assert.equal(result.moisture,null);
 scores.get('b').factors.tree.value=null;assert.ok(Math.abs(adaptive.factors(cells,scores).tree-.8)<1e-10);
});
