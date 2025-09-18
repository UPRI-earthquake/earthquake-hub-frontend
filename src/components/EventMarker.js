import React, { useState, useEffect, useCallback, useRef, useMemo }  from 'react';
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

  // Cache DivIcon instances to avoid re-creating DOM/HTML on every render
  // Key on: animation flag, fill color bucket, and size bucket
  const iconCacheRef = useRef(new Map());
  const divCircle = useMemo(() => {
    const radius = toRadius(mag);
    // Bucket sizes to reduce unique icon churn while keeping visual fidelity
    const sizeKey = Math.round(radius * (animate ? 8 : 2));
    const colorKey = fillColor || 'theme';
    const cacheKey = `${animate ? 'a' : 'd'}|${colorKey}|${sizeKey}`;

    const cache = iconCacheRef.current;
    const existing = cache.get(cacheKey);
    if (existing) return existing;

    const html = ReactDOMServer.renderToString(
      animate ? (
        <CircleWithBorder
          className={styles.radiate}
          style={fillColor ? { fill: fillColor } : undefined}
        />
      ) : (
        <Circle
          className={styles.default}
          style={fillColor ? { fill: fillColor } : undefined}
        />
      )
    );

    const size = animate ? (8 * radius) : (2 * radius);
    const icon = new DivIcon({
      className: 'eq-marker', // stable container class to enable CSS transitions
      html,
      iconSize: [size, size],
    });
    cache.set(cacheKey, icon);
    return icon;
  }, [animate, mag, fillColor]);

  // Gentle fade-in when marker icon mounts or changes
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker || typeof marker.getElement !== 'function') return;
    const el = marker.getElement();
    if (!el) return;
    // Reset then re-apply to retrigger transition on icon swap
    el.classList.remove('is-mounted');
    // Next tick to ensure transition plays
    const id = window.requestAnimationFrame(() => {
      el.classList.add('is-mounted');
    });
    return () => window.cancelAnimationFrame(id);
  }, [divCircle]);

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
