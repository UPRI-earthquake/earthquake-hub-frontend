import React, { useState, useEffect, useCallback, useRef }  from 'react';
import moment from 'moment';
import { Marker, Popup, useMap } from "react-leaflet";
import { DivIcon } from "leaflet";
import { useSelector } from 'react-redux';
import ReactDOMServer from 'react-dom/server';
import styles from "./EventMarker.module.css";
import {ReactComponent as Circle} from './circle.svg';
import {ReactComponent as CircleWithBorder} from './circleWithBorder.svg';
import { eqSizePx } from '../config/mapStyles';

function toRadius(magnitude) {
  // Convert desired diameter into a radius; DivIcon uses iconSize width/height
  const d = eqSizePx(magnitude);
  return d / 2;
}

const EventMarker = ({publicID, time, lat, lng, mag, depthKm, status, last_modification}) => {

  // AutoPopup OnClick of SidebarItem (with same publicID, see redux)
  const map = useMap();
  const selectedEvent = useSelector(state => state)
  const popupRef = useRef(null);
  const centerAndPopupEvent = useCallback((selectedEventId) => {
    if (!map) return;

    if (selectedEventId === publicID) {
      map.flyTo([lat, lng], 9);
      const popup = popupRef.current;
      if (popup && typeof popup.openOn === 'function') {
        popup.openOn(map);
      } else if (popup) {
        map.openPopup(popup);
      }
    } else if (selectedEventId === null) {
      map.flyTo([12.2795, 122.049], 6);
      const popup = popupRef.current;
      if (popup) {
        map.closePopup(popup);
      }
    }
  }, [map, publicID, lat, lng]);
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

  // Depth ramp toggle listener
  const [depthRamp, setDepthRamp] = useState(() => {
    try { return sessionStorage.getItem('eqDepthRamp') === '1'; } catch (_) { return false; }
  });
  useEffect(() => {
    const onToggle = (e) => setDepthRamp(!!(e && e.detail && e.detail.enabled));
    window.addEventListener('eqDepthRamp:toggle', onToggle);
    return () => window.removeEventListener('eqDepthRamp:toggle', onToggle);
  }, []);

  const depthColor = (() => {
    const d = depthKm == null ? null : Number(depthKm);
    if (d == null || Number.isNaN(d)) return null;
    if (d <= 70) return '#FF6B6B';
    if (d <= 300) return '#F4A261';
    return '#2A9D8F';
  })();

  const fillColor = depthRamp && depthColor ? depthColor : undefined; // undefined → use CSS var theme color

  const divCircle = new DivIcon(animate
    ? {
        // Keep container class minimal to avoid overriding Leaflet's inline transform.
        className: '',
        html: ReactDOMServer.renderToString(
          <CircleWithBorder
            className={styles.radiate}
            style={fillColor ? { fill: fillColor } : undefined}
          />
        ),
        iconSize: [8 * toRadius(mag), 8 * toRadius(mag)],
      }
    : {
        className: '',
        html: ReactDOMServer.renderToString(
          <Circle
            className={styles.default}
            style={fillColor ? { fill: fillColor } : undefined}
          />
        ),
        iconSize: [2 * toRadius(mag), 2 * toRadius(mag)],
      }
  );


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
          {depthKm != null && !Number.isNaN(Number(depthKm)) && (
            <p>Depth {Number(depthKm).toFixed(0)} km</p>
          )}
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
