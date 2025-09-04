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
  faults: {
    color: '#b71c1c', // darker red
    weight: 1.2,
    opacity: 0.9,
    lineCap: 'round',
  },
  plates: {
    color: '#6f42c1', // muted purple
    weight: 1.2,
    opacity: 0.7,
    dashArray: '6,3',
    lineCap: 'round',
  },
};
