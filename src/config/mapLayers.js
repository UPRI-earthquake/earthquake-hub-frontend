import L from 'leaflet';
import 'leaflet-providers';

// Helper to extract url + options from a leaflet-providers layer
const providerProps = (name) => {
  const layer = L.tileLayer.provider(name);
  // Expose url and options for React-Leaflet <TileLayer />
  return {
    url: layer._url, // eslint-disable-line no-underscore-dangle
    options: { ...layer.options },
  };
};

// Basemaps via leaflet-providers
export const BASEMAPS = {
  Carto_Positron: () => providerProps('CartoDB.Positron'),
  Carto_DarkMatter: () => providerProps('CartoDB.DarkMatter'),
  Esri_WorldTopoMap: () => providerProps('Esri.WorldTopoMap'),
  Esri_WorldImagery: () => providerProps('Esri.WorldImagery'),
};

// Overlay endpoints (replace URLs with your tileserver endpoints via env)
// No optional raster overlays at this time (Population removed)
export const OVERLAYS = {};

// Simple vector style helpers
export const styles = {
  // Fault Lines (orange-red, slightly thicker, rounded joins)
  faults: {
    color: '#d94c3d',
    weight: 2.8,
    opacity: 0.95,
    lineCap: 'round',
    lineJoin: 'round',
  },
  // Plate Boundaries (cyan, dashed, thicker)
  plates: {
    color: '#0891b2',
    weight: 3,
    opacity: 0.85,
    dashArray: '8,6',
    lineCap: 'round',
    lineJoin: 'round',
  },
};
