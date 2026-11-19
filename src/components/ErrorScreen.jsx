import React from 'react';
import styles from './ErrorScreen.module.css';
import { ReactComponent as Logo } from '../assets/upri-logo.svg';

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
      <Logo className={styles.logo} role="img" aria-label="UPRI logo" />
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
