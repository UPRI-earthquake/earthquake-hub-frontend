// Reusable helper to reset the map view to the Philippines bbox/center.
// Also collapses UI panels, deselects current selection, and closes popups.

export const PH_CENTER = [12.2795, 122.049];
export const PH_ZOOM = 6;

/**
 * Reset the Leaflet map view to the Philippines center/zoom and clear UI state.
 * @param {{ map?: any, dispatch?: Function, animate?: boolean }} opts
 */
export function resetToPH(opts = {}) {
  const { map: providedMap, dispatch, animate = true } = opts;
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
    // Fly or jump to PH center/zoom depending on animate flag
    if (map && typeof map.flyTo === 'function') {
      if (animate) map.flyTo(PH_CENTER, PH_ZOOM, { duration: 1.0 });
      else map.setView(PH_CENTER, PH_ZOOM, { animate: false });
    }
  } catch (_) {}
}

