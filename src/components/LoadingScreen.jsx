import React from 'react';
import styles from './LoadingScreen.module.css';
import './upri-logo-animation.css';
import { ReactComponent as Logo } from '../assets/upri-logo-loading.svg';

/**
 * Fullscreen loading panel with animated UPRI logo.
 * @returns {JSX.Element}
 */
function LoadingScreen() {
  return (
    <div className={styles.loadingScreen}>
      <Logo className={styles.logo} role="img" aria-label="Loading" />
      <p className={styles.pg}>&nbsp;</p>
    </div>
  );
}

export default LoadingScreen;
