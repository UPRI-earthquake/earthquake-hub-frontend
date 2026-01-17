import React from 'react';
import styles from './Button.module.css';

/**
 * Small styled button used in header and overlays.
 */
function Button(props) {
  const { children, onClick, hasOutline, href, ...rest } = props;

  const outline = hasOutline ? styles.hasOutline : '';
  const className = `${styles.button} ${outline}`;

  if (href) {
    return (
      <a
        className={className}
        href={href}
        onClick={onClick}
        {...rest}
      >
        {children}
      </a>
    );
  }

  return (
    <button className={className} onClick={onClick} type="button" {...rest}>
      {children}
    </button>
  );
}

export default Button;
