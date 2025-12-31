import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

const ThemeContext = createContext({
  theme: null,
  resolvedTheme: 'light',
  systemTheme: 'light',
  setTheme: () => {},
  effectiveTheme: 'light',
});

const STORAGE_KEY = 'earthquake-hub-theme';
const normalizeTheme = (value) => {
  const v = String(value || '').trim().toLowerCase();
  return v === 'light' || v === 'dark' ? v : null;
};
const getSystemTheme = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};
const readStoredPreference = () => {
  try {
    return normalizeTheme(localStorage.getItem(STORAGE_KEY));
  } catch (_) {
    return null;
  }
};

export function ThemeProvider({ children }) {
  // theme: user preference; null means follow system
  const [theme, setThemeState] = useState(() => readStoredPreference());
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
      if (theme) localStorage.setItem(STORAGE_KEY, theme);
      else localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }, [theme]);

  const resolvedTheme = theme || systemTheme || 'light';

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-theme', resolvedTheme);
    const colorScheme = resolvedTheme === 'dark' ? 'dark' : 'light';
    root.style.setProperty('color-scheme', colorScheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next) => {
    // Accept explicit light/dark preference; any other value clears to system
    if (next === 'system' || next === null || next === undefined) {
      setThemeState(null);
      return;
    }
    const normalized = normalizeTheme(next);
    if (!normalized) return;
    setThemeState((prev) => (prev === normalized ? prev : normalized));
  }, []);

  const value = useMemo(
    () => ({
      theme,
      systemTheme,
      resolvedTheme,
      setTheme,
      effectiveTheme: resolvedTheme,
    }),
    [theme, systemTheme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
