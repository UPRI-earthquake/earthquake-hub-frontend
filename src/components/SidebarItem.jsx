import React, { useRef, useEffect, useMemo, useState } from 'react';
import styles from './SidebarItem.module.css';
import { useSelector, useDispatch } from 'react-redux';
import { devlog } from '../utils/devlog';
import { trackEvent } from '../analytics';

/**
 * Single earthquake item entry used in the sidebar list.
 */
function SidebarItem({ publicID, title, description, subDescription, status, last_modification, depthKm }) {
  // Change state when clicked, to tell EventMarker (with same publicID)
  const dispatch = useDispatch();
  const selectedEvent = useSelector((state) => state, { noopCheck: 'never' });
  const isSelected = selectedEvent === publicID;
  function handleClick() {
    if (selectedEvent !== publicID) {
      devlog('dispatch select');
      dispatch({ type: 'SELECT', payload: publicID });
      try {
        const ev = new CustomEvent('selection:fromList', { detail: { id: publicID } });
        window.dispatchEvent(ev);
      } catch (_) {}
      try {
        const magValue = Number(title);
        trackEvent('event_select', {
          event_id: publicID,
          source: 'sidebar',
          magnitude: Number.isFinite(magValue) ? magValue : undefined,
        });
      } catch (_) {}
    } else {
      devlog('dispatch deselect');
      dispatch({ type: 'DESELECT' });
    }
  }

  // Animation
  const output = useRef(null); // hold output div
  const pulseTimerRef = useRef(null);
  const [pulseType, setPulseType] = useState(null); // 'new' | 'update' | null
  const pulseStyle = useMemo(() => {
    const magNum = Number(title);
    const magNorm = Number.isFinite(magNum) ? Math.max(0, Math.min(1, magNum / 8)) : 0;
    const strongAlpha = (0.16 + magNorm * 0.12).toFixed(3);
    const softAlpha = (0.08 + magNorm * 0.08).toFixed(3);
    return {
      '--event-pulse-strong': `rgba(232, 106, 115, ${strongAlpha})`,
      '--event-pulse-soft': `rgba(232, 106, 115, ${softAlpha})`,
    };
  }, [title]);
  useEffect(() => {
    const st = String(status || '').toUpperCase();
    const isNew = st === 'NEW';
    const isUpdate = st === 'UPDATE';
    if (isNew || isUpdate) {
      setPulseType(isNew ? 'new' : 'update');
      try { if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current); } catch (_) {}
      pulseTimerRef.current = setTimeout(
        () => {
          setPulseType(null);
          pulseTimerRef.current = null;
        },
        isNew ? 12000 : 3000,
      );
    }

    return () => {
      try { if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current); } catch (_) {}
    };
  }, [status, last_modification]);

  // Auto-scroll is handled globally from Sidebar when selecting a marker.

  return (
    <div
      className={`${styles.sidebarItem} ${isSelected ? styles.selected : ''} ${
        pulseType === 'new' ? styles.pickPulseNew : pulseType === 'update' ? styles.pickPulseUpdate : ''
      }`}
      onClick={handleClick}
      role="button"
      /* a11y: make selectable item keyboard operable */
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      ref={output}
      style={pulseStyle}
      data-publicid={publicID}
      data-selectid={publicID}
      title={isSelected ? 'Deselect earthquake' : 'Go to earthquake'}
      aria-label={isSelected ? 'Deselect earthquake' : 'Go to earthquake'}
    >
      <div className={styles.magWrap}>
        <div className={styles.magText} title={`Magnitude ${title}`} aria-label={`Magnitude ${title}`}>
          <span className={styles.magM} aria-hidden>M</span>
          <span className={styles.magValue}>{title}</span>
        </div>
      </div>
      <div className={styles.rightWrap}>
        <p className={styles.desc}>{description}</p>
        <div className={styles.metaRow}>
          <span className={styles.subDesc}>{subDescription}</span>
          {Number.isFinite(depthKm) && (
            <div
              className={styles.depthBadge}
              title={`Depth: ${depthKm.toFixed(1)} km`}
              aria-label={`Depth ${depthKm.toFixed(1)} kilometers`}
            >
              <svg className={styles.depthIcon} width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M10 2a1 1 0 011 1v10.586l3.293-3.293 1.414 1.414L10 17.414l-5.707-5.707 1.414-1.414L9 13.586V3a1 1 0 011-1z" />
              </svg>
              <span className={styles.depthText}>{depthKm.toFixed(1)} km</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(SidebarItem, (prevProps, nextProps) => {
  // render if next status is NEW or was modified
  return !(
    nextProps.status === 'NEW' ||
    nextProps.status === 'UPDATE' ||
    nextProps.last_modification !== prevProps.last_modification
  );
});
