import StationMarkerItem from './StationMarkerItem';
import useStations from '@/features/map/hooks/useStations';


/**
 * Renders station markers with filters mirrored from the station list.
 */
export default function StationMarkers() {
  
  const { viewableStations: stations } = useStations();

  return <>{stations.map((station) => (
    <StationMarkerItem key={station.code} station={station} />
  ))}</>;
}

//<div>Icons made by <a href="https://www.freepik.com" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a></div>
