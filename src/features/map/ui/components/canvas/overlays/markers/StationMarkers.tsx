import { useEffect, useMemo, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import StationMarkerItem from './StationMarkerItem';
import { Station } from '@/features/map/types/station';
import useStations from '@/features/map/hooks/useStations';


/**
 * Renders station markers with filters mirrored from the station list, plus slight location jittering.
 */
export default function StationMarkers() {
  
  const { viewableStations: stations } = useStations();

  // TODO: Formatting must be done in items; obscuring location in backend
  // const formattedStations = useMemo(() => {
  //   return stations.map((station) => {
  //       const net = String(station.network || 'AM').toUpperCase();
  //       const code = String(station.code || '').toUpperCase();
  //       const key = `${net}:${code}`;
  //       const latNum = Number(station.latitude);
  //       const lonNum = Number(station.longitude);
  //       if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return null;
  //       const jittered = jitterRef.current.get(key) || obscureLocation(latNum, lonNum);
  //       if (!jitterRef.current.has(key)) jitterRef.current.set(key, jittered);
  //       const [lat, lon] = jittered;
  //       const displayLng = normalizeLngNear(lon, centerLng);
  //       return {
  //         key,
  //         net,
  //         code,
  //         latLng: [lat, displayLng],
  //         description: station.description,
  //         activity: station.activity,
  //       };
  //     })
  //     .filter(Boolean);
  // }, [stations, centerLng]);

  return <>{stations.map((station) => (
    <StationMarkerItem key={station.code} station={station} />
  ))}</>;
}

// TODO: Obscuring location must be done in backend
function obscureLocation(lat: number, lon: number) {
  // 1deg is 111km, 100m is 0.0009deg
  // randomize with value around -500m to 500m
  return [lat + (Math.random() - 0.499) / 100, lon + (Math.random() - 0.499) / 100];
}

//<div>Icons made by <a href="https://www.freepik.com" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a></div>
