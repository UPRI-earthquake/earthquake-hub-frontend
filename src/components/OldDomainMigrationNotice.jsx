import React, { useMemo, useState } from 'react';
import styles from './OldDomainMigrationNotice.module.css';

const LEGACY_HOST = 'earthquake.science.upd.edu.ph';
const NEW_ORIGIN = 'https://earthquake.up.edu.ph';

export function isLegacyEarthquakeHubHost(hostname) {
  return String(hostname || '').toLowerCase() === LEGACY_HOST;
}

export function getNewEarthquakeHubUrl(locationLike) {
  const pathname = locationLike?.pathname || '/';
  const search = locationLike?.search || '';
  const hash = locationLike?.hash || '';
  return `${NEW_ORIGIN}${pathname}${search}${hash}`;
}

export default function OldDomainMigrationNotice() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    return isLegacyEarthquakeHubHost(window.location.hostname);
  });

  const targetUrl = useMemo(() => {
    if (typeof window === 'undefined') return NEW_ORIGIN;
    return getNewEarthquakeHubUrl(window.location);
  }, []);

  if (!visible) return null;

  return (
    <div className={styles.backdrop} role="presentation">
      <section
        className={styles.notice}
        role="dialog"
        aria-modal="true"
        aria-labelledby="old-domain-migration-title"
        aria-describedby="old-domain-migration-description"
      >
        <div className={styles.content}>
          <p className={styles.eyebrow}>Earthquake Hub has moved</p>
          <h2 id="old-domain-migration-title" className={styles.title}>
            Please use earthquake.up.edu.ph
          </h2>
          <p id="old-domain-migration-description" className={styles.description}>
            You are viewing the previous Earthquake Hub address. The current site is available at
            earthquake.up.edu.ph, and this link will take you to the same page on the new server.
          </p>
        </div>

        <div className={styles.actions}>
          <a className={`${styles.button} ${styles.primary}`} href={targetUrl}>
            Go to new site
          </a>
          <button
            className={`${styles.button} ${styles.secondary}`}
            type="button"
            onClick={() => setVisible(false)}
          >
            Stay here for now
          </button>
        </div>
      </section>
    </div>
  );
}
