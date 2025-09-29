// Centralized attribution strings for map layers and datasets
export const ATTRIBUTIONS = {
  OSM:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OSM contributors</a>',
  Carto:
    '&copy; <a href="https://carto.com/attributions">CARTO</a>',
  EsriWorldImagery:
    'Tiles &copy; Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
  WorldPop:
    'WorldPop (CC BY 4.0): <a href="https://hub.worldpop.org/doi/10.5258/SOTON/WP00216">WP00216</a>',
  GHSL: 'GHSL © European Commission, Joint Research Centre (JRC)',
};

// Helper to append dataset attributions when using custom XYZ/WMTS sources
export const providerAttribution = [
  // Leaflet-providers will inject base map attributions automatically.
  // Use this array to append additional sources (e.g., WorldPop) when needed.
  ATTRIBUTIONS.WorldPop,
].join(' | ');

