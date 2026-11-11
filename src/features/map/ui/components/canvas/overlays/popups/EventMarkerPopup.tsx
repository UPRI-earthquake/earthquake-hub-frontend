import { useCallback, useMemo, useRef } from "react";
import { Popup } from "react-leaflet";
import { DEFAULT_POPUP_AUTOPAN } from "@/config/popupAutoPan";

import moment from '@/shared/utils/time';
import styles from '../../../../styles/canvas/overlays/markers/EventMarkerItem.module.css';
import usePopupAutoPanPadding from "../../../../../hooks/usePopupAutoPanPadding";

interface EventMarkerPopupProps {
  publicID: string;
  depthKm: number;
  mag: number;
  lat: number;
  lng: number;
  time: string;
  location: string;
  eventData: any;
}

export default function EventMarkerPopup({ publicID, depthKm, mag, lat, lng, time, location, eventData }: EventMarkerPopupProps) {
  const popupRef = useRef(null);
  const popupAutoPanPadding = usePopupAutoPanPadding();
  
  
  const locationLabel = useMemo(() => normalizeLocation(location), [location]);
  
  const depthText = useMemo(() => {
    const value = Number(depthKm);
    return Number.isFinite(value) ? `${value.toFixed(0)} km` : 'Unknown';
  }, [depthKm]);
  const latText = useMemo(() => formatCoord(lat, 'N', 'S'), [lat]);
  const lngText = useMemo(() => formatCoord(lng, 'E', 'W'), [lng]);
  
  const timestampText = useMemo(() => formatDateTime(time), [time]);
  const locationText = locationLabel || `${latText}, ${lngText}`;
  const showCoordRows = Boolean(locationLabel);
  

  const magnitudeText = useMemo(() => {
      const value = Number(mag);
      return Number.isFinite(value) ? `M ${value.toFixed(1)}` : 'Unknown';
    }, [mag]);

  const { topLeft: popupPaddingTopLeft, bottomRight: popupPaddingBottomRight } =
    popupAutoPanPadding || DEFAULT_POPUP_AUTOPAN;

  
  // Handle navigation to earthquake detail page
  const handleEventInfoClick = useCallback(() => {
    if (!publicID || !eventData) return;
    try {
      window.localStorage.setItem(
        `earthquake-detail:${publicID}`,
        JSON.stringify({
          cachedAt: Date.now(),
          payload: eventData,
          version: 1,
        }),
      );
    } catch (_) {}
    const url = `/earthquake-detail?id=${encodeURIComponent(publicID)}`;
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (_) {
      window.location.assign(url);
    }
  }, [publicID, eventData]);

  return (<Popup ref={popupRef} autoPan
    // autoPanPaddingTopLeft={popupPaddingTopLeft}
    // autoPanPaddingBottomRight={popupPaddingBottomRight}
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
          disabled={!publicID || !eventData}
        >
          Event Info &gt;
        </button>
      </div>
    </div>
  </Popup>);
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