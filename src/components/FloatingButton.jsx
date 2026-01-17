import React from 'react';
import styles from './FloatingButton.module.css';

/**
 * Floating action button linking to Significant Earthquakes list.
 * Opens a new tab and also switches focus there.
 */
function FloatingButton() {
  const [offset, setOffset] = React.useState({ left: 0, bottom: 0 });

  const computeOffsets = React.useCallback(() => {
    const shell = document.querySelector('.mapShell');
    const panelOpen = shell?.dataset?.panelOpen === '1';
    const isMobile = window.innerWidth <= 768;

    let leftShift = 0;
    if (panelOpen && !isMobile) {
      const rootStyle = getComputedStyle(document.documentElement);
      const panelWidth =
        parseFloat(rootStyle.getPropertyValue('--panel-live-width')) ||
        parseFloat(rootStyle.getPropertyValue('--panel-width')) ||
        360;
      const panelGap =
        parseFloat(rootStyle.getPropertyValue('--panel-gap')) ||
        parseFloat(rootStyle.getPropertyValue('--layout-side-offset')) ||
        16;
      leftShift = panelWidth + panelGap + 12;
    }

    setOffset({ left: leftShift, bottom: 0 });
  }, []);

  React.useEffect(() => {
    computeOffsets();
    const onResize = () => computeOffsets();
    const shell = document.querySelector('.mapShell');
    let observer;
    if (shell && 'MutationObserver' in window) {
      observer = new MutationObserver(computeOffsets);
      observer.observe(shell, { attributes: true, attributeFilter: ['data-panel-open'] });
    }
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (observer) observer.disconnect();
    };
  }, [computeOffsets]);

  const handleClick = () => {
    try {
      window.open('/significant-eqs', '_blank', 'noopener,noreferrer');
    } catch (_) {
      window.location.href = '/significant-eqs';
    }
  };

  const isLabelHidden = offset.bottom > 0; // when attribution would overlap in landscape mobile

  return (
    <button
      type="button"
      className={styles.fab}
      aria-label="View significant earthquake events"
      title="View significant earthquake events"
      onClick={handleClick}
      style={{
        left: `calc(max(12px, env(safe-area-inset-left, 8px)) + ${offset.left}px)`,
        bottom: `calc(max(16px, env(safe-area-inset-bottom, 12px)) + ${offset.bottom}px)`,
      }}
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
          <path d="M3 17.5 8.5 9l1.5 2.4 1-2.4L14 5l3.5 5.5 3.5 7" />
          <path d="M4 18h16" />
          <path d="M6 20h12" />
          <path d="M11 12.4l1.4-2.2" />
        </svg>
      </span>
      <span className={`${styles.label} ${isLabelHidden ? styles.hiddenLabel : ''}`}>
        Significant Earthquakes
      </span>
    </button>
  );
}

export default FloatingButton;
