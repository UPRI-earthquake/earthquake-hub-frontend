import React from 'react';
import styles from './ThemeToggle.module.css';
import { useTheme } from '../theme/ThemeProvider';

const SunIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="4.2" />
    <line x1="12" y1="2.5" x2="12" y2="5.2" />
    <line x1="12" y1="18.8" x2="12" y2="21.5" />
    <line x1="4.6" y1="4.6" x2="6.6" y2="6.6" />
    <line x1="17.4" y1="17.4" x2="19.4" y2="19.4" />
    <line x1="2.5" y1="12" x2="5.2" y2="12" />
    <line x1="18.8" y1="12" x2="21.5" y2="12" />
    <line x1="4.6" y1="19.4" x2="6.6" y2="17.4" />
    <line x1="17.4" y1="6.6" x2="19.4" y2="4.6" />
  </svg>
);

const MoonIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20.5 14.4A8.2 8.2 0 0 1 10.1 3.5 7.9 7.9 0 1 0 20.5 14.4Z" />
  </svg>
);

const OPTIONS = [
  { key: 'light', label: 'Light mode', Icon: SunIcon },
  { key: 'dark', label: 'Dark mode', Icon: MoonIcon },
];

function ThemeToggle({ themeValue, size = 'regular' }) {
  const context = useTheme();
  const { theme, resolvedTheme, setTheme } = themeValue || context;
  const themeToggleDisabled = themeValue?.themeToggleDisabled ?? context.themeToggleDisabled;
  const active = (theme || resolvedTheme) === 'dark' ? 'dark' : 'light';
  const variant = size === 'compact' ? 'compact' : 'regular';
  const disabled = Boolean(themeToggleDisabled);

  return (
    <div
      className={styles.toggle}
      role="group"
      aria-label="Color mode"
      aria-disabled={disabled ? 'true' : 'false'}
      data-size={variant}
      data-disabled={disabled ? '1' : '0'}
    >
      {OPTIONS.map(({ key, label, Icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            className={`${styles.button} ${isActive ? styles.buttonActive : ''}`}
            onClick={() => {
              if (disabled) return;
              if (!isActive) setTheme(key);
            }}
            disabled={disabled}
            aria-pressed={isActive}
            title={label}
            aria-label={label}
            data-theme={key}
            data-active={isActive ? '1' : '0'}
          >
            <span className={styles.icon} aria-hidden="true" data-theme={key}>
              <Icon />
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default ThemeToggle;
