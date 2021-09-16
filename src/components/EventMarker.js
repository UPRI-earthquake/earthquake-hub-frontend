import React, { useEffect, useCallback, useRef }  from 'react';
import moment from 'moment';
import { CircleMarker, Popup, useMap } from "react-leaflet";
import { useSelector } from 'react-redux';
import styles from "./EventMarker.module.css";

function animate(status,type){
  switch(status){
    case 'NEW': 
    case 'UPDATE':
      return styles[type]
    default:
      return null
  }
}

function toRadius(magnitude) {
  // 0th index is for mag<1, then mag=1+, and so on up to 33.32 for mag>8
  const radiiPixels = [4, 4, 5, 6, 7, 8.5, 11, 13.5, 16]
  return radiiPixels[magnitude < 8 ? Math.floor(magnitude) : 8]
}

const EventMarker = ({publicID, time, lat, lng, mag, status}) => {
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
    }else if(selectedEvent === null){
      map.flyTo([12.2795, 122.049], 6)
      map.closePopup(popupRef.current)
    }
  },[publicID, lat, lng, map]); //useCallback prevents recreat of this fn ever render
  useEffect(() => {
    centerAndPopupEvent(selectedEvent)
  }, [selectedEvent, centerAndPopupEvent]);

  return(
    <CircleMarker 
      key={Math.random()}
      className={animate(status,'radiate')}
      stroke={false}
      fillColor='red'
      fillOpacity={0.4}
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

export default React.memo(EventMarker, (prevProps, nextProps) => {
  // render if status is NEW or UPDATE
  return !(nextProps.status === 'UPDATE' 
        || nextProps.status === 'NEW')
});
