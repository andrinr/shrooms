# shrooms ✳

**Follow the fungi.** A mushroom habitat explorer for the **canton of Zürich**.

[![CI](https://github.com/andrinr/shrooms/actions/workflows/ci.yml/badge.svg)](https://github.com/andrinr/shrooms/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/code-MIT-limegreen.svg)](LICENSE)

Explore forests by tree composition, moisture, slope, and season. Built with plain HTML, CSS, and JavaScript; deployable on GitHub Pages without a backend or API key.

## A look around

![shrooms map walkthrough: zooming into forests and comparing five mushroom heatmaps](docs/media/showcase.gif)

*Map-only UI captures: zoom from the canton into local forests, then compare porcini, chanterelle, bay bolete, horn of plenty, and saffron milkcap. Recorded September 2026; shown scores are illustrative, not current conditions.*

[View a still image](docs/media/overview.png) · Basemap: GIS-ZH and © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Weather: [Open-Meteo](https://open-meteo.com/).

## What it does

- **Seven species:** porcini, chanterelle, horn of plenty, parasol, bay bolete, wood hedgehog, and saffron milkcap.
- **Interactive heatmap:** pan, zoom, search municipalities, and inspect the inputs behind every score. Pink highlights stronger relative signals; the legend shows the score thresholds.
- **4,726 forest cells:** 500 m scores built from official forest surveys and terrain sampled at 50 m.
- **Detailed bundled basemap:** major roads, rivers, and 904 settlement locations, with labels revealed as you zoom. No live map-tile requests.
- **Weather context:** rainfall, soil moisture, humidity, temperature, sunshine, and a provisional drying adjustment. A dated snapshot ships with the app; live refresh is optional.
- **Static delivery:** compressed regional geometry files load as needed. No framework, database, or runtime build step.

> Scores describe **modeled habitat suitability**, not a calibrated probability or a known mushroom find. The model is unvalidated. Check local collection rules and have mushrooms professionally identified before eating them.

## Run locally

```sh
git clone git@github.com:andrinr/shrooms.git
cd shrooms
python3 -m http.server 8000
```

Open **http://localhost:8000** in a current browser. Directly opening `index.html` also works; compressed data require browser support for `DecompressionStream`.

The basemap, habitat data, and weather snapshot are bundled. Optional weather refresh, external links, and Google Fonts use the internet; system fonts provide a fallback. Snapshots older than 48 hours are excluded from scoring.

## Deploy to GitHub Pages

In the repository, choose **Settings → Pages → Deploy from a branch → main → / (root)**. The site uses relative paths and includes `.nojekyll`.

CI also produces a `shrooms-static-site` artifact containing just deployable files and license notices. See [development instructions](docs/development.md) for packaging and data refresh commands.

## Data and model

| Source | Used for |
| --- | --- |
| [GIS-ZH](https://www.zh.ch/de/politik-staat/opendata/offene-geodaten.html) | Forest composition, canopy, terrain, boundaries, forest reserves |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | Roads, rivers, and settlement locations |
| [Open-Meteo](https://open-meteo.com/en/docs) | Regional weather at 32 locations on a 10 km lattice |

Weather is much coarser than the forest grid. Soil acidity, deadwood, frost damage, and fine-scale microclimate are not modeled. Forest reserves are excluded, but the map does not establish collection permission.

**[Model, weights, provenance, and limitations →](docs/model-and-data.md)**

## Development

Node 22 is used in CI. No package installation is needed for the application checks:

```sh
node scripts/check_syntax.cjs
node --test tests/*.test.cjs
node scripts/package_site.cjs
```

CI runs on pushes and pull requests. Tests use committed data and fixed dates, so they do not depend on external weather or map services.

**[Data preparation, Python tools, CI, and project layout →](docs/development.md)**

## License

Original application code, scripts, documentation, and artwork are **[MIT licensed](LICENSE)**. Third-party data and libraries keep their own licenses, including OpenStreetMap’s ODbL, Open-Meteo’s CC BY 4.0, and Leaflet’s BSD 2-Clause license.

See **[third-party notices](THIRD_PARTY_NOTICES.md)** for attribution, data transformations, font sources, and service terms.
