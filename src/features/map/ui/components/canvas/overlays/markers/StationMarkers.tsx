import { useEffect, useMemo, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import StationMarkerItem from './StationMarkerItem';


/**
 * Renders station markers with filters mirrored from the station list, plus slight location jittering.
 */
export default function StationMarkers({ stations = [], filters = {} }) {
  const map = useMap();
  const [centerLng, setCenterLng] = useState(() => {
    try {
      return map?.getCenter?.().lng ?? 0;
    } catch (_) {
      return 0;
    }
  });
  const jitterRef = useRef(new Map());


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

  const formattedStations = useMemo(() => {
    return stations.map((station) => {
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
  }, [stations, centerLng]);

  return <>{formattedStations.map((station) => (
    <StationMarkerItem
      network={station.net}
      key={station.key}
      code={station.code}
      latLng={station.latLng}
      description={station.description}
      activity={station.activity}
    />
  ))}</>;
}

// TODO: Obscuring location must be done in backend
function obscureLocation(lat: number, lon: number) {
  // 1deg is 111km, 100m is 0.0009deg
  // randomize with value around -500m to 500m
  return [lat + (Math.random() - 0.499) / 100, lon + (Math.random() - 0.499) / 100];
}

//<div>Icons made by <a href="https://www.freepik.com" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a></div>
