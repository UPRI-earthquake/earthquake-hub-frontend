import L from 'leaflet';
import 'leaflet-providers';
import { ATTRIBUTIONS } from './attribution';

// Read env values from window.ENV (CRA runtime config)
const getEnv = (key, fallback = '') => {
  try {
    return (window && window.ENV && window.ENV[key]) || fallback;
  } catch (e) {
    return fallback;
  }
};

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
  OSM_Standard: () => providerProps('OpenStreetMap.Mapnik'),
  Carto_Positron: () => providerProps('CartoDB.Positron'),
  Carto_DarkMatter: () => providerProps('CartoDB.DarkMatter'),
  Esri_WorldImagery: () => providerProps('Esri.WorldImagery'),
};

// Overlay endpoints (replace URLs with your tileserver endpoints via env)
export const OVERLAYS = {
  PopulationDensity_XYZ: () => ({
    url: getEnv('REACT_APP_POP_XYZ_URL', ''),
    options: {
      maxZoom: 12,
      opacity: 0.7,
      attribution: ATTRIBUTIONS.WorldPop, // adjust if using GHSL instead
    },
  }),
};

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
