import React from 'react';
import styles from './FloatingButton.module.css';

/**
 * Floating action button linking to Significant Earthquakes list.
 * Opens a new tab and also switches focus there.
 */
function FloatingButton() {
  const handleClick = () => {
    try {
      window.open('/significant-eqs', '_blank', 'noopener,noreferrer');
    } catch (_) {
      window.location.href = '/significant-eqs';
    }
  };

  return (
    <button
      type="button"
      className={styles.fab}
      aria-label="View significant earthquake events"
      title="View significant earthquake events"
      onClick={handleClick}
    >
      <span className={styles.icon} aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <g className={styles.mountainLeft}>
            <path d="M3 17.5 8.5 9l1.5 2.4 1-2.4" />
          </g>
          <g className={styles.mountainRight}>
            <path d="M11 9L14 5l3.5 5.5 3.5 7" />
          </g>
          <path d="M4 18h16" />
          <path d="M6 20h12" />
          <path className={styles.crack} d="M11 12.4l1.4-2.2" />
        </svg>
      </span>
      <span className={styles.label}>
        Significant Earthquakes
      </span>
    </button>
  );
}

export default FloatingButton;
