# Add a mushroom or improve its habitat indicators

You can contribute through GitHub without setting up a development environment. Contributions in English, German, French, Italian or Romansh are welcome.

## Option 1: suggest a species without code

1. Open **[Suggest a mushroom species](https://github.com/andrinr/shrooms/issues/new?template=species.yml)**.
2. Give its scientific name, habitat, tree partners and typical fruiting season.
3. Link sources and explain which facts they support. Mention differences between Switzerland and the source region.
4. List important inputs that are not mapped, such as soil pH or deadwood. Optional translated names are helpful.

Maintainers can turn the suggestion into a profile. You do not need to supply numerical coefficients or all five translations to open an issue. Please do not publish precise private collecting locations.

For a new data source or factor, use **[Suggest a habitat indicator](https://github.com/andrinr/shrooms/issues/new?template=indicator.yml)**.

## Option 2: add a profile in a pull request

Most new species require editing only **two files**:

- [`src/data.js`](src/data.js): species, model inputs, sources and missing indicators.
- [`src/locales.js`](src/locales.js): common name, habitat note and any new visible labels in all five languages.

On GitHub, fork the repository, open a file and use the pencil button to edit. Copy an existing profile, choose a new stable ID, update its fields and translations, then open a pull request. CI runs the checks for you. A profile using existing indicators needs no geodata rebuild, database migration, route or dropdown change: the map, API and saved spots use the shared catalog automatically. A running backend must be restarted when deploying catalog changes.

### Profile reference

This is the existing slippery jack profile, shown as an example of the shape to copy:

```js
slippery: {
  name: 'Slippery jack',
  local: 'Butterpilz',
  latin: 'Suillus luteus',
  months: [7, 8, 9, 10, 11],
  temp: [8, 18],
  host: { beech: 0, oak: 0, conifer: 1, other: 0 },
  requiredTree: 'pine',
  canopy: 'open',
  note: 'Pine-associated woodland. Uses mapped pine share where available; soil chemistry and tree age are not mapped.',
  unmapped: ['Soil chemistry', 'Tree age'],
  sources: [{
    title: 'First Nature — Suillus luteus',
    url: 'https://www.first-nature.com/fungi/suillus-luteus.php'
  }]
}
```

The tree association has ecological support. **The temperature band, canopy category and numerical preferences are provisional modeling choices**, not measured thresholds. Explain such assumptions in the pull request; a citation to a general habitat guide does not validate the coefficients. Do not copy numbers to a new species and present them as evidence.

| Field | Meaning and constraints |
| --- | --- |
| Catalog key | Stable lowercase ID, e.g. `spruce_milkcap`. Saved spots store this ID; do not rename or remove existing IDs without a migration. |
| `name`, `local`, `latin` | English common name, German common name and scientific name. Scientific names must be unique. |
| `months` | Unique month numbers 1–12. Provisional season window, not a daily prediction. |
| `temp` | Increasing pair in °C for the **regional 7-day mean air temperature** response, not soil temperature or daily maxima. Validation accepts −30 to 50; this is a guardrail, not a recommended biological range. |
| `host` | Relative suitability coefficients 0–1 for `beech`, `oak`, `conifer`, `other`. These are not measured tree percentages. `other` is the remaining broadleaf share. At least one coefficient must be positive. |
| `host: null` | Uses the existing forest-edge proxy, as for Parasol. It does **not** mean “ignore trees” or “use deadwood”; request a model change if that is what you need. |
| `requiredTree` | Optional `pine`, `spruce`, `beech`, `oak` or `fir`. Overrides the general host response with the measured share of that tree. Requires a non-null host profile. Missing share is omitted; measured zero is a weak host signal. It is not a hard exclusion of the cell. |
| `canopy` | `open` or `closed`, selecting an existing response curve. Explain the assumption; intermediate/unknown preferences require a model change. |
| `note` | Short, plain-language habitat description including the most important uncertainty. |
| `unmapped` | Array of relevant unavailable indicators. Displayed under “Ecology & limits”; these **do not contribute to the score**. |
| `sources` | One or more `{title,url}` entries, with HTTPS URLs. Prefer inventories, research and authored field guides; identify what is supported and the source region. |

Unknown profile fields fail validation. Adding `soilPH`, `altitude` or `moisturePreference` to a profile alone would otherwise have no effect, so these cannot silently pass CI.

### Available indicators

| Input | Availability and interpretation |
| --- | --- |
| Broadleaf / conifer mix | Both national and Zürich datasets; missing coverage remains unknown. |
| Beech, oak, pine, spruce, fir; canopy | Available where surveyed in Zürich. National individual host-tree shares and canopy are missing and omitted. General national host scoring uses the known broadleaf/conifer split without inventing specific trees. |
| Rain, soil water, air humidity, temperature, sunshine, reference evaporation | Regional weather, blended across anchors; not cell-scale measurements. Stale weather is omitted. Sunshine is context, not an extra score factor. |
| Slope and aspect | Zürich terrain at 50 m; national source at 200 m. Used by a shared provisional moisture-retention response. |
| Elevation | Displayed but not currently an independent score factor. |
| Forest percentage | Used for the Parasol edge proxy. At the Zürich 50 m mask it is usually 100%, so this proxy has limited discriminatory power there. |
| Soil pH, deadwood, moss, tree age, fungal presence | Unavailable. List as missing; do not infer them from forest type. |

All profiles currently share the moisture and terrain response curves and the six global weights. Species-specific host, canopy, temperature and season preferences already vary. Adding species-specific moisture curves requires explicit code and evidence, not a new unused property.

### Translations

Each row in `src/locales.js` has five columns separated by `|`:

```text
English|Swiss Standard German|French|Italian|Rumantsch Grischun
```

Add a row for the exact `name`, `note` and each new `unmapped` label. Reuse existing labels where possible. Do not put a literal pipe or newline inside a column. Named placeholders must match. Scientific names are an acceptable Romansh label where a reliable common name is unavailable. Request language help in your PR if needed; do not invent vernacular names. Source titles retain their bibliographic wording.

### Local checks (optional for GitHub-only contributors)

Use Node 24+, with no npm dependencies to install:

```sh
node scripts/check_species.cjs
npm run check
npm test
npm start
```

`npm test` builds the frontend first. Open http://localhost:3000, select the new species, inspect the habitat factors and sources, switch languages, and try both Zürich and another canton. A pine/spruce specialist must show an unavailable host factor where the corresponding tree data are missing.

## Adding a genuinely new indicator

Open an indicator issue first to discuss the evidence and available dataset. A complete implementation needs:

1. A licensed source with units, resolution, coverage, dates and missing-value definitions.
2. A reproducible preparation step in `scripts/` and provenance in the generated metadata; keep unavailable regions null.
3. A response function and missing-data behavior in [`src/scoring.js`](src/scoring.js), plus schema support in `scripts/check_species.cjs`. Explain weights and possible double counting with existing factors.
4. Visible units, explanations and limitations in `src/app.js` and all translations.
5. Tests showing that the factor changes scores in the intended direction, does not turn missing into zero, and does not alter unrelated species accidentally.
6. Updated [model documentation](docs/model-and-data.md), source notices, and bounded static bundles. Keep frontend and backend on the same scoring module.

The model has not been validated against Swiss mushroom observations. Species additions and ecological references do not turn its output into calibrated probabilities or establish identification, edibility or collection permission.

## Translation style

Write for someone planning a walk, using natural sentences rather than word-for-word English. German uses Swiss Standard German, «du», Swiss spelling and familiar local terms such as «Föhre». French uses «vous»; Italian uses «tu». Keep terminology consistent across buttons, descriptions, legends and warnings. In particular, the heatmap describes habitat suitability, not temperature or a measured probability of finding mushrooms.

Translate complete thoughts wherever possible. Check text split around links in the rendered page so that the sentence is grammatical as a whole. Preserve scientific names, place names, units and placeholder names. Check long labels at narrow widths. Catalog checks verify completeness and placeholders, not linguistic quality; Romansh and unfamiliar regional terminology should be reviewed by fluent speakers before being described as fully reviewed.
