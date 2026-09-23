# Soil chemistry and resolution

## What is available now

Selecting a forest cell loads **predicted topsoil pH** from WSL's nationwide forest
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

## Why pH does not change the mushroom score yet

Soil acidity can inform habitat assessment, but species-specific response curves
need evidence. pH values in water and CaCl₂ cannot be treated as interchangeable.
Before adding a score contribution, a profile needs a cited response on a compatible
measurement scale and soil depth, a documented treatment of uncertainty, and
validation against independent occurrence data. Avoid double-counting soil effects
already represented by tree composition or terrain. Until then, pH is inspectable
context and the existing habitat score remains unchanged.

## Rebuild

With the preparation environment's `numpy` and `rasterio` installed:

```sh
python scripts/build_soil.py
```

The script downloads two public ZIP archives into `.cache/soil/`, extracts only the
0–5 cm layers, and writes `data/soil/index.js` plus 1,088 compressed soil tiles.
The bundles total about 40 MB; only the selected location's tile is fetched.
Decoded soil tiles are limited to eight cached tiles in the browser. The same files
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

Habitat cells remain **50 m in Zürich, 100 m in other canton views, and 500 m in the
national view**. National terrain is still based on a 200 m source. Subdividing those
cells would not add terrain information. A future finer habitat model should use a
finer national terrain source and forest boundaries, then validate species responses;
the new 25 m pH data is one genuine additional input toward that model.
