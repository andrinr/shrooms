(function () {
  const $=id=>document.getElementById(id);
  const data=window.SHROOMS_GEO, species=window.SHROOMS_SPECIES;
  if (!data) { $('map').textContent='The forest dataset could not load. Reload the page to try again.'; return; }
  const features=data.features, cells=features.map(f=>f.properties);
  const byId=new Map(features.map(f=>[f.properties.id,f]));
  const state={species:'porcini',selected:null,map:null,layer:null,selection:null,mode:'heat',weather:new Map(),scores:new Map(),status:'loading',search:'',updated:null};
  const today=new Date();
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zurich',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(today).map(p=>[p.type,p.value]));
  const todayKey=`${parts.year}-${parts.month}-${parts.day}`;
  const known=v=>typeof v==='number'&&Number.isFinite(v);
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=(v,suffix='',digits=0)=>known(v)?`${v.toFixed(digits)}${suffix}`:'Not available';
  const treeName=c=>c.treeKnown<.5?'Tree mix unavailable':c.conifer>=75?'Conifer forest':c.broadleaf>=75?'Broadleaf forest':'Mixed forest';
  const treeColor=c=>c.treeKnown<.5?'#a79baa':c.conifer>=75?'#8064c0':c.broadleaf>=75?'#63bc9b':'#d3d781';
  const scored=c=>state.scores.get(c.id);
  const label=v=>v>=70?'Stronger habitat signal':v>=45?'Moderate habitat signal':'Lower habitat signal';
  $('date-pill').textContent=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Zurich',day:'numeric',month:'short',year:'numeric'}).format(today).toUpperCase();
  $('collecting-title').textContent=Number(parts.day)<=10?'Closed season today':'Collect with care today';
  $('collecting-copy').textContent=Number(parts.day)<=10?'No mushroom collecting from the 1st through the 10th of each month in Zürich canton. You can still explore and observe.':'Maximum 1 kg per person per day. Collecting is prohibited in nature reserves; always check the rules at your location.';
  $('dataset-count').textContent=cells.length.toLocaleString('en');

  function recompute() {
    cells.forEach(c=>state.scores.set(c.id,window.SHROOMS_SCORE.score(c,species[state.species],state.weather.get(c.weather),today)));
    if (!state.selected) state.selected=[...cells].sort((a,b)=>scored(b).value-scored(a).value)[0].id;
    state.layer?.setStyle(feature=>cellStyle(feature));
    render();
  }
  function cellStyle(feature) {
    return {stroke:false,fillColor:state.mode==='heat'?window.SHROOMS_COLOR(scored(feature.properties).value):treeColor(feature.properties),fillOpacity:.68};
  }
  function select(id,fly=true) {
    state.selected=id;
    const feature=byId.get(id), c=feature.properties;
    if(state.map){
      if(state.selection)state.map.removeLayer(state.selection);
      state.selection=L.geoJSON(feature,{interactive:false,style:{color:'#422149',weight:3,fillColor:'#fff',fillOpacity:.12}}).addTo(state.map);
      if(fly)state.map.flyTo([c.lat,c.lon],13,{duration:.6});
    }
    renderDetail();renderList();
  }
  function renderList() {
    const query=state.search.toLocaleLowerCase();
    const visible=cells.filter(c=>query?c.name.toLocaleLowerCase().includes(query):!state.map||state.map.getBounds().contains([c.lat,c.lon]));
    visible.sort((a,b)=>scored(b).value-scored(a).value);
    const picks=[];
    for(const cell of visible){
      if(picks.every(p=>Math.hypot(p.x-cell.x,p.y-cell.y)>=1600))picks.push(cell);
      if(picks.length===12)break;
    }
    $('result-count').textContent=`${visible.length.toLocaleString('en')} CELLS`;
    $('site-list').innerHTML=picks.length?picks.map(c=>`<button class="site-row ${c.id===state.selected?'active':''}" data-cell="${c.id}" type="button"><span class="site-icon">✳</span><span class="site-name"><strong>${escape(c.name)}</strong><small>${treeName(c)} · ${number(c.slope,'° slope')}</small></span><span class="site-score" style="--score-color:${window.SHROOMS_COLOR(scored(c).value)}">${scored(c).value}</span></button>`).join(''):'<p class="empty-list">No mapped forest cells here. Pan the map, clear the search, or choose “Whole canton”.</p>';
    $('site-list').querySelectorAll('[data-cell]').forEach(btn=>btn.addEventListener('click',()=>select(btn.dataset.cell)));
  }
  function factor(title,detail,factor) {
    const value=factor.value;
    return `<div class="factor"><div class="factor-label"><span>${title}<small>${detail}</small></span><strong>${known(value)?Math.round(value*100)+'/100':'—'}</strong></div><div class="factor-track"><i style="width:${known(value)?value*100:0}%"></i></div></div>`;
  }
  function renderDetail() {
    const c=byId.get(state.selected).properties, result=scored(c), w=state.weather.get(c.weather), s=species[state.species];
    const aspect=known(c.aspect)?['N','NE','E','SE','S','SW','W','NW'][Math.round(c.aspect/45)%8]:'unknown';
    const weatherCopy=w?`${number(w.rain14,' mm',1)} / 14 days · ${number(w.humidity,'% RH')} · ${number(w.soil,' m³/m³',2)} soil water`:'Weather unavailable; this factor is omitted.';
    $('detail').innerHTML=`<div class="detail-kicker">FOREST CELL <span>${c.id}</span></div><div class="detail-title"><h3>${escape(c.name)}</h3><p>${escape(c.district)} · ${number(c.elevation,' m')} · ${c.area} ha mapped forest</p></div><div class="score-panel"><div class="score-ring" style="--value:${result.value};--ring-color:${window.SHROOMS_COLOR(result.value)}"><span>${result.value}<small>/ 100</small></span></div><div><small>MODELED SUITABILITY</small><strong>${label(result.value)}</strong><p>${s.name} · ${result.live?'weather included':'habitat & terrain only'}</p></div></div><div class="factor-heading">WHAT DRIVES IT? <span>${Object.values(result.factors).filter(f=>known(f.value)).length} / 6 FACTORS</span></div>${factor(s.host?'Tree partners':'Forest edge proxy',s.host?`${number(c.broadleaf,'% broadleaf')} · ${number(c.conifer,'% conifer')}`:`${c.forest}% forest coverage in this 500 m cell`,result.factors.tree)}${factor('Canopy & forest coverage',`${number(c.canopy,'% canopy')} · ${c.forest}% of 500 m cell is forest`,result.factors.canopy)}${factor('Moisture',weatherCopy,result.factors.moisture)}${factor('Temperature',w?number(w.temp7,'°C · past 7 days',1):'Weather unavailable',result.factors.temperature)}${factor('Slope & aspect',`${number(c.slope,'° median slope',1)} · ${aspect} aspect`,result.factors.terrain)}${factor('Season',s.months.map(m=>new Intl.DateTimeFormat('en',{month:'short'}).format(new Date(2024,m-1))).join(' · '),result.factors.season)}<div class="detail-note"><span>TRACEABLE TO THE SOURCE</span><p>Forest survey ${c.yearMin===c.yearMax?c.yearMin:`${c.yearMin}–${c.yearMax}`} · DTM 2022. Cell ${c.id}, ${c.lat.toFixed(4)}° N, ${c.lon.toFixed(4)}° E.</p><small>500 m score, clipped to a 50 m forest mask. This is a habitat estimate, not a sighting or collection permission.</small></div><a class="directions" href="https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lon}#map=15/${c.lat}/${c.lon}" target="_blank" rel="noopener noreferrer">Explore this forest <span>↗</span></a>`;
  }
  function render() {
    $('species-latin').textContent=`${species[state.species].latin} · ${species[state.species].note}`;
    $('map-status').textContent=state.status==='loading'?'Loading weather…':state.status==='live'?'Live weather connected':state.status==='cached'?'Recent weather · cached':state.status==='partial'?'Partial weather coverage':'Habitat & terrain only';
    document.querySelector('.overlay-dot').classList.toggle('offline',state.status==='offline'||state.status==='partial');
    renderList();renderDetail();
  }
  function mapMode(mode) {
    state.mode=mode;
    $('legend-title').textContent=mode==='heat'?'HABITAT SIGNAL':'FOREST TYPE';
    $('heatmap-mode').setAttribute('aria-pressed',String(mode==='heat'));
    $('points-mode').setAttribute('aria-pressed',String(mode==='forest'));
    $('map-legend').classList.toggle('heat-active',mode==='heat');
    state.layer?.setStyle(cellStyle);
  }
  function initMap() {
    if(!window.L){$('map').innerHTML='<div class="map-error">The map could not load. Reload to try again.</div>';return;}
    state.map=L.map('map',{zoomControl:false,preferCanvas:true}).setView([47.43,8.65],10);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Forest/terrain: <a href="https://geolion.zh.ch/geodatensatz/347">GIS-ZH</a>'}).addTo(state.map);
    L.control.zoom({position:'bottomright'}).addTo(state.map);
    state.layer=L.geoJSON(features,{style:cellStyle,onEachFeature(feature,layer){
      layer.on('click',()=>select(feature.properties.id,false));
      layer.bindTooltip(()=>`${escape(feature.properties.name)} · ${scored(feature.properties).value}/100<br>${treeName(feature.properties)} · click to inspect`,{sticky:true});
    }}).addTo(state.map);
    const all=()=>state.map.fitBounds(state.layer.getBounds(),{padding:[20,20]});
    $('reset-view').addEventListener('click',()=>{state.search='';$('place-search').value='';all();});
    state.map.on('moveend',renderList);all();select(state.selected,false);
  }
  async function loadWeather(force=false) {
    const cacheKey='shrooms-weather-v2';
    const gridKey=data.weatherPoints.map(point=>point.id).join('|');
    if(!force)try{
      const cached=JSON.parse(localStorage.getItem(cacheKey));
      if(cached?.day===todayKey&&cached.grid===gridKey&&Date.now()-cached.at<3600000&&cached.entries?.length===data.weatherPoints.length){state.weather=new Map(cached.entries);state.status='cached';recompute();return;}
    }catch{}
    state.status='loading';render();
    for(let start=0;start<data.weatherPoints.length;start+=16){
      const points=data.weatherPoints.slice(start,start+16);
      const params=new URLSearchParams({latitude:points.map(p=>p.lat).join(','),longitude:points.map(p=>p.lon).join(','),daily:'precipitation_sum,temperature_2m_mean',hourly:'soil_moisture_3_to_9cm,relative_humidity_2m',past_days:'14',forecast_days:'1',timezone:'Europe/Zurich'});
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
    if(state.status==='live')try{localStorage.setItem(cacheKey,JSON.stringify({day:todayKey,grid:gridKey,at:Date.now(),entries:[...state.weather]}));}catch{}
    recompute();
  }
  $('species').addEventListener('change',event=>{state.species=event.target.value;recompute();});
  $('place-search').addEventListener('input',event=>{state.search=event.target.value.trim();renderList();});
  $('heatmap-mode').addEventListener('click',()=>mapMode('heat'));
  $('points-mode').addEventListener('click',()=>mapMode('forest'));
  recompute();initMap();loadWeather();
})();
