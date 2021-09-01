import React, {useState, useEffect, useRef} from 'react';
import axios from 'axios';
import StationMarker from "./StationMarker";

const StationMarkers = () => {

  // initialize station markers on map
  const [stations, setStations] = useState([]);  
  useEffect(() => {
    const fetchData = async () => {
      const result = await axios.get('http://localhost:5000/stationLocations'); 
      const stations = result.data.map(station => (
        {...station, isPicked: false}
      ));
      setStations(stations);
    };
    fetchData();
  }, []);

  // subscribe to events channel
  const eventSourceRef = useRef(null)
  // assign ref to source, will persist across renders

  useEffect(() => {
    eventSourceRef.current = new EventSource('http://localhost:5000/messaging')
    const eventSource = eventSourceRef.current

    const onError = error => {
      console.log(error)
      eventSource.close()
    }

    eventSource.addEventListener('error', onError);

    return () => {
      // clean up function 
      eventSource.close()
      eventSource.removeEventListener('error',onError)
    }
  }, []);

  return (
    stations.map(station => 
      <StationMarker 
        key={station.code} 
        code={station.code} 
        latLng={[station.latitude, station.longitude]}
        description={station.description}
        eventSource={eventSourceRef.current}
      />
    )
  )
}

export default StationMarkers;

//<div>Icons made by <a href="https://www.freepik.com" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a></div>
