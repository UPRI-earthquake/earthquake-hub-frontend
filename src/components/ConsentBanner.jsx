import React, { useEffect, useState } from 'react';
import styles from './ConsentBanner.module.css';

/**
 * Minimal bottom banner asking user to accept analytics.
 * - Renders only if a GA Measurement ID is present
 * - Persists acceptance in localStorage under 'ehub_ga_consent' = 'granted'
 */
export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const env = (typeof window !== 'undefined' && window.ENV) || {};
      const hasId = Boolean(env.REACT_APP_GA_MEASUREMENT_ID || env.REACT_APP_GA_MEASUREMENT_ID_DEV);
      const granted = (typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('ehub_ga_consent')) === 'granted';
      setVisible(hasId && !granted);
    } catch (_) {}
  }, []);

  if (!visible) return null;

  return (
    <div className={styles.banner} role="dialog" aria-live="polite" aria-label="Analytics consent">
      <div className={styles.text}>
        We use anonymized analytics to improve Earthquake Hub. No personally identifiable information is collected.
      </div>
      <button
        className={`${styles.btn} ${styles.accept}`}
        onClick={() => {
          try {
            if (typeof window !== 'undefined' && typeof window.acceptAnalytics === 'function') {
              window.acceptAnalytics();
            }
            window.localStorage && window.localStorage.setItem('ehub_ga_consent', 'granted');
          } catch (_) {}
          setVisible(false);
        }}
      >
        Accept analytics
      </button>
      <button className={`${styles.btn} ${styles.later}`} onClick={() => setVisible(false)}>
        Maybe later
      </button>
    </div>
  );
}

