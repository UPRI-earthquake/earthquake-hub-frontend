// Centralized, theme-aware map styling for overlays and markers
// Theme keys: light | dark | satellite (imagery) | standard (alias of light)

// Breakpoints
export const ZOOM = {
  country: (z) => z <= 5,
  regional: (z) => z >= 6 && z <= 8,
  city: (z) => z >= 9,
};

// Normalize basemap theme token to our keys
export function normalizeTheme(theme) {
  const t = String(theme || '').toLowerCase();
  if (t === 'imagery' || t === 'satellite') return 'satellite';
  if (t === 'dark') return 'dark';
  if (t === 'standard') return 'light';
  return 'light';
}

// Palette
const PALETTE = {
  earthquakes: {
    light: { fill: '#E53935', halo: '#FFFFFF' },
    dark: { fill: '#FF6B6B', halo: '#1A1A1A' },
    satellite: { fill: '#FF6B6B', halo: '#1A1A1A' },
  },
  stations: {
    fill: '#2E8B57',
    // Default halos; satellite will override to white for contrast
    haloLight: '#FFFFFF',
    haloDark: '#1A1A1A',
  },
  faults: {
    light: '#C48A2C',
    dark: '#C48A2C',
    satellite: '#C48A2C',
    secondary: '#D7A657',
  },
  // Default plate stroke retained for light; per-theme overrides below
  plates: { stroke: '#D7A657' },
};

// Theme-specific colors that are easy to extend when adding new basemaps
const FAULT_COLORS = {
  light: PALETTE.faults.light,
  dark: PALETTE.faults.light,
  satellite: PALETTE.faults.light,
};
const PLATE_COLORS = {
  light: PALETTE.plates.stroke,
  dark: PALETTE.plates.stroke,
  satellite: PALETTE.plates.stroke,
};
const STATION_FILL_LIGHT = '#22C55E';

// Depth ramp colors chosen to avoid conflict with station markers
// and to maintain contrast on satellite imagery.
// Order: [shallow (0–70), intermediate (70–300), deep (300+)]
// Define core ramps and alias to all basemap variants for easy editing
const DR_LIGHT = ['#DC2626', '#F97316', '#FACC15'];
const DR_DARK = ['#EF4444', '#FB923C', '#FDE047'];
const DR_SAT = ['#EF4444', '#FB923C', '#FDE047'];
export const DEPTH_RAMP = {
  // canonical keys
  light: DR_LIGHT,
  dark: DR_DARK,
  satellite: DR_SAT,
  // aliases for basemap names so editing is one place
  standard: DR_LIGHT,
  osm: DR_LIGHT,
  positron: DR_LIGHT,
  carto_positron: DR_LIGHT,
  darkmatter: DR_DARK,
  carto_dark: DR_DARK,
  carto_darkmatter: DR_DARK,
  imagery: DR_SAT,
  esri: DR_SAT,
  esri_worldimagery: DR_SAT,
};

export function eqDepthColor(theme, depthKm) {
  const t = normalizeTheme(theme);
  const ramp = DEPTH_RAMP[t] || DEPTH_RAMP.light;
  const d = depthKm == null ? null : Number(depthKm);
  if (d == null || Number.isNaN(d)) return null;
  if (d <= 70) return ramp[0];
  if (d <= 300) return ramp[1];
  return ramp[2];
}

// Earthquake size scale (diameter in px used by icons)
// Provide a continuous, piecewise‑linear scale so sizes reflect
// decimal magnitudes precisely while preserving previous anchors:
// M1≈5, M3≈6, M5≈10, M7≈16, M8+≈20. Below M1, taper to 4px at M0.
export function eqSizePx(mag) {
  const m = Math.max(0, Number(mag) || 0);
  const lerp = (a, b, t) => a + (b - a) * t;
  if (m <= 0) return 4;
  if (m <= 1) return lerp(4, 5, m / 1);
  if (m <= 3) return lerp(5, 6, (m - 1) / 2);
  if (m <= 5) return lerp(6, 10, (m - 3) / 2);
  if (m <= 7) return lerp(10, 16, (m - 5) / 2);
  if (m <= 8) return lerp(16, 20, (m - 7) / 1);
  return 20; // cap at large magnitudes
}

// Opacity by zoom (fill opacity target for EQs)
export function eqFillOpacityForZoom(z) {
  if (ZOOM.country(z)) return 0.75;
  if (ZOOM.regional(z)) return 0.65;
  return 0.6; // city
}

// Smooth, continuous scale multiplier for marker SVGs based on zoom.
// Keeps interaction targets readable across zoom while avoiding jumps.
export function eqScaleForZoom(z) {
  const zz = Math.max(0, Number(z) || 0);
  // Anchors: z<=5 -> 1.0, z=6 -> 1.5, z=9 -> 2.0, z=12 -> 2.5, z=14 -> 5.0
  const lerp = (a, b, t) => a + (b - a) * t;
  if (zz <= 3) return 0.5;
  if (zz <= 5) return 0.8;
  if (zz <= 6) return lerp(1.0, 1.5, zz - 5);
  if (zz <= 9) return lerp(1.5, 2.0, (zz - 6) / 3);
  if (zz <= 12) return lerp(2.0, 2.5, (zz - 9) / 3);
  if (zz <= 14) return lerp(2.5, 5.0, (zz - 12) / 2);
  return 5.0;
}

export function buildThemeTokens({ theme, zoom, overlays }) {
  const t = normalizeTheme(theme);
  const z = Math.max(0, Number(zoom) || 0);
  const hasEQ = overlays?.has?.('earthquakes');
  const hasFaults = overlays?.has?.('faults');
  // Interaction scale multiplier to enlarge targets at higher zoom
  // Smooth scale up as zoom increases using continuous function
  const scale = eqScaleForZoom(z);

  // Earthquakes
  const eqBase = PALETTE.earthquakes[t] || PALETTE.earthquakes.light;
  let eqFillOpacity = eqFillOpacityForZoom(z);
  if (hasEQ && hasFaults) eqFillOpacity = Math.max(0, eqFillOpacity - 0.05);
  const eqHaloWidth = t === 'dark' || t === 'satellite' ? 2 : 1.25;
  const eqHaloWidthOnlyEQ = t === 'dark' || t === 'satellite' ? eqHaloWidth + 0.5 : eqHaloWidth; // applied if only EQ

  // Faults
  const faultColor = FAULT_COLORS[t] || FAULT_COLORS.light;
  const faultOpacityBase = 0.7;
  const faultOpacity =
    !hasEQ && hasFaults ? Math.min(1, faultOpacityBase + 0.05) : faultOpacityBase;
  // Keep stroke weights fixed across zoom to reduce visual jitter.
  const faultWeight = t === 'satellite' ? 0.9 : t === 'dark' ? 0.85 : 0.8;
  // Keep a solid stroke at all zoom levels to avoid dash artifacts
  const faultDashed = false;

  // Plates
  // Make plate boundaries only slightly thicker than faults and
  // keep thickness stable across zooms (no scale multiplier).
  // This aligns with the visual goal: plates ≈ faults, just a touch heavier.
  const plateDash = '6,6';
  const plateWeight = faultWeight + 0.2; // subtle emphasis over faults

  // Stations
  // On satellite imagery, use a high-contrast fill and thicker white halo
  // so markers remain visible over greens (land) and dark blues (water).
  const stFill =
    t === 'satellite' ? '#FFD54F' : t === 'dark' ? PALETTE.stations.fill : STATION_FILL_LIGHT; // amber 300
  const stHalo =
    t === 'satellite'
      ? '#FFFFFF'
      : t === 'dark'
      ? PALETTE.stations.haloDark
      : PALETTE.stations.haloLight;
  const stHaloWidth = t === 'satellite' ? 3 : t === 'dark' ? 2.5 : 2;
  const stOpacity = t === 'satellite' ? 0.95 : 0.9;
  // Theme-aware offline marker fill: neutral slate/gray with sufficient contrast
  const stOfflineFill =
    t === 'satellite'
      ? '#FFFFFF' // white: matches satellite legend swatch
      : t === 'dark'
      ? '#CBD5E1' // slate-300: light neutral on dark basemap
      : '#4B5563'; // gray-600: stronger contrast on standard/light basemap
  // Pulse colors for marker status changes (online=green, offline=neutral gray)
  const stPulseOn =
    t === 'satellite' ? '#34D399' : t === 'dark' ? '#86EFAC' : '#22C55E';
  const stPulseOff = t === 'satellite' ? '#E5E7EB' : t === 'dark' ? '#94A3B8' : '#6B7280';

  return {
    theme: t,
    zoom: z,
    eq: {
      fill: eqBase.fill,
      halo: eqBase.halo,
      haloWidth: eqHaloWidth,
      haloWidthOnlyEQ: eqHaloWidthOnlyEQ,
      fillOpacity: eqFillOpacity,
      scale,
    },
    faults: {
      color: faultColor,
      weight: faultWeight,
      opacity: faultOpacity,
      dashArray: faultDashed ? '6,6' : null,
    },
    plates: {
      color: PLATE_COLORS[t] || PLATE_COLORS.light,
      weight: plateWeight,
      opacity: 0.7,
      dashArray: plateDash,
    },
    stations: {
      fill: stFill,
      halo: stHalo,
      haloWidth: stHaloWidth,
      opacity: stOpacity,
      offlineFill: stOfflineFill,
      pulseOn: stPulseOn,
      pulseOff: stPulseOff,
    },
    zIndex: {
      plates: 405,
      faults: 410,
      stations: 600, // markerPane default
      earthquakes: 610,
    },
  };
}

// Leaflet style builders for GeoJSON layers
export function faultsStyle({ theme, zoom, overlays }) {
  const t = buildThemeTokens({ theme, zoom, overlays }).faults;
  return {
    color: t.color,
    weight: t.weight,
    opacity: t.opacity,
    dashArray: t.dashArray || undefined,
    lineCap: 'round',
    lineJoin: 'round',
    smoothFactor: 1.25,
  };
}

export function platesStyle({ theme, zoom }) {
  const t = buildThemeTokens({ theme, zoom, overlays: null }).plates;
  return {
    color: t.color,
    weight: t.weight,
    opacity: t.opacity,
    dashArray: t.dashArray,
    lineCap: 'round',
    lineJoin: 'round',
    smoothFactor: 1.5,
  };
}

// Helpers to read current map theme/zoom from DOM container
export function themeFromMapContainer(container) {
  const v =
    (container && container.getAttribute && container.getAttribute('data-basemap-theme')) ||
    'light';
  return normalizeTheme(v);
}

export function zoomFromMap(map) {
  try {
    return map.getZoom();
  } catch (_) {
    return 6;
  }
}
