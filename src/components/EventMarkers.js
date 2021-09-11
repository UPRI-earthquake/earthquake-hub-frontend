import React, { useEffect, useCallback, useRef }  from 'react';
import moment from 'moment';
import { CircleMarker, Popup, useMap } from "react-leaflet";
import { useSelector } from 'react-redux';

function toRadius(magnitude) {
  // 0th index is for mag<1, then mag=1+, and so on up to 33.32 for mag>8
  const radiiPixels = [4, 4, 5, 6, 7, 8.5, 11, 13.5, 16]
  return radiiPixels[magnitude < 8 ? Math.floor(magnitude) : 8]
}

const EventMarker = ({publicID, time, lat, lng, mag}) => {
  // get parent map, and selected event, and ref to this marker's popup
  const map = useMap();
  const selectedEvent = useSelector(state => state)
  const popupRef = useRef();

  const centerAndPopupEvent = useCallback((selectedEvent) => {
    if(selectedEvent === publicID){
      //center the event
      map.flyTo([lat, lng], 9)
      //show popup
      map.openPopup(popupRef.current)

      //
    }else if(selectedEvent === null){
      map.flyTo([12.2795, 122.049], 6)
      map.closePopup(popupRef.current)
    }
  },[publicID, lat, lng, map, popupRef]); //useCallback prevents recreat of this fn ever render

  useEffect(() => {
    centerAndPopupEvent(selectedEvent)
  }, [selectedEvent, centerAndPopupEvent]);

  console.log('state:', selectedEvent, 'publicID', publicID, 'bool', (selectedEvent === publicID))

  return(
    <CircleMarker 
      stroke={false}
      fillOpacity={0.4}
      fillColor='red'
      center={[lat, lng]}
      radius={toRadius(mag)}
    >
      <Popup ref={popupRef}>
        <div>
          <h2>Magnitude {+mag.toFixed(2)}</h2>
          <p>{moment(time).format("YYYY-MM-DD hh:mm:ss A [(UTC]Z[)]")}</p>
          <p>
            {lat.toFixed(3)}&#176;N&nbsp;
            {lng.toFixed(3)}&#176;E
          </p>
        </div>
      </Popup>
    </CircleMarker>
  )
}

const EventMarkers = ({events, selectedEvent}) => {

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

