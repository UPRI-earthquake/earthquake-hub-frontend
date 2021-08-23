import React, {useState, useEffect} from 'react';
import axios from 'axios';
import { Marker } from "react-leaflet";
import { Icon } from "leaflet";

const StationMarkers = () => {

  const triangle = new Icon({
    iconUrl:'/triangle.svg',
    iconSize: [10,10]
  });

  const [stations, setStations] = useState([]);  

  useEffect(() => {
    const fetchData = async () => {
      const result = await axios.get('http://localhost:5000/stationLocations'); 
      setStations(result.data);
    };
    fetchData();
  }, []);

  return (
    stations.map(station => 
      <Marker 
        key={station.code} 
        position={[station.latitude, station.longitude]}
        icon={triangle}
      />
    )
  );
}

export default StationMarkers;

//<div>Icons made by <a href="https://www.freepik.com" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a></div>
