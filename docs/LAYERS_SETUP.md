Basemaps & Overlays Setup

Overview
- Basemaps: OSM Standard, CartoDB Positron/DarkMatter, Esri World Imagery via leaflet-providers.
- Overlays: Fault Lines (vector tiles), Plate Boundaries (vector tiles), Population Density (XYZ/WMTS raster).
- React Leaflet v3 (fork) + Leaflet 1.7.1.

Environment Variables (.env)
- REACT_APP_FAULTS_VT_URL=https://YOUR_TILESERVER/faults/{z}/{x}/{y}.pbf
- REACT_APP_PLATES_VT_URL=https://YOUR_TILESERVER/plates/{z}/{x}/{y}.pbf
- REACT_APP_POP_XYZ_URL=https://YOUR_TILESERVER/worldpop/{z}/{x}/{y}.png
- Optional: REACT_APP_FAULTS_VT_LAYER_NAME=faults
- Optional: REACT_APP_PLATES_VT_LAYER_NAME=plates
- Optional: REACT_APP_ESRI_API_KEY=

KMZ → Vector Tiles (Fault Lines)
1) Place your KMZ file in the repo root (example: distribution-of-active-faults-in-the-philippines_mar2019.kmz).
2) Extract KML and convert to GeoJSON (requires GDAL/OGR):
   unzip -l distribution-of-active-faults-in-the-philippines_mar2019.kmz
   unzip distribution-of-active-faults-in-the-philippines_mar2019.kmz -d kmz_extract
   ogr2ogr -f GeoJSON faults_raw.geojson kmz_extract/doc.kml -t_srs EPSG:4326 -skipfailures -nln faults

3) Optional cleanup/simplify (install mapshaper: npm i -g mapshaper):
   mapshaper faults_raw.geojson -clean -simplify 10% keep-shapes -o format=geojson faults_clean.geojson

4) Generate vector tiles with tippecanoe (install: brew install tippecanoe or equivalent):
   tippecanoe -o faults.mbtiles -l faults -Z0 -z14 --no-tile-size-limit faults_clean.geojson

5) Serve vector tiles (choose one):
   - tileserver-gl-light (npm i -g tileserver-gl-light):
     tileserver-gl-light faults.mbtiles --port 8080
     # URL: http://localhost:8080/data/faults/{z}/{x}/{y}.pbf
   - tegola or t-rex (alternative servers) – configure to expose /{z}/{x}/{y}.pbf

6) Configure the app (.env):
   REACT_APP_FAULTS_VT_URL=http://localhost:8080/data/faults/{z}/{x}/{y}.pbf
   REACT_APP_FAULTS_VT_LAYER_NAME=faults

Plate Boundaries (Vector)
Option A — Own tiles:
1) Obtain plate boundaries dataset (e.g., PB2002 from Bird 2003, or the tectonicplates dataset by Jason Davies).
2) Convert to MBTiles with tippecanoe:
   tippecanoe -o plates.mbtiles -l plates -Z0 -z6 plates.geojson
3) Serve with tileserver-gl-light:
   tileserver-gl-light plates.mbtiles --port 8081
4) Configure:
   REACT_APP_PLATES_VT_URL=http://localhost:8081/data/plates/{z}/{x}/{y}.pbf
   REACT_APP_PLATES_VT_LAYER_NAME=plates

Option B — Hosted sources:
- If your organization exposes vector tiles via ArcGIS Vector Tile Server or Mapbox vector tiles, use the service’s /tile/{z}/{x}/{y}.pbf endpoint and set the env vars accordingly.

Population Density (Raster)
Option A — Self-hosted from GeoTIFF:
1) Get a raster (e.g., WorldPop or GHSL per-country GeoTIFF).
2) Generate XYZ tiles (gdal2tiles.py):
   gdal2tiles.py -z 0-12 -w none population.tif worldpop_tiles
3) Serve statically (nginx or any static server):
   # Example URL: http://localhost:8082/tiles/{z}/{x}/{y}.png
4) Configure:
   REACT_APP_POP_XYZ_URL=http://localhost:8082/tiles/{z}/{x}/{y}.png

Option B — Hosted services:
- ArcGIS MapServer tile endpoints or WMTS proxies that return XYZ tiles. Confirm license/attribution and set REACT_APP_POP_XYZ_URL to the tile template.

Notes
- Attribution: Base maps come with attribution from leaflet-providers. Population layer appends WorldPop attribution by default (adjust if you use GHSL).
- Z-order: Earthquakes and Stations overlays are now toggleable inside the LayersControl.
- Styling: Vector tiles default to red lines for faults and dashed purple for plates (tweak src/config/mapLayers.js).

Troubleshooting
- If you only see default grey vector tile styling, verify the layer name inside your MBTiles and set REACT_APP_*_VT_LAYER_NAME accordingly. Use tippecanoe-decode or tileserver-gl UI to inspect.
- CORS: When serving tiles locally, enable CORS headers on your server.
- CRA build on Node 18 may fail due to OpenSSL changes; develop with Node 16/18 and set NODE_OPTIONS=--openssl-legacy-provider if needed for builds.

