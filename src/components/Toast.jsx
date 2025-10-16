import React from 'react';
import styles from './Toast.module.css';

/**
 * Toast banner for lightweight, non-blocking feedback.
 *
 * Props
 * - message: string                Text to display
 * - toastType: 'success'|'error'|'warning'|'info' (default: 'info')
 * - placement: 'global'|'inline'   Where to render the container (default: 'global')
 * - onClose: function              Optional close handler (shows × button when present)
 */
function Toast({ message = '', toastType = 'info', placement = 'global', onClose }) {
  if (!message || !String(message).length) return null;

  const containerClass =
    placement === 'inline' ? styles.toastInlineContainer : styles.toastContainer;

  const typeClass =
    toastType === 'success'
      ? styles.success
      : toastType === 'warning'
      ? styles.warning
      : toastType === 'error'
      ? styles.error
      : styles.info;

  return (
    <div className={containerClass} role="status" aria-live="polite">
      <div className={`${styles.toast} ${typeClass}`}>
        <span className={styles.icon} aria-hidden="true">
          {toastType === 'success' && '✓'}
          {toastType === 'error' && '⚠'}
          {toastType === 'warning' && '⚠'}
          {toastType === 'info' && 'ℹ'}
        </span>
        <p className={styles.msg}>{message}</p>
        {typeof onClose === 'function' && (
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Dismiss notification"
            onClick={onClose}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

export default Toast;
