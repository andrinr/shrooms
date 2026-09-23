/* Only attach forest geometry in the current view. Yield between small batches
   so high-resolution data never creates a single, canton-sized rendering task. */
(function(){
  function create({load,attach,detach,pause=()=>new Promise(resolve=>setTimeout(resolve,0)),batchSize=80}){
    const active=new Map();let generation=0;
    function cancel(){generation++;}
    async function update(keys,visible){
      const current=++generation,wanted=new Set(keys);
      for(const [id,item] of active)if(!wanted.has(item.key)||!visible(item.feature)){
        detach(item.layer);active.delete(id);
      }
      let next=0,failed=false;
      await Promise.all(Array.from({length:2},async()=>{
        while(next<keys.length&&current===generation){
          const key=keys[next++];let features;
          try{features=await load(key);}catch{failed=true;continue;}
          if(current!==generation)return;
          let count=0;
          for(const feature of features){
            if(current!==generation)return;
            if(visible(feature)&&!active.has(feature.properties.id)){
              active.set(feature.properties.id,{key,feature,layer:attach(feature)});
              if(++count%batchSize===0)await pause();
            }
          }
        }
      }));
      return {stale:current!==generation,failed,count:active.size};
    }
    return {update,cancel,size:()=>active.size};
  }
  window.SHROOMS_DETAIL_TILES={create};
})();
