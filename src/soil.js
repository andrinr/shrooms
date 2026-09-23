/* Native WSL raster lookup: no interpolation, extrapolation or score weighting. */
(function(){
  function address(meta,x,y){
    const col=Math.floor((x-meta.origin[0])/meta.resolutionMeters);
    const row=Math.floor((meta.origin[1]-y)/meta.resolutionMeters);
    if(!Number.isFinite(col)||!Number.isFinite(row)||col<0||row<0||col>=meta.width||row>=meta.height)return null;
    const size=meta.tileSize;
    return {key:`soil/tiles/${Math.floor(row/size)}-${Math.floor(col/size)}`,offset:((row%size)*size+col%size)*3};
  }
  function decode(meta,bytes,offset){
    if(bytes[offset]===meta.noData||bytes[offset]===undefined)return null;
    const value=i=>bytes[offset+i]===meta.noData?null:bytes[offset+i]/meta.scale;
    return {ph:value(0),lower:value(1),upper:value(2)};
  }
  function create(load){
    let metadata;const cache=new Map();
    return async function lookup(x,y){
      if(!metadata){try{metadata=await load('soil/index');}catch{return {status:'error'};}}
      const at=address(metadata,x,y);
      if(!at||!metadata.tiles.includes(at.key))return {status:'missing'};
      try{
        if(!cache.has(at.key)){
          const pending=load(at.key).then(tile=>Uint8Array.from(atob(tile.values),c=>c.charCodeAt(0)));
          cache.set(at.key,pending);
          pending.catch(()=>cache.delete(at.key));
        }
        const bytes=await cache.get(at.key);
        // Only a small number of 192 KiB decoded tiles need to remain resident.
        while(cache.size>8){const key=cache.keys().next().value;cache.delete(key);load.release?.(key);}
        const value=decode(metadata,bytes,at.offset);
        return value?{status:'ready',...value}:{status:'missing'};
      }catch{return {status:'error'};}
    };
  }
  window.SHROOMS_SOIL={address,decode,create};
})();
