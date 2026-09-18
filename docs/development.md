# Development and data preparation

[← Back to shrooms](../README.md)

Run all commands from the repository root.

## Rebuild the bundled data

The optional preparation pipeline downloads about 500 MB of source data into the ignored `.cache` directory. It emits a compact static dataset; visitors never download the raw sources.

```sh
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements.txt
.venv/bin/python scripts/build_habitat.py --download
```

To rebuild from existing downloads, omit `--download`. The script fails if the forest response appears truncated or hits the configured WFS feature limit. Do not ship `.cache` or `.venv`.

Refresh the bundled weather before deploying (Node 18+):

```sh
node scripts/prefetch_weather.cjs
```

Commit the resulting `data/weather.js` and deploy it with the other static files. The script preserves the previous snapshot if any weather batch is incomplete or fails. No scheduled refresh is configured; after 48 hours visitors can use the refresh button. Forest rebuilds automatically call `scripts/pack_habitat.py` to produce the index and geometry chunks.

```sh
node --test tests/*.test.cjs
```

The tests check dry-weather sensitivity, species response to tree mix, missing data, terrain effects, exclusion of future weather, and validity of every generated cell.

## Continuous integration

[CI runs](https://github.com/andrinr/shrooms/actions/workflows/ci.yml) execute on every push and pull request, and can also be started manually. The workflow uses Node 22 and checks JavaScript syntax, Python script syntax, the ecological model, all compressed chunks through the actual loader, missing assets, and project-relative links. Tests use bundled data and fixed dates, so an aging weather snapshot or unavailable external API does not break CI.

Each successful run uploads a `shrooms-static-site` artifact containing only deployable assets (including `.nojekyll`). Raw source downloads, caches, scripts, tests, and Git metadata are excluded. Existing branch-based GitHub Pages deployment remains supported; CI does not change the repository's Pages settings.

To run the same checks and produce the static folder locally:

```sh
node scripts/check_syntax.cjs
node --test tests/*.test.cjs
PYTHONPYCACHEPREFIX=.cache/pycompile python3 -m py_compile scripts/*.py
node scripts/package_site.cjs
```

Serve `_site/` to preview the packaged version. No dependency installation, secrets, GIS rebuild, or live weather download is needed for CI.


## Rebuild the basemap

After downloading the GIS-ZH sources:

```sh
.venv/bin/python scripts/build_basemap.py --download
```

Omit `--download` to reuse the cached OpenStreetMap extract. The SVG and label files are committed, so visitors and CI do not need to contact the data servers.

## Repository layout

| Path | Contents |
| --- | --- |
| `src/` | UI, scoring, weather aggregation, compressed asset loading |
| `data/` | Committed habitat chunks, basemap, weather snapshot, provenance |
| `scripts/` | Optional preparation, validation, and packaging tools |
| `tests/` | Model and static-data integration checks |
| `vendor/` | Leaflet and its license |
| `docs/media/` | Recorded UI showcase; excluded from the deployment artifact |

The showcase GIF is a 14-second sequence of real browser captures cropped to the map workspace: two zoom steps followed by species changes, with two seconds per scene. Its historical scores are illustrative; they are not current conditions.

## Rebuild protected-area markings

After refreshing the cached GIS-ZH sources, run:

```sh
.venv/bin/python scripts/build_protected.py
```

Commit `data/protected.js` together with rebuilt habitat data. CI verifies that the overlay and habitat metadata refer to the same reserve source hash.
