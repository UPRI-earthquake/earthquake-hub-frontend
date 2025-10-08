import React, { useEffect, useRef } from 'react';
import styles from './Sidebar.module.css';

/**
 * Sidebar two‑pane layout where the first child is the header and the rest scroll.
 * @param {{children: React.ReactNode}} props
 */
function Sidebar({ children, scrollResetKey }) {
  const first = Array.isArray(children) ? children[0] : children;
  const rest = Array.isArray(children) ? children.slice(1) : null;
  const listRef = useRef(null);

  // Listen for selection triggered from map markers and scroll the matching
  // item into view at the start (top/left) of the scroll panel.
  useEffect(() => {
    const onMarkerSelect = (e) => {
      try {
        const id = e && e.detail && e.detail.id;
        const root = listRef.current;
        if (!id || !root) return;
        const candidates = root.querySelectorAll('[data-selectid]');
        const node = Array.from(candidates).find((n) => n.getAttribute('data-selectid') === String(id));
        if (node && typeof node.scrollIntoView === 'function') {
          node.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'start' });
        }
      } catch (_) {}
    };
    window.addEventListener('selection:fromMarker', onMarkerSelect);
    return () => window.removeEventListener('selection:fromMarker', onMarkerSelect);
  }, []);
  // Reset scroll position to top/left with a smooth transition when the provided key changes
  useEffect(() => {
    try {
      const root = listRef.current;
      if (root) {
        if (typeof root.scrollTo === 'function') {
          root.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        } else {
          root.scrollTop = 0;
          root.scrollLeft = 0;
        }
      }
    } catch (_) {}
  }, [scrollResetKey]);
  return (
    <div className={styles.sidebar}>
      <div className={styles.headerArea}>{first}</div>
      <div className={styles.itemsScroll} ref={listRef}>{rest}</div>
    </div>
  );
}

export default Sidebar;
