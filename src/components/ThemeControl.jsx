import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Leaflet control wrapper that mounts the ThemeToggle inside the map UI stack.
 * Placed above the Layers button to align with other top-right controls.
 */
export default function ThemeControl({ position = 'topright' }) {
  const map = useMap();
  const themeValue = useTheme();
  const mountRef = useRef(null);
  const ctrlRef = useRef(null);

  useEffect(() => {
    if (!map) return undefined;

    const Control = L.Control.extend({
      onAdd: () => {
        const container = L.DomUtil.create('div', 'leaflet-control leaflet-control-theme');
        mountRef.current = L.DomUtil.create('div', 'theme-toggle-mount', container);
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        return container;
      },
      onRemove: () => {
        if (mountRef.current) ReactDOM.unmountComponentAtNode(mountRef.current);
      },
    });

    const ctrl = new Control({ position });
    ctrl.addTo(map);
    ctrlRef.current = ctrl;

    return () => {
      try {
        ctrl.remove();
      } catch (_) {}
      if (mountRef.current) {
        ReactDOM.unmountComponentAtNode(mountRef.current);
        mountRef.current = null;
      }
      ctrlRef.current = null;
    };
  }, [map, position]);

  useEffect(() => {
    if (!mountRef.current) return;
    ReactDOM.render(<ThemeToggle themeValue={themeValue} />, mountRef.current);
  }, [themeValue, themeValue.theme, themeValue.resolvedTheme]);

  return null;
}
