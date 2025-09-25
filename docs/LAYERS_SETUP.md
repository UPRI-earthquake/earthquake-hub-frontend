Basemaps & Overlays Setup

Overview

- Basemaps: OSM Standard, CartoDB Positron/DarkMatter, Esri World Imagery via leaflet-providers.
- Overlays (current implementation):
  - Fault Lines: Static GeoJSON (GEM harmonized faults) loaded from CDN.
  - Plate Boundaries: Static GeoJSON (PB2002) loaded from CDN.
  - Population Density (optional): XYZ/WMTS raster tiles via env var.
- React Leaflet v3 (fork) + Leaflet 1.7.1 (see `package.json`).

Configuration files

- Basemap providers and overlay helpers: `src/config/mapLayers.js:1`
- External dataset URLs (Faults, Plates): `src/config/datasets.js:1`
- Theme-aware styles and symbol scaling: `src/config/mapStyles.js:1`
- Layer controls and legend wiring: `src/components/MapLayersControl.jsx:1`, `src/components/LegendControl.jsx:1`, `src/components/layers/*.jsx`

Environment Variables (.env)

- REACT_APP_POP_XYZ_URL=https://YOUR_TILESERVER/worldpop/{z}/{x}/{y}.png

Notes

- Attribution: Base maps include provider attribution. Population layer defaults to WorldPop attribution (adjust if using GHSL) in `src/config/mapLayers.js:1`.
- Z-order & toggles: Earthquakes and Stations are toggleable inside the `LayersControl` and synchronized with the Legend via `OverlayStateContext`.
- Styling: Fault and plate line styles are theme/zoom aware and defined in `src/config/mapStyles.js:1`.

Optional: Self-hosted data sources

- Faults/Plates as GeoJSON: Host your own copies and override `DATASETS.FAULTS.cdnUrl` / `DATASETS.PLATES.cdnUrl` in `src/config/datasets.js:1`.
- Population density: Point `REACT_APP_POP_XYZ_URL` to your XYZ/WMTS service. The legend attempts to infer a last-update date from the tile server’s headers.

Troubleshooting

- If overlays don’t appear, verify network access to the CDN URLs in `src/config/datasets.js:1` and that the Population URL template is valid.
- CORS: When serving tiles locally, enable CORS headers on your server.
- CRA builds on newer Node may require `NODE_OPTIONS=--openssl-legacy-provider` (as typical for react-scripts 4).
