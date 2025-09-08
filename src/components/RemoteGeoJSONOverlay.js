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

const RemoteGeoJSONOverlay = forwardRef(function RemoteGeoJSONOverlay(
  { url, style, filterBbox, lineOnly = true },
  ref
) {
  const [data, setData] = React.useState(null);
  const gjRef = useRef(null);

  React.useEffect(() => {
    let cancelled = false;
    const key = JSON.stringify({ url, filterBbox, lineOnly });
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
  }, [url, filterBbox, lineOnly]);

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
    interactive: false,
  };
  const element = <GeoJSON ref={gjRef} data={data} style={mergedStyle} />;

  return element;
});

export default RemoteGeoJSONOverlay;
