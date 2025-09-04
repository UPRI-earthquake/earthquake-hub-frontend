#!/usr/bin/env bash
set -euo pipefail

# This script documents the steps to prepare local tiles for development.
# Requirements (install locally or run in suitable Docker images):
# - tippecanoe (vector tiles)
# - gdal2tiles.py (raster → XYZ)
# - mapshaper (optional cleaning/simplification)
# - tileserver-gl-light (to serve MBTiles) or maptiler/tileserver-gl docker image

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
DATA_DIR="$ROOT_DIR/data"
MBTILES_DIR="$DATA_DIR/mbtiles"
RASTER_DIR="$DATA_DIR/raster"
mkdir -p "$MBTILES_DIR" "$RASTER_DIR"

echo "== Download plate boundaries (PB2002) GeoJSON =="
curl -L -o "$DATA_DIR/PB2002_boundaries.json" \
  https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json

echo "== Download GEM Global Active Faults (harmonized) GeoJSON =="
curl -L -o "$DATA_DIR/gem_active_faults_harmonized.geojson" \
  https://raw.githubusercontent.com/GEMScienceTools/gem-global-active-faults/master/geojson/gem_active_faults_harmonized.geojson

echo "== Optional: simplify with mapshaper to speed up tiles =="
# npm i -g mapshaper
# mapshaper $DATA_DIR/gem_active_faults_harmonized.geojson -quiet -simplify 10% keep-shapes -o $DATA_DIR/gem_active_faults_simplified.geojson
# mapshaper $DATA_DIR/PB2002_boundaries.json -quiet -simplify 10% keep-shapes -o $DATA_DIR/PB2002_boundaries_simplified.json

echo "== Build vector tiles with tippecanoe =="
# brew install tippecanoe (or use Linux packages)
tippecanoe -o "$MBTILES_DIR/faults.mbtiles" -l faults -Z0 -z14 --no-tile-size-limit \
  "$DATA_DIR/gem_active_faults_harmonized.geojson"
tippecanoe -o "$MBTILES_DIR/plates.mbtiles" -l plates -Z0 -z6 \
  "$DATA_DIR/PB2002_boundaries.json"

echo "== Serve MBTiles using tileserver-gl-light =="
# npm i -g tileserver-gl-light
# tileserver-gl-light "$MBTILES_DIR/faults.mbtiles" "$MBTILES_DIR/plates.mbtiles" --port 8080
# Then set:
#  REACT_APP_FAULTS_VT_URL=http://localhost:8080/data/faults/{z}/{x}/{y}.pbf
#  REACT_APP_PLATES_VT_URL=http://localhost:8080/data/plates/{z}/{x}/{y}.pbf

echo "== Population density raster tiles (supply your own GeoTIFF) =="
echo "Place your GeoTIFF (e.g., worldpop_ph.tif) at $RASTER_DIR and run:"
cat <<'EOS'
  gdal2tiles.py -z 0-12 -w none worldpop_ph.tif worldpop_tiles
  # serve worldpop_tiles as static files at http://localhost:8082/tiles/{z}/{x}/{y}.png
  # set REACT_APP_POP_XYZ_URL accordingly
EOS

echo "Done."

