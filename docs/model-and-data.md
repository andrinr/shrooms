# Model and data reference

[← Back to shrooms](../README.md)

## Where the map comes from

There are **no handpicked “known spots” or mushroom sighting records** in the current model. The original demonstration anchors have been replaced by **197,669 computed 50 m forest cells in Zürich**, plus 100 m cells in the other cantons and a 500 m Swiss overview:

- **Forest stands:** GIS-ZH [Luftbild-Bestandeskarte](https://geolion.zh.ch/geodatensatz/347), 95,716 source features, including 92,866 forest stands with `flcodelb=10`. Tree composition, canopy coverage and aerial survey years come from those features. Survey years range from 2000 to 2024, with the dates for each cell shown in the interface.
- **Forest mask:** stand polygons are simplified by 3 m before rasterization at 50 m. Raster cell centers determine coverage. Each retained 50 m cell represents one forest sample (0.25 ha). This adds local forest and terrain detail, but does not preserve parcel-level boundaries or create finer weather measurements.
- **Terrain:** GIS-ZH [DTM 2022](https://geolion.zh.ch/geodatenservice/1379), requested at 50 m using bilinear resampling. Slope is calculated from the elevation gradient. Each forest cell uses the median slope and elevation, and the circular mean aspect.
- **Boundaries:** official GIS-ZH municipality polygons restrict the mask to canton territory and provide municipality names.
- **Reserves:** the GIS-ZH forest reserve layer is overlaid with transparent hatching and a warning that collecting may be forbidden. Its approximately 41.91 km² of mapped forest remain included in habitat scoring. This does **not** cover every nature reserve or local restriction, and does not establish collection permission.
- **Weather:** the [Open-Meteo forecast API](https://open-meteo.com/en/docs), requested in two batches for 32 anchors on a 10 km lattice. Each forest cell blends available anchors using inverse squared distance with a taper to zero at a 40 km support radius, separately for each weather input. Missing inputs are renormalized; when there are no nearby anchors the nearest available anchor is used. This avoids abrupt nearest-anchor boundaries; it does not add measured local weather detail. Weather resolution is much coarser than the forest grid.

The Zürich habitat dataset is approximately 11.6 MB: a 7.1 MB compressed index plus 493 spatial chunks, each under 32 KB. National bundles add roughly 73 MB on disk but are loaded by selected region, not all at once. Geometry chunks load when their bounds intersect the viewport and are reused when revisited; the whole-canton view uses summaries from the index and does not fetch all geometry chunks. Data are losslessly gzip-compressed inside base64 script envelopes, so GitHub Pages needs no custom headers and direct file previews avoid fetch/CORS restrictions. A current browser with `DecompressionStream` is required. Exact source requests, retrieval/build metadata and raw-source hashes are in [`data/sources.json`](../data/sources.json). GIS attribution remains visible on the map and in the source cards.

## Nationwide coverage

Outside Zürich, forest boundaries come from © swisstopo swissTLMRegio 2026. This is generalized regional mapping (approximately 20–60 m positional accuracy), rasterized by cell centers at 100 m. Tree mix comes from the FOEN / WSL National Forest Inventory 2023 broadleaf percentage raster at 10 m, averaged to 100 m. Tree cover alone is not treated as forest: the swissTLMRegio forest mask controls inclusion. Individual tree-species shares and canopy are unknown and omitted.

Elevation and slope come from © swisstopo DHM25/200, a 200 m source reprojected from LV03 to LV95 and resampled to the grid. Aspect is resampled using sine/cosine components to avoid angle wraparound. The output's 100 m cells do not create 100 m terrain observations. National cell date 2023 describes tree mix; forest boundaries are the 2026 release.

The national overview aggregates 100 m forest samples into 85,969 forest-shaped 500 m groups. Select a canton to load finer detail. National weather uses 137 anchors on a 20 km lattice; Zürich adds its 10 km lattice. Compact regional interpolation smooths artificial anchor seams without adding measurements.

`data/switzerland.svg` and `data/switzerland-map.js` provide national roads, boundaries, lakes and settlement labels from swissTLMRegio. The national protection overlay combines 36 Swiss-clipped swissTLMRegio protected-area polygons with Zürich's 594 reserve groups. It is **not a comprehensive national protection inventory**. National cell reserve overlap is unknown (null); warnings and boundaries remain visible. Sources and download checksums are in `data/national-sources.json` and each regional index.

## What the number means

The 0–100 **modeled suitability** score is an unvalidated ecological heuristic. It is not a probability of encountering a mushroom, a report of a find, or an identification tool. The weights and response curves are explicit in [`src/scoring.js`](../src/scoring.js):

| Factor | Weight | Inputs |
| --- | ---: | --- |
| Tree partners | 20% | Mapped beech, oak, other broadleaf and conifer shares; forest-coverage edge proxy for Parasol |
| Canopy | 10% | Mapped canopy percentage; species-specific open/closed preference |
| Moisture | 35% | Soil water 50%, 14-day rain adjusted for drying 30%, recent relative humidity 20% |
| Temperature | 15% | 7-day mean temperature against a provisional species range |
| Terrain | 10% | Slope and aspect as a modest moisture-retention proxy |
| Season | 10% | Provisional species fruiting months |

The score is a weighted geometric mean. Missing factors are omitted and the remaining weights normalized; the UI shows available factors. Tree and canopy inputs are omitted when their valid source coverage is below half of the cell's sampled forest area. Tree shares are normalized among represented broadleaf and conifer shares. Negative source sentinel values are never treated as observations.

Only completed days enter the weather aggregates. Today's and future forecasts are excluded. A full 14-day rainfall history is required for the rainfall term. Soil moisture and humidity use up to 24 hourly samples from the preceding completed day. Hosted mode uses a server snapshot refreshed every six hours. Static mode uses a bundled dated snapshot. Snapshots older than 48 hours are excluded. In hosted mode “Refresh weather” reloads the shared server cache. In static mode it requests the provider and caches successful responses locally for one hour. The app falls back to available habitat and terrain factors when no usable weather is available. The snapshot date marks the aggregation cutoff; only earlier complete days are included.

The source surveys are real; the species response functions and weights are assumptions. Soil acidity, deadwood, fungal presence, recent collection pressure and fine-scale microclimate are not modeled. Open grassland habitat for Parasol is outside this forest map. Habitat scores with different missing inputs should not be treated as equally certain.

## Bundled basemap

`data/basemap.svg` is a bundled vector map combining GIS-ZH municipality and lake boundaries with OpenStreetMap motorways, primary/secondary/tertiary roads, rivers, and settlement locations. All geometry is clipped to canton territory and projected to Web Mercator so it aligns with the forest overlay. Roads use 15 m simplification; boundary polygons use 35 m simplification.

Place labels use mapped settlement points rather than municipality centroids. Cities and towns appear first; villages and hamlets appear at closer zoom levels, with overlap filtering. Streets, paths, routing, and complete water-body coverage are outside this overview map.

No third-party map tiles are requested. The source download happens only during preparation, using the reproducible query in `scripts/basemap.overpass`. Both static and hosted modes use the same bundled maps. OSM data attribution and the ODbL license are linked on the map; metadata records retrieval time, the server’s base-version value, checksum and road counts.

Rebuild after refreshing the cached municipality data:

```sh
.venv/bin/python scripts/build_basemap.py --download
```

Omit `--download` to reuse `.cache/basemap-osm.json`. OSM-derived place data are provided under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/); the bundled SVG includes © OpenStreetMap contributors data. Source extraction and rendering steps are supplied in this repository.

Both basemap files are bundled into the CI artifact automatically.

## Heatmap contrast

Colors adapt to the selected species’ scores across the selected region: the 10th percentile is the low color endpoint and the 95th percentile is the high endpoint. Scores outside that interval clamp to the endpoint colors. Pink highlights the strongest relative signals, while weaker cells are more transparent. The legend displays the actual score thresholds. Endpoints stay fixed while panning and update when species or weather changes. A minimum 10-point span prevents tiny differences from being stretched across the entire palette. Numeric suitability scores are unchanged; these colors do not indicate calibrated probabilities or guarantee good conditions.

## More species, sunshine, and drying

Eleven species are available, including bay bolete (Maronenröhrling), wood hedgehog (Semmelstoppelpilz), and saffron milkcap (Echter Reizker). Saffron milkcap uses mapped pine percentage; an unknown pine value is omitted, while a measured zero is a weak host signal. Profiles, month ranges, temperature bands, and response coefficients remain provisional assumptions, not fitted Zürich observations.

The weather snapshot and live refresh now include seven-day sunshine hours and fourteen-day reference evapotranspiration (ET₀). Sunshine is displayed as regional context, not as measured light below the canopy. The rainfall component uses `max(0, rain14 − 0.5 × ET₀14)` before its existing response curve. The 0.5 coefficient is a deliberately modest, unvalidated drying assumption. ET₀ describes a reference grass surface, not actual forest evaporation. No extra independent sun weight is added; canopy and aspect already represent shelter. Missing ET₀ preserves the previous rain-only calculation. All new aggregates require complete past days and exclude today and future forecasts.

Other potentially useful inputs—soil pH, substrate/deadwood, frost damage, and fine-scale terrain shading—remain outside the score until suitable data and response functions are available.

References: [Open-Meteo variable definitions](https://open-meteo.com/en/docs), [WSL fungal ecology research](https://www.wsl.ch/en/biodiversity/species-diversity/fungi/), [wood hedgehog habitat](https://www.first-nature.com/fungi/hydnum-repandum.php), [saffron milkcap habitat](https://www.first-nature.com/fungi/lactarius-deliciosus.php), and [NDFF bay bolete habitat observations](https://www.verspreidingsatlas.nl/biodiversiteit/habitat-distribution.aspx?soortnummer=10142020).

## Visible protection overlay

The map explicitly marks GIS-ZH forest reserves with brown boundaries and diagonal hatching, above both habitat and forest-type colors. Clicking a reserve shows its name and source identifier. The legend identifies the coverage as **partial**; unmarked areas can have other protections or local restrictions. Loading failures display an explicit warning and retry button.

`data/protected.js` contains 594 reserve groups from 1,814 source polygons. Geometry is clipped to the canton and simplified by 5 m for display. Forest habitat remains scored inside these boundaries. The overlay signals possible collecting restrictions; it does not assert a ban for every reserve. Source hash and coverage metadata are included in the compressed asset.

## Adaptive map display

At zoom levels 6–10, the map shows 1 km groups; at 11, 500 m groups; from 12 onwards, regional forest polygons: 50 m in Zürich, 100 m in other cantons, or 500 m in the national overview. Overview squares use forest-area-weighted means of the current species scores, not the highest score in a group. Their centers are forest-area-weighted locations and their screen size keeps them visible; squares are generalized summaries, not habitat boundaries. Overview squares are rendered with crisp edges, without a blur filter. Smooth regional variation comes from the interpolated weather inputs and continuous color scale. This changes presentation only, not cell scores. Forest shapes and reserve boundaries stay sharp. Clicking a summary zooms in. Species, weather and forest-type changes update the overview, while the canton-wide color scale stays consistent across zoom levels. Reserve boundaries remain overlaid at all scales.

## Extensible species profiles

The catalog in `src/data.js` is shared by the frontend and API. Every profile lists ecological source links and missing indicators, shown under “Ecology & limits”. Winter chanterelle adds a late-season conifer profile; slippery jack uses measured pine shares; spruce milkcap uses measured spruce shares; charcoal burner emphasizes broadleaf hosts. The general moisture and terrain functions remain shared. Where individual hosts are unavailable, those factors are omitted rather than replaced with general conifer coverage.

New profiles use European habitat references, including [winter chanterelle](https://www.first-nature.com/fungi/cantharellus-tubaeformis.php), [slippery jack](https://www.first-nature.com/fungi/suillus-luteus.php), [NDFF spruce milkcap ecology](https://www.verspreidingsatlas.nl/0069170) and [NDFF charcoal burner host observations](https://www.verspreidingsatlas.nl/biodiversiteit/habitat-distribution.aspx?soortnummer=10126300). Source seasons from other countries are context, not validated Swiss phenology. Temperature bands, host coefficients and canopy choices are provisional hypotheses. No empirical calibration is implied by these links.

See [CONTRIBUTING.md](../CONTRIBUTING.md) to propose a species or implement a new data-backed indicator. CI rejects unsupported fields, invalid ranges, missing sources and incomplete translations.
