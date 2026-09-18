# shrooms ✳

A static, browser-only mushroom habitat explorer for the **canton of Zürich**, with a psychedelic visual identity and an interactive forest heatmap. No runtime server, build step or API key is required. Live weather and map tiles require an internet connection.

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

The bundled dataset is about 4 MB. Exact source requests, retrieval/build metadata and raw-source hashes are in `data/sources.json`. GIS attribution remains visible on the map and in the source cards.

## What the number means

The 0–100 **modeled suitability** score is an unvalidated ecological heuristic. It is not a probability of encountering a mushroom, a report of a find, or an identification tool. The weights and response curves are explicit in `src/scoring.js`:

| Factor | Weight | Inputs |
| --- | ---: | --- |
| Tree partners | 20% | Mapped beech, oak, other broadleaf and conifer shares; forest-coverage edge proxy for Parasol |
| Canopy | 10% | Mapped canopy percentage; species-specific open/closed preference |
| Moisture | 35% | Soil water 50%, 14-day rain 30%, recent relative humidity 20% |
| Temperature | 15% | 7-day mean temperature against a provisional species range |
| Terrain | 10% | Slope and aspect as a modest moisture-retention proxy |
| Season | 10% | Provisional species fruiting months |

The score is a weighted geometric mean. Missing factors are omitted and the remaining weights normalized; the UI shows available factors. Tree and canopy inputs are omitted when their valid source coverage is below half of the cell's sampled forest area. Tree shares are normalized among represented broadleaf and conifer shares. Negative source sentinel values are never treated as observations.

Only completed days enter the weather aggregates. Today's and future forecasts are excluded. A full 14-day rainfall history is required for the rainfall term. Soil moisture and humidity use up to 24 hourly samples from the preceding completed day. Successful responses are cached locally for one hour. The app falls back to the available habitat and terrain factors when weather fails.

The source surveys are real; the species response functions and weights are assumptions. Soil acidity, deadwood, fungal presence, recent collection pressure and fine-scale microclimate are not modeled. Open grassland habitat for Parasol is outside this forest map. Habitat scores with different missing inputs should not be treated as equally certain.

## Rebuild the bundled data

The optional preparation pipeline downloads about 500 MB of source data into the ignored `.cache` directory. It emits a compact static dataset; visitors never download the raw sources.

```sh
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements.txt
.venv/bin/python scripts/build_habitat.py --download
```

To rebuild from existing downloads, omit `--download`. The script fails if the forest response appears truncated or hits the configured WFS feature limit. Do not ship `.cache` or `.venv`.

```sh
node --test tests/model.test.cjs
```

The tests check dry-weather sensitivity, species response to tree mix, missing data, terrain effects, exclusion of future weather, and validity of every generated cell.

## Other sources

- [GIS-ZH OGD WFS](https://geolion.zh.ch/geodatenservice/2030)
- [SwissFungi distribution atlas](https://swissfungi.wsl.ch/en/distribution-data/distribution-atlas/) — ecological reference for future calibration
- [Canton of Zürich mushroom collecting guidance](https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/gesundheit/lebensmittelkontrollen/MD-00134.pdf)
- [OpenStreetMap attribution](https://www.openstreetmap.org/copyright)
- [Leaflet 1.9.4](https://leafletjs.com), bundled locally, BSD-2-Clause

Always verify local access and protection rules. Have collected mushrooms checked by a municipal mushroom inspection service before eating them.
