/* One Swiss map. Canton sources are storage boundaries, never navigation boundaries. */
(function(){
  const intersects=(a,b)=>a[0][0]<=b[1][0]&&a[1][0]>=b[0][0]&&a[0][1]<=b[1][1]&&a[1][1]>=b[0][1];
  function create(manifest,load){
    let generation=0;const cache=new Map();
    function cancel(){generation++;}
    async function view(bounds){
      const current=++generation,tiles=manifest.tiles.filter(t=>intersects(t.bounds,bounds));
      const features=[];let next=0,failed=false;
      await Promise.all(Array.from({length:2},async()=>{
        while(next<tiles.length&&generation===current){
          const tile=tiles[next++];
          try{
            if(!cache.has(tile.key)){const p=load(tile.key);cache.set(tile.key,p);p.catch(()=>cache.delete(tile.key));}
            const data=await cache.get(tile.key);
            if(generation!==current)return;
            for(const feature of data){const c=feature.properties,margin=c.cellSizeMeters/70000;
              if(c.lat>=bounds[0][0]-margin&&c.lat<=bounds[1][0]+margin&&c.lon>=bounds[0][1]-margin&&c.lon<=bounds[1][1]+margin)features.push(feature);
            }
          }catch{failed=true;}
        }
      }));
      const wanted=new Set(tiles.map(t=>t.key));
      for(const key of cache.keys())if(cache.size>40&&!wanted.has(key)){cache.delete(key);load.release?.(key);}
      return {stale:current!==generation,features,failed};
    }
    return {view,cancel};
  }
  window.SHROOMS_HABITAT={create,intersects};
})();
