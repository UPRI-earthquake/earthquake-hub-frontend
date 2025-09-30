import React from 'react';
import styles from './StationListItem.module.css';
import moment from 'moment';
import { useDispatch, useSelector } from 'react-redux';

/**
 * Station list visual optimized for the Stations dataset in the sidebar.
 * @param {{station: {code:string, description?:string, network?:string, activity?:string, statusSince?:string}}} props
 */
export default function StationListItem({ station }) {
  const code = station.code || '-';
  const name = station.description || 'Unnamed station';
  const netRaw = station.network || 'AM';
  const network = `${netRaw} Network`;
  const isActive = String(station.activity || '').toLowerCase() === 'active';
  const statusLabel = isActive ? 'Active' : 'Inactive';
  const since = station.statusSince ? moment(station.statusSince) : null;
  const tooltip = (() => {
    if (isActive) {
      if (since) return `Streaming since ${since.fromNow()}`;
      return 'Streaming';
    }
    if (since && since.isAfter(moment().subtract(1, 'month'))) {
      // recent enough to show last report
      const hrs = Math.max(0, Math.round(moment.duration(moment().diff(since)).asHours()));
      return `Currently inactive (last report ${hrs} hrs ago).`;
    }
    return 'Device Offline';
  })();

  const dispatch = useDispatch();
  const selectedId = useSelector((state) => state);
  const isSelected = selectedId === `station:${code}`;
  const flyTo = () => {
    const lat = Number(station.latitude);
    const lng = Number(station.longitude);
    if (!isFinite(lat) || !isFinite(lng)) return;
    try {
      const map = window.__leaflet_map__;
      if (map && typeof map.flyTo === 'function') {
        const z = Math.max(8, map.getZoom ? map.getZoom() : 8);
        map.flyTo([lat, lng], z);
      }
    } catch (_) {}
  };
  const onClick = () => {
    flyTo();
    if (!isSelected) dispatch({ type: 'SELECT', payload: `station:${code}` });
    else dispatch({ type: 'DESELECT' });
  };

  return (
    <div
      className={`${styles.row} ${isSelected ? styles.selected : ''}`}
      title={tooltip}
      data-tip={tooltip}
      role="button"
      onClick={onClick}
    >
      <div className={styles.titleLine}>
        <div className={styles.code}>{code}</div>
        <div className={styles.deviceName}>
          <em>{name}</em>
        </div>
      </div>
      <div className={styles.metaLine}>
        <span className={styles.net} title={network} aria-label={network}>
          {network}
        </span>
        <span className={styles.sep}>|</span>
        <span className={`${styles.status} ${isActive ? styles.activeText : styles.inactiveText}`} aria-label={`Status: ${statusLabel}`}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
