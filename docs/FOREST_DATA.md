# One Swiss map, multiple local sources

The map uses a small national overview when zoomed out. Zooming in loads only the
local habitat bundles intersecting the viewport, including both sides of canton
boundaries. Zürich retains its 50 m stand survey; the other cantons use swissTLM3D boundaries on a
25 m forest mask within 50 m score cells. The canton menu is a navigation shortcut, not a data
filter. Existing `?region=ti` links still frame Ticino, with the rest of Switzerland
accessible by panning. Municipality search uses the national overview.

## Storage and scoring

Use `python scripts/download_tlm3d.py` and then
`python scripts/build_detailed_habitat.py` in the preparation environment.
The downloader extracts only the land-cover members of the official archive using
HTTP ranges. Raw shapefiles stay in `.cache/`, outside deployment artifacts.
The builder selects `Wald` and `Wald offen`, rasterizes boundaries at 25 m, samples
municipality assignment at each 50 m cell centre, and resamples the existing 10 m
NFI mix raster to 50 m. Each cell retains its actual forest-covered area and a
forest-shaped geometry made from the 25 m pixels. Terrain is still derived from
DHM25/200; interpolation to the new grid adds no terrain measurements.

`node scripts/build_seamless.cjs` refreshes the Zürich stand bundles while retaining
an existing detailed national build. Legacy regional API bundles remain available.
New national cells have distinct `tlm50-...` identifiers. Old notebook entries keep
their saved coordinates and IDs; opening them inspects the nearest new cell within
150 m. The saved entry itself is not rewritten.

At close zoom, rankings, map contrast and click inspection use the loaded local
cells. Coarse summaries remain the national overview, so their scores may differ
from the richer local surveys. Weather uses the same national anchor grid across
the continuous map; source differences in forest attributes remain explicit.
Failed tiles show a retry notice and never silently receive made-up fine scores.

## Sources and further upgrades

| Source | What it adds | Important distinction |
| --- | --- | --- |
| [swissTLM3D](https://www.swisstopo.admin.ch/en/landscape-model-swisstlm3d) / [forest layer](https://api3.geo.admin.ch/rest/services/api/MapServer/ch.swisstopo.swisstlm3d-wald/legend) | **Imported for local detail.** Detailed forest polygons nationwide; swisstopo lists 1–3 m geometric accuracy for indistinct objects such as forest | Boundary accuracy is not mushroom-score resolution or tree-species identification |
| [Basel-Landschaft forest datasets](https://www.baselland.ch/politik-und-behoerden/direktionen/volkswirtschafts-und-gesundheitsdirektion/amt-fur-geoinformation/geoportal/geodaten/wald) | Stand map with age, mix and canopy-cover information | Check dataset metadata, dates, spatial coverage and reuse terms before importing |
| [WSL vegetation-height model](https://www.wsl.ch/de/landschaft/landschaftsentwicklung-und-monitoring/schweiz-3d/) | Nationwide vegetation structure | Height does not establish individual host-tree species |
| [Ticino geoportal](https://map.geo.ti.ch/) | Cantonal forest-related layers and forest-boundary determinations | Legally determined boundaries and ecological forest stands are different datasets |

The local forest mask now comes from **swissTLM3D 2026-02**. The coarse national
overview and legacy regional API datasets retain swissTLMRegio, so zoom transitions
can reveal forest patches that were absent in the generalized overview. The source
release is shown in each new cell's provenance; it is not a claim that every polygon
was surveyed in 2026. Forest polygons are converted into a 25 m mask, not retained
at the source's full vector precision.

[swissALTI3D](https://www.swisstopo.admin.ch/en/height-model-swissalti3d) provides
nationwide 2 m terrain (also 0.5 m where available). This is the next terrain upgrade;
it is **not yet imported**. It requires offline terrain processing and aggregation,
not delivery of the raw national elevation dataset to browsers. The other cantonal
and vegetation-height candidates in the table are also not yet imported.

A source adapter should document license, survey date, units, null values, coverage
and precedence. Prefer a verified stand survey where present and the national
source elsewhere; do not add overlapping forest area twice. Higher resolution
terrain is also needed before claiming uniformly finer terrain-based scores.
