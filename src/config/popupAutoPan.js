export const DEFAULT_POPUP_AUTOPAN = {
  topLeft: [16, 96],
  bottomRight: [16, 16],
};

function parsePx(raw, fallback = 0) {
  const n = Number.parseFloat(String(raw || '').replace('px', '').trim());
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Keep popup auto-pan clear of the fixed header while preserving Leaflet defaults elsewhere.
 */
export function computeHeaderAwarePopupAutoPanPadding(map) {
  try {
    const el = map?.getContainer?.();
    if (!el || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
      return DEFAULT_POPUP_AUTOPAN;
    }
    const cs = window.getComputedStyle(el);
    const header = parsePx(cs.getPropertyValue('--header-h'), 72);
    const topOffset = parsePx(cs.getPropertyValue('--layout-top-offset'), 24);
    const topY = Math.max(DEFAULT_POPUP_AUTOPAN.topLeft[1], Math.round(header + topOffset + 16));
    return {
      topLeft: [DEFAULT_POPUP_AUTOPAN.topLeft[0], topY],
      bottomRight: DEFAULT_POPUP_AUTOPAN.bottomRight,
    };
  } catch (_) {
    return DEFAULT_POPUP_AUTOPAN;
  }
}
