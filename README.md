# MycoMap Zürich

A frontend-only exploration map for mushroom habitat across the **canton of Zürich**. It works as a static GitHub Pages site: no build step, server, API key, or account is required.

## Run locally

Serve this folder with any static server, for example `python3 -m http.server 8000`, then open `http://localhost:8000`. Opening `index.html` directly also works in most browsers, but a local server is closer to GitHub Pages.

## Deploy to GitHub Pages

Push these files to a GitHub repository. In **Settings → Pages**, select **Deploy from a branch**, then select the branch and `/ (root)`. The site uses relative asset paths and `.nojekyll`, so it works at a repository subpath.

## How it works

- The included Leaflet 1.9.4 files render a navigable OpenStreetMap base map (Leaflet is BSD-2-Clause licensed; see `vendor/leaflet.js`).
- The included area anchors cover different regions of Zürich canton. Their tree mix and microhabitat notes are **indicative editorial descriptions**, not verified habitat polygons or secret collecting locations.
- The browser requests recent daily rain, temperature, and shallow soil moisture from the [Open-Meteo forecast API](https://open-meteo.com/en/docs), once for the area anchors. The API supports multiple coordinates in one request. No location is sent from the user's device.
- `src/scoring.js` combines species habitat affinity (45%), moisture (25%), recent temperature (15%), and season (15%). The number is an **uncalibrated relative signal**, never a probability of finding or identifying a species. When weather fails, habitat and season are reweighted and the UI explicitly says so.
- The model does not account for soil chemistry, actual tree inventory, shade, slope, past finds, recent picking pressure, protected-area boundaries, or forecast uncertainty.

## Sources and responsibilities

- [Open-Meteo API documentation](https://open-meteo.com/en/docs)
- [OpenStreetMap copyright and attribution](https://www.openstreetmap.org/copyright)
- [Canton of Zürich mushroom collecting guidance](https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/gesundheit/lebensmittelkontrollen/MD-00134.pdf) (current guidance checked September 2026)
- [SwissFungi distribution atlas](https://swissfungi.wsl.ch/en/distribution-data/distribution-atlas/) for species ecology context

Always confirm local access and protected-area rules before collecting. Use a municipal mushroom inspection service before eating any wild mushrooms.
