const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function runtime({search='',saved=null,languages=['en-GB'],blocked=false}={}){
 const context={window:{},location:{search},navigator:{languages},URLSearchParams,Intl,Date,localStorage:{getItem(){if(blocked)throw Error('blocked');return saved;}}};
 vm.createContext(context);for(const file of ['locales','i18n'])vm.runInContext(fs.readFileSync(`src/${file}.js`,'utf8'),context);
 return {api:context.window.SHROOMS_I18N,rows:context.window.SHROOMS_MESSAGES};
}
test('all five languages have complete catalogs with matching placeholders',()=>{
 const {rows}=runtime(),keys=new Set(),tokens=s=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
 assert.ok(rows.length>200);
 for(const row of rows){assert.equal(row.length,5,row[0]);assert.ok(!keys.has(row[0]),`duplicate ${row[0]}`);keys.add(row[0]);for(const translation of row){assert.ok(translation.trim());assert.deepEqual(tokens(translation),tokens(row[0]),row[0]);}}
});
test('language selection honors links, preference, browser and safe fallback',()=>{
 assert.equal(runtime({search:'?lang=it',saved:'de',languages:['fr-CH']}).api.lang,'it');
 assert.equal(runtime({saved:'rm',languages:['fr-CH']}).api.lang,'rm');
 assert.equal(runtime({search:'?lang=bad',saved:'bad',languages:['de-CH']}).api.lang,'de');
 assert.equal(runtime({blocked:true,languages:['xx']}).api.lang,'en');
});
test('dynamic habitat, protection, species and account messages translate without changing values',()=>{
 for(const lang of ['de','fr','it','rm']){
  const {api}=runtime({search:`?lang=${lang}`});
  for(const source of ['My spots','Recovery code','Delete this saved spot?','Porcini','COLLECTING MAY BE FORBIDDEN','Some forest tiles could not load. Pan the map to retry.'])assert.notEqual(api.t(source),source,`${lang}: ${source}`);
  const details=api.t('Conifer forest · 12° slope');assert.ok(details.includes('12'));assert.doesNotMatch(details,/Conifer forest|slope/);
  assert.equal(api.t('0.9° median slope · NE aspect'),api.t('0.9° median slope')+' · '+api.t('NE aspect'));
  const caption=api.t('Offline basemap · 1 km overview · zoom for 50 m detail');assert.ok(caption.includes('50'));assert.doesNotMatch(caption,/Offline basemap|overview|detail$/);
  const reserve=api.t('594 mapped areas · collecting may be forbidden in hatched areas');assert.ok(reserve.includes('594'));assert.doesNotMatch(reserve,/mapped areas/);
  assert.equal(api.t('Boletus edulis'),'Boletus edulis');assert.equal(api.t('Wädenswil'),'Wädenswil');
 }
});

test('Romansh months do not fall back to English when browser locale data is absent',()=>{
 const {api}=runtime({search:'?lang=rm'});
 assert.equal(api.date(new Date('2026-09-23T12:00:00Z'),{day:'numeric',month:'short',year:'numeric'}),'23 sett. 2026');
 assert.equal(api.date(new Date('2026-07-15T12:00:00Z'),{month:'short'}),'fan.');
});
