// Reusable helper to reset the map view to the Philippines bbox/center.
// Also collapses UI panels, deselects current selection, and closes popups.

export const PH_CENTER = [12.2795, 122.049];
export const PH_ZOOM = 6;
export const PH_BOUNDS = [
  [4.5, 116],
  [21.5, 127],
];

function readCssPx(name) {
  if (typeof window === 'undefined' || !window.getComputedStyle) return 0;
  try {
    const raw = window.getComputedStyle(document.documentElement).getPropertyValue(name);
    const parsed = parseFloat(String(raw || '').replace('px', '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (_) {
    return 0;
  }
}

function getHeaderOffsetPx() {
  const header = readCssPx('--header-h');
  return header || 0;
}

/**
 * Reset the Leaflet map view to the Philippines center/zoom and clear UI state.
 * @param {{ map?: any, dispatch?: Function, animate?: boolean }} opts
 */
export function resetToPH(opts = {}) {
  const { map: providedMap, dispatch, animate = true, padding = [20, 20] } = opts;
  let map = providedMap;
  try {
    if (!map && typeof window !== 'undefined') map = window.__leaflet_map__;
  } catch (_) {}

  try {
    // Collapse Layers/Legend panels and any open sidebar popups consistently
    try { window.dispatchEvent(new CustomEvent('ui:popup:open')); } catch (_) {}
    // Deselect any currently selected event
    if (dispatch) {
      try { dispatch({ type: 'DESELECT' }); } catch (_) {}
    }
    // Close any open Leaflet popups
    try { map && typeof map.closePopup === 'function' && map.closePopup(); } catch (_) {}
    const padX = Array.isArray(padding) ? Number(padding[0]) || 0 : 0;
    const padY = Array.isArray(padding) ? Number(padding[1]) || 0 : 0;
    const headerOffset = getHeaderOffsetPx();
    const fitOpts = {
      paddingTopLeft: [padX, headerOffset + padY],
      paddingBottomRight: [padX, padY],
      maxZoom: PH_ZOOM,
      animate: !!animate,
      duration: 1.0,
    };
    if (map && typeof map.fitBounds === 'function') {
      map.fitBounds(PH_BOUNDS, fitOpts);
    } else if (map && typeof map.flyTo === 'function') {
      if (animate) map.flyTo(PH_CENTER, PH_ZOOM, { duration: 1.0 });
      else map.setView(PH_CENTER, PH_ZOOM, { animate: false });
    }
  } catch (_) {}
}
