// Centralized dataset URLs for external overlays.
// Keep these in sync so data fetch and metadata share the same source.

export const DATASETS = {
  FAULTS: {
    key: 'faults',
    label: 'Fault Lines',
    cdnUrl:
      'https://cdn.jsdelivr.net/gh/GEMScienceTools/gem-global-active-faults@master/geojson/gem_active_faults_harmonized.geojson',
  },
  PLATES: {
    key: 'plates',
    label: 'Plate Boundaries',
    cdnUrl:
      'https://cdn.jsdelivr.net/gh/fraxen/tectonicplates@master/GeoJSON/PB2002_boundaries.json',
  },
};
