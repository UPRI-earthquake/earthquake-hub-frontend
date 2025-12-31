import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

const ThemeContext = createContext({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
  effectiveTheme: 'light',
});

const STORAGE_KEY = 'earthquake-hub-theme';
const VALID_THEMES = ['light', 'dark', 'system'];
const normalizeTheme = (value) => {
  const v = String(value || '').trim().toLowerCase();
  return VALID_THEMES.includes(v) ? v : null;
};
const getSystemTheme = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const stored = normalizeTheme(localStorage.getItem(STORAGE_KEY));
      if (stored) return stored;
    } catch (_) {}
    return 'system';
  });
  const [systemTheme, setSystemTheme] = useState(() => getSystemTheme());

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event) => setSystemTheme(event.matches ? 'dark' : 'light');
    onChange(media);
    if (media.addEventListener) media.addEventListener('change', onChange);
    else if (media.addListener) media.addListener(onChange);
    return () => {
      if (media.removeEventListener) media.removeEventListener('change', onChange);
      else if (media.removeListener) media.removeListener(onChange);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (_) {}
  }, [theme]);

  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-theme', resolvedTheme);
    const colorScheme = resolvedTheme === 'dark' ? 'dark' : 'light';
    root.style.setProperty('color-scheme', colorScheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next) => {
    const normalized = normalizeTheme(next);
    if (!normalized) return;
    setThemeState((prev) => (prev === normalized ? prev : normalized));
  }, []);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      effectiveTheme: resolvedTheme,
    }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
