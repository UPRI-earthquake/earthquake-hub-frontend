import React, { useCallback, useMemo, useRef, useState } from 'react';
import styles from './StationListItem.module.css';
import moment from 'moment';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';

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
  const since = useMemo(() => (station.statusSince ? moment(station.statusSince) : null), [station.statusSince]);

  const initialTooltip = useMemo(() => {
    if (isActive) return since ? `Streaming since ${since.fromNow()}` : 'Streaming';
    if (since) return since.isAfter(moment().subtract(1, 'month')) ? `Not streaming since ${since.fromNow()}` : 'Device Offline';
    return 'Device Offline';
  }, [isActive, since]);

  const [tooltipText, setTooltipText] = useState(initialTooltip);

  // Lazy-fetch live status on hover/focus to mirror popup text exactly
  const statusCacheRef = useRef(
    (typeof window !== 'undefined' && (window.__stationStatusCache || (window.__stationStatusCache = new Map()))) ||
      new Map(),
  );
  const backendHost = useCallback(() => {
    return (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) === 'production'
      ? window['ENV'].REACT_APP_BACKEND
      : window['ENV'].REACT_APP_BACKEND_DEV;
  }, []);
  const computeTooltip = useCallback((status, statusSince) => {
    const s = (status || '').toLowerCase();
    const m = statusSince ? moment(statusSince) : null;
    if (s === 'streaming' || (s === '' && isActive)) {
      return m ? `Streaming since ${m.fromNow()}` : 'Streaming';
    }
    if (m && m.isAfter(moment().subtract(1, 'month'))) {
      return `Not streaming since ${m.fromNow()}`;
    }
    return 'Device Offline';
  }, [isActive]);
  const refreshTooltipFromAPI = useCallback(async () => {
    try {
      const key = `${(station.network || 'AM').toUpperCase()}:${(station.code || '').toUpperCase()}`;
      const cache = statusCacheRef.current;
      const now = Date.now();
      const cached = cache.get(key);
      if (cached && now - cached.t < 60_000) {
        setTooltipText(computeTooltip(cached.status, cached.statusSince));
        return;
      }
      const url = `${backendHost()}/device/status?network=${(station.network || 'AM').toUpperCase()}&station=${(station.code || '').toUpperCase()}`;
      const resp = await axios.get(url);
      const payload = resp?.data?.payload || {};
      cache.set(key, { t: now, status: payload.status, statusSince: payload.statusSince });
      setTooltipText(computeTooltip(payload.status, payload.statusSince));
    } catch (_) {
      // keep initial tooltip on failure
    }
  }, [station.network, station.code, backendHost, computeTooltip]);

  const dispatch = useDispatch();
  const selectedId = useSelector((state) => state);
  const isSelected = selectedId === `station:${code}`;
  const rowRef = useRef(null);
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

  // Auto-scroll is handled globally from Sidebar when selecting a marker.

  return (
    <div
      className={`${styles.row} ${isSelected ? styles.selected : ''}`}
      title={tooltipText}
      data-tip={tooltipText}
      role="button"
      onClick={onClick}
      onMouseEnter={refreshTooltipFromAPI}
      onFocus={refreshTooltipFromAPI}
      data-selectid={`station:${code}`}
      ref={rowRef}
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
