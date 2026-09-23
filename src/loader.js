/* Gzip in script envelopes works on Pages and direct file previews alike. */
window.SHROOMS_PACKED = {};
window.SHROOMS_LOAD = (() => {
  const pending = new Map();
  return function load(key) {
    if (pending.has(key)) return pending.get(key);
    const task = (async () => {
      if(window.SHROOMS_SERVICE&&await window.SHROOMS_SERVICE.ready){
        try{return await window.SHROOMS_SERVICE.request(`data/${key}?v=20260923c`);}catch(error){console.warn('Using bundled map data after API failure.');}
      }
      await new Promise((resolve,reject) => {
        const script=document.createElement('script');
        script.src=`./data/${key}.js?v=20260923c`;
        const timer=setTimeout(()=>{script.remove();reject(new Error(`Timed out loading ${key}`));},15000);
        script.onload=()=>{clearTimeout(timer);script.remove();resolve();};
        script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error(`Could not load ${key}`));};
        document.head.appendChild(script);
      });
      const encoded=window.SHROOMS_PACKED[key];
      if(!encoded)throw new Error(`Empty data: ${key}`);
      const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
      const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      const value=await new Response(stream).json();
      delete window.SHROOMS_PACKED[key];
      return value;
    })();
    pending.set(key,task);
    task.catch(()=>pending.delete(key));
    return task;
  };
})();
