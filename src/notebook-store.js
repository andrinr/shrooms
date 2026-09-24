/* Browser-only notebook. Writes are atomic; failed writes never discard the prior data. */
(function(root){
 const key='shrooms-spots-v1',limit=500;
 function validate(s){
  if(!s||typeof s.name!=='string'||!s.name.trim()||s.name.length>100||typeof s.notes!=='string'||s.notes.length>2000||!Number.isFinite(s.lat)||!Number.isFinite(s.lon)||Math.abs(s.lat)>90||Math.abs(s.lon)>180||typeof s.species!=='string'||s.species.length>100||typeof s.cellId!=='string'||s.cellId.length>200)throw Error('Invalid notebook file.');
  return {id:typeof s.id==='string'&&/^[\w-]{1,80}$/.test(s.id)?s.id:crypto.randomUUID(),name:s.name.trim(),notes:s.notes,lat:s.lat,lon:s.lon,species:s.species,cellId:s.cellId};
 }
 function create(storage){
  function read(){const raw=storage.getItem(key);if(!raw)return [];const data=JSON.parse(raw);if(data.version!==1||!Array.isArray(data.spots)||data.spots.length>limit)throw Error('Invalid notebook file.');return data.spots.map(validate);}
  function write(spots){if(spots.length>limit)throw Error('Your notebook can hold up to 500 spots.');storage.setItem(key,JSON.stringify({version:1,spots}));if(typeof root.dispatchEvent==='function')root.dispatchEvent(new Event('shrooms:notebook-change'));return spots;}
  return {read,save(spot){const s=validate(spot),spots=read(),i=spots.findIndex(v=>v.id===s.id);if(i<0)spots.unshift(s);else spots[i]=s;write(spots);return s;},remove(id){return write(read().filter(s=>s.id!==id));},import(text){if(text.length>2000000)throw Error('Invalid notebook file.');const data=JSON.parse(text);if((data.version!==undefined&&data.version!==1)||!Array.isArray(data.spots)||data.spots.length>limit)throw Error('Invalid notebook file.');const incoming=data.spots.map(validate),spots=read();for(const s of incoming){if(spots.some(v=>v.lat===s.lat&&v.lon===s.lon&&v.species===s.species&&v.name===s.name&&v.notes===s.notes))continue;if(spots.some(v=>v.id===s.id))s.id=crypto.randomUUID();spots.push(s);}return write(spots);},export(){return JSON.stringify({version:1,exported:new Date().toISOString(),spots:read()},null,2);}};
 }
 const api={create,key};if(typeof module!=='undefined')module.exports=api;else root.SHROOMS_NOTEBOOK=api;
})(globalThis);
