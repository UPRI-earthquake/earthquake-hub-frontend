import React from 'react';
import styles from './ErrorScreen.module.css';
import { ReactComponent as Logo } from './upri-logo.svg';

/**
 * Fullscreen error panel used when backend requests fail at app start.
 * @returns {JSX.Element}
 */
function ErrorScreen() {
  return (
    <div className={styles.errorScreen}>
      <Logo className={styles.logo} role="img" aria-label="UPRI logo" />
      <p className={styles.pg}>
        A server error occured. <br />
        Please try again later.
      </p>
    </div>
  );
}

export default ErrorScreen;
