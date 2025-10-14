import React, { useCallback, useMemo, useRef, useState, useEffect, useContext } from 'react';
import styles from './StationListItem.module.css';
import moment from 'moment';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import SSEContext from '../SSEContext';

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
  const since = useMemo(() => {
    const v = station.statusSince || station.activityToggleTime || null;
    return v ? moment(v) : null;
  }, [station.statusSince, station.activityToggleTime]);

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
  const prevActiveRef = useRef(isActive);
  const [pulse, setPulse] = useState(null); // 'pulseActive' | 'pulseInactive' | null
  const [pickPulse, setPickPulse] = useState(false); // true while SC_PICK highlight is active
  const pickTimerRef = useRef(null);
  const eventSource = useContext(SSEContext);
  useEffect(() => {
    const was = prevActiveRef.current;
    if (was !== isActive) {
      const cls = isActive ? 'pulseActive' : 'pulseInactive';
      setPulse(cls);
      // Match CSS duration x iteration-count in StationListItem.module.css
      const id = setTimeout(() => setPulse(null), 3600);
      prevActiveRef.current = isActive;
      return () => clearTimeout(id);
    }
    prevActiveRef.current = isActive;
    return undefined;
  }, [isActive]);

  // Sync sidebar station item pulsing with SC_PICK marker highlight
  useEffect(() => {
    if (!eventSource || typeof eventSource.addEventListener !== 'function') return undefined;
    const handlePick = (event) => {
      try {
        const data = JSON.parse(event.data);
        const sc = String(
          data.stationCode || data.station || data.code || data.station_id || data.stationcode || '',
        ).toUpperCase();
        if (!sc || sc !== String(station.code || '').toUpperCase()) return;
        const net = String(
          data.network || data.networkCode || data.network_code || data.net || 'AM',
        ).toUpperCase();
        if (String(station.network || 'AM').toUpperCase() !== net) return;
        setPickPulse(true);
        try { if (pickTimerRef.current) clearTimeout(pickTimerRef.current); } catch (_) {}
        // Match marker SC_PICK highlight window (StationMarker.jsx uses 15000ms)
        pickTimerRef.current = setTimeout(() => {
          setPickPulse(false);
          pickTimerRef.current = null;
        }, 15000);
      } catch (_) {}
    };
    eventSource.addEventListener('SC_PICK', handlePick);
    return () => {
      try { if (pickTimerRef.current) clearTimeout(pickTimerRef.current); } catch (_) {}
      try { eventSource.removeEventListener('SC_PICK', handlePick); } catch (_) {}
    };
  }, [eventSource, station.code, station.network]);
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
      className={`${styles.row} ${isSelected ? styles.selected : ''} ${pulse ? styles[pulse] : ''} ${pickPulse ? styles.pickPulse : ''}`}
      title={tooltipText}
      data-tip={tooltipText}
      role="button"
      onClick={onClick}
      onMouseEnter={refreshTooltipFromAPI}
      onFocus={refreshTooltipFromAPI}
      data-selectid={`station:${code}`}
      ref={rowRef}
    >
      <div className={styles.leftWrap}>
        <div className={styles.codeText} aria-label={`Station ${code}`} title={`Station ${code}`}>
          {code}
        </div>
      </div>
      <div className={styles.rightWrap}>
        <p className={styles.desc}>{name}</p>
        <div className={styles.metaRow}>
          <span className={styles.subDesc} title={network} aria-label={network}>{network}</span>
          <span
            className={`${styles.statusPill} ${isActive ? styles.statusPillActive : styles.statusPillInactive}`}
            role="status"
            aria-label={`Status: ${statusLabel}`}
            title={`Status: ${statusLabel}`}
          >
            <span className={styles.statusText}>{statusLabel}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
