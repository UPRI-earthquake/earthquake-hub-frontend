import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

/**
 * Removes the default Leaflet attribution prefix for a cleaner footer.
 * @returns {null}
 */
export default function AttributionControl() {
  const map = useMap();
  useEffect(() => {
    if (map && map.attributionControl) {
      map.attributionControl.setPrefix(false);
    }
  }, [map]);
  return null;
}
