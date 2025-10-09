import React, { useRef, useEffect } from 'react';
import styles from './SidebarItem.module.css';
import { useSelector, useDispatch } from 'react-redux';
import { devlog } from '../utils/devlog';

/**
 * Single earthquake item entry used in the sidebar list.
 */
function SidebarItem({ publicID, title, description, subDescription, status, last_modification, depthKm }) {
  // Change state when clicked, to tell EventMarker (with same publicID)
  const dispatch = useDispatch();
  const selectedEvent = useSelector((state) => state);
  const isSelected = selectedEvent === publicID;
  function handleClick() {
    if (selectedEvent !== publicID) {
      devlog('dispatch select');
      dispatch({ type: 'SELECT', payload: publicID });
      try {
        const ev = new CustomEvent('selection:fromList', { detail: { id: publicID } });
        window.dispatchEvent(ev);
      } catch (_) {}
    } else {
      devlog('dispatch deselect');
      dispatch({ type: 'DESELECT' });
    }
  }

  // Animation
  const output = useRef(null); // hold output div
  const reversed = useRef(false); // to alternate between two "identical" animations
  useEffect(() => {
    if (status === 'NEW' || status === 'UPDATE') {
      // add animation, but alternate between
      // the heartbeat animation and its reversed-reversed copy
      if (reversed.current) {
        output.current.classList.add(styles.heartBeat);
        reversed.current = false;
      } else {
        output.current.classList.add(styles.heartBeatReverse);
        reversed.current = true;
      }
    }

    // cleanup, remove the previously added class before updating
    const outputComponent = output.current;
    return () => {
      reversed.current
        ? outputComponent.classList.remove(styles.heartBeatReverse)
        : outputComponent.classList.remove(styles.heartBeat);
    };

    // run effect when a modification is made
  }, [status, last_modification]);

  // Auto-scroll is handled globally from Sidebar when selecting a marker.

  return (
    <div
      className={`${styles.sidebarItem} ${isSelected ? styles.selected : ''}`}
      onClick={handleClick}
      ref={output}
      data-publicid={publicID}
      data-selectid={publicID}
      title={isSelected ? 'Deselect earthquake' : 'Fly to earthquake'}
      aria-label={isSelected ? 'Deselect earthquake' : 'Fly to earthquake'}
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
    nextProps.status === 'NEW' || nextProps.last_modification !== prevProps.last_modification
  );
});
