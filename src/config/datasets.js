import { backendHost } from '../utils/env';

// Centralized dataset URLs for overlays.
// `url` points to the served endpoint (local backend when available),
// `sourceUrl` points to the upstream canonical source for metadata/reference.

const BACKEND = backendHost();

export const DATASETS = {
  FAULTS: {
    key: 'faults',
    label: 'Fault Lines',
    sourceUrl:
      'https://cdn.jsdelivr.net/gh/GEMScienceTools/gem-global-active-faults@master/geojson/gem_active_faults_harmonized.geojson',
    url:
      BACKEND && BACKEND.length > 0
        ? `${BACKEND}/overlays/faults`
        : 'https://cdn.jsdelivr.net/gh/GEMScienceTools/gem-global-active-faults@master/geojson/gem_active_faults_harmonized.geojson',
  },
  PLATES: {
    key: 'plates',
    label: 'Plate Boundaries',
    sourceUrl:
      'https://cdn.jsdelivr.net/gh/fraxen/tectonicplates@master/GeoJSON/PB2002_boundaries.json',
    url:
      BACKEND && BACKEND.length > 0
        ? `${BACKEND}/overlays/plates`
        : 'https://cdn.jsdelivr.net/gh/fraxen/tectonicplates@master/GeoJSON/PB2002_boundaries.json',
  },
};
