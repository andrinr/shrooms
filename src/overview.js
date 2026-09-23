/* Draw overview squares in canvas tiles, without a Leaflet layer per cell. */
(function(){
  const halfSize=(size,zoom)=>Math.min(size===1000?5:4.5,Math.max(1.3,5*2**(zoom-10)));
  function create(L,map){
    let summaries=[],size=1000,color=()=>'',click=()=>{},version='',projection=null;
    function project(zoom){
      if(projection?.zoom===zoom)return projection;
      const bins=new Map(),half=halfSize(size,zoom);
      summaries.forEach((summary,key)=>{
        const p=map.project([summary.lat,summary.lon],zoom),item={x:p.x,y:p.y,key,summary};
        // Include edge-crossing squares in both tiles so seams remain invisible.
        for(let x=Math.floor((p.x-half)/256);x<=Math.floor((p.x+half)/256);x++)
          for(let y=Math.floor((p.y-half)/256);y<=Math.floor((p.y+half)/256);y++){
            const id=`${x}:${y}`;if(!bins.has(id))bins.set(id,[]);bins.get(id).push(item);
          }
      });
      projection={zoom,bins,half};return projection;
    }
    const Tiles=L.GridLayer.extend({
      createTile(coords){
        const tile=document.createElement('canvas'),ratio=Math.min(window.devicePixelRatio||1,2);
        tile.width=tile.height=256*ratio;
        const ctx=tile.getContext('2d');ctx.scale(ratio,ratio);
        const {bins,half}=project(coords.z);
        ctx.globalAlpha=.78;
        for(const item of bins.get(`${coords.x}:${coords.y}`)||[]){
          ctx.fillStyle=color(item.summary);
          ctx.fillRect(item.x-coords.x*256-half,item.y-coords.y*256-half,2*half,2*half);
        }
        return tile;
      },
      onAdd(map){L.GridLayer.prototype.onAdd.call(this,map);map.on('click',inspect);},
      onRemove(map){map.off('click',inspect);L.GridLayer.prototype.onRemove.call(this,map);}
    });
    function inspect(event){
      const zoom=Math.round(map.getZoom()),p=map.project(event.latlng,zoom),{bins,half}=project(zoom);
      const candidates=bins.get(`${Math.floor(p.x/256)}:${Math.floor(p.y/256)}`)||[];
      // Last painted square wins, matching the previous canvas renderer.
      for(let i=candidates.length-1;i>=0;i--){const item=candidates[i];if(Math.abs(item.x-p.x)<=half&&Math.abs(item.y-p.y)<=half){click(item.summary,item.key);break;}}
    }
    const layer=new Tiles({pane:'overviewHeat',tileSize:256,keepBuffer:1,updateWhenIdle:true,updateWhenZooming:false,noWrap:true});
    layer.setData=(items,meters,paint,onClick,key)=>{
      const changed=items!==summaries||meters!==size||key!==version;
      if(items!==summaries||meters!==size)projection=null;
      summaries=items;size=meters;color=paint;click=onClick;version=key;
      if(changed&&map.hasLayer(layer))layer.redraw();
    };
    return layer;
  }
  window.SHROOMS_OVERVIEW={create,halfSize};
})();
