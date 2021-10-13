import React, {useState} from 'react';
import StationMarker from "./StationMarker";

const StationMarkers = ({initStations}) => {

  // initialize station markers on map
  const [stations, ] = useState(initStations);  

  return (
    stations.map(station => 
      <StationMarker 
        key={station.code} 
        code={station.code} 
        latLng={[station.latitude, station.longitude]}
        description={station.description}
      />
    )
  )
}

export default StationMarkers;

//<div>Icons made by <a href="https://www.freepik.com" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a></div>
