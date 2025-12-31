import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import { filterStations } from '../utils/stationFilters';
import StationMarker from './StationMarker';

function obscureLocation(lat, lon) {
  // 1deg is 111km, 100m is 0.0009deg
  // randomize with value around -500m to 500m
  return [lat + (Math.random() - 0.499) / 100, lon + (Math.random() - 0.499) / 100];
}

/**
 * Renders station markers with filters mirrored from the station list, plus slight location jittering.
 * @param {{initStations: Array<{network:string, code:string, latitude:number, longitude:number, description?:string}>, filters?: {searchText?: string, statusFilter?: string|null}}} props
 */
const StationMarkers = ({ initStations = [], filters = {} }) => {
  // initialize station markers on map
  const [stations, setStations] = useState(initStations);
  const map = useMap();
  const [centerLng, setCenterLng] = useState(() => {
    try {
      return map?.getCenter?.().lng ?? 0;
    } catch (_) {
      return 0;
    }
  });
  const jitterRef = useRef(new Map());

  // Keep stations in sync when upstream changes (e.g., SSE/status update)
  useEffect(() => {
    setStations(initStations || []);
  }, [initStations]);

  useEffect(() => {
    if (!map) return undefined;
    const onMove = () => {
      try { setCenterLng(map.getCenter().lng); } catch (_) {}
    };
    map.on('moveend', onMove);
    return () => {
      map.off('moveend', onMove);
    };
  }, [map]);

  const normalizeLngNear = (lng, refLng) => {
    if (!Number.isFinite(lng) || !Number.isFinite(refLng)) return lng;
    let x = lng;
    while (x - refLng > 180) x -= 360;
    while (x - refLng < -180) x += 360;
    return x;
  };

  const visibleStations = useMemo(() => {
    const filtered = filterStations(stations || [], filters || {});
    return filtered
      .map((station) => {
        const net = String(station.network || 'AM').toUpperCase();
        const code = String(station.code || '').toUpperCase();
        const key = `${net}:${code}`;
        const latNum = Number(station.latitude);
        const lonNum = Number(station.longitude);
        if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return null;
        const jittered = jitterRef.current.get(key) || obscureLocation(latNum, lonNum);
        if (!jitterRef.current.has(key)) jitterRef.current.set(key, jittered);
        const [lat, lon] = jittered;
        const displayLng = normalizeLngNear(lon, centerLng);
        return {
          key,
          net,
          code,
          latLng: [lat, displayLng],
          description: station.description,
          activity: station.activity,
        };
      })
      .filter(Boolean);
  }, [stations, filters, centerLng]);

  return visibleStations.map((station) => (
    <StationMarker
      network={station.net}
      key={station.key}
      code={station.code}
      latLng={station.latLng}
      description={station.description}
      activity={station.activity}
    />
  ));
};

export default StationMarkers;

//<div>Icons made by <a href="https://www.freepik.com" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a></div>
