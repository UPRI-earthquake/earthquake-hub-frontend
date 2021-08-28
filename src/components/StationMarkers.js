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

    function switchStationPickStatus(stationCode, pickStatus){
      setStations(prevStations => {
        const newStations = prevStations.map(
          station => {
            var isPicked = station.isPicked
            if(station.code === stationCode){
              console.log('Set station '+stationCode+' to '+ pickStatus)
              isPicked = pickStatus;
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

    source.onmessage = (event) => {      
      // check event.event, run an update-function based on it
      // response.write("event: event-type\n");
      // use addEventListener
      const data = JSON.parse(event.data)
      switchStationPickStatus(data.stationCode, true)
      setTimeout(() => {
        switchStationPickStatus(data.stationCode, false)
      }, 6000)
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
