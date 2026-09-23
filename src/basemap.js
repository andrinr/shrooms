/* Nationwide, on-demand swisstopo tiles. No tile proxy, bulk download or API key. */
(function(){
  const root='https://wmts.geo.admin.ch/1.0.0/';
  const definitions=[
    ['ch.swisstopo.pixelkarte-grau','jpeg','swissBase',210],
    ['ch.swisstopo.pixelkarte-grau','jpeg','swissInk',430]
  ];
  function mount(L,map,onChange){
    let online=false,orientation=true,layers=[];
    for(const [, ,name,z] of definitions){const pane=map.createPane(name);pane.style.zIndex=z;pane.style.pointerEvents='none';if(name==='swissInk'){pane.style.mixBlendMode='multiply';pane.style.opacity='.85';}}
    function remove(){for(const layer of layers)map.removeLayer(layer);layers=[];}
    function mode(enabled){
      remove();online=enabled;
      onChange(online,false);
      if(!online)return;
      layers=definitions.map(([id,ext,pane])=>L.tileLayer(`${root}${id}/default/current/3857/{z}/{x}/{y}.${ext}`,{
        pane,minZoom:6,maxZoom:16,maxNativeZoom:16,bounds:[[45.398181,5.140242],[48.230651,11.47757]],
        noWrap:true,updateWhenIdle:true,updateWhenZooming:false,keepBuffer:1,
        attribution:'© <a href="https://www.swisstopo.admin.ch/">swisstopo</a>',
        errorTileUrl:'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='
      }));
      for(const layer of layers)layer.on('tileerror',()=>{
        if(!online||!layers.includes(layer))return;
        remove();online=false;onChange(false,true);
      });
      layers[0].addTo(map);
      if(orientation)layers[1].addTo(map);
    }
    function overlays(enabled){orientation=enabled;if(online)for(const layer of layers.slice(1))enabled?layer.addTo(map):map.removeLayer(layer);}
    return {mode,overlays};
  }
  window.SHROOMS_BASEMAP_TILES={mount};
})();
