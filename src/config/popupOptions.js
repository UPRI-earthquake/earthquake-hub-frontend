// Shared Leaflet popup padding so autoPan keeps cards clear of header,
// floating buttons, and map controls. Values are [x, y] pixels.
const FALLBACK_POPUP_PADDING = {
  topLeft: [32, 120],
  bottomRight: [140, 180],
};

const parsePx = (value, fallback = 0) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

const relativeRect = (el, container) => {
  if (!el || !container) return null;
  const r = el.getBoundingClientRect();
  const c = container.getBoundingClientRect();
  return {
    top: r.top - c.top,
    bottom: r.bottom - c.top,
    left: r.left - c.left,
    right: r.right - c.left,
    height: r.height,
    width: r.width,
  };
};

/**
 * Compute popup auto-pan padding based on current layout variables.
 * Falls back to a generous padding that clears the right control stack.
 */
export function computePopupAutoPanPadding(map) {
  try {
    const el = map?.getContainer?.();
    if (!el || typeof window === 'undefined') return FALLBACK_POPUP_PADDING;
    const cs = getComputedStyle(el);
    const headerH = parsePx(cs.getPropertyValue('--header-h'), 72);
    const topOffset = parsePx(cs.getPropertyValue('--layout-top-offset'), 24);
    const bottomOffset = parsePx(cs.getPropertyValue('--leaflet-bottom-offset'), 16);
    const controlGap = parsePx(cs.getPropertyValue('--leaflet-control-gap'), 10);
    const rightOffset = parsePx(cs.getPropertyValue('--leaflet-right-offset'), 16);
    const ctrlWidth = Math.max(56, parsePx(cs.getPropertyValue('--leaflet-control-width'), 0));
    const containerWidth = el.clientWidth || 0;
  const containerHeight = el.clientHeight || 0;
  const isLandscapeCompact = containerHeight > 0 && containerHeight <= 540;
  const topControls = relativeRect(el.querySelector('.leaflet-top.leaflet-right'), el);
  const bottomControls = relativeRect(el.querySelector('.leaflet-bottom.leaflet-right'), el);

    const rightBase = rightOffset + ctrlWidth + controlGap * 2 + 24;
    const rightPadding = Math.round(
      Math.min(
        Math.max(FALLBACK_POPUP_PADDING.bottomRight[0], rightBase),
        containerWidth ? containerWidth * 0.35 : 240,
      ),
    );
    const baseTopPadding = Math.max(
      isLandscapeCompact ? 40 : FALLBACK_POPUP_PADDING.topLeft[1],
      headerH + topOffset + (isLandscapeCompact ? controlGap * 0.25 : controlGap),
    );
    const baseBottomPadding = Math.max(
      isLandscapeCompact ? 64 : FALLBACK_POPUP_PADDING.bottomRight[1],
      bottomOffset + controlGap * (isLandscapeCompact ? 0.5 : 2) + (isLandscapeCompact ? 48 : 96),
    );

    let topPadding = baseTopPadding;
  let bottomPadding = baseBottomPadding;

  if (topControls && bottomControls && containerHeight) {
    const gap = bottomControls.top - topControls.bottom;
    const margin = controlGap * 2 + 24;
    const usableGap = gap - margin;
    if (usableGap > 40) {
      const mid = topControls.bottom + gap / 2;
      const halfHeight = Math.max(
        isLandscapeCompact ? 40 : 100,
        Math.min(usableGap / 2, containerHeight * (isLandscapeCompact ? 0.28 : 0.4)),
      );
      const bandTop = mid - halfHeight;
      const bandBottom = mid + halfHeight;
      topPadding = Math.max(baseTopPadding, Math.round(bandTop));
      bottomPadding = Math.max(
        baseBottomPadding,
        Math.round(containerHeight - bandBottom),
      );
    } else {
      topPadding = Math.max(baseTopPadding, Math.round(topControls.bottom + controlGap));
      bottomPadding = Math.max(
        baseBottomPadding,
        Math.round(containerHeight - bottomControls.top + controlGap),
      );
    }
  } else {
    if (topControls) {
      topPadding = Math.max(baseTopPadding, Math.round(topControls.bottom + controlGap));
    }
      if (bottomControls && containerHeight) {
        bottomPadding = Math.max(
          baseBottomPadding,
          Math.round(containerHeight - bottomControls.top + controlGap),
        );
      }
    }

    if (containerHeight) {
      const maxTotalPadding = Math.max(
        isLandscapeCompact ? 80 : 160,
        Math.round(containerHeight * (isLandscapeCompact ? 0.28 : 0.55)),
      );
      const total = topPadding + bottomPadding;
      if (total > maxTotalPadding) {
        const scale = maxTotalPadding / total;
        topPadding = Math.round(topPadding * scale);
        bottomPadding = Math.round(bottomPadding * scale);
      }
    }

    const leftPadding = Math.max(FALLBACK_POPUP_PADDING.topLeft[0], controlGap + 20);

    return {
      topLeft: [Math.round(leftPadding), Math.round(topPadding)],
      bottomRight: [Math.round(rightPadding), Math.round(bottomPadding)],
    };
  } catch (_) {
    return FALLBACK_POPUP_PADDING;
  }
}

export const POPUP_AUTOPAN_PADDING_TOPLEFT = FALLBACK_POPUP_PADDING.topLeft;
export const POPUP_AUTOPAN_PADDING_BOTTOMRIGHT = FALLBACK_POPUP_PADDING.bottomRight;
