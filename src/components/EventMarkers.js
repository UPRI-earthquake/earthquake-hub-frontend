import React  from 'react';
import moment from 'moment';
import { CircleMarker, Popup } from "react-leaflet";

function toRadius(magnitude) {
  // 0th index is for mag<1, then mag=1+, and so on up to 33.32 for mag>8
  const radiiPixels = [4, 4, 5, 6, 7, 8.5, 11, 13.5, 16]
  return radiiPixels[magnitude < 8 ? Math.floor(magnitude) : 8]
}

const EventMarker = ({publicID, time, lat, lng, mag, selectedEvent}) => {
  return(
    <CircleMarker 
      stroke={false}
      fillOpacity={0.3}
      center={[lat, lng]}
      radius={toRadius(mag)}
      fillColor={selectedEvent === publicID ? 'red' : 'blue'}
    >
      <Popup>
        <div>
          <h2>Magnitude {+mag.toFixed(2)}</h2>
          <p>{moment(time).format("YYYY-MM-DD hh:mm:ss A [(UTC]Z[)]")}</p>
          <p>
            {lat.toFixed(3)}&#176;N&nbsp;
            {lng.toFixed(3)}&#176;E
          </p>
          <p>SELECTED: {selectedEvent}</p>
        </div>
      </Popup>
    </CircleMarker>
  )
}

const EventMarkers = ({events, selectedEvent}) => {
  console.log('Parent rendered')

  return (
    events.map(event => 
      <EventMarker
        key={event.publicID}
        publicID={event.publicID}
        time={event.OT}
        lat={event.latitude_value}
        lng={event.longitude_value}
        mag={event.magnitude_value}
      />
    )
  );
}

export default EventMarkers;

