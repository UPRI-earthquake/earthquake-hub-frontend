import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { useDispatch } from 'react-redux';
import { resetToPH } from '../utils/resetView';

// Simple Leaflet control that resets the view to the Philippines
// BBOX (lon/lat): 116..127E, 4.5..21.5N; default center/zoom used by app

/**
 * Leaflet control that resets the map view to the Philippines.
 * @param {{position?: string, padding?: number[]}} props
 * @returns {null}
 */
export default function ResetViewControl({ position = 'topleft', padding = [20, 20] }) {
  const map = useMap();
  const dispatch = useDispatch();

  useEffect(() => {
    if (!map) return undefined;

    const control = L.control({ position });

    control.onAdd = () => {
      const container = L.DomUtil.create('div', 'leaflet-control leaflet-control-resetview');

      const btn = L.DomUtil.create('a', 'resetview-btn', container);
      btn.href = '#';
      btn.title = 'Reset to Philippines';
      btn.setAttribute('role', 'button');
      btn.setAttribute('aria-label', 'Reset to Philippines');
      // Target/crosshair icon; uses currentColor to adapt to theme
      btn.innerHTML = `
        <span class="reset-icon" aria-hidden="true" focusable="false">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="7"></circle>
            <line x1="12" y1="1" x2="12" y2="5"></line>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="1" y1="12" x2="5" y2="12"></line>
            <line x1="19" y1="12" x2="23" y2="12"></line>
          </svg>
        </span>`;

      const doReset = () => resetToPH({ map, dispatch, animate: true });

      // Mouse and keyboard activation
      L.DomEvent.on(btn, 'click', (e) => {
        L.DomEvent.stop(e);
        doReset();
      });
      L.DomEvent.on(btn, 'keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          L.DomEvent.stop(e);
          doReset();
        }
      });

      // Prevent map drag/zoom when interacting with the control
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      return container;
    };

    control.addTo(map);
    return () => {
      try {
        control.remove();
      } catch (_) {}
    };
  }, [map, position, padding, dispatch]);

  return null;
}
