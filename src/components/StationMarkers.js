import React, {useState, useEffect} from 'react';
import axios from 'axios';
import StationMarker from "./StationMarker";

const StationMarkers = () => {

  // initialize station markers on map
  const [stations, setStations] = useState([]);  
  useEffect(() => {
    const fetchData = async () => {
      // TODO: Refactor, put this on App.js, then pass as props
      const result = await axios.get(`${process.env.REACT_APP_BACKEND}/stationLocations`); 
      const stations = result.data.map(station => (
        {...station, isPicked: false}
      ));
      setStations(stations);
    };
    fetchData();
  }, []);

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
