# Third-party data and software

The [MIT license](LICENSE) covers original shrooms application code, scripts, documentation, and artwork. It does **not** replace the terms of third-party software, fonts, or source data. Screenshots and GIFs depict the attributed datasets below.

## Leaflet

`vendor/leaflet.js` and `vendor/leaflet.css`: Leaflet 1.9.4, BSD 2-Clause.

Copyright (c) 2010–2023, Volodymyr Agafonkin; copyright (c) 2010–2011, CloudMade. The complete upstream notice is in [vendor/leaflet.LICENSE](vendor/leaflet.LICENSE).

## GIS-ZH

Geografisches Informationssystem des Kantons Zürich (GIS-ZH): Luftbild-Bestandeskarte, municipality boundaries, forest reserves, and DTM 2022. These open geodata supply the derived habitat chunks and the canton boundaries in the SVG basemap.

- [Open geodata and access information](https://www.zh.ch/de/politik-staat/opendata/offene-geodaten.html)
- [Official GIS-ZH usage guidance](https://maps.zh.ch/help/index.html)
- Exact source requests and hashes: [data/sources.json](data/sources.json)

Source terms continue to apply. shrooms simplifies and rasterizes boundaries, aggregates stand attributes, derives slope/aspect, and applies its own unvalidated suitability model. GIS-ZH does not supply or endorse those scores.

## OpenStreetMap

© OpenStreetMap contributors. Roads, rivers and settlement positions in `data/basemap.svg` and `data/basemap.js` derive from OpenStreetMap data under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). OSM-derived database content retains that license.

[Copyright and attribution](https://www.openstreetmap.org/copyright). The extract is clipped to the canton and simplified. The query and transformation are in `scripts/basemap.overpass` and `scripts/build_basemap.py`; source metadata are in `data/basemap.js`. Map graphics and showcase media retain this attribution.

## Open-Meteo

Weather data by [Open-Meteo](https://open-meteo.com/), provided under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The bundled snapshot aggregates model data into rainfall, temperature, humidity, soil moisture, sunshine, and reference evaporation summaries. These transformations and the suitability scores are shrooms’ work.

API access has separate [service terms](https://open-meteo.com/en/terms), including non-commercial restrictions on the free endpoint. The MIT license for this application does not override those service terms.

## Fonts

The stylesheet requests DM Sans and DM Serif Display through Google Fonts; font binaries are not bundled. Both font families use the SIL Open Font License 1.1. See the upstream [DM Sans](https://github.com/google/fonts/tree/main/ofl/dmsans) and [DM Serif Display](https://github.com/google/fonts/tree/main/ofl/dmserifdisplay) directories for their notices. System fonts are used when the request is unavailable.

## National Swiss data

© swisstopo: **swissTLMRegio 2026** supplies forest boundaries, administrative boundaries, protected-area outlines, lakes, roads and places. **DHM25/200** supplies national terrain. Data are redistributed and transformed under the [swisstopo open-data terms](https://www.swisstopo.admin.ch/en/faq-free-geodata), including source attribution. Source geometry is generalized, rasterized or simplified; terrain gradients and habitat scores are derived by shrooms, not supplied or endorsed by swisstopo.

**FOEN / WSL, Swiss National Forest Inventory (NFI), forest mix 2023** supplies modeled broadleaf percentages at 10 m, averaged to our forest grid. [Official layer metadata](https://api3.geo.admin.ch/rest/services/api/MapServer/ch.bafu.landesforstinventar-waldmischungsgrad/legend). The layer is tree cover data, not a complete forest boundary or species inventory. Source attribution and terms remain applicable to derived regional bundles.

Exact national downloads and checksums are listed in [data/national-sources.json](data/national-sources.json). Original source data are not relicensed under the application's MIT license. National screenshots and map exports should retain © swisstopo and FOEN / WSL attribution.

## Online Swiss topographic map

The optional online map loads `ch.swisstopo.pixelkarte-grau` tiles directly from swisstopo's [XYZ service](https://docs.geo.admin.ch/visualize-data/xyz.html). © swisstopo. The layer selects cartographic scales appropriate to zoom throughout Switzerland. A second, browser-cached copy is blended above the heatmap to keep roads, names and contours visible; this is a display treatment, not a separate roads dataset.

Use is subject to [FSDI terms and fair use](https://www.geo.admin.ch/en/general-terms-of-use-fsdi) and swisstopo's applicable data terms. The app requests visible tiles on demand, with a small pan buffer, and does not bulk-download or proxy them. The bundled map remains available without this service. Tile requests disclose the viewed map area and normal request metadata to the provider; switching to the bundled map stops new online map requests.
