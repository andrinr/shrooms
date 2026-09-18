(function () {
  const { sites, species } = window.MYCO_DATA;
  const $ = id => document.getElementById(id);
  const state = { species: 'porcini', selected: 'albis', weather: new Map(), status: 'loading', map: null, markers: new Map() };
  const today = new Date();
  const zurichDay = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', day: 'numeric' }).format(today));
  $('date-pill').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', day: 'numeric', month: 'short', year: 'numeric' }).format(today).toUpperCase();
  $('collecting-title').textContent = zurichDay <= 10 ? 'Closed season today' : 'Collect with care today';
  $('collecting-copy').textContent = zurichDay <= 10
    ? 'Mushroom collecting is prohibited across the canton from the 1st through the 10th of each month. You can still explore and observe.'
    : 'The canton permits at most 1 kg of mushrooms per person per day. Collecting remains prohibited in nature reserves.';

  function weatherFor(site) { return state.weather.get(site.id) || null; }
  function scored(site) { return window.MYCO_SCORE.score(site, species[state.species], weatherFor(site), today); }
  function color(value) { return value >= 70 ? '#b8d979' : value >= 48 ? '#edb86a' : '#d78d75'; }
  function label(value) { return value >= 70 ? 'Stronger' : value >= 48 ? 'Moderate' : 'Lower'; }
  function pct(value) { return `${Math.round(value * 100)}%`; }
  function statLine(title, detail, value) { return `<div class="factor"><div class="factor-label"><span>${title}<small>${detail}</small></span><strong>${pct(value)}</strong></div><div class="factor-track"><i style="width:${pct(value)}"></i></div></div>`; }
  function selectSite(id, fly = true) {
    state.selected = id;
    const site = sites.find(s => s.id === id);
    if (fly && state.map) state.map.flyTo([site.lat, site.lon], Math.max(state.map.getZoom(), 11), { duration: 0.65 });
    render();
  }
  function renderList() {
    const sorted = [...sites].sort((a, b) => scored(b).value - scored(a).value);
    $('result-count').textContent = `${sites.length} AREAS`;
    $('site-list').innerHTML = sorted.map(site => {
      const result = scored(site);
      return `<button class="site-row ${site.id === state.selected ? 'active' : ''}" data-site="${site.id}" type="button"><span class="site-icon">♧</span><span class="site-name"><strong>${site.name}</strong><small>${site.region} · ${site.trees}</small></span><span class="site-score" style="--score-color:${color(result.value)}">${result.value}</span></button>`;
    }).join('');
    $('site-list').querySelectorAll('[data-site]').forEach(btn => btn.addEventListener('click', () => selectSite(btn.dataset.site)));
  }
  function seasonText(months) {
    const name = month => new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date(2024, month - 1, 1));
    return `${name(months[0])}–${name(months[months.length - 1])}`;
  }
  function renderDetail() {
    const site = sites.find(s => s.id === state.selected);
    const selectedSpecies = species[state.species];
    const result = scored(site);
    const weather = weatherFor(site);
    $('detail').innerHTML = `<div class="detail-kicker">SELECTED AREA <span>↗</span></div><div class="detail-title"><div><h3>${site.name}</h3><p>${site.region} · ${site.elevation}</p></div></div><div class="score-panel"><div class="score-ring" style="--value:${result.value};--ring-color:${color(result.value)}"><span>${result.value}<small>/ 100</small></span></div><div><small>RELATIVE HABITAT SIGNAL</small><strong>${label(result.value)} conditions</strong><p>For ${selectedSpecies.name} · ${selectedSpecies.local}</p></div></div><div class="detail-divider"></div><div class="factor-heading">WHY THIS SCORE? <span>${result.live ? 'LIVE WEATHER' : 'HABITAT ONLY'}</span></div>${statLine('Forest fit', site.trees, result.habitat)}${result.live ? statLine('Moisture', `${weather.rain7.toFixed(1)} mm rain in 7 days${Number.isFinite(weather.soil) ? ' · modeled soil water' : ''}`, result.moisture) + statLine('Temperature', `${weather.temp7.toFixed(1)}°C recent mean`, result.temperature) : '<p class="weather-note">Weather unavailable. Score uses forest fit and season only.</p>'}${statLine('Season', seasonText(selectedSpecies.months), result.season)}<div class="detail-divider"></div><div class="detail-note"><span>FIELD CLUE</span><p>${site.clue}</p><small>${site.access}</small></div><a class="directions" href="https://www.openstreetmap.org/?mlat=${site.lat}&mlon=${site.lon}#map=13/${site.lat}/${site.lon}" target="_blank" rel="noopener noreferrer">Open area in OpenStreetMap <span>↗</span></a>`;
  }
  function renderMarkers() {
    if (!state.map) return;
    sites.forEach(site => {
      const result = scored(site);
      const active = site.id === state.selected;
      const marker = state.markers.get(site.id);
      marker.setStyle({ color: '#fff', weight: active ? 3 : 2, fillColor: color(result.value), fillOpacity: 0.95, radius: active ? 14 : 11 });
      marker.setTooltipContent(`<strong>${site.name}</strong><br>${result.value}/100 · ${label(result.value)} signal`);
      if (active) marker.bringToFront();
    });
  }
  function render() {
    $('species-latin').textContent = species[state.species].latin + ' · ' + species[state.species].note;
    $('map-status').textContent = state.status === 'loading' ? 'Loading live conditions…' : state.status === 'live' ? 'Live weather connected' : 'Habitat-only mode';
    document.querySelector('.overlay-dot').classList.toggle('offline', state.status === 'offline');
    renderList(); renderDetail(); renderMarkers();
  }
  function initMap() {
    if (!window.L) { $('map').innerHTML = '<div class="map-error">The map could not load. Check your connection and reload this page.</div>'; return; }
    const map = L.map('map', { zoomControl: false, scrollWheelZoom: true }).setView([47.43, 8.67], 10);
    state.map = map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    sites.forEach(site => {
      const marker = L.circleMarker([site.lat, site.lon], { radius: 11, color: '#fff', weight: 2, fillColor: '#edb86a', fillOpacity: 0.95 }).addTo(map);
      marker.bindTooltip('', { direction: 'top', offset: [0, -10] });
      marker.on('click', () => selectSite(site.id, false));
      state.markers.set(site.id, marker);
    });
    $('reset-view').addEventListener('click', () => map.fitBounds(L.latLngBounds(sites.map(s => [s.lat, s.lon])).pad(0.18), { animate: true }));
    map.fitBounds(L.latLngBounds(sites.map(s => [s.lat, s.lon])).pad(0.18));
  }
  async function loadWeather() {
    const params = new URLSearchParams({
      latitude: sites.map(s => s.lat).join(','), longitude: sites.map(s => s.lon).join(','),
      daily: 'precipitation_sum,temperature_2m_mean', hourly: 'soil_moisture_3_to_9cm',
      past_days: '7', forecast_days: '1', timezone: 'Europe/Zurich'
    });
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`Weather API ${response.status}`);
      const data = await response.json();
      const locations = Array.isArray(data) ? data : [data];
      if (locations.length !== sites.length) throw new Error('Unexpected location count');
      locations.forEach((item, index) => {
        const rain = item.daily?.precipitation_sum?.slice(-8, -1).filter(Number.isFinite) || [];
        const temps = item.daily?.temperature_2m_mean?.slice(-8, -1).filter(Number.isFinite) || [];
        if (!rain.length || !temps.length) return;
        const soils = item.hourly?.soil_moisture_3_to_9cm?.filter(Number.isFinite) || [];
        state.weather.set(sites[index].id, { rain7: rain.reduce((a, b) => a + b, 0), temp7: temps.reduce((a, b) => a + b, 0) / temps.length, soil: soils.length ? soils[soils.length - 1] : null });
      });
      state.status = state.weather.size ? 'live' : 'offline';
    } catch (error) { state.status = 'offline'; console.warn('Live weather unavailable:', error); }
    render();
  }
  $('species').addEventListener('change', event => { state.species = event.target.value; render(); });
  initMap(); render(); loadWeather();
})();
