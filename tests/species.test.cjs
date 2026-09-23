const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {validateSpecies,loadProfiles}=require('../scripts/check_species.cjs');
const {SHROOMS_SPECIES:species,SHROOMS_MESSAGES:messages}=loadProfiles();
test('every species has supported indicators, ecological sources and all translations',()=>{
 assert.ok(Object.keys(species).length>=11);assert.deepEqual(validateSpecies(species,messages),[]);
});
test('contributor mistakes cannot silently produce a nonfunctional indicator',()=>{
 for(const changes of [{months:[0,13]},{temp:[20,5]},{canopy:'dense'},{requiredTree:'birch'},{soilPH:[4,6]},{sources:[]},{sources:[{title:'Bad link',url:'javascript:alert(1)'}]},{note:'An untranslated note'}]){
  assert.ok(validateSpecies({example:{...species.slippery,...changes}},messages).length>0,JSON.stringify(changes));
 }
});
test('spruce and pine specialists respond to their own mapped host and omit unknown hosts',()=>{
 const context={window:{},Intl,Date};vm.createContext(context);vm.runInContext(fs.readFileSync('src/scoring.js','utf8'),context);const score=context.window.SHROOMS_SCORE.score;
 const cell={forest:100,treeKnown:1,conifer:100,broadleaf:0,canopy:85,canopyKnown:1,slope:5,aspect:0},date=new Date('2026-09-23T12:00:00Z');
 const spruce={...cell,spruce:100,pine:0},pine={...cell,spruce:0,pine:100};
 assert.ok(score(spruce,species.spruce_milkcap,null,date).value>score(pine,species.spruce_milkcap,null,date).value);
 assert.ok(score(pine,species.slippery,null,date).value>score(spruce,species.slippery,null,date).value);
 for(const profile of [species.spruce_milkcap,species.slippery])assert.equal(score(cell,profile,null,date).factors.tree.value,null);
});
