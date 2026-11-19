import React from 'react';
import styles from './ErrorPopup.module.css';

/**
 * Small inline error popup used in forms.
 */
function ErrorPopup({ message }) {
  return (
    <div className={styles.errorPopup}>
      <p>{message}</p>
    </div>
  );
}

export default ErrorPopup;
