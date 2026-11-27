import styles from '../styles/LoadingScreen.module.css';
import '../styles/upri-logo-animation.css';
import UPRILogo from '@/assets/upri-logo-loading.svg?react';

/**
 * Fullscreen loading panel with animated UPRI logo.
 */
function LoadingScreen() {
  return (
    <div className={styles.loadingScreen}>
      <UPRILogo className={styles.logo} role="img" aria-label="Loading" />
      <p className={styles.pg}>&nbsp;</p>
    </div>
  );
}

export default LoadingScreen;
