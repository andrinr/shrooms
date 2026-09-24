# One Swiss map, multiple local sources

The map uses a small national overview when zoomed out. Zooming in loads only the
local habitat bundles intersecting the viewport, including both sides of canton
boundaries. Zürich retains its 50 m stand survey; the other cantons retain their
100 m national-source cells. The canton menu is a navigation shortcut, not a data
filter. Existing `?region=ti` links still frame Ticino, with the rest of Switzerland
accessible by panning. Municipality search uses the national overview.

## Storage and scoring

Run `node scripts/build_seamless.cjs` after rebuilding regional habitat datasets.
It preserves source geometry and properties in 2,425 compressed local bundles,
adds per-cell resolution metadata, and namespaces IDs by source canton. Existing
saved spots retain their original `canton:cell` identities and open within the same
map. The bundles add about 83 MB of static hosting storage; browsers request only
nearby bundles. Legacy regional bundles remain for API compatibility.

At close zoom, rankings, map contrast and click inspection use the loaded local
cells. Coarse summaries remain the national overview, so their scores may differ
from the richer local surveys. Weather uses the same national anchor grid across
the continuous map; source differences in forest attributes remain explicit.
Failed tiles show a retry notice and never silently receive made-up fine scores.

## Better forest datasets: verified candidates, not yet imported

| Source | What it adds | Important distinction |
| --- | --- | --- |
| [swissTLM3D](https://www.swisstopo.admin.ch/en/landscape-model-swisstlm3d) / [forest layer](https://api3.geo.admin.ch/rest/services/api/MapServer/ch.swisstopo.swisstlm3d-wald/legend) | Detailed forest polygons nationwide; swisstopo lists 1–3 m geometric accuracy for indistinct objects such as forest | Boundary accuracy is not mushroom-score resolution or tree-species identification |
| [Basel-Landschaft forest datasets](https://www.baselland.ch/politik-und-behoerden/direktionen/volkswirtschafts-und-gesundheitsdirektion/amt-fur-geoinformation/geoportal/geodaten/wald) | Stand map with age, mix and canopy-cover information | Check dataset metadata, dates, spatial coverage and reuse terms before importing |
| [WSL vegetation-height model](https://www.wsl.ch/de/landschaft/landschaftsentwicklung-und-monitoring/schweiz-3d/) | Nationwide vegetation structure | Height does not establish individual host-tree species |
| [Ticino geoportal](https://map.geo.ti.ch/) | Cantonal forest-related layers and forest-boundary determinations | Legally determined boundaries and ecological forest stands are different datasets |

The current national forest mask comes from **generalized swissTLMRegio**, not
swissTLM3D. Replacing that mask with swissTLM3D is the most useful consistent
nationwide boundary upgrade. It requires rebuilding forest intersections, sampling
other inputs, regenerating overview/local bundles and testing coverage at dataset
seams. Adding a detailed map picture alone would not improve the habitat model.

A source adapter should document license, survey date, units, null values, coverage
and precedence. Prefer a verified stand survey where present and the national
source elsewhere; do not add overlapping forest area twice. Higher resolution
terrain is also needed before claiming uniformly finer terrain-based scores.
