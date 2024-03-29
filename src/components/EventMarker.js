import React, { useState, useEffect, useCallback, useRef }  from 'react';
import moment from 'moment';
import { Marker, Popup, useMap } from "react-leaflet";
import { DivIcon } from "leaflet";
import { useSelector } from 'react-redux';
import ReactDOMServer from 'react-dom/server';
import styles from "./EventMarker.module.css";
import {ReactComponent as Circle} from './circle.svg';
import {ReactComponent as CircleWithBorder} from './circleWithBorder.svg';

function toRadius(magnitude) {
  // 0th index is for mag<1, then mag=1+, and so on up to 33.32 for mag>8
  const radiiPixels = [4, 4, 5, 6, 7, 8.5, 11, 13.5, 16]
  return radiiPixels[magnitude < 8 ? Math.floor(magnitude) : 8]
}

const EventMarker = ({publicID, time, lat, lng, mag, status, last_modification}) => {

  // AutoPopup OnClick of SidebarItem (with same publicID, see redux)
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


  // Animation
  const [animate, setAnimate] = useState(false);
  const timerId = useRef(null) // hold running timeout-id across renders
  useEffect(() => {
    if(status === 'NEW' || status === 'UPDATE'){
      setAnimate(true)
      clearTimeout(timerId.current) // it's ok to clear on null
      timerId.current = setTimeout(()=>{
        setAnimate(false)
        timerId.current = null // to avoid clearing other ids
      }, 7500);
    }
  }, [status, last_modification]);

  const divCircle = new DivIcon(animate 
    ? {
        className: styles.radiate,
        html: ReactDOMServer.renderToString(<CircleWithBorder />),
        iconSize: [8*toRadius(mag),8*toRadius(mag)]
      }
    : {
        className: styles.default,
        html: ReactDOMServer.renderToString(<Circle />),
        iconSize: [2*toRadius(mag),2*toRadius(mag)]
      }
  )


  return(
    <Marker 
      icon={divCircle}
      stroke={false}
      position={[lat, lng]}
    >
      <Popup ref={popupRef}>
        <div>
          <h2>Magnitude {+mag.toFixed(1)}</h2>
          <p>{moment(time).format("YYYY-MM-DD hh:mm:ss A [(UTC]Z[)]")}</p>
          <p>
            {lat.toFixed(3)}&#176;N&nbsp;
            {lng.toFixed(3)}&#176;E
          </p>
          <p style={{color:'gray'}}>
            Last updated {moment(time).fromNow()}
          </p>
        </div>
      </Popup>
    </Marker>
  )
}

/*
export default EventMarker
*/
export default React.memo(EventMarker, (prevProps, nextProps) => {
  // render if status is NEW or was modified
  return !(nextProps.status === 'NEW' 
        || nextProps.last_modification !== prevProps.last_modification)
});
