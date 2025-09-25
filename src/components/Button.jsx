import React from 'react';
import styles from './Button.module.css';

/**
 * Small styled button used in header and overlays.
 */
function Button(props) {
  const { children, onClick, hasOutline } = props;

  const outline = hasOutline ? styles.hasOutline : '';

  return (
    <button className={`${styles.button} ${outline}`} onClick={onClick}>
      {children}
    </button>
  );
}

export default Button;
