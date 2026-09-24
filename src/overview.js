/* Real forest footprints on canvas tiles; no Leaflet object per overview cell. */
(function(){
  function inside(point,ring){let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
  const contains=(geometry,point)=>geometry.coordinates.some(poly=>inside(point,poly[0])&&!poly.slice(1).some(r=>inside(point,r)));
  function create(L,map,{manifest,load,onError=()=>{}}){
    let summaries=[],size,color=()=>'',click=()=>{},version='',generation=0;
    const members=new Map(),cache=new Map(),projected=new Map(),queue=[];let running=0;
    function drain(){while(running<3&&queue.length){const job=queue.shift();running++;job().finally(()=>{running--;drain();});}}
    function get(key){
      if(!cache.has(key)){
        const promise=new Promise((resolve,reject)=>{queue.push(async()=>{try{resolve(await load(key));}catch(e){cache.delete(key);reject(e);}});drain();});cache.set(key,promise);
        while(cache.size>48){const oldest=cache.keys().next().value;cache.delete(oldest);load.release?.(oldest);}
      }return cache.get(key);
    }
    function tilesAt(bounds){return manifest.tiles.filter(t=>t.bounds[0][0]<=bounds[1][0]&&t.bounds[1][0]>=bounds[0][0]&&t.bounds[0][1]<=bounds[1][1]&&t.bounds[1][1]>=bounds[0][1]);}
    function project(key,features,z){
      const id=`${key}:${z}`;if(projected.has(id))return projected.get(id);
      const values=features.map(f=>{let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
        const polygons=f.geometry.coordinates.map(poly=>poly.map(ring=>ring.map(([lon,lat])=>{const p=map.project([lat,lon],z);x0=Math.min(x0,p.x);y0=Math.min(y0,p.y);x1=Math.max(x1,p.x);y1=Math.max(y1,p.y);return [p.x,p.y];})));
        return {id:f.id,polygons,bounds:[x0,y0,x1,y1]};});
      projected.set(id,values);while(projected.size>24)projected.delete(projected.keys().next().value);return values;
    }
    const Tiles=L.GridLayer.extend({
      createTile(coords,done){
        const tile=document.createElement('canvas'),ratio=Math.min(window.devicePixelRatio||1,2),current=generation;
        tile.width=tile.height=256*ratio;const ctx=tile.getContext('2d');ctx.scale(ratio,ratio);
        const ox=coords.x*256,oy=coords.y*256,nw=map.unproject([ox-1,oy-1],coords.z),se=map.unproject([ox+257,oy+257],coords.z);
        Promise.all(tilesAt([[se.lat,nw.lng],[nw.lat,se.lng]]).map(async meta=>{
          const key=coords.z<=10?meta.coarseKey:meta.key;
          const features=await get(key);if(current!==generation)return;
          for(const f of project(key,features,coords.z)){
            const group=members.get(f.id);if(group===undefined)continue;
            const [x0,y0,x1,y1]=f.bounds;if(x1<ox-1||x0>ox+257||y1<oy-1||y0>oy+257)continue;
            ctx.fillStyle=ctx.strokeStyle=color(summaries[group]);ctx.globalAlpha=.83;
            ctx.beginPath();for(const poly of f.polygons)for(const ring of poly){ring.forEach(([x,y],i)=>i?ctx.lineTo(x-ox,y-oy):ctx.moveTo(x-ox,y-oy));ctx.closePath();}
            ctx.fill('evenodd');
            // A subpixel outline keeps narrow woodland legible in the national view.
            if(coords.z<=10){ctx.lineWidth=.65;ctx.lineJoin='round';ctx.stroke();}
          }
        })).then(()=>done(null,tile)).catch(error=>{if(current===generation)onError(error);done(null,tile);});
        return tile;
      },
      onAdd(map){L.GridLayer.prototype.onAdd.call(this,map);map.on('click',inspect);},
      onRemove(map){generation++;map.off('click',inspect);L.GridLayer.prototype.onRemove.call(this,map);}
    });
    async function inspect(event){
      const current=generation,point=[event.latlng.lng,event.latlng.lat];
      for(const meta of tilesAt([[point[1],point[0]],[point[1],point[0]]])){
        try{for(const f of await get(Math.round(map.getZoom())<=10?meta.coarseKey:meta.key)){if(current!==generation)return;const group=members.get(f.id);if(group!==undefined&&contains(f.geometry,point)){click(summaries[group],group);return;}}}catch(e){onError(e);}
      }
    }
    const layer=new Tiles({pane:'overviewHeat',tileSize:256,keepBuffer:1,updateWhenIdle:true,updateWhenZooming:false,noWrap:true});
    layer.setData=(items,meters,paint,onClick,key)=>{
      const changed=items!==summaries||meters!==size||key!==version;
      if(items!==summaries){members.clear();items.forEach((item,i)=>item.members.forEach(id=>members.set(id,i)));}
      summaries=items;size=meters;color=paint;click=onClick;version=key;
      if(changed){generation++;if(map.hasLayer(layer))layer.redraw();}
    };
    return layer;
  }
  window.SHROOMS_OVERVIEW={create,contains};
})();
