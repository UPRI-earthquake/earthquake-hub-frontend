import { trackEvent } from "@/analytics";
import { DEFAULT_POPUP_AUTOPAN } from "@/config/popupAutoPan";
import usePopupAutoPanPadding from "@/features/map/hooks/usePopupAutoPanPadding";
import { EarthquakeShortInfo } from "@/features/map/types/earthquake";
import styles from '../../../../styles/canvas/overlays/markers/EventMarkerItem.module.css';
import moment from "@/shared/utils/time";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Marker, Popup, useMap } from "react-leaflet";
import type { Marker as LeafletMarker } from "leaflet";
import { useStore } from "react-redux";


export interface EarthquakePopupRef {
  open: (eartquake: EarthquakeShortInfo) => void;
}


const EarthquakePopup = forwardRef<EarthquakePopupRef>(function EarthquakePopup(_props, ref) {
  const [ earthquakePopup, setEarthquakePopup ] = useState<EarthquakeShortInfo>();
  const popupAutoPanPadding = usePopupAutoPanPadding();
  const { topLeft: popupPaddingTopLeft, bottomRight: popupPaddingBottomRight } =
    popupAutoPanPadding || DEFAULT_POPUP_AUTOPAN;
  const map = useMap();
  const store = useStore();
  const popupParentRef = useRef<LeafletMarker>(null);

  useEffect(() => {
    if (earthquakePopup) popupParentRef.current?.openPopup();
  }, [earthquakePopup]);

  useEffect(() => {
    if (!earthquakePopup) return;

    const marker = popupParentRef.current;
    const position = marker?.getLatLng();
    if (!position) return;

    const popupHeight = 250;
    const popupWidth = 300;

    const timer = window.setTimeout(() => {
      if (!marker.isPopupOpen()) return;

      map.panInside(position, {
        paddingTopLeft: [
          popupPaddingTopLeft[0] + popupWidth/2, 
          popupPaddingTopLeft[1] + popupHeight
        ],
        paddingBottomRight: [
          popupPaddingBottomRight[0] + popupWidth/2, 
          popupPaddingBottomRight[1]
        ],
      });
    }, 200);

    return () => window.clearTimeout(timer);
  }, [earthquakePopup, map, popupPaddingTopLeft, popupPaddingBottomRight]);

  useImperativeHandle(ref, () => ({
    open: (earthquake: EarthquakeShortInfo) => {
      setEarthquakePopup({ ...earthquake });
    }
  }), []);

  return !!earthquakePopup ? (<Marker
    ref={popupParentRef}
    position={[earthquakePopup.latitude_value, earthquakePopup.longitude_value]}
    opacity={0}
    interactive={false}
    eventHandlers={{
      popupopen: () => {
        try {
          // Any popup opening should collapse Layers/Legend panels
          try { window.dispatchEvent(new CustomEvent('ui:popup:open')); } catch (_) {}
          // Do not emit scroll/select if this popup was opened programmatically from sidebar
          const bySidebar = typeof window !== 'undefined' && window["__openBySidebar"];
          if (!bySidebar) {
            store.dispatch({ type: 'SELECT', payload: earthquakePopup.publicID });
            try {
              const ev = new CustomEvent('selection:fromMarker', { detail: { id: earthquakePopup.publicID } });
              window.dispatchEvent(ev);
            } catch (_) {}
            try {
              trackEvent('event_select', {
                event_id: earthquakePopup.publicID,
                source: 'marker',
                magnitude: earthquakePopup.magnitude_value,
              });
            } catch (_) {}
          }
        } catch (_) {}
      },
      popupclose: () => {
        setEarthquakePopup((current) => current === earthquakePopup ? undefined : current);
        if (store.getState() === earthquakePopup.publicID) {
          store.dispatch({ type: 'DESELECT' });
        }
      }
    }}>
    <Popup autoPan={false}>
      <EarthquakePopupContent earthquake={earthquakePopup} />
    </Popup>
  </Marker>) : null;
});

function EarthquakePopupContent({ earthquake }: { earthquake: EarthquakeShortInfo }) {
  
  const depthText = useMemo(() => {
    const value = Number(earthquake.depth_value);
    return Number.isFinite(value) ? `${value.toFixed(0)} km` : 'Unknown';
  }, [earthquake.depth_value]);

  const latText = useMemo(() => formatCoord(earthquake.latitude_value, 'N', 'S'), [earthquake.latitude_value]);
  const lngText = useMemo(() => formatCoord(earthquake.longitude_value, 'E', 'W'), [earthquake.longitude_value]);
  
  
  const locationLabel = normalizeLocation(earthquake.place);
  const timestampText = useMemo(() => formatDateTime(earthquake.OT), [earthquake.OT]);
  const locationText = locationLabel || `${latText}, ${lngText}`;
  const showCoordRows = Boolean(locationLabel);
  

  const magnitudeText = useMemo(() => {
      const value = Number(earthquake.magnitude_value);
      return Number.isFinite(value) ? `M ${value.toFixed(1)}` : 'Unknown';
    }, [earthquake.magnitude_value]);

    
  // Handle navigation to earthquake detail page
  const handleEventInfoClick = useCallback(() => {
    if (!earthquake.publicID || !earthquake) return;
    try {
      window.localStorage.setItem(
        `earthquake-detail:${earthquake.publicID}`,
        JSON.stringify({
          cachedAt: Date.now(),
          payload: earthquake,
          version: 1,
        }),
      );
    } catch (_) {}
    const url = `/earthquake-detail?id=${encodeURIComponent(earthquake.publicID)}`;
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (_) {
      window.location.assign(url);
    }
  }, [earthquake]);


  return (<div className={styles.popupCard}>
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
        <span className={styles.popupKey}>PH Time</span>
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
        disabled={!earthquake.publicID || !earthquake}
      >
        Event Info &gt;
      </button>
    </div>
  </div>);
}


const formatCoord = (value, positiveLabel, negativeLabel) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 'Unknown';
  const hemi = num >= 0 ? positiveLabel : negativeLabel;
  return `${Math.abs(num).toFixed(3)}\u00B0${hemi}`;
};

const formatDateTime = (value) => {
  if (!value) return 'Unknown';
  const parsed = typeof moment.utc === 'function'
    ? moment.utc(value).utcOffset(8 * 60)
    : moment(value);
  if (!parsed || typeof parsed.isValid !== 'function' || !parsed.isValid()) return 'Unknown';
  return parsed.format('D MMMM YYYY h:mm A');
};


const normalizeLocation = (value) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || raw === 'Unavailable' || raw === 'Unable to geocode') return '';
  return raw;
};

export default EarthquakePopup;
