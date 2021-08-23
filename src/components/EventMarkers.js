import React, {useState, useEffect} from 'react';
import axios from 'axios';
import { CircleMarker } from "react-leaflet";

function toRadius(magnitude) {
  // 0th index is for mag<1, then mag=1+, and so on up to 33.32 for mag>8
  const radiiPixels = [4, 4, 5, 6, 7, 8.5, 11, 13.5, 16]
  return radiiPixels[magnitude < 8 ? Math.floor(magnitude) : 8]
}

const EventMarkers = () => {

  const [events, setEvents] = useState([]);  

  useEffect(() => {
    const fetchData = async () => {
      const result = await axios.get('http://localhost:5000/eventsList'); 
      setEvents(result.data);
    };
    fetchData();
  }, []);

  return (
    events.map(event => 
      <CircleMarker 
        stroke={false}
        fillOpacity={0.3}
        key={event.publicID} 
        center={[event.latitude_value, event.longitude_value]}
        radius={toRadius(event.magnitude_value)}
      />
    )
  );
}

export default EventMarkers;

