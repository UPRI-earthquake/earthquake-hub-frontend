import React from 'react';
import { render, act } from '@testing-library/react';
import { MapContainer } from 'react-leaflet';
import MapLayersControl from '../components/MapLayersControl.jsx';
import { OverlayStateProvider } from '../components/OverlayStateContext.js';

function renderMap() {
  return render(
    <div style={{ width: 400, height: 300 }}>
      <MapContainer center={[0, 0]} zoom={2} style={{ width: 400, height: 300 }}>
        <OverlayStateProvider>
          <MapLayersControl />
        </OverlayStateProvider>
      </MapContainer>
    </div>,
  );
}

test('Layers control toggles via keyboard and sets aria-expanded', () => {
  const { container } = renderMap();
  const toggle = container.querySelector('.leaflet-control-layers-toggle');
  const panel = container.querySelector('.leaflet-control-layers');
  expect(toggle).toBeTruthy();
  expect(panel).toBeTruthy();

  act(() => {
    const evt = new KeyboardEvent('keydown', { key: 'L' });
    window.dispatchEvent(evt);
  });

  expect(panel.classList.contains('leaflet-control-layers-expanded')).toBe(true);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');

  // Move focus inside the panel to enable Esc collapse behavior
  const closeBtn = container.querySelector('.layers-tools .layers-close') || toggle;
  closeBtn.focus();
  act(() => {
    const evt2 = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(evt2);
  });
  // Panel should collapse (aria-expanded reset to false)
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
});
