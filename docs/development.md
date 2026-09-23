# Development and data preparation

[← Back to shrooms](../README.md)

Run all commands from the repository root.

## Rebuild the bundled data

The optional preparation pipeline downloads several hundred MB of source data into the ignored `.cache` directory. It emits a compact static dataset; visitors never download the raw sources.

```sh
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements.txt
.venv/bin/python scripts/build_habitat.py --download
```

To rebuild from existing downloads, omit `--download`. The script fails if the forest response appears truncated or hits the configured WFS feature limit. Do not ship `.cache` or `.venv`.

Refresh the bundled weather before deploying (Node 24+):

```sh
node scripts/prefetch_weather.cjs
```

Commit the resulting `data/weather.js` and `data/national-weather.js` and deploy it with the other static files. The script preserves the previous snapshot if any weather batch is incomplete or fails. The backend refreshes its own cache every six hours. Static visitors can use the refresh button after the bundled snapshot expires. Forest rebuilds automatically call `scripts/pack_habitat.py` to produce the index and geometry chunks.

```sh
npm test
```

The tests check dry-weather sensitivity, species response to tree mix, missing data, terrain effects, exclusion of future weather, and validity of every generated cell.

## Continuous integration

[CI runs](https://github.com/andrinr/shrooms/actions/workflows/ci.yml) execute on every push and pull request, and can also be started manually. The workflow uses Node 24 and checks JavaScript syntax, Python script syntax, the ecological model, all compressed chunks through the actual loader, missing assets, and project-relative links. Tests use bundled data and fixed dates, so an aging weather snapshot or unavailable external API does not break CI.

A separate job builds the Docker image, checks Compose, starts and restarts the server, and verifies an online SQLite backup.

Each successful run uploads a `shrooms-static-site` artifact containing only deployable assets (including `.nojekyll`). Raw source downloads, caches, scripts, tests, and Git metadata are excluded. Existing branch-based GitHub Pages deployment remains supported; CI does not change the repository's Pages settings.

To run the same checks and produce the static folder locally:

```sh
node scripts/check_syntax.cjs
npm test
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

## Nationwide data

After installing the pinned Python requirements:

```sh
.venv/bin/python scripts/download_switzerland.py
.venv/bin/python scripts/build_switzerland.py
.venv/bin/python scripts/build_national_protected.py
```

The downloader pins official source URLs and checksums. Rebuilding Zürich with `build_habitat.py` produces 50 m cells. The national builder produces 100 m canton cells and a 500 m overview; it does not replace Zürich's more detailed survey. National protection combines swissTLMRegio with the committed Zürich overlay. All generated files in `data/` are committed, so runtime and CI never require Python or source downloads.

## Full application

`npm run build` packages the frontend and `npm start` runs the Node backend on port 3000. Rebuild after frontend changes. `npm run dev` restarts the backend on changes; it does not automatically rebuild assets. `npm test` builds before running the test suite. Integration tests start ephemeral local HTTP listeners and disposable SQLite databases.

`server/` contains data serving, weather caching, authentication and private spots. `src/service.js` discovers backend availability; `src/account.js` implements the notebook UI. See [architecture](architecture.md), [API](api.md) and [deployment](deployment.md).

## Languages

The frontend supports `de`, `fr`, `it`, `rm` and `en`. The header selector remembers the choice locally and adds `?lang=fr` (for example) to shareable links. Priority: valid URL language, saved preference, supported browser language, then English. Region navigation preserves the language. Changing language reloads the page; finish editing a note first.

`src/locales.js` is the bundled translation catalog: English source text followed by Swiss Standard German, French, Italian and Rumantsch Grischun. Named placeholders must match across all five columns. `src/i18n.js` translates UI text and accessible labels, including subsequently rendered map/account panels. It never changes form values. Scientific names, mapped place names and private notebook content remain unchanged; Romansh mushroom labels use scientific names rather than uncertain regional names. No translation service or network request is used.

Add entries whenever introducing interface text, including server messages shown to users. Tests check catalog completeness, placeholder parity, preference fallback and dynamic translations. Language tests are structural, not linguistic certification; native-language review is welcome, especially for Romansh and collection-rule wording. The linked official rules remain authoritative. Repository developer documentation remains in English.
