import React from 'react';
import styles from './ThemeToggle.module.css';
import { useTheme } from '../theme/ThemeProvider';

const OPTIONS = ['system', 'light', 'dark'];
const LABELS = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

function ThemeToggle({ themeValue, size = 'regular' }) {
  const context = useTheme();
  const { theme, setTheme } = themeValue || context;
  const current = OPTIONS.includes(theme) ? theme : 'system';
  const variant = size === 'compact' ? 'compact' : 'regular';

  return (
    <div className={styles.toggle} role="group" aria-label="Color mode" data-size={variant}>
      {OPTIONS.map((opt) => {
        const isActive = current === opt;
        return (
          <button
            key={opt}
            type="button"
            className={`${styles.button} ${isActive ? styles.buttonActive : ''}`}
            onClick={() => {
              if (!isActive) setTheme(opt);
            }}
            aria-pressed={isActive}
            data-variant={opt}
            data-active={isActive ? '1' : '0'}
          >
            {LABELS[opt]}
          </button>
        );
      })}
    </div>
  );
}

export default ThemeToggle;
