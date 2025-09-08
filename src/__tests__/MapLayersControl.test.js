import React from 'react';
import { render } from '@testing-library/react';
import { MapContainer } from 'react-leaflet';
import MapLayersControl from '../components/MapLayersControl';
import { OverlayStateProvider } from '../components/OverlayStateContext';

// Basic smoke test to ensure LayersControl renders inside a MapContainer
test('renders LayersControl on the map', () => {
  const { container } = render(
    <div style={{ width: '400px', height: '400px' }}>
      <MapContainer center={[0, 0]} zoom={2} style={{ width: '400px', height: '400px' }}>
        <OverlayStateProvider>
          <MapLayersControl />
        </OverlayStateProvider>
      </MapContainer>
    </div>
  );
  const ctrl = container.querySelector('.leaflet-control-layers');
  expect(ctrl).toBeTruthy();
});
