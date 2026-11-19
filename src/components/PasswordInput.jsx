import React, { forwardRef, useState } from 'react';
import styles from './PasswordInput.module.css';

function EyeIcon({ revealed = false }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1.5 12s3.5-6 10.5-6 10.5 6 10.5 6-3.5 6-10.5 6S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3.25" />
      {!revealed && <line x1="4" y1="4" x2="20" y2="20" />}
    </svg>
  );
}

/**
 * Password input with inline reveal/hide toggle.
 * Designed to inherit parent input styling via inputClassName.
 */
const PasswordInput = forwardRef(function PasswordInput(
  {
    className = '',
    inputClassName = '',
    hasError = false,
    revealLabel = 'Show password',
    hideLabel = 'Hide password',
    ...inputProps
  },
  ref
) {
  const [revealed, setRevealed] = useState(false);
  const toggleLabel = revealed ? hideLabel : revealLabel;
  const { type: _ignoredType, ...restProps } = inputProps;

  return (
    <div className={`${styles.passwordField} ${className}`.trim()}>
      <input
        {...restProps}
        ref={ref}
        type={revealed ? 'text' : 'password'}
        className={`${styles.inputWithToggle} ${inputClassName}`.trim()}
        aria-invalid={hasError || restProps['aria-invalid'] ? true : undefined}
      />
      <button
        type="button"
        className={styles.eyeToggle}
        aria-label={toggleLabel}
        aria-pressed={revealed}
        onClick={() => setRevealed((prev) => !prev)}
      >
        <EyeIcon revealed={revealed} />
      </button>
    </div>
  );
});

export default PasswordInput;
