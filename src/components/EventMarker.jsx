import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import moment from '../utils/time';
import { Marker, useMap, Popup } from 'react-leaflet';
import { DivIcon } from 'leaflet';
import { useSelector, useDispatch } from 'react-redux';
import ReactDOMServer from 'react-dom/server';
import styles from './EventMarker.module.css';
import { ReactComponent as Circle } from '../assets/circle.svg';
import { ReactComponent as CircleWithBorder } from '../assets/circleWithBorder.svg';
import { eqSizePx, themeFromMapContainer, eqDepthColor } from '../config/mapStyles';
import { DEFAULT_POPUP_AUTOPAN } from '../config/popupAutoPan';
import { trackEvent } from '../analytics';

function toRadius(magnitude) {
  // Convert desired diameter into a radius; DivIcon uses iconSize width/height
  const d = eqSizePx(magnitude);
  return d / 2;
}

const formatCoord = (value, positiveLabel, negativeLabel) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 'Unknown';
  const hemi = num >= 0 ? positiveLabel : negativeLabel;
  return `${Math.abs(num).toFixed(3)}\u00B0${hemi}`;
};

const formatDateTime = (value) => {
  if (!value) return 'Unknown';
  const parsed = moment(value);
  if (!parsed || typeof parsed.isValid !== 'function' || !parsed.isValid()) return 'Unknown';
  return parsed.format('D MMMM YYYY h:mm A');
};

const normalizeLocation = (value) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || raw === 'Unavailable' || raw === 'Unable to geocode') return '';
  return raw;
};

/**
 * Individual earthquake marker with popup and selection sync via Redux.
 */
const EventMarker = ({
  publicID,
  time,
  lat,
  lng,
  mag,
  depthKm,
  status,
  last_modification,
  location,
  eventData,
  enableAnimation = true,
  suppressInitialRadiate = false,
  popupAutoPanPadding = DEFAULT_POPUP_AUTOPAN,
}) => {
  // Basic coordinate guard; evaluated but not returned yet (hooks must run first)
  const hasValidCoords = Number.isFinite(lat) && Number.isFinite(lng);

  // AutoPopup OnClick of SidebarItem (with same publicID, see redux)
  const map = useMap();
  const { topLeft: popupPaddingTopLeft, bottomRight: popupPaddingBottomRight } =
    popupAutoPanPadding || DEFAULT_POPUP_AUTOPAN;
  const dispatch = useDispatch();
  const selectedEvent = useSelector((state) => state);
  const popupRef = useRef(null);
  const markerRef = useRef(null);
  const prevSelectedRef = useRef(null);
  // Track origin of selection to control flyTo animation
  const selectionOriginRef = useRef({ type: 'unknown', id: null });
  useEffect(() => {
    const onSelFromMarker = (e) => {
      try {
        const id = e && e.detail && e.detail.id;
        selectionOriginRef.current = { type: 'marker', id: id || null };
      } catch (_) {}
    };
    const onSelFromList = (e) => {
      try {
        const id = e && e.detail && e.detail.id;
        selectionOriginRef.current = { type: 'list', id: id || null };
      } catch (_) {}
    };
    window.addEventListener('selection:fromMarker', onSelFromMarker);
    window.addEventListener('selection:fromList', onSelFromList);
    return () => {
      window.removeEventListener('selection:fromMarker', onSelFromMarker);
      window.removeEventListener('selection:fromList', onSelFromList);
    };
  }, []);
  const centerAndPopupEvent = useCallback(
    (selectedEventId) => {
      if (!map) return;

      const marker = markerRef.current;
      // On select: center and open this marker's popup
      if (selectedEventId === publicID) {
        // Only animate when selection originated from the list, not from marker
        const origin = selectionOriginRef.current || {};
        if (hasValidCoords) {
          if (!(origin.type === 'marker' && origin.id === publicID)) {
            map.flyTo([lat, lng], 9);
          }
        }
        if (marker && typeof marker.openPopup === 'function') {
          try { window.__openBySidebar = true; } catch (_) {}
          marker.openPopup();
          try {
            // Reset the flag on next tick so user-driven opens are not affected
            setTimeout(() => { try { window.__openBySidebar = false; } catch (_) {} }, 0);
          } catch (_) {}
        }
      } else if (prevSelectedRef.current === publicID) {
        // On deselect (or selection changed away from this id): close the popup
        if (marker && typeof marker.closePopup === 'function') {
          marker.closePopup();
        }
      }
      // update previous selection tracker after handling
      prevSelectedRef.current = selectedEventId;
    },
    [map, publicID, lat, lng, hasValidCoords],
  );
  useEffect(() => {
    centerAndPopupEvent(selectedEvent);
  }, [selectedEvent, centerAndPopupEvent]);

  // Animation
  const [animate, setAnimate] = useState(false);
  const timerId = useRef(null); // hold running timeout-id across renders
  const didProcessInitialRef = useRef(false);
  useEffect(() => {
    let isMounted = true;
    const isInitial = !didProcessInitialRef.current;
    // Allow SSE radiate pulses regardless of enableAnimation, but skip the very first
    // trigger on mount when suppressInitialRadiate is true (dataset switch case).
    if ((status === 'NEW' || status === 'UPDATE')) {
      if (!(suppressInitialRadiate && isInitial)) {
        setAnimate(true);
        clearTimeout(timerId.current); // it's ok to clear on null
        timerId.current = setTimeout(() => {
          if (!isMounted) return; // avoid state update after unmount
          setAnimate(false);
          timerId.current = null; // to avoid clearing other ids
        }, 7500);
      }
    }
    didProcessInitialRef.current = true;
    return () => {
      isMounted = false;
      try { clearTimeout(timerId.current); } catch (_) {}
      timerId.current = null;
    };
  }, [status, last_modification, suppressInitialRadiate]);

  // Opacity is now driven purely by CSS var --eq-opacity on the map container.
  // Avoid binding it into the icon to prevent DivIcon churn on zoom changes.

  // Track basemap theme to ensure depth colors update when switching base layers
  const [themeKey, setThemeKey] = useState(() => {
    try {
      return themeFromMapContainer(map?.getContainer?.());
    } catch (_) {
      return 'light';
    }
  });
  useEffect(() => {
    if (!map) return undefined;
    const update = () => {
      try {
        setThemeKey(themeFromMapContainer(map.getContainer()));
      } catch (_) {}
    };
    map.on('baselayerchange', update);
    // Also observe attribute change as a fallback in case theme attribute updates without event
    let mo = null;
    try {
      const el = map.getContainer();
      mo = new MutationObserver(update);
      mo.observe(el, { attributes: true, attributeFilter: ['data-basemap-theme'] });
    } catch (_) {}
    return () => {
      try { map.off('baselayerchange', update); } catch (_) {}
      try { if (mo) mo.disconnect(); } catch (_) {}
    };
  }, [map]);

  const depthColor = eqDepthColor(themeKey, depthKm);
  const fillColor = depthColor || undefined; // undefined -> use CSS var theme color

  // Fallback to default marker pane if custom pane does not yet exist
  const paneName = useMemo(() => {
    try {
      return map && map.getPane && map.getPane('eqMarkers') ? 'eqMarkers' : undefined;
    } catch (_) {
      return undefined;
    }
  }, [map]);

  // Cache DivIcon instances to avoid re-creating DOM/HTML on every render
  // Key on: animation flag, fill color bucket, and size bucket (0.1px precision)
  const iconCacheRef = useRef(new Map());
  const divCircle = useMemo(() => {
    const radius = toRadius(mag);
    // Bucket sizes at 0.1px precision to reflect decimal magnitudes precisely
    const sizeKey = Math.round((animate ? 8 : 2) * radius * 10); // tenths of a px
    const colorKey = fillColor || 'theme';
    const variantKey = animate ? 'a' : enableAnimation ? 'd' : 's';
    const cacheKey = `${variantKey}|${colorKey}|${sizeKey}`;

    const cache = iconCacheRef.current;
    const existing = cache.get(cacheKey);
    if (existing) return existing;

    // Do not attach explicit opacity; rely on CSS vars set on map container.
    const baseStyle = {};
    const svgStyle = fillColor ? { ...baseStyle, fill: fillColor } : baseStyle;
    const html = ReactDOMServer.renderToString(
      animate ? (
        <CircleWithBorder className={styles.radiate} style={svgStyle} />
      ) : enableAnimation ? (
        <Circle className={styles.default} style={svgStyle} />
      ) : (
        <Circle className={styles.static} style={svgStyle} />
      ),
    );

    const size = animate ? 8 * radius : 2 * radius;
    const icon = new DivIcon({
      className: 'leaflet-div-icon eq-marker', // stable container class to enable CSS transitions
      html,
      iconSize: [size, size],
    });
    cache.set(cacheKey, icon);
    return icon;
  }, [animate, mag, fillColor, enableAnimation]);

  // Gentle fade-in when marker icon mounts or changes
  useEffect(() => {
    if (!enableAnimation) return undefined;
    const marker = markerRef.current;
    if (!marker || typeof marker.getElement !== 'function') return undefined;
    const el = marker.getElement();
    if (!el) return undefined;
    // Reset then re-apply to retrigger transition on icon swap
    el.classList.remove('is-mounted');
    // Next tick to ensure transition plays
    const id = window.requestAnimationFrame(() => {
      el.classList.add('is-mounted');
    });
    return () => window.cancelAnimationFrame(id);
  }, [divCircle, enableAnimation]);

  // Ensure fade-in re-applies when the marker layer is re-added (e.g., overlay toggled)
  useEffect(() => {
    if (!enableAnimation) return undefined;
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
  }, [enableAnimation]);

  const tooltipText = useMemo(() => {
    const magValue = Number(mag);
    const timeValue = moment(time);

    const magText = Number.isFinite(magValue) ? `M${magValue.toFixed(1)}` : null;
    const timeText = timeValue && timeValue.isValid()
      ? `${timeValue.format('MMM D, YYYY • h:mm A')} (${timeValue.fromNow()})`
      : null;

    return [magText, timeText].filter(Boolean).join(' • ');
  }, [mag, time]);

  const locationLabel = useMemo(() => normalizeLocation(location), [location]);
  const magnitudeText = useMemo(() => {
    const value = Number(mag);
    return Number.isFinite(value) ? `M ${value.toFixed(1)}` : 'Unknown';
  }, [mag]);
  const depthText = useMemo(() => {
    const value = Number(depthKm);
    return Number.isFinite(value) ? `${value.toFixed(0)} km` : 'Unknown';
  }, [depthKm]);
  const latText = useMemo(() => formatCoord(lat, 'N', 'S'), [lat]);
  const lngText = useMemo(() => formatCoord(lng, 'E', 'W'), [lng]);
  const timestampText = useMemo(() => formatDateTime(time), [time]);
  const locationText = locationLabel || `${latText}, ${lngText}`;
  const showCoordRows = Boolean(locationLabel);

  // Handle navigation to earthquake detail page
  const handleEventInfoClick = useCallback(() => {
    if (!publicID || !eventData) return;
    try {
      window.localStorage.setItem(`earthquake-detail:${publicID}`, JSON.stringify(eventData));
    } catch (_) {}
    const url = `/earthquake-detail?id=${encodeURIComponent(publicID)}`;
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (_) {
      window.location.assign(url);
    }
  }, [publicID, eventData]);

  // If bad coords slipped through, skip rendering after hooks have been called
  if (!hasValidCoords) {
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('EventMarker skipped due to invalid coords', { publicID, lat, lng });
    }
    return null;
  }

  return (
    <Marker
      ref={markerRef}
      icon={divCircle}
      title={tooltipText}
      stroke={false}
      position={[lat, lng]}
      {...(paneName ? { pane: paneName } : {})} // only pass pane when available
      eventHandlers={{
        click: () => {
          try {
            dispatch({ type: 'SELECT', payload: publicID });
          } catch (_) {}
          try {
            const ev = new CustomEvent('selection:fromMarker', { detail: { id: publicID } });
            window.dispatchEvent(ev);
          } catch (_) {}
          try {
            const magnitude = Number(mag);
            trackEvent('event_select', {
              event_id: publicID,
              source: 'marker',
              magnitude: Number.isFinite(magnitude) ? magnitude : undefined,
            });
          } catch (_) {}
        },
        popupopen: () => {
          try {
            // Any popup opening should collapse Layers/Legend panels
            try { window.dispatchEvent(new CustomEvent('ui:popup:open')); } catch (_) {}
            // Do not emit scroll/select if this popup was opened programmatically from sidebar
            const bySidebar = typeof window !== 'undefined' && window.__openBySidebar;
            if (!bySidebar) {
              dispatch({ type: 'SELECT', payload: publicID });
              try {
                const ev = new CustomEvent('selection:fromMarker', { detail: { id: publicID } });
                window.dispatchEvent(ev);
              } catch (_) {}
              try {
                const magnitude = Number(mag);
                trackEvent('event_select', {
                  event_id: publicID,
                  source: 'marker',
                  magnitude: Number.isFinite(magnitude) ? magnitude : undefined,
                });
              } catch (_) {}
            }
          } catch (_) {}
        },
        popupclose: () => {
          try {
            // only deselect if this marker is currently selected
            if (selectedEvent === publicID) {
              dispatch({ type: 'DESELECT' });
            }
          } catch (_) {}
        },
      }}
    >
      <Popup
        ref={popupRef}
        autoPan
        autoPanPaddingTopLeft={popupPaddingTopLeft}
        autoPanPaddingBottomRight={popupPaddingBottomRight}
      >
        <div className={styles.popupCard}>
          <div className={`${styles.popupGroup} ${styles.popupGroupPrimary}`}>
            <div className={styles.popupRow}>
              <span className={styles.popupKey}>Magnitude</span>
              <span className={styles.popupValue}>{magnitudeText}</span>
            </div>
            <div className={styles.popupRow}>
              <span className={styles.popupKey}>Location</span>
              <span className={styles.popupValue}>{locationText}</span>
            </div>
            <div className={styles.popupRow}>
              <span className={styles.popupKey}>Time</span>
              <span className={styles.popupValue}>{timestampText}</span>
            </div>
          </div>
          <div className={`${styles.popupGroup} ${styles.popupGroupSecondary}`}>
            <div className={styles.popupRow}>
              <span className={styles.popupKey}>Depth</span>
              <span className={styles.popupValue}>{depthText}</span>
            </div>
            {showCoordRows ? (
              <>
                <div className={styles.popupRow}>
                  <span className={styles.popupKey}>Lat</span>
                  <span className={styles.popupValue}>{latText}</span>
                </div>
                <div className={styles.popupRow}>
                  <span className={styles.popupKey}>Lon</span>
                  <span className={styles.popupValue}>{lngText}</span>
                </div>
              </>
            ) : null}
          </div>
          <div className={styles.popupGroup}>
            <button
              className={styles.eventInfoButton}
              onClick={handleEventInfoClick}
              type="button"
              aria-label="View event details"
              disabled={!publicID || !eventData}
            >
              Event Info &gt;
            </button>
          </div>
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
    prev.last_modification === next.last_modification &&
    prev.location === next.location &&
    prev.eventData === next.eventData
  );
});
