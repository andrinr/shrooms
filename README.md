# shrooms ✳

A static, browser-only mushroom habitat explorer for the **canton of Zürich**, with a psychedelic visual identity and an interactive forest heatmap. No runtime server, build step or API key is required. The basemap, habitat, and bundled weather are served entirely as static assets. Only optional live weather refresh and external links require an internet connection.

## Run and deploy

Serve the project with `python3 -m http.server 8000` and open `http://localhost:8000`. The included data are loaded as a local script, so opening `index.html` directly also works.

For GitHub Pages, choose **Settings → Pages → Deploy from a branch → main → / (root)**. Assets use relative paths; `.nojekyll` is included. The Python preparation tools are optional and not used by visitors.

## Where the map comes from

There are **no handpicked “known spots” or mushroom sighting records** in the current model. The original demonstration anchors have been replaced by **4,726 computed forest cells**:

- **Forest stands:** GIS-ZH [Luftbild-Bestandeskarte](https://geolion.zh.ch/geodatensatz/347), 95,716 source features, including 92,866 forest stands with `flcodelb=10`. Tree composition, canopy coverage and aerial survey years come from those features. Survey years range from 2000 to 2024, with the dates for each cell shown in the interface.
- **Forest mask:** stand polygons are simplified by 3 m before rasterization at 50 m. Raster cell centers determine coverage. The raster is aggregated into 500 m cells; cells with less than 0.75 ha of eligible forest are omitted. This does not preserve parcel-level boundaries.
- **Terrain:** GIS-ZH [DTM 2022](https://geolion.zh.ch/geodatenservice/1379), requested at 50 m using bilinear resampling. Slope is calculated from the elevation gradient. Each forest cell uses the median slope and elevation, and the circular mean aspect.
- **Boundaries:** official GIS-ZH municipality polygons restrict the mask to canton territory and provide municipality names.
- **Reserves:** the GIS-ZH forest reserve layer is excluded conservatively: about 41.91 km² of mapped forest. This does **not** cover every nature reserve or local restriction, and does not establish collection permission.
- **Weather:** the [Open-Meteo forecast API](https://open-meteo.com/en/docs), requested in two batches for 32 anchors on a 10 km lattice. Each forest cell uses the nearest lattice anchor. Weather resolution is much coarser than the forest grid.

The habitat dataset is 979 KB total: a 326 KB index plus 95 spatial chunks of at most 24 KB each. Geometry chunks load when their bounds intersect the viewport and are reused when revisited; the whole-canton view needs all chunks. Data are losslessly gzip-compressed inside base64 script envelopes, so GitHub Pages needs no custom headers and direct file previews avoid fetch/CORS restrictions. A current browser with `DecompressionStream` is required. Exact source requests, retrieval/build metadata and raw-source hashes are in `data/sources.json`. GIS attribution remains visible on the map and in the source cards.

## What the number means

The 0–100 **modeled suitability** score is an unvalidated ecological heuristic. It is not a probability of encountering a mushroom, a report of a find, or an identification tool. The weights and response curves are explicit in `src/scoring.js`:

| Factor | Weight | Inputs |
| --- | ---: | --- |
| Tree partners | 20% | Mapped beech, oak, other broadleaf and conifer shares; forest-coverage edge proxy for Parasol |
| Canopy | 10% | Mapped canopy percentage; species-specific open/closed preference |
| Moisture | 35% | Soil water 50%, 14-day rain adjusted for drying 30%, recent relative humidity 20% |
| Temperature | 15% | 7-day mean temperature against a provisional species range |
| Terrain | 10% | Slope and aspect as a modest moisture-retention proxy |
| Season | 10% | Provisional species fruiting months |

The score is a weighted geometric mean. Missing factors are omitted and the remaining weights normalized; the UI shows available factors. Tree and canopy inputs are omitted when their valid source coverage is below half of the cell's sampled forest area. Tree shares are normalized among represented broadleaf and conifer shares. Negative source sentinel values are never treated as observations.

Only completed days enter the weather aggregates. Today's and future forecasts are excluded. A full 14-day rainfall history is required for the rainfall term. Soil moisture and humidity use up to 24 hourly samples from the preceding completed day. The default is a bundled, dated weather snapshot (roughly 2 KB), without visitor weather API requests. Snapshots older than 48 hours are excluded. “Refresh weather” requests current data and caches successful responses locally for one hour. The app falls back to available habitat and terrain factors when no usable weather is available. The snapshot date marks the aggregation cutoff; only earlier complete days are included.

The source surveys are real; the species response functions and weights are assumptions. Soil acidity, deadwood, fungal presence, recent collection pressure and fine-scale microclimate are not modeled. Open grassland habitat for Parasol is outside this forest map. Habitat scores with different missing inputs should not be treated as equally certain.

## Rebuild the bundled data

The optional preparation pipeline downloads about 500 MB of source data into the ignored `.cache` directory. It emits a compact static dataset; visitors never download the raw sources.

```sh
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements.txt
.venv/bin/python scripts/build_habitat.py --download
```

To rebuild from existing downloads, omit `--download`. The script fails if the forest response appears truncated or hits the configured WFS feature limit. Do not ship `.cache` or `.venv`.

Refresh the bundled weather before deploying (Node 18+):

```sh
node scripts/prefetch_weather.cjs
```

Commit the resulting `data/weather.js` and deploy it with the other static files. The script preserves the previous snapshot if any weather batch is incomplete or fails. No scheduled refresh is configured; after 48 hours visitors can use the refresh button. Forest rebuilds automatically call `scripts/pack_habitat.py` to produce the index and geometry chunks.

```sh
node --test tests/*.test.cjs
```

The tests check dry-weather sensitivity, species response to tree mix, missing data, terrain effects, exclusion of future weather, and validity of every generated cell.

## Other sources

- [GIS-ZH OGD WFS](https://geolion.zh.ch/geodatenservice/2030)
- [SwissFungi distribution atlas](https://swissfungi.wsl.ch/en/distribution-data/distribution-atlas/) — ecological reference for future calibration
- [Canton of Zürich mushroom collecting guidance](https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/gesundheit/lebensmittelkontrollen/MD-00134.pdf)
- [OpenStreetMap attribution](https://www.openstreetmap.org/copyright)
- [Leaflet 1.9.4](https://leafletjs.com), bundled locally, BSD-2-Clause

Always verify local access and protection rules. Have collected mushrooms checked by a municipal mushroom inspection service before eating them.

## Continuous integration

[CI runs](https://github.com/andrinr/shrooms/actions/workflows/ci.yml) execute on every push and pull request, and can also be started manually. The workflow uses Node 22 and checks JavaScript syntax, Python script syntax, the ecological model, all compressed chunks through the actual loader, missing assets, and project-relative links. Tests use bundled data and fixed dates, so an aging weather snapshot or unavailable external API does not break CI.

Each successful run uploads a `shrooms-static-site` artifact containing only deployable assets (including `.nojekyll`). Raw source downloads, caches, scripts, tests, and Git metadata are excluded. Existing branch-based GitHub Pages deployment remains supported; CI does not change the repository's Pages settings.

To run the same checks and produce the static folder locally:

```sh
node scripts/check_syntax.cjs
node --test tests/*.test.cjs
PYTHONPYCACHEPREFIX=.cache/pycompile python3 -m py_compile scripts/*.py
node scripts/package_site.cjs
```

Serve `_site/` to preview the packaged version. No dependency installation, secrets, GIS rebuild, or live weather download is needed for CI.

## Bundled basemap

`data/basemap.svg` is a bundled vector map combining GIS-ZH municipality and lake boundaries with OpenStreetMap motorways, primary/secondary/tertiary roads, rivers, and settlement locations. All geometry is clipped to canton territory and projected to Web Mercator so it aligns with the forest overlay. Roads use 15 m simplification; boundary polygons use 35 m simplification.

Place labels use mapped settlement points rather than municipality centroids. Cities and towns appear first; villages and hamlets appear at closer zoom levels, with overlap filtering. Streets, paths, routing, and complete water-body coverage are outside this overview map.

No third-party map tiles are requested. The source download happens only during preparation, using the reproducible query in `scripts/basemap.overpass`. The deployed site remains fully static. OSM data attribution and the ODbL license are linked on the map; metadata records retrieval time, the server’s base-version value, checksum and road counts.

Rebuild after refreshing the cached municipality data:

```sh
.venv/bin/python scripts/build_basemap.py --download
```

Omit `--download` to reuse `.cache/basemap-osm.json`. OSM-derived place data are provided under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/); the bundled SVG includes © OpenStreetMap contributors data. Source extraction and rendering steps are supplied in this repository.

Both basemap files are bundled into the CI artifact automatically.

## Heatmap contrast

Colors adapt to the selected species’ scores across the entire canton: the 10th percentile is the low color endpoint and the 95th percentile is the high endpoint. Scores outside that interval clamp to the endpoint colors. Pink highlights the strongest relative signals, while weaker cells are more transparent. The legend displays the actual score thresholds. Endpoints stay fixed while panning and update when species or weather changes. A minimum 10-point span prevents tiny differences from being stretched across the entire palette. Numeric suitability scores are unchanged; these colors do not indicate calibrated probabilities or guarantee good conditions.

## More species, sunshine, and drying

Seven species are available, including bay bolete (Maronenröhrling), wood hedgehog (Semmelstoppelpilz), and saffron milkcap (Echter Reizker). Saffron milkcap uses mapped pine percentage; an unknown pine value is omitted, while a measured zero is a weak host signal. Profiles, month ranges, temperature bands, and response coefficients remain provisional assumptions, not fitted Zürich observations.

The weather snapshot and live refresh now include seven-day sunshine hours and fourteen-day reference evapotranspiration (ET₀). Sunshine is displayed as regional context, not as measured light below the canopy. The rainfall component uses `max(0, rain14 − 0.5 × ET₀14)` before its existing response curve. The 0.5 coefficient is a deliberately modest, unvalidated drying assumption. ET₀ describes a reference grass surface, not actual forest evaporation. No extra independent sun weight is added; canopy and aspect already represent shelter. Missing ET₀ preserves the previous rain-only calculation. All new aggregates require complete past days and exclude today and future forecasts.

Other potentially useful inputs—soil pH, substrate/deadwood, frost damage, and fine-scale terrain shading—remain outside the score until suitable data and response functions are available.

References: [Open-Meteo variable definitions](https://open-meteo.com/en/docs), [WSL fungal ecology research](https://www.wsl.ch/en/biodiversity/species-diversity/fungi/), [wood hedgehog habitat](https://www.first-nature.com/fungi/hydnum-repandum.php), [saffron milkcap habitat](https://www.first-nature.com/fungi/lactarius-deliciosus.php), and [NDFF bay bolete habitat observations](https://www.verspreidingsatlas.nl/biodiversiteit/habitat-distribution.aspx?soortnummer=10142020).
