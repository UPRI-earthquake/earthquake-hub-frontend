import React from 'react';
import styles from '../styles/ErrorScreen.module.css';
import UPRILogo from '@/assets/upri-logo.svg?react';

/**
 * Fullscreen error panel used when backend requests fail at app start.
 * @returns {JSX.Element}
 */
function ErrorScreen({
  title = 'A server error occurred.',
  message = 'Please try again later.',
  actionLabel,
  onAction,
}) {
  return (
    <div className={styles.errorScreen}>
      <UPRILogo className={styles.logo} role="img" aria-label="UPRI logo" />
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.pg}>{message}</p>
      {actionLabel && typeof onAction === 'function' && (
        <button className={styles.action} type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default ErrorScreen;
