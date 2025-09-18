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

  // Basic coordinate guard; evaluated but not returned yet (hooks must run first)
  const hasValidCoords = Number.isFinite(lat) && Number.isFinite(lng);

  // AutoPopup OnClick of SidebarItem (with same publicID, see redux)
  const map = useMap();
  const selectedEvent = useSelector(state => state)
  const popupRef = useRef(null);
  const markerRef = useRef(null);
  const centerAndPopupEvent = useCallback((selectedEventId) => {
    if (!map) return;

    if (selectedEventId === publicID) {
      if (hasValidCoords) {
        map.flyTo([lat, lng], 9);
      }
      const marker = markerRef.current;
      if (marker && typeof marker.openPopup === 'function') {
        marker.openPopup();
      }
    } else if (selectedEventId === null) {
      map.flyTo([12.2795, 122.049], 6);
      const marker = markerRef.current;
      if (marker && typeof marker.closePopup === 'function') {
        marker.closePopup();
      }
    }
  }, [map, publicID, lat, lng, hasValidCoords]);
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

  // If bad coords slipped through, skip rendering after hooks have been called
  if (!hasValidCoords) {
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('EventMarker skipped due to invalid coords', { publicID, lat, lng });
    }
    return null;
  }

  return(
    <Marker 
      ref={markerRef}
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
