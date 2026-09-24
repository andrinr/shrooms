# Soil chemistry and resolution

## What is available now

Each forest cell contains **predicted topsoil pH** from WSL's nationwide forest
soil maps. The detail panel shows pH measured on the source's **CaCl₂ scale**, the
**0–5 cm depth**, and the **90% prediction interval**. These are model predictions
based on soil profiles and environmental covariates, not a new measurement.

We retain the source's **25 m raster**, including its original alignment. A lookup
uses the pixel containing the selected habitat cell's centre. It is not the average
pH of the entire habitat cell. If that point lacks a prediction, we show missing
data; we do not substitute a neighbouring pixel. The soil layer therefore has finer
resolution than the habitat grid without claiming finer habitat probabilities.

[Dataset and citation](https://doi.org/10.16904/envidat.484) ·
[WSL project](https://www.wsl.ch/en/projects/high-resolution-soil-maps-for-the-swiss-forest/).
WSL also publishes texture, organic carbon and other soil properties; those are not
bundled in this release.

## Experimental contribution to suitability

Soil acidity now contributes to the same score used by the heatmap, rankings,
cell details and API. It is enabled for porcini (maximum 3% share), chanterelle
and bay bolete (maximum 5%). Other species omit it until a supported profile is added.

The profiles encode broad acidic-soil associations, not experimentally fitted pH
optima. Evidence: [European Cantharellus taxonomy and ecology](https://doi.org/10.1007/s13225-016-0376-7)
and a [Polish forest study of Boletus edulis and Imleria badia](https://pmc.ncbi.nlm.nih.gov/articles/PMC12348591/).
These observations do not establish a Swiss fruiting-response curve. The weaker
porcini weight reflects its broad habitat range. Numerical cutoffs below are
explicit implementation assumptions, not values extracted from those papers.

On the native **CaCl₂, 0–5 cm scale**, suitability stays at 1 up to pH 4.5
(chanterelle and bay) or 5 (porcini), then fades linearly to 0.6 at pH 6.5 or 7.
No conversion from water pH is attempted. Average the curve at the lower bound,
central estimate and upper bound as a sensitivity heuristic, not a statistical
expectation. Uncertainty multiplier = 1 / (1 + interval width²). Multiply the
species cap by that multiplier. The resulting share remains capped even when
other factors are unavailable; original factors keep their relative weights.

An interval 4 pH units wide retains only 1/17 of the species cap.

Missing estimates, missing interval bounds, invalid intervals, and unsupported species contribute **zero weight**. Soil never
means an automatic exclusion. The shared geometric-mean score remains unvalidated;
soil effects can overlap with tree and terrain signals, which is another reason
for the small cap. Texture, nutrients, organic matter and contamination are not
inferred from pH and are not scored.

For fast rendering, native cell-centre samples are joined into compressed habitat
bundles ahead of time as `soilPh: [estimate, lower, upper]` or `null`. This adds no
soil downloads or recalculation delay while panning. National overview samples are
at the centres of its 500 m cells, not averages over those cells. Their soil factor
can therefore differ from local 50 m detail. Derived soil fields retain CC BY-SA 4.0.

## Rebuild

With the preparation environment's `numpy` and `rasterio` installed:

```sh
python scripts/build_soil.py
node scripts/join_soil.cjs
```

The script downloads two public ZIP archives into `.cache/soil/`, extracts only the
0–5 cm layers, and writes `data/soil/index.js` plus 1,088 compressed soil tiles.
The bundles total about 40 MB; only the selected location's tile is fetched.
The optional raw-raster lookup cache is limited to eight decoded tiles. The same files
work through the backend, GitHub Pages and direct file previews. CI validates all
bundled pixels, interval ordering, lookup boundaries and the API allowlist.

The derived soil bundles retain **CC BY-SA 4.0**. See
[third-party notices](../THIRD_PARTY_NOTICES.md); the application remains MIT.

## Rendering and further refinement

The map attaches detailed forest polygons only near the visible viewport. Drawing
is split into small batches and cancelled when a new pan or zoom starts. Leaving
an area detaches its shapes; returning uses cached geometry. This reduces the work
Leaflet must do on subsequent zooms without simplifying the source forest shapes.
Decoded habitat downloads and the property index still remain in memory, so this
is not a constant-memory renderer for arbitrarily large datasets.

Habitat cells remain **50 m in local views across Switzerland and 500 m in the
national overview**. National terrain is still based on a 200 m source. Subdividing those
cells would not add terrain information. The detailed forest mask now uses swissTLM3D at 25 m outside Zürich.
A future finer terrain model should use a finer national elevation source, then validate species responses;
the new 25 m pH data is one genuine additional input toward that model.

Run `node scripts/join_soil.cjs` after rebuilding any habitat indexes or local bundles. It is idempotent and reads only the committed soil rasters. CI verifies samples against the source grid.
