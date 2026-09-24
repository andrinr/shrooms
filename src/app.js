(async function () {
  const $=id=>document.getElementById(id);
  const locale=window.SHROOMS_I18N?.locale||'en-GB';
  const catalog=await window.SHROOMS_LOAD('regions');
  const requested=new URLSearchParams(location.search).get('region')||'ch';
  const region=catalog.regions.find(r=>r.id==='ch');
  const manifest=await window.SHROOMS_LOAD('habitat/index');
  const habitat=window.SHROOMS_HABITAT.create(manifest,window.SHROOMS_LOAD);
  window.SHROOMS_REGION='ch';window.SHROOMS_SEAMLESS=true;
  $('region').innerHTML=catalog.regions.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
  $('region').value=requested;
  $('region').addEventListener('change',()=>{
    const target=manifest.regions.find(r=>r.id===$('region').value);
    state.map.fitBounds(target?target.bounds:basemap.bounds,{padding:[20,20]});
    const url=new URL(location.href);url.searchParams.set('region',$('region').value);history.replaceState(null,'',url);
  });
  let data;
  try { data=await window.SHROOMS_LOAD(region.index); } catch(error) { $('map').textContent='Forest data could not load. Please reload using a current browser.'; console.error(error); return; }
  const species=window.SHROOMS_SPECIES;
  if (!data) { $('map').textContent='The forest dataset could not load. Reload the page to try again.'; return; }
  const baseCells=data.cells;
  let cells=baseCells,localFeatures=new Map();
  const national=true;
  const basemap=national?await window.SHROOMS_LOAD('switzerland-map'):window.SHROOMS_BASEMAP;
  const byId=new Map(cells.map(c=>[c.id,{type:"Feature",properties:c}]));
  let detailTiles;
  const soilLookup=window.SHROOMS_SOIL.create(window.SHROOMS_LOAD);
  let soilCell=null,soilResult={status:"loading"};
  const overviewGroups=new Map([500,1000].map(size=>[size,window.SHROOMS_ADAPTIVE.group(cells,size)]));
  const state={species:'porcini',selected:null,map:null,layer:null,selection:null,mode:'heat',weather:new Map(),scores:new Map(),status:'loading',search:'',updated:null};
  let rankedCells=[],baseRankedCells=[];
  const overviewSummaries=new Map();
  function invalidateOverview(){overviewSummaries.clear();}
  const today=new Date();
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zurich',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(today).map(p=>[p.type,p.value]));
  const todayKey=`${parts.year}-${parts.month}-${parts.day}`;
  const known=v=>typeof v==='number'&&Number.isFinite(v);
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=(v,suffix='',digits=0)=>known(v)?`${new Intl.NumberFormat(locale,{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(v)}${suffix}`:'Not available';
  const treeName=c=>c.treeKnown<.5?'Tree mix unavailable':c.conifer>=75?'Conifer forest':c.broadleaf>=75?'Broadleaf forest':'Mixed forest';
  const treeColor=c=>c.treeKnown<.5?'#a79baa':c.conifer>=75?'#8064c0':c.broadleaf>=75?'#63bc9b':'#d3d781';
  const scored=c=>state.scores.get(c.id);
  const label=v=>v>=70?'Stronger habitat signal':v>=45?'Moderate habitat signal':'Lower habitat signal';
  $('date-pill').textContent=window.SHROOMS_I18N.date(today,{timeZone:'Europe/Zurich',day:'numeric',month:'short',year:'numeric'}).toUpperCase();
  if(region.id==='zh'){
  $('collecting-title').textContent=Number(parts.day)<=10?'Closed season today':'Collect with care today';
  $('collecting-copy').textContent=Number(parts.day)<=10?'No mushroom collecting from the 1st through the 10th of each month in Zürich canton. You can still explore and observe.':'Maximum 1 kg per person per day. Collecting is prohibited in nature reserves; always check the rules at your location.';
  }else{$('collecting-title').textContent='Check local collecting rules';$('collecting-copy').textContent='Rules differ across Switzerland. Check cantonal, municipal and protected-area restrictions. This habitat score does not establish collection permission.';}
  $('dataset-count').textContent=manifest.tiles.reduce((sum,tile)=>sum+tile.count,0).toLocaleString(locale);

  let interpolatedSource;
  const cellWeather=new Map();
  let heatScale=window.SHROOMS_HEAT_SCALE([]);
  const scoreColor=value=>window.SHROOMS_COLOR(heatScale.normalize(value));
  function recompute() {
    state.map?.closePopup();
    if(interpolatedSource!==state.weather){
      cellWeather.clear();
      if(state.weather.size)for(const c of [...baseCells,...(cells===baseCells?[]:cells)])cellWeather.set(c.id,window.SHROOMS_WEATHER.interpolate(c,data.weatherPoints,state.weather));
      interpolatedSource=state.weather;
    }
    [...baseCells,...(cells===baseCells?[]:cells)].forEach(c=>state.scores.set(c.id,window.SHROOMS_SCORE.score(c,species[state.species],cellWeather.get(c.id),today)));
    if(state.selected&&!cells.some(c=>c.id===state.selected)){const c=byId.get(state.selected)?.properties;if(c)state.scores.set(c.id,window.SHROOMS_SCORE.score(c,species[state.species],cellWeather.get(c.id),today));}
    baseRankedCells=[...baseCells].sort((a,b)=>scored(b).value-scored(a).value);
    rankedCells=cells===baseCells?baseRankedCells:[...cells].sort((a,b)=>scored(b).value-scored(a).value);
    invalidateOverview();
    heatScale=window.SHROOMS_HEAT_SCALE([...state.scores.values()].map(s=>s.value));
    $('heat-low').textContent=`≤ ${heatScale.low} / 100`;
    $('heat-high').textContent=`≥ ${heatScale.high} / 100`;
    if (!state.selected) state.selected=rankedCells[0].id;
    state.layer?.setStyle(feature=>cellStyle(feature));
    updateResolution();render();
  }
  function cellStyle(feature) {
    return {stroke:false,fillColor:state.mode==='heat'?scoreColor(scored(feature.properties).value):treeColor(feature.properties),fillOpacity:state.mode==='heat'?.35+.6*heatScale.normalize(scored(feature.properties).value)/100:.68};
  }
  async function select(id,fly=true) {
    state.selected=id;
    const feature=byId.get(id), c=feature.properties;
    soilCell=id;soilResult={status:'loading'};
    soilLookup(c.x,c.y).then(result=>{if(soilCell===id){soilResult=result;renderDetail();}});
    renderDetail();renderList();
    window.dispatchEvent(new CustomEvent('shrooms:selection',{detail:{...c,id:c.sourceId||c.id,species:state.species,region:c.sourceId?c.region:'ch'}}));
    if(fly&&state.map)state.map.flyTo([c.lat,c.lon],13,{duration:.6});
    try { await loadTile(c.tile); } catch { return; }
    if(state.selected!==id)return;
    if(state.map){
      if(state.selection)state.map.removeLayer(state.selection);
      state.selection=L.geoJSON(feature,{interactive:false,style:{color:'#422149',weight:3,fillColor:'#fff',fillOpacity:.12}}).addTo(state.map);

    }
    renderDetail();renderList();
  }
  function renderList() {
    const query=state.search.toLocaleLowerCase();
    const bounds=state.map?.getBounds();
    const south=bounds?.getSouth(),north=bounds?.getNorth(),west=bounds?.getWest(),east=bounds?.getEast();
    const visible=(query?baseRankedCells:rankedCells).filter(c=>query?c.name.toLocaleLowerCase().includes(query):!bounds||(c.lat>=south&&c.lat<=north&&c.lon>=west&&c.lon<=east));
    const picks=[];
    for(const cell of visible){
      if(picks.every(p=>Math.hypot(p.x-cell.x,p.y-cell.y)>=1600))picks.push(cell);
      if(picks.length===12)break;
    }
    $('result-count').textContent=`${visible.length.toLocaleString(locale)} CELLS`;
    $('site-list').innerHTML=picks.length?picks.map(c=>`<button class="site-row ${c.id===state.selected?'active':''}" data-cell="${c.id}" type="button"><span class="site-icon">✳</span><span class="site-name"><strong>${escape(c.name)}</strong><small>${treeName(c)} · ${number(c.slope,'° slope')}</small></span><span class="site-score" style="--score-color:${scoreColor(scored(c).value)}">${scored(c).value}</span></button>`).join(''):'<p class="empty-list">No mapped forest cells here. Pan the map, clear the search, or choose “Whole canton”.</p>';
    $('site-list').querySelectorAll('[data-cell]').forEach(btn=>btn.addEventListener('click',()=>select(btn.dataset.cell)));
  }
  function factor(title,detail,factor) {
    const value=factor.value;
    return `<div class="factor"><div class="factor-label"><span>${title}<small>${detail}</small></span><strong>${known(value)?Math.round(value*100)+'/100':'—'}</strong></div><div class="factor-track"><i style="width:${known(value)?value*100:0}%"></i></div></div>`;
  }
  function soilDetail(){
    const t=window.SHROOMS_I18N.t;
    const result=soilResult;
    let text=t(result.status==='loading'?'Loading soil prediction…':result.status==='error'?'Soil data could not load. Select the cell to retry.':'No soil prediction at this cell centre.');
    if(result.status==='ready')text=`pH (CaCl₂): ${number(result.ph,'',1)}<br>${escape(t('90% prediction interval'))}: ${number(result.lower,'',1)}–${number(result.upper,'',1)}`;
    return `<div class="detail-note"><span>${escape(t('SOIL ACIDITY'))}</span><p>${text}</p><small>${escape(t('Predicted topsoil pH (0–5 cm), sampled at the cell centre from a 25 m grid. Not a local measurement or an input to the habitat score.'))}</small><p><a href="https://doi.org/10.16904/envidat.484" target="_blank" rel="noopener noreferrer">WSL / EnviDat (2024)</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a></p></div>`;
  }
  function renderDetail() {
    const c=byId.get(state.selected).properties, result=scored(c), w=cellWeather.get(c.id), s=species[state.species];
    const gridSize=c.cellSizeMeters||data.metadata.cellSizeMeters;
    const aspect=known(c.aspect)?['N','NE','E','SE','S','SW','W','NW'][Math.round(c.aspect/45)%8]:'unknown';
    const sunCopy=w?`${number(w.sunHours7,' h sunshine / 7 days',1)} · ${number(w.et014,' mm reference evaporation / 14 days',1)}`:'Sunshine and drying data unavailable';
    const weatherCopy=w?`${number(w.rain14,' mm',1)} / 14 days · ${number(w.humidity,'% RH')} · ${number(w.soil,' m³/m³',2)} soil water`:'Weather unavailable; this factor is omitted.';
    $('detail').innerHTML=`<div class="detail-kicker">FOREST CELL <span>${c.id}</span></div><div class="detail-title"><h3>${escape(c.name)}</h3><p>${escape(c.district)} · ${number(c.elevation,' m')} · ${number(c.area,'',c.area%1?2:0)} ha mapped forest</p></div><div class="score-panel"><div class="score-ring" style="--value:${result.value};--ring-color:${scoreColor(result.value)}"><span>${result.value}<small>/ 100</small></span></div><div><small>MODELED SUITABILITY</small><strong>${label(result.value)}</strong><p>${s.name} · ${result.live?'weather included':'habitat & terrain only'}</p></div></div>${c.reservePercent==null?`<div class="detail-note"><span>CHECK LOCAL PROTECTION RULES</span><p>Protection coverage is incomplete. Collecting may be forbidden in mapped areas and elsewhere. Check local rules before collecting.</p></div>`:c.reservePercent>0?`<div class="detail-note"><span>COLLECTING MAY BE FORBIDDEN</span><p>This cell overlaps a mapped forest reserve. Check the official rules before collecting; the score describes habitat suitability only.</p></div>`:""}<div class="factor-heading">WHAT DRIVES IT? <span>${Object.values(result.factors).filter(f=>known(f.value)).length} / 6 FACTORS</span></div>${factor(s.host?'Tree partners':'Forest edge proxy',s.requiredTree?`${number(c[s.requiredTree],'% '+s.requiredTree)} · mapped host tree`:s.host?(c.treeKnown<.5?'Tree mix unavailable':`${number(c.broadleaf,'% broadleaf')} · ${number(c.conifer,'% conifer')}`):`${c.forest}% forest coverage in this ${gridSize} m cell`,result.factors.tree)}${factor('Canopy & forest coverage',`${number(c.canopy,'% canopy')} · ${c.forest}% of ${gridSize} m cell is forest`,result.factors.canopy)}${factor('Moisture',weatherCopy,result.factors.moisture)}${factor('Temperature',w?number(w.temp7,'°C · past 7 days',1):'Weather unavailable',result.factors.temperature)}${factor('Slope & aspect',`${number(c.slope,'° median slope',1)} · ${aspect} aspect`,result.factors.terrain)}${factor('Season',s.months.map(m=>window.SHROOMS_I18N.date(new Date(2024,m-1),{month:'short'})).join(' · '),result.factors.season)}<div class="detail-note"><span>SUN & DRYING</span><p>${sunCopy}</p><small>Weather inputs blend regional anchors; they are not local forest measurements. Sunshine is not light reaching the forest floor. Reference evaporation modestly reduces the rainfall contribution; canopy and aspect already represent shelter.</small></div>${soilDetail()}<div class="detail-note"><span>TRACEABLE TO THE SOURCE</span><p>Forest source ${escape(c.forestSource||(c.yearMin===c.yearMax?c.yearMin:`${c.yearMin}–${c.yearMax}`))} · terrain ${c.terrainResolutionMeters||data.metadata.terrainResolutionMeters} m. Cell ${c.id}, ${c.lat.toFixed(4)}° N, ${c.lon.toFixed(4)}° E.</p><small>${gridSize} m score · ${c.maskResolutionMeters||data.metadata.maskResolutionMeters} m forest mask. This is a habitat estimate, not a sighting or collection permission.</small></div><a class="directions" href="https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lon}#map=15/${c.lat}/${c.lon}" target="_blank" rel="noopener noreferrer">Explore this forest <span>↗</span></a>`;
  }
  function render() {
    $('species-evidence').innerHTML=`<summary>Ecology & limits</summary><p>Ecological sources support habitat descriptions. Numerical settings remain provisional.</p><strong>Not modeled</strong><ul>${species[state.species].unmapped.map(item=>`<li>${escape(item)}</li>`).join('')}</ul>${species[state.species].sources.map(source=>`<a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.title)} ↗</a>`).join('<br>')}`;
    $('species-latin').textContent=`${species[state.species].latin} · ${species[state.species].note}`;
    $('map-status').textContent=state.status==='loading'?'Loading weather…':state.status==='snapshot'?`Weather snapshot · ${state.weatherDay}`:state.status==='live'?`Weather refreshed · ${todayKey}`:state.status==='cached'?'Recent weather · cached':state.status==='partial'?'Partial weather coverage':'Habitat & terrain only';
    document.querySelector('.overlay-dot').classList.toggle('offline',state.status==='offline'||state.status==='partial');
    renderList();renderDetail();
  }
  function mapMode(mode) {
    state.map?.closePopup();state.mode=mode;invalidateOverview();
    $('legend-title').textContent=mode==='heat'?'HABITAT SIGNAL':'FOREST TYPE';
    $('heatmap-mode').setAttribute('aria-pressed',String(mode==='heat'));
    $('points-mode').setAttribute('aria-pressed',String(mode==='forest'));
    $('map-legend').classList.toggle('heat-active',mode==='heat');
    state.layer?.setStyle(cellStyle);updateResolution();
  }
  function initMap() {
    if(!window.L){$('map').innerHTML='<div class="map-error">The map could not load. Reload to try again.</div>';return;}
    state.map=L.map('map',{zoomControl:false,preferCanvas:true,zoomSnap:.25,zoomDelta:.5}).setView([47.43,8.65],10);
    const base=basemap;
    if(base){
      state.map.createPane('offlineBase').style.zIndex=190;
      L.imageOverlay(national?'./data/switzerland.svg':'./data/basemap.svg',base.bounds,{pane:'offlineBase',interactive:false,attribution:national?'© swisstopo; FOEN / WSL NFI':'Basemap, forest & terrain: <a href="https://geolion.zh.ch/geodatensatz/347">GIS-ZH</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'}).addTo(state.map);
      state.map.createPane('placeLabels');
      state.map.getPane('placeLabels').style.pointerEvents='none';
      const labels=L.layerGroup().addTo(state.map);
      const updateLabels=()=>{
        labels.clearLayers();
        if(state.onlineMap)return;
        const occupied=[];
        base.labels.filter(p=>p.minZoom<=state.map.getZoom()&&state.map.getBounds().contains([p.lat,p.lon])).forEach(p=>{
          const point=state.map.latLngToContainerPoint([p.lat,p.lon]);
          const width=Math.min(170,p.name.length*6+14),height=24;
          const box={x:point.x-width/2,y:point.y-height/2,width,height};
          if(occupied.some(b=>box.x<b.x+b.width&&box.x+box.width>b.x&&box.y<b.y+b.height&&box.y+box.height>b.y))return;
          occupied.push(box);
          L.marker([p.lat,p.lon],{pane:'placeLabels',interactive:false,keyboard:false,icon:L.divIcon({className:`place-label place-${p.kind}`,html:`<span>${escape(p.name)}</span>`,iconSize:[0,0]})}).addTo(labels);
        });
      };
      state.updateLabels=updateLabels;
      state.map.on('moveend',updateLabels);updateLabels();
      state.map.setMaxBounds(L.latLngBounds(base.bounds).pad(.15));
      state.map.setMinZoom(6);state.map.setMaxZoom(16);
    }

    L.control.zoom({position:'bottomright'}).addTo(state.map);
    state.layer=L.featureGroup().addTo(state.map);
    detailTiles=window.SHROOMS_DETAIL_TILES.create({
      load:loadTile,
      attach(feature){
        const layer=L.geoJSON(feature,{style:cellStyle,onEachFeature(f,path){
          path.on('click',()=>select(f.properties.id,false));
          path.bindTooltip(()=>`${escape(f.properties.name)} · ${scored(f.properties).value}/100<br>${treeName(f.properties)} · click to inspect`,{sticky:true});
        }});
        state.layer.addLayer(layer);return layer;
      },
      detach:layer=>state.layer.removeLayer(layer)
    });
    const bounds=L.latLngBounds(data.tiles.flatMap(t=>t.bounds));
    const all=()=>state.map.fitBounds(bounds,{padding:[20,20]});
    $('reset-view').addEventListener('click',()=>{state.search='';$('place-search').value='';$('region').value='ch';all();});
    let locationLayers=null;
    const locateButton=$('locate-me'),locationStatus=$('location-status'),clearLocation=$('clear-location');
    locateButton.disabled=false;
    clearLocation.addEventListener('click',()=>{
      locationLayers?.remove();locationLayers=null;clearLocation.hidden=true;
      locationStatus.textContent='Your position stays in this tab.';
    });
    locateButton.addEventListener('click',()=>{
      if(!window.isSecureContext||!navigator.geolocation){
        locationStatus.textContent='Location needs HTTPS or localhost and a supported browser.';return;
      }
      locateButton.disabled=true;locationStatus.textContent='Finding your location…';
      navigator.geolocation.getCurrentPosition(position=>{
        locateButton.disabled=false;
        const {latitude,longitude,accuracy}=position.coords;
        const point=L.latLng(latitude,longitude);
        if(!base||!L.latLngBounds(base.bounds).contains(point)){
          locationStatus.textContent=region.id==='zh'?'Outside this map. Choose Switzerland or your canton, then try again.':'Your location is outside the Swiss map coverage.';
          return;
        }
        locationLayers?.remove();
        locationLayers=L.layerGroup().addTo(state.map);
        const uncertainty=L.circle(point,{radius:accuracy,color:'#2878c7',weight:1,fillOpacity:.08,interactive:false}).addTo(locationLayers);
        L.circleMarker(point,{radius:7,color:'#fff',weight:3,fillColor:'#2878c7',fillOpacity:1})
          .bindTooltip(window.SHROOMS_I18N.t('Your location')).addTo(locationLayers);
        clearLocation.hidden=false;
        state.search='';$('place-search').value='';
        state.map.fitBounds(uncertainty.getBounds(),{padding:[35,35],maxZoom:14});
        locationStatus.textContent=window.SHROOMS_I18N.t('Location accuracy: about {distance} m.').replace('{distance}',number(Math.ceil(accuracy)));
      },error=>{
        locateButton.disabled=false;
        locationStatus.textContent=error.code===1?'Location permission denied. Allow it in your browser to try again.':error.code===3?'Location timed out. Please try again.':'Location unavailable. Please try again.';
      },{enableHighAccuracy:true,timeout:15000,maximumAge:30000});
    });
    const overviewPane=state.map.createPane('overviewHeat');
    overviewPane.style.zIndex=410;
    overviewPane.style.pointerEvents='none';
    state.overview=window.SHROOMS_OVERVIEW.create(L,state.map);
    let viewTimer;
    state.map.on('movestart',()=>{clearTimeout(viewTimer);detailTiles.cancel();habitat.cancel();});
    state.map.on('moveend',()=>{clearTimeout(viewTimer);viewTimer=setTimeout(()=>{updateResolution();renderList();renderDetail();loadVisibleTiles();},100);});const initial=manifest.regions.find(r=>r.id===requested);if(initial)state.map.fitBounds(initial.bounds,{padding:[20,20]});else all();updateResolution();loadVisibleTiles();select(state.selected,false);
    const tiledMap=window.SHROOMS_BASEMAP_TILES.mount(L,state.map,(online,failed)=>{
      state.onlineMap=online;$('basemap-style').value=online?'online':'offline';
      $('map-orientation').disabled=!online;
      $('basemap-status').hidden=!failed;
      $('basemap-status').textContent=failed?'Online map unavailable. Showing the bundled map; select Swiss topo map to retry.':'';
      state.updateLabels?.();updateResolution();
    });
    $('basemap-style').addEventListener('change',()=>tiledMap.mode($('basemap-style').value==='online'));
    $('map-orientation').addEventListener('change',()=>tiledMap.overlays($('map-orientation').checked));
    tiledMap.mode(true);

  }
  function updateResolution() {
    if(!state.map||!state.overview)return;
    const size=window.SHROOMS_ADAPTIVE.resolution(state.map.getZoom());
    if(size!==100&&cells!==baseCells){cells=baseCells;rankedCells=baseRankedCells;}
    const sizes=[...new Set(cells.map(c=>c.cellSizeMeters||500))].sort((a,b)=>a-b);
    const gridSize=size===100&&sizes.length?sizes.join('–'):'50';
    state.map.getPane('overviewHeat').style.display=size===100?'none':'';
    document.querySelector('.heatmap-caption').textContent=size===100?`${state.onlineMap?'Swiss topo map':'Offline basemap'} · ${gridSize} m forest scores`:`${state.onlineMap?'Swiss topo map':'Offline basemap'} · ${size===1000?'1 km':'500 m'} overview · zoom for ${gridSize} m detail`;
    const visibleBounds=state.map.getBounds();
    if(size!==100&&!overviewSummaries.has(size))overviewSummaries.set(size,overviewGroups.get(size).map(group=>window.SHROOMS_ADAPTIVE.summarize(group,state.scores)));
    const displayed=size===100?cells:overviewSummaries.get(size);
    const south=visibleBounds.getSouth(),north=visibleBounds.getNorth(),west=visibleBounds.getWest(),east=visibleBounds.getEast();
    const values=displayed.filter(c=>c.lat>=south&&c.lat<=north&&c.lon>=west&&c.lon<=east).map(c=>size===100?scored(c).value:c.value);
    const nextScale=window.SHROOMS_HEAT_SCALE(values);
    const scaleChanged=nextScale.low!==heatScale.low||nextScale.high!==heatScale.high;
    heatScale=nextScale;
    $('heat-low').textContent=`≤ ${Math.round(heatScale.low)} / 100`;
    $('heat-high').textContent=`≥ ${Math.round(heatScale.high)} / 100`;
    if(size===100&&state.mode==='heat'&&(scaleChanged||!state.map.hasLayer(state.layer)))state.layer.setStyle(cellStyle);
    if(size===100){
      state.map.removeLayer(state.overview);state.layer.addTo(state.map);
      return;
    }
    state.map.removeLayer(state.layer);
    state.overview.setData(overviewSummaries.get(size),size,
      summary=>state.mode==='heat'?scoreColor(summary.value):treeColor(summary),
      (summary,key)=>showSummary(overviewGroups.get(size)[key],summary,size),
      `${state.mode}:${heatScale.low}:${heatScale.high}`);
    if(!state.map.hasLayer(state.overview))state.overview.addTo(state.map);
  }

  function showSummary(group,summary,size){
    const t=window.SHROOMS_I18N.t;
    const names={tree:'Tree partners',canopy:'Canopy & forest coverage',moisture:'Moisture',temperature:'Temperature',terrain:'Slope & aspect',season:'Season'};
    const factors=window.SHROOMS_ADAPTIVE.factors(group,state.scores);
    const rows=Object.entries(names).map(([key,name])=>`<tr><td>${escape(t(name))}</td><td>${factors[key]===null?'—':Math.round(factors[key]*100)+'/100'}</td></tr>`).join('');
    const content=document.createElement('div');content.className='summary-popup';
    content.innerHTML=`<strong>${escape(t('{size} forest summary').replace('{size}',size===1000?'1 km':'500 m'))}</strong><p>${escape(t(species[state.species].name))} · ${Math.round(summary.value)}/100</p><p>${escape(t('Area-weighted mean of {count} cells').replace('{count}',summary.count))}</p><table>${rows}</table><p>${escape(t('Missing factors are omitted. Summary factors average only cells with data.'))}</p><button type="button">${escape(t('Zoom to forest cells'))}</button>`;
    content.querySelector('button').addEventListener('click',()=>{state.map.closePopup();state.map.setView([summary.lat,summary.lon],size===1000?12:14);});
    L.popup().setLatLng([summary.lat,summary.lon]).setContent(content).openOn(state.map);
  }

  async function loadProtected() {
    if(!state.map)return;
    $('protection-status').textContent='Loading reserve boundaries…';
    $('retry-protection').hidden=true;
    try {
      const reserves=await window.SHROOMS_LOAD(national?'national-protected':'protected');
      const pane=state.map.getPane('protectedAreas')||state.map.createPane('protectedAreas');
      pane.style.zIndex=450;pane.style.pointerEvents='none';
      const renderer=L.svg({pane:'protectedAreas'}).addTo(state.map);
      const svg=pane.querySelector('svg');
      const ns='http://www.w3.org/2000/svg';
      const defs=document.createElementNS(ns,'defs');
      const pattern=document.createElementNS(ns,'pattern');
      pattern.setAttribute('id','reserve-hatch');pattern.setAttribute('width','8');pattern.setAttribute('height','8');pattern.setAttribute('patternUnits','userSpaceOnUse');
      const background=document.createElementNS(ns,'rect');
      background.setAttribute('width','8');background.setAttribute('height','8');background.setAttribute('fill','#fff1dc');background.setAttribute('fill-opacity','0');
      const stripes=document.createElementNS(ns,'path');
      stripes.setAttribute('d','M-2 2L2 -2M0 8L8 0M6 10L10 6');stripes.setAttribute('stroke','#863e25');stripes.setAttribute('stroke-width','1');stripes.setAttribute('stroke-opacity','.55');
      pattern.append(background,stripes);defs.append(pattern);svg.prepend(defs);
      L.geoJSON(reserves,{pane:'protectedAreas',renderer,interactive:false,style:{color:'#863e25',weight:1.5,fillColor:'url(#reserve-hatch)',fillOpacity:1},onEachFeature(feature,layer){
        layer.bindTooltip(`${escape(feature.properties.name)} · mapped protected area`,{sticky:true});
        layer.bindPopup(`<div class="reserve-popup"><strong>${escape(feature.properties.name)}</strong><p>Mapped protected area</p><p>Collecting may be forbidden here. Habitat scores describe growing conditions, not permission to collect. Check the official reserve rules before collecting.</p><small>${escape(feature.properties.source||'GIS-ZH Waldreservate')} · ${escape(feature.properties.id)}. Boundaries simplified for display; other protections may apply outside this layer.</small><p><a href="${national?'https://map.geo.admin.ch/':'https://maps.zh.ch/'}" target="_blank" rel="noopener noreferrer">Check the official map ↗</a></p></div>`);
      }}).addTo(state.map);
      $('protection-status').textContent=`${reserves.features.length} mapped areas · collecting may be forbidden in hatched areas`;
    }catch(error){
      $('protection-status').textContent='Reserve boundaries unavailable — protection coverage is not shown.';
      $('retry-protection').hidden=false;
      console.warn('Protected areas unavailable',error.message);
    }
  }
  async function loadTile(key) {
    if(key.startsWith('habitat/'))return window.SHROOMS_LOAD(key);
    const items=await window.SHROOMS_LOAD(key);
    return items.map(item=>{const f=byId.get(item.id);f.geometry=item.geometry;return f;});
  }
  async function loadVisibleTiles() {
    if(!detailTiles)return;
    if(window.SHROOMS_ADAPTIVE.resolution(state.map.getZoom())!==100){
      await detailTiles.update([],()=>false);$('geometry-status').hidden=true;$('map').dataset.renderedCells=0;return;
    }
    const bounds=state.map.getBounds().pad(.06);
    const view=await habitat.view([[bounds.getSouth(),bounds.getWest()],[bounds.getNorth(),bounds.getEast()]]);
    if(view.stale)return;
    const previousFeatures=localFeatures;
    localFeatures=new Map(view.features.map(f=>[f.properties.id,f]));
    cells=view.features.map(f=>f.properties);
    for(const f of view.features){
      const c=f.properties;byId.set(c.id,f);
      const weather=state.weather.size?window.SHROOMS_WEATHER.interpolate(c,data.weatherPoints,state.weather):undefined;
      cellWeather.set(c.id,weather);state.scores.set(c.id,window.SHROOMS_SCORE.score(c,species[state.species],weather,today));
    }
    rankedCells=[...cells].sort((a,b)=>scored(b).value-scored(a).value);
    updateResolution();renderList();
    const keys=[...new Set(cells.map(c=>c.tile))];
    const result=await detailTiles.update(keys,f=>localFeatures.has(f.properties.id));
    if(!result.stale){$('geometry-status').hidden=!(result.failed||view.failed);$('map').dataset.renderedCells=result.count;
      for(const id of previousFeatures.keys())if(!localFeatures.has(id)&&id!==state.selected){byId.delete(id);state.scores.delete(id);cellWeather.delete(id);}
    }
    const selected=byId.get(state.selected)?.properties;
    if(!pendingSpot&&selected&&!selected.sourceId&&cells.length&&bounds.contains([selected.lat,selected.lon])){
      const nearest=cells.reduce((best,c)=>Math.hypot(c.x-selected.x,c.y-selected.y)<Math.hypot(best.x-selected.x,best.y-selected.y)?c:best);
      select(nearest.id,false);
    }
    if(pendingSpot){
      const id=pendingSpot.cellId;
      if(byId.has(id)){pendingSpot=null;select(id,false);}
      else if(cells.length){
        // Old 100 m spot IDs stay in the notebook; inspect the new cell near its saved coordinate.
        const nearest=window.SHROOMS_HABITAT.nearest(cells,pendingSpot.lat,pendingSpot.lon,150);
        if(nearest){pendingSpot=null;select(nearest.id,false);}
      }
    }
  }
  async function serverWeather(){
    const payload=await window.SHROOMS_SERVICE.request(`weather?region=${region.id}`);
    if(window.SHROOMS_WEATHER.usable(payload.snapshot,data.weatherPoints,new Date())){
      state.weather=new Map(payload.snapshot.entries);state.status='snapshot';state.weatherDay=payload.snapshot.day;
    }else{state.weather=new Map();state.status='offline';}
    recompute();
  }
  async function initialWeather() {
    if(window.SHROOMS_SERVICE&&await window.SHROOMS_SERVICE.ready){
      try{await serverWeather();return;}catch{console.warn('Shared weather unavailable; trying bundled snapshot.');}
    }
    try {
      const snapshot=await window.SHROOMS_LOAD(national?'national-weather':'weather');
      if(window.SHROOMS_WEATHER.usable(snapshot,data.weatherPoints,today)){
        state.weather=new Map(snapshot.entries);state.status='snapshot';state.weatherDay=snapshot.day;
      }else state.status='offline';
    }catch{state.status='offline';}
    // A fresher manually refreshed cache wins over the bundled snapshot.
    try{
      const cached=JSON.parse(localStorage.getItem('shrooms-weather-v3'));
      if(cached?.day===todayKey&&window.SHROOMS_WEATHER.usable(cached,data.weatherPoints,today)&&Date.now()-cached.at<3600000){state.weather=new Map(cached.entries);state.status='cached';}
    }catch{}
    recompute();
  }
  async function loadWeather(force=false) {
    if(window.SHROOMS_SERVICE&&await window.SHROOMS_SERVICE.ready){
      $('refresh-weather').disabled=true;
      try{await serverWeather();}catch{$('map-status').textContent='Shared weather unavailable. Try again later.';}
      finally{$('refresh-weather').disabled=false;}return;
    }
    const cacheKey='shrooms-weather-v3';
    const gridKey=data.weatherPoints.map(point=>point.id).join('|');
    if(!force)try{
      const cached=JSON.parse(localStorage.getItem(cacheKey));
      if(cached?.day===todayKey&&cached.grid===gridKey&&Date.now()-cached.at<3600000&&cached.entries?.length===data.weatherPoints.length){state.weather=new Map(cached.entries);state.status='cached';recompute();return;}
    }catch{}
    const previous={weather:state.weather,status:state.status};
    state.weather=new Map();
    $('refresh-weather').disabled=true;
    state.status='loading';render();
    for(let start=0;start<data.weatherPoints.length;start+=16){
      const points=data.weatherPoints.slice(start,start+16);
      const params=new URLSearchParams({latitude:points.map(p=>p.lat).join(','),longitude:points.map(p=>p.lon).join(','),daily:'precipitation_sum,temperature_2m_mean,sunshine_duration,et0_fao_evapotranspiration',hourly:'soil_moisture_3_to_9cm,relative_humidity_2m',past_days:'14',forecast_days:'1',timezone:'Europe/Zurich'});
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
      try{
        const response=await fetch(`https://api.open-meteo.com/v1/forecast?${params}`,{signal:controller.signal});
        if(!response.ok)throw new Error(`Weather ${response.status}`);
        const payload=await response.json();const list=Array.isArray(payload)?payload:[payload];
        if(list.length!==points.length)throw new Error('Weather location mismatch');
        list.forEach((item,i)=>{const parsed=window.SHROOMS_WEATHER.parse(item,todayKey);if(parsed)state.weather.set(start+i,parsed);});
      }catch(error){console.warn('Weather batch unavailable',error.message);}finally{clearTimeout(timer);}
    }
    state.status=state.weather.size===data.weatherPoints.length?'live':state.weather.size?'partial':'offline';
    if(!state.weather.size&&previous.weather.size){state.weather=previous.weather;state.status=previous.status;}
    $('refresh-weather').disabled=false;
    if(state.status==='live')try{localStorage.setItem(cacheKey,JSON.stringify({day:todayKey,grid:gridKey,at:Date.now(),entries:[...state.weather]}));}catch{}
    recompute();
  }
  $('species').innerHTML=Object.entries(species).map(([id,s])=>`<option value="${id}">${escape(window.SHROOMS_I18N.t(s.name))}${window.SHROOMS_I18N.t(s.name)===s.latin?'':` · ${escape(s.latin)}`}</option>`).join('');
  $('species').addEventListener('change',event=>{state.species=event.target.value;recompute();});
  $('place-search').addEventListener('input',event=>{state.search=event.target.value.trim();renderList();});
  $('heatmap-mode').addEventListener('click',()=>mapMode('heat'));
  $('points-mode').addEventListener('click',()=>mapMode('forest'));
  $('refresh-weather').addEventListener('click',()=>loadWeather(true));
  $('retry-protection').addEventListener('click',loadProtected);
  let pendingSpot=null;
  window.SHROOMS_SELECTED=()=>{const c=byId.get(state.selected).properties;return {...c,id:c.sourceId||c.id,species:state.species,region:c.sourceId?c.region:'ch'};};
  window.addEventListener('shrooms:open-spot',event=>{
    const spot=event.detail;if(spot.species&&species[spot.species]){$('species').value=spot.species;state.species=spot.species;recompute();}
    const id=spot.cellId?.startsWith('ch:')?spot.cellId.slice(3):spot.cellId;
    if(byId.has(id))select(id);else{pendingSpot=spot;state.map.setView([spot.lat,spot.lon],14);loadVisibleTiles();}
  });
  recompute();initMap();loadProtected();initialWeather();window.dispatchEvent(new Event('shrooms:ready'));
})();
