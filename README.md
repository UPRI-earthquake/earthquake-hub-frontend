# earthquake-hub-frontend
This is the user interface for the earthquake-hub web application which is the client-side code served as static html files by the backend. It is the front-end component of the web application that provides real-time information about seismic events, sensor data visualization, access to the data archive, and citizen science account information.

## Local Development Setup
To run this repository on your local machine, please follow the instructions provided under the [Setting Up The Repository On Your Local Machine](CONTRIBUTING.md#setting-up-the-repository-on-your-local-machine) section of the [contributing.md](CONTRIBUTING.md).

## Basemaps & Overlays

- Run locally: `npm start` (ensures `public/config.js` is generated from `.env`).
- Keys and URLs: add the following to `.env` (or copy `.env.example` and edit):
  - `REACT_APP_FAULTS_VT_URL=https://YOUR_TILESERVER/faults/{z}/{x}/{y}.pbf`
  - `REACT_APP_PLATES_VT_URL=https://YOUR_TILESERVER/plates/{z}/{x}/{y}.pbf`
  - `REACT_APP_POP_XYZ_URL=https://YOUR_TILESERVER/worldpop/{z}/{x}/{y}.png`
  - Optional: `REACT_APP_ESRI_API_KEY=` (not required for Esri World Imagery raster in dev).

### Basemap Choices
- OSM Standard, CartoDB Positron/Dark Matter, and Esri World Imagery via `leaflet-providers`.
- Attribution is handled by each provider; the global Leaflet prefix is removed.

### Overlays
- Fault Lines (vector tiles, PBF) and Plate Boundaries (vector tiles, PBF) using `leaflet.vectorgrid`.
- Population Density (XYZ/WMTS raster, e.g., WorldPop or GHSL) using `TileLayer`.

### Data Conversion Notes
- Vector tiles: convert GeoJSON to MBTiles with `tippecanoe`, then serve as `/{z}/{x}/{y}.pbf` via a tileserver.
  - Example: `tippecanoe -o faults.mbtiles --layer=faults --no-tile-size-limit faults.geojson`
- Raster tiles: convert GeoTIFF to XYZ/WMTS (e.g., `gdal2tiles.py`, `rio-tiler`) and publish as `/{z}/{x}/{y}.png` with reasonable zooms (e.g., 0–10 global).

### Licensing & Attribution
- OSM: follow Tile Usage Policy.
- Carto: attribution required; CDN suitable for moderate use.
- Esri World Imagery: raster suitable for dev; production may require ArcGIS Developer account/API key.
- WorldPop: CC BY 4.0; project includes a proper credit string.
