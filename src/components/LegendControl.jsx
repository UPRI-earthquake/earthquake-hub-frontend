import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { useOverlayState } from './OverlayStateContext';
import { buildThemeTokens, themeFromMapContainer, zoomFromMap } from '../config/mapStyles';
import { DATASETS } from '../config/datasets';
import { getLastUpdated, partsForCdnUrl } from '../utils/lastUpdated';
import './legend.css';
import { DEPTH_RAMP } from '../config/mapStyles';
import { trackEvent } from '../analytics';

/**
 * Legend and metadata control synced with overlay visibility.
 * Lightweight metadata per supported overlay. Sources align with existing config/docs.
 */
const META = {
  faults: {
    label: 'Faults',
    source: 'GEM Global Active Faults (harmonized)',
    // Use centralized dataset URL (jsDelivr GitHub) for exact ref
    lastUpdateHintUrl: DATASETS.FAULTS.sourceUrl,
  },
  plates: {
    label: 'Plate Boundaries',
    source: 'PB2002 (Bird, 2003) via tectonicplates',
    lastUpdateHintUrl: DATASETS.PLATES.sourceUrl,
  },
  // Population overlay removed
};

// Commit-first last updated for GitHub-backed CDN sources; falls back to HEAD Last-Modified
function useLastUpdatedGitHubFirst(url) {
  const [res, setRes] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!url) return undefined;

    const controller = new AbortController();

    async function resolveLastModified() {
      try {
        const res = await getLastUpdated(partsForCdnUrl(url));
        if (!cancelled) setRes(res);
      } catch (e) {
        if (!cancelled) setRes(null);
      }
    }

    resolveLastModified();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url]);

  return res;
}

// Population HEAD Last-Modified helper removed

// Depth ramp chips only (no toggle here)
function DepthRampSub() {
  const map = useMap();
  const [enabled, setEnabled] = useState(() => {
    try {
      return sessionStorage.getItem('eqDepthRamp') === '1';
    } catch (_) {
      return false;
    }
  });
  useEffect(() => {
    const on = (e) => setEnabled(!!(e && e.detail && e.detail.enabled));
    window.addEventListener('eqDepthRamp:toggle', on);
    return () => window.removeEventListener('eqDepthRamp:toggle', on);
  }, []);
  if (!enabled) return null;
  let theme = 'light';
  try {
    theme = themeFromMapContainer(map?.getContainer?.());
  } catch (_) {}
  const [c1, c2, c3] = (DEPTH_RAMP && DEPTH_RAMP[theme]) || DEPTH_RAMP.light;
  return (
    <div className="legend-subrow ramp-in" onClick={(e) => e.stopPropagation()}>
      <span className="legend-chip">
        <i style={{ background: c1 }} /> 0–70 km
      </span>
      <span className="legend-chip">
        <i style={{ background: c2 }} /> 70–300 km
      </span>
      <span className="legend-chip">
        <i style={{ background: c3 }} /> 300+ km
      </span>
    </div>
  );
}

// Inline-only toggle button (used next to Earthquakes label)
function DepthRampToggleInline() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return sessionStorage.getItem('eqDepthRamp') === '1';
    } catch (_) {
      return false;
    }
  });
  useEffect(() => {
    const on = (e) => setEnabled(!!(e && e.detail && e.detail.enabled));
    window.addEventListener('eqDepthRamp:toggle', on);
    return () => window.removeEventListener('eqDepthRamp:toggle', on);
  }, []);
  const toggle = (e) => {
    e?.stopPropagation?.();
    const next = !enabled;
    setEnabled(next);
    try {
      sessionStorage.setItem('eqDepthRamp', next ? '1' : '0');
      window.dispatchEvent(new CustomEvent('eqDepthRamp:toggle', { detail: { enabled: next } }));
    } catch (_) {}
    try {
      trackEvent('depth_ramp', { enabled: next, trigger: 'legend' });
    } catch (_) {}
  };
  return (
    <button
      type="button"
      className="legend-toggle-inline"
      onClick={toggle}
      role="switch"
      aria-checked={enabled}
      aria-label="Depth ramp"
      title={enabled ? 'Disable depth ramp coloring' : 'Enable depth ramp coloring'}
    >
      Depth ramp
    </button>
  );
}

function LegendContent({ active, tokens }) {
  // Build a small map of active overlays we support
  const shown = useMemo(
    () => ({
      faults: active.has('faults'),
      plates: active.has('plates'),
      // Population overlay removed
      stations: active.has('stations'),
      earthquakes: active.has('earthquakes'),
    }),
    [active],
  );

  // Try to compute last-updated for each where possible
  // Population overlay removed

  const faultsLU = useLastUpdatedGitHubFirst(shown.faults ? META.faults.lastUpdateHintUrl : null);
  const platesLU = useLastUpdatedGitHubFirst(shown.plates ? META.plates.lastUpdateHintUrl : null);
  // Population overlay removed

  // Legend is display-only; no overlay toggling here for clarity

  const anyShown = shown.faults || shown.plates || shown.stations || shown.earthquakes;
  const hints = {
    earthquakes: 'Marker size ∝ Earthquake magnitude',
    faults: 'Mapped active faults (GEM)',
    plates: 'PB2002 (Bird, 2003)',
    stations: 'UPRI sensor sites',
  };

  return (
    <div className="map-legend" role="region" aria-label="Map legend">
      {!anyShown && <div className="legend-empty">No overlays enabled</div>}
      {shown.faults && (
        <div className="legend-item" data-key="faults" title={hints.faults}>
          <div className="legend-swatch">
            <span
              className="swatch-line"
              style={{
                background: tokens.faults.color,
                opacity: tokens.faults.opacity,
                height: 0,
                borderTop: `${Math.max(2, (tokens.faults.weight || 1) * 2)}px ${
                  tokens.faults.dashArray ? 'dashed' : 'solid'
                } ${tokens.faults.color}`,
              }}
            />
          </div>
          <div className="legend-meta">
            <div className="legend-label">{META.faults.label}</div>
            <div className="legend-source-line">{META.faults.source}</div>
            <div
              className="legend-update-line"
              title={faultsLU?.tooltip || ''}
              aria-label={faultsLU?.tooltip || ''}
            >
              {faultsLU ? (
                <>
                  Last updated: {faultsLU.displayDate || 'Unknown'}
                  {faultsLU.source === 'github' && faultsLU.commitUrl && faultsLU.commitSha ? (
                    <>
                      {' '}
                      ·{' '}
                      <a
                        href={faultsLU.commitUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
                        }}
                      >
                        {faultsLU.commitSha}
                      </a>
                    </>
                  ) : null}
                  {faultsLU.source === 'cdn' ? ' (from CDN header)' : null}
                </>
              ) : (
                'Last updated: —'
              )}
            </div>
          </div>
        </div>
      )}
      {shown.plates && (
        <div className="legend-item" data-key="plates" title={hints.plates}>
          <div className="legend-swatch">
            <span
              className="swatch-line"
              style={{
                borderTop: `${Math.max(2, (tokens.plates.weight || 1) * 2)}px ${
                  tokens.plates.dashArray ? 'dashed' : 'solid'
                } ${tokens.plates.color}`,
                opacity: tokens.plates.opacity,
              }}
            />
          </div>
          <div className="legend-meta">
            <div className="legend-label">{META.plates.label}</div>
            <div className="legend-source-line">{META.plates.source}</div>
            <div
              className="legend-update-line"
              title={platesLU?.tooltip || ''}
              aria-label={platesLU?.tooltip || ''}
            >
              {platesLU ? (
                <>
                  Last updated: {platesLU.displayDate || 'Unknown'}
                  {platesLU.source === 'github' && platesLU.commitUrl && platesLU.commitSha ? (
                    <>
                      {' '}
                      ·{' '}
                      <a
                        href={platesLU.commitUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
                        }}
                      >
                        {platesLU.commitSha}
                      </a>
                    </>
                  ) : null}
                  {platesLU.source === 'cdn' ? ' (from CDN header)' : null}
                </>
              ) : (
                'Last updated: —'
              )}
            </div>
          </div>
        </div>
      )}
      {/* Population overlay removed */}
      {shown.stations && (
        <div className="legend-item" data-key="stations" title={hints.stations}>
          <div className="legend-swatch">
            {/* Main symbol for stations: triangle, matches marker shape */}
            <span
              className="swatch-triangle"
              aria-hidden
              style={{ borderBottomColor: tokens.stations.fill }}
            />
          </div>
          <div className="legend-meta">
            <div className="legend-label">Stations</div>
            <div className="legend-subrow" onClick={(e) => e.stopPropagation()}>
              <span className="legend-chip">
                <i style={{ background: tokens.stations.fill }} /> Online
              </span>
              <span className="legend-chip">
                <i style={{ background: tokens.stations.offlineFill }} /> Offline
              </span>
            </div>
          </div>
        </div>
      )}
      {shown.earthquakes && (
        <div className="legend-item" data-key="earthquakes" title={hints.earthquakes}>
          <div className="legend-swatch">
            <span
              className="swatch-circle"
              aria-hidden
              style={{
                background: tokens.eq.fill,
                borderColor: tokens.eq.halo,
                borderWidth: `${
                  active.has('earthquakes') && !active.has('faults')
                    ? tokens.eq.haloWidthOnlyEQ
                    : tokens.eq.haloWidth
                }px`,
                opacity: tokens.eq.fillOpacity,
              }}
            />
          </div>
          <div className="legend-meta">
            <div className="legend-label-with-toggle">
              <div className="legend-label">Earthquakes</div>
              <DepthRampToggleInline />
            </div>
            <DepthRampSub />
          </div>
        </div>
      )}
      {/* No empty-state text; tooltip handled on toggle via title */}
    </div>
  );
}

// Outline-only folded map icon, kept stable so the tool never swaps to chevrons/close symbols
const LegendIcon = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {/* Outer folded map silhouette (zig-zag top/bottom) */}
    <path d="M3 6l5-2 4 2 5-2 4 2v12l-5-2-4 2-5-2-4 2V6z" />
    {/* Fold lines */}
    <path d="M8 4v12M17 4v12M12 6v12" />
  </svg>
);

export default function LegendControl({ position = 'bottomright' }) {
  const map = useMap();
  const { activeIds } = useOverlayState();
  const containerRef = useRef(null);
  const [, forceRender] = useState(0); // trigger a re-render after control attaches
  // Collapse legend by default on first load; persist if available
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const v = sessionStorage.getItem('legendCollapsed');
      if (v === '0' || v === '1') return v === '1';
    } catch (_) {}
    return true; // collapsed by default
  });
  const collapsedRef = useRef(collapsed);
  useEffect(() => {
    collapsedRef.current = collapsed;
  }, [collapsed]);
  const emitLegendToggle = useCallback((isCollapsed, trigger = 'unknown') => {
    try {
      trackEvent('legend_toggle', {
        state: isCollapsed ? 'closed' : 'open',
        trigger,
      });
    } catch (_) {}
  }, []);

  // Track current basemap theme and map zoom so legend swatches react
  const [legendTheme, setLegendTheme] = useState(() => {
    try {
      return themeFromMapContainer(map?.getContainer?.());
    } catch (_) {
      return 'light';
    }
  });
  const [legendZoom, setLegendZoom] = useState(() => {
    try {
      return zoomFromMap(map);
    } catch (_) {
      return 6;
    }
  });

  // Update on basemap or zoom changes
  useEffect(() => {
    if (!map) return undefined;
    const el = map.getContainer();
    const applyTheme = () => setLegendTheme(themeFromMapContainer(el));
    const applyZoom = () => setLegendZoom(zoomFromMap(map));
    applyTheme();
    applyZoom();
    map.on('baselayerchange', applyTheme);
    map.on('zoomend', applyZoom);
    return () => {
      map.off('baselayerchange', applyTheme);
      map.off('zoomend', applyZoom);
    };
  }, [map]);

  // Build/attach Leaflet control container
  useEffect(() => {
    if (!map) return undefined;

    const Control = L.Control.extend({
      onAdd: () => {
        const div = L.DomUtil.create('div', 'leaflet-control custom-legend-control');
        div.setAttribute('aria-label', 'Legend');
        div.setAttribute('role', 'group');

        // stop clicks from interacting with the map
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);
        containerRef.current = div;
        return div;
      },
    });
    const ctrl = new Control({ position });
    ctrl.addTo(map);
    // force re-render so portal mounts into newly created container
    forceRender((n) => n + 1);
    return () => {
      ctrl.remove();
      containerRef.current = null;
    };
  }, [map, position]);

  // Keep map container annotated with legend open/closed state for CSS/interop
  useEffect(() => {
    try {
      const el = map?.getContainer?.();
      if (el) el.setAttribute('data-legend-expanded', collapsed ? '0' : '1');
    } catch (_) {}
  }, [map, collapsed]);

  const toggleLegend = useCallback(
    (nextState, trigger = 'button') => {
      setCollapsed((curr) => {
        const next = typeof nextState === 'boolean' ? nextState : !curr;
        if (next !== curr) emitLegendToggle(next, trigger);
        try {
          sessionStorage.setItem('legendCollapsed', next ? '1' : '0');
        } catch (_) {}
        if (!next) {
          try { map.closePopup(); } catch (_) {}
          try { window.dispatchEvent(new CustomEvent('ui:legend:open')); } catch (_) {}
        }
        return next;
      });
    },
    [emitLegendToggle, map],
  );

  // Keyboard shortcuts: G toggles Legend, Esc collapses
  useEffect(() => {
    const onKey = (e) => {
      // ignore if typing in input/textarea/contenteditable
      const t = e.target;
      const tag = (t && t.tagName) || '';
      const editable =
        t && (t.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT');
      if (editable) return;
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        toggleLegend(undefined, 'keyboard');
      } else if (e.key === 'Escape') {
        if (!collapsedRef.current) emitLegendToggle(true, 'keyboard');
        setCollapsed(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [map, emitLegendToggle, toggleLegend]);

  // Collapse when Layers opens or when any popup opens
  useEffect(() => {
    const onLayersOpen = () => toggleLegend(true, 'layers');
    const onPopupOpen = () => toggleLegend(true, 'popup');
    window.addEventListener('ui:layers:open', onLayersOpen);
    window.addEventListener('ui:popup:open', onPopupOpen);
    return () => {
      window.removeEventListener('ui:layers:open', onLayersOpen);
      window.removeEventListener('ui:popup:open', onPopupOpen);
    };
  }, [toggleLegend]);

  // Close when clicking outside the control
  useEffect(() => {
    if (collapsed) return undefined;
    const onPointerDown = (e) => {
      const container = containerRef.current;
      if (!container) return;
      if (container.contains(e.target)) return;
      toggleLegend(true, 'outside');
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [collapsed, toggleLegend]);

  // Focus trap inside the legend when expanded
  useEffect(() => {
    if (!containerRef.current || collapsed) return undefined;
    const shell = containerRef.current.querySelector('.legend-flyout');
    if (!shell) return undefined;
    const focusables = shell.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (first && typeof first.focus === 'function') first.focus();
    const trap = (e) => {
      if (e.key !== 'Tab') return;
      if (!focusables.length) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    shell.addEventListener('keydown', trap);
    return () => shell.removeEventListener('keydown', trap);
  }, [collapsed]);

  // Render portal content into the control container
  const hasAny = activeIds.size > 0;
  const isOpen = !collapsed;
  const content = (
    <div className="legend-shell" data-open={isOpen ? '1' : '0'}>
      <button
        type="button"
        className={`legend-toggle ${isOpen ? 'is-active' : ''}`.trim()}
        title={hasAny ? 'Legend (G)' : 'Legend (enable overlays)'}
        aria-label="Legend"
        aria-expanded={isOpen}
        aria-controls="legend-panel"
        onClick={() => toggleLegend(undefined, 'button')}
        data-active={isOpen ? '1' : '0'}
      >
        {/* Keep the map icon stable; rely on styling for open/closed state */}
        <LegendIcon size={22} />
      </button>

      <div
        id="legend-panel"
        className={`legend-flyout ${isOpen ? 'is-open' : ''}`}
        role={isOpen ? 'dialog' : undefined}
        aria-labelledby={isOpen ? 'legend-title' : undefined}
        aria-modal={isOpen ? 'true' : undefined}
      >
        <div className="legend-header">
          <div id="legend-title" className="legend-title">
            Legend
          </div>
        </div>
        <div className="legend-body">
          <LegendContent
            active={activeIds}
            tokens={buildThemeTokens({
              theme: legendTheme,
              // Exclude the very-close 5x scaling in legend swatches
              // so line symbols remain consistent regardless of map zoom.
              zoom: Math.min(legendZoom, 13.99),
              overlays: activeIds,
            })}
          />
        </div>
      </div>
    </div>
  );

  if (!containerRef.current) return null;
  // Keep container class in sync for CSS adjustments in collapsed mode
  try {
    containerRef.current.classList.toggle('is-collapsed', !!collapsed);
  } catch (_) {}
  return ReactDOM.createPortal(content, containerRef.current);
}
