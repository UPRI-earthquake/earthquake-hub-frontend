import React, {useState} from 'react';
import StationMarker from "./StationMarker";

function obscureLocation(lat, lon){
  // 1deg is 111km, 100m is 0.0009deg
  // randomize with value around -500m to 500m
  return [lat + (Math.random()-0.499)/100,
          lon + (Math.random()-0.499)/100]
}

const StationMarkers = ({initStations}) => {

  // initialize station markers on map
  const [stations, ] = useState(initStations);  

  return (
    stations.map(station => 
      <StationMarker 
        network={station.network}
        key={station.code} 
        code={station.code} 
        latLng={obscureLocation(station.latitude, station.longitude)}
        description={station.description}
      />
    )
  )
}

export default StationMarkers;

//<div>Icons made by <a href="https://www.freepik.com" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a></div>
