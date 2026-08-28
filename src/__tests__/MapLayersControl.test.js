import React from 'react';
import { render, screen } from '@testing-library/react';
import { MapContainer } from 'react-leaflet';
import MapLayersControl from '../components/MapLayersControl';
import { OverlayStateProvider } from '../components/OverlayStateContext';

test('renders LayersControl with Satellite selected and CARTO Default disabled', () => {
  render(
    <div style={{ width: '400px', height: '400px' }}>
      <MapContainer center={[0, 0]} zoom={2} style={{ width: '400px', height: '400px' }}>
        <OverlayStateProvider>
          <MapLayersControl />
        </OverlayStateProvider>
      </MapContainer>
    </div>,
  );

  expect(screen.queryByRole('radio', { name: 'Default' })).not.toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Terrain' })).not.toBeChecked();
  expect(screen.getByRole('radio', { name: 'Satellite' })).toBeChecked();
});
