import React, {useState, useEffect} from 'react';
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
  useEffect(() => {
    const source = new EventSource('http://localhost:5000/messaging');

    source.onmessage = function logEvents(event) {      
      // check event.event, run an update-function based on it
      // response.write("event: event-type\n");
      // use addEventListener
      const data = JSON.parse(event.data)
      setStations(prevStations => {
        const newStations = prevStations.map(
          station => {
            var isPicked = station.isPicked
            if(station.code === data.stationCode){
              isPicked = !isPicked;
            }
            return {
              "code":station.code, 
              "latitude":station.latitude,
              "longitude":station.longitude,
              "isPicked":isPicked,
            }
          }
        )
        return newStations
      });
    }
    // clean up funcation 
    return () => { source.close() }
  }, [])

  return (
    stations.map(station => 
      <StationMarker 
        key={station.code} 
        code={station.code} 
        latLng={[station.latitude, station.longitude]}
        isPicked={station.isPicked}
      />
    )
  );
}

export default StationMarkers;

//<div>Icons made by <a href="https://www.freepik.com" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a></div>
