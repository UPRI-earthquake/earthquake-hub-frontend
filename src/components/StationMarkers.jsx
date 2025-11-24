import React, { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import StationMarker from './StationMarker';

function obscureLocation(lat, lon) {
  // 1deg is 111km, 100m is 0.0009deg
  // randomize with value around -500m to 500m
  return [lat + (Math.random() - 0.499) / 100, lon + (Math.random() - 0.499) / 100];
}

/**
 * Renders station markers from an initial list, with slight location jittering.
 * @param {{initStations: Array<{network:string, code:string, latitude:number, longitude:number, description?:string}>}} props
 */
const StationMarkers = ({ initStations }) => {
  // initialize station markers on map
  const [stations] = useState(initStations);
  const map = useMap();
  const [centerLng, setCenterLng] = useState(() => {
    try {
      return map?.getCenter?.().lng ?? 0;
    } catch (_) {
      return 0;
    }
  });

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

  return stations.map((station) => {
    const [lat, lon] = obscureLocation(station.latitude, station.longitude);
    const displayLng = normalizeLngNear(lon, centerLng);
    return (
      <StationMarker
        network={station.network}
        key={station.code}
        code={station.code}
        latLng={[lat, displayLng]}
        description={station.description}
        activity={station.activity}
      />
    );
  });
};

export default StationMarkers;

//<div>Icons made by <a href="https://www.freepik.com" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a></div>
