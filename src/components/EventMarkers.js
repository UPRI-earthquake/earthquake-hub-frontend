import React, {useState, useEffect} from 'react';
import axios from 'axios';
import moment from 'moment';
import { CircleMarker, Popup } from "react-leaflet";

function toRadius(magnitude) {
  // 0th index is for mag<1, then mag=1+, and so on up to 33.32 for mag>8
  const radiiPixels = [4, 4, 5, 6, 7, 8.5, 11, 13.5, 16]
  return radiiPixels[magnitude < 8 ? Math.floor(magnitude) : 8]
}

const EventMarkers = () => {

  const [events, setEvents] = useState([]);  

  useEffect(() => {
    const fetchData = async () => {
      const result = await axios.get('http://192.168.1.12:5000/eventsList',
        {params: {
          startTime:moment('2021-01-01').format("YYYY-MM-DD HH:mm:ss"),
          endTime:moment().format("YYYY-MM-DD HH:mm:ss"),
        }}
      ); 
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
      >
        <Popup>
          <div>
            <h2>Magnitude {+event.magnitude_value.toFixed(2)}</h2>
            <p>{moment(event.OT).format(
                            "YYYY-MM-DD hh:mm:ss A [(UTC]Z[)]")}</p>
            <p>
              {event.latitude_value.toFixed(3)}&#176;N&nbsp;
              {event.longitude_value.toFixed(3)}&#176;E
            </p>
          </div>
        </Popup>
      </CircleMarker>
    )
  );
}

export default EventMarkers;

