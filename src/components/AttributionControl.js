import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

export default function AttributionControl() {
  const map = useMap();
  useEffect(() => {
    if (map && map.attributionControl) {
      map.attributionControl.setPrefix(false);
    }
  }, [map]);
  return null;
}

