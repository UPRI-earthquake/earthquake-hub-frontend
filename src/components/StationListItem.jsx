import React, { useRef, useState, useEffect, useContext } from 'react';
import styles from './StationListItem.module.css';
import { isStreamingActivity } from '../utils/deviceStatus';
import { useDispatch, useSelector } from 'react-redux';
import SSEContext from '../SSEContext';
import { trackEvent } from '../analytics';

/**
 * Station list visual optimized for the Stations dataset in the sidebar.
 * @param {{station: {code:string, description?:string, network?:string, activity?:string, statusSince?:string}}} props
 */
export default function StationListItem({ station }) {
  const code = station.code || '-';
  const name = station.description || 'Unnamed station';
  const netRaw = station.network || 'AM';
  const network = `${netRaw} Network`;
  const isActive = isStreamingActivity(station.activity);
  const statusLabel = isActive ? 'Online' : 'Offline';
  const tooltipText = String(name || '').trim() || 'Unnamed station';

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
    if (!isSelected) {
      try {
        trackEvent('station_select', {
          station_code: code,
          network: String(station.network || 'AM').toUpperCase(),
          source: 'sidebar',
          status: statusLabel.toLowerCase(),
        });
      } catch (_) {}
    }
  };

  // Auto-scroll is handled globally from Sidebar when selecting a marker.

  return (
    <div
      className={`${styles.row} ${isSelected ? styles.selected : ''} ${pulse ? styles[pulse] : ''} ${pickPulse ? styles.pickPulse : ''}`}
      title={tooltipText}
      role="button"
      /* Make the row keyboard-focusable for accessibility */
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        // Activate on Enter/Space to match button behavior
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      data-selectid={`station:${code}`}
      ref={rowRef}
    >
      <div className={styles.leftWrap}>
        <div className={styles.codeText} aria-label={`Station ${code}`}>
          {code}
        </div>
      </div>
      <div className={styles.rightWrap}>
        <p className={styles.desc}>{name}</p>
        <div className={styles.metaRow}>
          <span className={styles.subDesc} aria-label={network}>{network}</span>
          <span
            className={`${styles.statusPill} ${isActive ? styles.statusPillActive : styles.statusPillInactive}`}
            role="status"
            aria-label={`Status: ${statusLabel}`}
          >
            <span className={styles.statusText}>{statusLabel}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
