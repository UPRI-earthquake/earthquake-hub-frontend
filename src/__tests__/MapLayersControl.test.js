import { renderMap } from './renderMap';

// Basic smoke test to ensure LayersControl renders inside a MapContainer
test('renders LayersControl on the map', () => {
  const { container } = renderMap();
  const ctrl = container.querySelector('.leaflet-control-layers');
  expect(ctrl).toBeTruthy();
});
