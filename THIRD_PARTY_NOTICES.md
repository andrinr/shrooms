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
