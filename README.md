![shrooms — Follow the fungi.](docs/media/banner.png)

# shrooms

**Follow the fungi.** Explore mushroom habitat across **Switzerland**, compare species, and keep a private forest notebook.

[![CI](https://github.com/andrinr/shrooms/actions/workflows/ci.yml/badge.svg)](https://github.com/andrinr/shrooms/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/code-MIT-limegreen.svg)](LICENSE)

## Explore

![Map walkthrough: zooming into forests and comparing mushroom heatmaps](docs/media/showcase.gif)

*Zürich map walkthrough recorded September 2026, before the nationwide expansion. Scores illustrate the interface, not current conditions. Basemap: GIS-ZH and © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).*

- **Locate yourself:** an optional browser location button shows your position and accuracy on the map, without saving or sending coordinates to the backend. Online map tiles reveal the viewed area to swisstopo; use the bundled map to avoid those requests.
- **Five languages:** Deutsch, Français, Italiano, Rumantsch Grischun and English, including map explanations and warnings.
- **Zoom-aware Swiss map:** swisstopo topography across all cantons, with roads, names and contours above the heatmap. Switch to the bundled offline map anytime; blocked tiles automatically fall back.
- **One continuous Swiss map:** local datasets load automatically as you zoom and pan, including across canton boundaries. The canton selector is a shortcut, not a filter. [Sources and detailed forest-map candidates](docs/FOREST_DATA.md).
- **Forest-shaped overview:** real forest footprints replace fixed-size squares, with simpler outlines at country scale and more detail nearby.
- **Finer habitat detail:** 50 m local cells across Switzerland, a 25 m swissTLM3D forest mask outside Zürich, and a 500 m national overview. Source precision varies; national terrain remains 200 m.
- **Eleven mushrooms:** the original seven plus winter chanterelle, slippery jack, spruce milkcap and charcoal burner. Every profile includes ecological references and missing indicators.
- **Soil acidity:** on-demand WSL topsoil pH predictions from a native 25 m grid, with uncertainty intervals. A small experimental score factor for porcini, chanterelle and bay bolete; uncertainty reduces its influence. [Data, resolution and modeling limits](docs/SOIL.md).
- **Explainable scores:** tree mix, moisture, temperature, slope, aspect and season. Missing inputs are explicitly omitted.
- **Browser notebook:** save places, species and notes locally, without an account. Saved places appear as clickable stars on the map. Export and import JSON backups to move between devices. Clearing browser data removes local spots.
- **Shared weather:** the backend refreshes a cached snapshot every six hours, instead of making every visitor contact the provider.
- **Protected-area overlays:** named boundaries and collection warnings, with partial coverage clearly marked.
- **Bundled maps:** no dependency on live map tiles; pan, zoom, search municipalities and inspect forest cells.

> Scores are **unvalidated habitat suitability estimates**, not calibrated probabilities, mushroom sightings, or permission to collect. Check local rules and have mushrooms professionally identified before eating them.

## Run locally

Requires **Node.js 24 or newer**. There are no runtime npm dependencies.

```sh
git clone git@github.com:andrinr/shrooms.git
cd shrooms
npm run build
npm start
```

Open **http://localhost:3000**. Saved places stay in the browser’s local storage, including on static hosting. Each origin has its own notebook; export/import a backup to move between localhost and a deployed site. Only the optional weather cache needs server storage in `.storage/`.

## Deploy cheaply

**Static hosting is enough:** build `_site/` and deploy to GitHub Pages. The map and notebook need no server or account. For scheduled shared weather updates, the optional Docker Compose setup runs on a small Linux server with Caddy for HTTPS.

```sh
cp .env.example .env
# Set DOMAIN to a hostname pointing to your server.
docker compose up -d --build
```

**[Deployment, upgrades and backups](docs/deployment.md)** · **[API reference](docs/api.md)** · **[Architecture](docs/architecture.md)**

No managed database, email provider or separate frontend hosting is needed. The free Open-Meteo endpoint is for non-commercial use; commercial deployments can set `OPEN_METEO_API_KEY`.

### Static preview

GitHub Pages and direct `index.html` previews still work for the map. Accounts and scheduled updates require the backend. Publish `_site/` or use Pages from `main` at the repository root. Static mode uses dated bundled weather with optional browser refresh; weather older than 48 hours is excluded from scoring.

## Data and resolution

| Region / source | Detail and limitations |
| --- | --- |
| Zürich: GIS-ZH surveys and DTM | 197,669 forest cells at 50 m; surveyed tree shares and canopy |
| Other cantons: © swisstopo swissTLM3D 2026-02 | 50 m score cells, forest edges retained on a 25 m mask; terrain still 200 m |
| FOEN / WSL National Forest Inventory | 2023 tree mix from a 10 m raster, aggregated to cells; individual host-tree shares and canopy unavailable |
| © swisstopo DHM25/200 | National elevation, slope and aspect from a 200 m source |
| Open-Meteo | Regional weather anchors; interpolation does not add local measurements |

Forest shape, terrain resolution, and weather resolution are different. Smaller cells do not establish equally precise mushroom forecasts. Protection coverage is incomplete throughout Switzerland.

**[Model, provenance and limitations](docs/model-and-data.md)** · **[Data preparation](docs/development.md)**

## Checks

```sh
npm run check
npm test
```

CI checks the model, all regional data, browser notebook persistence, legacy account isolation, weather caching and frontend assets. A separate job builds the deployment container, checks its health, restarts it, and verifies a SQLite backup. Tests use fixed dates and committed datasets.

## Add mushrooms through GitHub

No coding required: [suggest a species](https://github.com/andrinr/shrooms/issues/new?template=species.yml) or [propose a habitat indicator](https://github.com/andrinr/shrooms/issues/new?template=indicator.yml). Include the scientific name, ecological evidence and data gaps.

For a pull request, most species need only a profile and translations. The map, API and notebook discover them automatically. **[Contribution guide with a copyable example, indicator reference and checks](CONTRIBUTING.md)**.

## License

Original code, scripts, documentation and artwork are **[MIT licensed](LICENSE)**. External data and libraries retain their own terms. See **[third-party notices](THIRD_PARTY_NOTICES.md)** for attribution and service restrictions.

### Existing account data

The account UI and public account endpoints are retired. Existing server databases are preserved, not deleted or automatically copied into browser storage. Previously exported spot JSON files can be imported into the notebook. Local storage is specific to the browser and site address; it is not encrypted or synchronized.

Scores are species-specific. The details show each factor’s effective weight and multiplier, plus the selected cell’s ranking within the visible forest cells. This relative comparison changes with the viewport; the underlying habitat score does not. Fine 50 m geometry is loaded from zoom level 13; wider views use lightweight summaries.
