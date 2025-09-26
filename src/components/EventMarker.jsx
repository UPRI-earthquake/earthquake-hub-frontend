import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import moment from 'moment';
import { Marker, Popup, useMap } from 'react-leaflet';
import { DivIcon } from 'leaflet';
import { useSelector } from 'react-redux';
import ReactDOMServer from 'react-dom/server';
import styles from './EventMarker.module.css';
import { ReactComponent as Circle } from './circle.svg';
import { ReactComponent as CircleWithBorder } from './circleWithBorder.svg';
import { eqSizePx } from '../config/mapStyles';

function toRadius(magnitude) {
  // Convert desired diameter into a radius; DivIcon uses iconSize width/height
  const d = eqSizePx(magnitude);
  return d / 2;
}

/**
 * Individual earthquake marker with popup and selection sync via Redux.
 */
const EventMarker = ({ publicID, time, lat, lng, mag, depthKm, status, last_modification }) => {
  // Basic coordinate guard; evaluated but not returned yet (hooks must run first)
  const hasValidCoords = Number.isFinite(lat) && Number.isFinite(lng);

  // AutoPopup OnClick of SidebarItem (with same publicID, see redux)
  const map = useMap();
  const selectedEvent = useSelector((state) => state);
  const popupRef = useRef(null);
  const markerRef = useRef(null);
  const centerAndPopupEvent = useCallback(
    (selectedEventId) => {
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
    },
    [map, publicID, lat, lng, hasValidCoords],
  );
  useEffect(() => {
    centerAndPopupEvent(selectedEvent);
  }, [selectedEvent, centerAndPopupEvent]);

  // Animation
  const [animate, setAnimate] = useState(false);
  const timerId = useRef(null); // hold running timeout-id across renders
  useEffect(() => {
    if (status === 'NEW' || status === 'UPDATE') {
      setAnimate(true);
      clearTimeout(timerId.current); // it's ok to clear on null
      timerId.current = setTimeout(() => {
        setAnimate(false);
        timerId.current = null; // to avoid clearing other ids
      }, 7500);
    }
  }, [status, last_modification]);

  // Numeric opacity resolved from CSS variable on the map container.
  // Keeps markers consistent after overlay toggles where var() could be stale.
  const [eqOpacity, setEqOpacity] = useState(0.65);
  useEffect(() => {
    if (!map || typeof map.getContainer !== 'function') return undefined;
    const el = map.getContainer();
    const read = () => {
      try {
        const v = getComputedStyle(el).getPropertyValue('--eq-opacity');
        const n = parseFloat(String(v).trim());
        setEqOpacity(Number.isFinite(n) ? n : 0.65);
      } catch (_) {
        setEqOpacity(0.65);
      }
    };
    read();
    // Update whenever map styling might change
    map.on('zoom', read);
    map.on('zoomend', read);
    map.on('baselayerchange', read);
    map.on('overlayadd', read);
    map.on('overlayremove', read);
    return () => {
      map.off('zoom', read);
      map.off('zoomend', read);
      map.off('baselayerchange', read);
      map.off('overlayadd', read);
      map.off('overlayremove', read);
    };
  }, [map]);

  // Depth ramp toggle listener
  const [depthRamp, setDepthRamp] = useState(() => {
    try {
      return sessionStorage.getItem('eqDepthRamp') === '1';
    } catch (_) {
      return false;
    }
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
    const opKey = Math.round(eqOpacity * 100); // two decimals precision
    const cacheKey = `${animate ? 'a' : 'd'}|${colorKey}|${sizeKey}|op${opKey}`;

    const cache = iconCacheRef.current;
    const existing = cache.get(cacheKey);
    if (existing) return existing;

    // Apply numeric opacity and also set the CSS variable locally so
    // animations that reference var(--eq-opacity) resolve to the same value.
    const baseStyle = { opacity: eqOpacity, '--eq-opacity': eqOpacity };
    const svgStyle = fillColor ? { ...baseStyle, fill: fillColor } : baseStyle;
    const html = ReactDOMServer.renderToString(
      animate ? (
        <CircleWithBorder className={styles.radiate} style={svgStyle} />
      ) : (
        <Circle className={styles.default} style={svgStyle} />
      ),
    );

    const size = animate ? 8 * radius : 2 * radius;
    const icon = new DivIcon({
      className: 'eq-marker', // stable container class to enable CSS transitions
      html,
      iconSize: [size, size],
    });
    cache.set(cacheKey, icon);
    return icon;
  }, [animate, mag, fillColor, eqOpacity]);

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

  // Ensure fade-in re-applies when the marker layer is re-added (e.g., overlay toggled)
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker || typeof marker.on !== 'function') return undefined;
    const onAdd = () => {
      const el = marker.getElement && marker.getElement();
      if (!el) return;
      el.classList.remove('is-mounted');
      window.requestAnimationFrame(() => {
        el.classList.add('is-mounted');
      });
    };
    marker.on('add', onAdd);
    return () => {
      marker.off('add', onAdd);
    };
  }, []);

  // If bad coords slipped through, skip rendering after hooks have been called
  if (!hasValidCoords) {
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('EventMarker skipped due to invalid coords', { publicID, lat, lng });
    }
    return null;
  }

  return (
    <Marker ref={markerRef} icon={divCircle} stroke={false} position={[lat, lng]}>
      <Popup ref={popupRef}>
        <div>
          <h2>Magnitude {+mag.toFixed(1)}</h2>
          <p>{moment(time).format('YYYY-MM-DD hh:mm:ss A [(UTC]Z[)]')}</p>
          <p>
            {lat.toFixed(3)}&#176;N&nbsp;
            {lng.toFixed(3)}&#176;E
          </p>
          {depthKm != null && !Number.isNaN(Number(depthKm)) && (
            <p>Depth {Number(depthKm).toFixed(0)} km</p>
          )}
          <p style={{ color: 'gray' }}>Last updated {moment(time).fromNow()}</p>
        </div>
      </Popup>
    </Marker>
  );
};

/*
export default EventMarker
*/
export default React.memo(EventMarker, (prev, next) => {
  // Only skip re-render when all relevant props are strictly equal
  return (
    prev.publicID === next.publicID &&
    prev.time === next.time &&
    prev.lat === next.lat &&
    prev.lng === next.lng &&
    prev.mag === next.mag &&
    prev.depthKm === next.depthKm &&
    prev.status === next.status &&
    prev.last_modification === next.last_modification
  );
});
