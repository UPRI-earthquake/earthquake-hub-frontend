import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { GeoJSON } from 'react-leaflet';

// simple in-memory cache so toggling overlays does not refetch/parse large files
const cache = new Map(); // key => FeatureCollection

function featureInBbox(feature, bbox) {
  if (!bbox) return true;
  const [minX, minY, maxX, maxY] = bbox; // lon/lat bbox
  const geom = feature && feature.geometry;
  if (!geom) return false;

  const testCoord = ([x, y]) => x >= minX && x <= maxX && y >= minY && y <= maxY;

  switch (geom.type) {
    case 'LineString':
      return geom.coordinates.some(testCoord);
    case 'MultiLineString':
      return geom.coordinates.some((line) => line.some(testCoord));
    case 'Polygon':
      return geom.coordinates.some((ring) => ring.some(testCoord));
    case 'MultiPolygon':
      return geom.coordinates.some((poly) => poly.some((ring) => ring.some(testCoord)));
    case 'Point':
      return testCoord(geom.coordinates);
    case 'MultiPoint':
      return geom.coordinates.some(testCoord);
    default:
      return true;
  }
}

// Shift a GeoJSON geometry's longitudes by a constant delta (in degrees)
function shiftGeometryLng(geom, delta) {
  if (!geom || !delta) return geom;
  const shiftCoord = (c) => {
    if (!Array.isArray(c)) return c;
    // Allow 2D or 3D coords; adjust only longitude (index 0)
    const out = c.slice();
    if (typeof out[0] === 'number') out[0] = out[0] + delta;
    return out;
  };
  const shiftLine = (line) => Array.isArray(line) ? line.map(shiftCoord) : line;
  const shiftMulti = (multi) => Array.isArray(multi) ? multi.map(shiftLine) : multi;

  switch (geom.type) {
    case 'Point':
      return { ...geom, coordinates: shiftCoord(geom.coordinates) };
    case 'MultiPoint':
    case 'LineString':
      return { ...geom, coordinates: shiftLine(geom.coordinates) };
    case 'MultiLineString':
    case 'Polygon':
      return { ...geom, coordinates: shiftMulti(geom.coordinates) };
    case 'MultiPolygon':
      return { ...geom, coordinates: Array.isArray(geom.coordinates) ? geom.coordinates.map(shiftMulti) : geom.coordinates };
    default:
      return geom;
  }
}

const RemoteGeoJSONOverlay = forwardRef(function RemoteGeoJSONOverlay(
  {
    url,
    style,
    filterBbox,
    lineOnly = true,
    worldCopies = false,
    interactive = false,
    onEachFeature,
  },
  ref
) {
  const [data, setData] = React.useState(null);
  const gjRef = useRef(null);

  React.useEffect(() => {
    let cancelled = false;
    const key = JSON.stringify({ url, filterBbox, lineOnly, worldCopies });
    const cached = cache.get(key);
    if (cached) {
      setData(cached);
      return undefined;
    }

    const controller = new AbortController();
    async function load() {
      try {
        const res = await fetch(url, { cache: 'default', signal: controller.signal });
        const gj = await res.json();
        if (cancelled) return;
        let features = Array.isArray(gj.features) ? gj.features : [];
        if (filterBbox) features = features.filter((f) => featureInBbox(f, filterBbox));
        if (lineOnly) features = features.filter((f) => {
          const t = f?.geometry?.type;
          return t === 'LineString' || t === 'MultiLineString';
        });
        // If requested, add left/right world copies by shifting longitudes ±360°
        if (worldCopies) {
          const left = features.map((f) => ({
            ...f,
            geometry: shiftGeometryLng(f.geometry, -360),
            properties: { ...(f.properties || {}), _copy: -1 },
          }));
          const right = features.map((f) => ({
            ...f,
            geometry: shiftGeometryLng(f.geometry, 360),
            properties: { ...(f.properties || {}), _copy: 1 },
          }));
          features = [...left, ...features, ...right];
        }

        const fc = { type: 'FeatureCollection', features };
        cache.set(key, fc);
        setData(fc);
      } catch (e) {
        if (e.name !== 'AbortError') {
          // eslint-disable-next-line no-console
          console.error('GeoJSON load error:', e);
        }
      }
    }
    // defer parsing work to next tick to keep UI responsive
    const id = setTimeout(load, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
      controller.abort();
    };
  }, [url, filterBbox, lineOnly, worldCopies]);

  // Expose underlying Leaflet layer via ref (compat for v2/v3 forks)
  useImperativeHandle(
    ref,
    () => {
      const inst = gjRef.current;
      if (!inst) return null;
      return inst.leafletElement || inst; // v2 uses leafletElement, v3 returns the Leaflet instance directly
    }
  );

  if (!data) return null;
  const mergedStyle = {
    ...style,
    fill: false,
    fillOpacity: 0,
    // Allow callers to opt-in to interaction for hover tooltips, etc.
    interactive: Boolean(interactive),
    className: 'remote-geojson-layer',
  };
  const element = (
    <GeoJSON
      ref={gjRef}
      data={data}
      style={mergedStyle}
      // Pass through optional feature hook for tooltips/highlights
      onEachFeature={onEachFeature}
    />
  );

  return element;
});

export default RemoteGeoJSONOverlay;
