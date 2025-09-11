import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { useOverlayState } from './OverlayStateContext';
import { buildThemeTokens, themeFromMapContainer, zoomFromMap } from '../config/mapStyles';
import { DATASETS } from '../config/datasets';
import { getLastUpdated, partsForCdnUrl } from '../utils/lastUpdated';
import './legend.css';

// Lightweight metadata per supported overlay. Sources align with existing config/docs.
const META = {
  faults: {
    label: 'Faults',
    source: 'GEM Global Active Faults (harmonized)',
    // Use centralized dataset URL (jsDelivr GitHub) for exact ref
    lastUpdateHintUrl: DATASETS.FAULTS.cdnUrl,
  },
  plates: {
    label: 'Plate Boundaries',
    source: 'PB2002 (Bird, 2003) via tectonicplates',
    lastUpdateHintUrl: DATASETS.PLATES.cdnUrl,
  },
  population: {
    label: 'Population Density',
    source: 'WorldPop (or configured provider)',
    units: 'people/km²',
    // Try to infer last update from XYZ template by probing z/x/y = 0/0/0
    lastUpdateFromTemplateEnv: 'REACT_APP_POP_XYZ_URL',
  },
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

// Simple HEAD Last-Modified/Date for non-GitHub XYZ sources (e.g., Population tiles)
function useHeadLastModified(url) {
  const [iso, setIso] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!url) { setIso(null); return undefined; }
    const controller = new AbortController();
    const cacheKey = `lm:${url}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) { setIso(cached); return undefined; }
    } catch (_) {}
    (async () => {
      try {
        const res = await fetch(url, { method: 'HEAD', cache: 'no-cache', signal: controller.signal });
        if (!res.ok) throw new Error(`HEAD ${res.status}`);
        const lm = (res.headers.get && (res.headers.get('Last-Modified') || res.headers.get('last-modified') || res.headers.get('Date') || res.headers.get('date')));
        const next = lm ? new Date(lm).toISOString() : null;
        if (!cancelled) {
          setIso(next);
          try { if (next) sessionStorage.setItem(cacheKey, next); } catch (_) {}
        }
      } catch (_) {
        if (!cancelled) setIso(null);
      }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [url]);
  return iso;
}

// Depth ramp chips only (no toggle here)
function DepthRampSub() {
  const [enabled, setEnabled] = useState(() => {
    try { return sessionStorage.getItem('eqDepthRamp') === '1'; } catch (_) { return false; }
  });
  useEffect(() => {
    const on = (e) => setEnabled(!!(e && e.detail && e.detail.enabled));
    window.addEventListener('eqDepthRamp:toggle', on);
    return () => window.removeEventListener('eqDepthRamp:toggle', on);
  }, []);
  if (!enabled) return null;
  return (
    <div className="legend-subrow" onClick={(e) => e.stopPropagation()}>
      <span className="legend-chip"><i style={{ background: '#FF6B6B' }} /> 0–70 km</span>
      <span className="legend-chip"><i style={{ background: '#F4A261' }} /> 70–300 km</span>
      <span className="legend-chip"><i style={{ background: '#2A9D8F' }} /> 300+ km</span>
    </div>
  );
}

// Inline-only toggle button (used next to Earthquakes label)
function DepthRampToggleInline() {
  const [enabled, setEnabled] = useState(() => {
    try { return sessionStorage.getItem('eqDepthRamp') === '1'; } catch (_) { return false; }
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
  };
  return (
    <button type="button" className="legend-toggle-inline" onClick={toggle} aria-pressed={enabled} aria-label="Toggle depth color ramp">
      Depth ramp: {enabled ? 'On' : 'Off'}
    </button>
  );
}

function LegendContent({ active, tokens }) {
  // Build a small map of active overlays we support
  const shown = useMemo(() => ({
    faults: active.has('faults'),
    plates: active.has('plates'),
    population: active.has('population'),
    stations: active.has('stations'),
    earthquakes: active.has('earthquakes'),
  }), [active]);

  // Try to compute last-updated for each where possible
  const popUrlTemplate = (() => {
    try {
      return (window && window.ENV && window.ENV[META.population.lastUpdateFromTemplateEnv]) || '';
    } catch (e) {
      return '';
    }
  })();
  const popHeadUrl = useMemo(() => {
    if (!popUrlTemplate) return null;
    return popUrlTemplate.replace('{z}', '0').replace('{x}', '0').replace('{y}', '0');
  }, [popUrlTemplate]);

  const faultsLU = useLastUpdatedGitHubFirst(shown.faults ? META.faults.lastUpdateHintUrl : null);
  const platesLU = useLastUpdatedGitHubFirst(shown.plates ? META.plates.lastUpdateHintUrl : null);
  const popLM = useHeadLastModified(shown.population ? popHeadUrl : null);

  // Legend is display-only; no overlay toggling here for clarity

  const anyShown = shown.faults || shown.plates || shown.population || shown.stations || shown.earthquakes;
  const hints = {
    earthquakes: 'Past 30 days; size ∝ magnitude',
    faults: 'Mapped active faults (GEM)',
    plates: 'PB2002 (Bird, 2003)',
    stations: 'UPRI sensor sites',
  };

  return (
    <div className="map-legend" role="region" aria-label="Map legend">
      {!anyShown && (
        <div className="legend-empty">No overlays enabled</div>
      )}
      {shown.faults && (
        <div
          className="legend-item"
          data-key="faults"
          title={hints.faults}
        >
          <div className="legend-swatch">
            <span
              className="swatch-line"
              style={{
                background: tokens.faults.color,
                opacity: tokens.faults.opacity,
                height: 0,
                borderTop: `${Math.max(2, (tokens.faults.weight || 1) * 2)}px ${(tokens.faults.dashArray ? 'dashed' : 'solid')} ${tokens.faults.color}`,
              }}
            />
          </div>
          <div className="legend-meta">
            <div className="legend-label">{META.faults.label}</div>
            <div className="legend-source-line">{META.faults.source}</div>
            <div className="legend-update-line" title={faultsLU?.tooltip || ''} aria-label={faultsLU?.tooltip || ''}>
              {faultsLU ? (
                <>
                  Last updated: {faultsLU.displayDate || 'Unknown'}
                  {faultsLU.source === 'github' && faultsLU.commitUrl && faultsLU.commitSha ? (
                    <>
                      {' '}· <a
                        href={faultsLU.commitUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}
                      >{faultsLU.commitSha}</a>
                    </>
                  ) : null}
                  {faultsLU.source === 'cdn' ? ' (from CDN header)' : null}
                </>
              ) : 'Last updated: —'}
            </div>
          </div>
        </div>
      )}
      {shown.plates && (
        <div
          className="legend-item"
          data-key="plates"
          title={hints.plates}
        >
          <div className="legend-swatch">
            <span
              className="swatch-line"
              style={{
                borderTop: `${Math.max(2, (tokens.plates.weight || 1) * 2)}px ${(tokens.plates.dashArray ? 'dashed' : 'solid')} ${tokens.plates.color}`,
                opacity: tokens.plates.opacity,
              }}
            />
          </div>
          <div className="legend-meta">
            <div className="legend-label">{META.plates.label}</div>
            <div className="legend-source-line">{META.plates.source}</div>
            <div className="legend-update-line" title={platesLU?.tooltip || ''} aria-label={platesLU?.tooltip || ''}>
              {platesLU ? (
                <>
                  Last updated: {platesLU.displayDate || 'Unknown'}
                  {platesLU.source === 'github' && platesLU.commitUrl && platesLU.commitSha ? (
                    <>
                      {' '}· <a
                        href={platesLU.commitUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}
                      >{platesLU.commitSha}</a>
                    </>
                  ) : null}
                  {platesLU.source === 'cdn' ? ' (from CDN header)' : null}
                </>
              ) : 'Last updated: —'}
            </div>
          </div>
        </div>
      )}
      {shown.population && (
        <div
          className="legend-item"
          data-key="population"
          title="Population density"
        >
          <div className="legend-swatch">
            {/* simple 4-step ramp */}
            <span className="swatch-ramp">
              <i style={{ background: '#f7fbff' }} />
              <i style={{ background: '#c6dbef' }} />
              <i style={{ background: '#6baed6' }} />
              <i style={{ background: '#2171b5' }} />
            </span>
          </div>
          <div className="legend-meta">
            <div className="legend-label">{META.population.label} ({META.population.units})</div>
            <div className="legend-source-line">{META.population.source}</div>
            <div className="legend-update-line">{popLM ? `Last update: ${new Date(popLM).toLocaleDateString()}` : 'Last update: —'}</div>
          </div>
        </div>
      )}
      {shown.stations && (
        <div
          className="legend-item"
          data-key="stations"
          title={hints.stations}
        >
          <div className="legend-swatch">
            <span className="swatch-triangle" aria-hidden style={{ borderBottomColor: tokens.stations.fill }} />
          </div>
          <div className="legend-meta">
            <div className="legend-label">Stations</div>
          </div>
        </div>
      )}
      {shown.earthquakes && (
        <div
          className="legend-item"
          data-key="earthquakes"
          title={hints.earthquakes}
        >
          <div className="legend-swatch">
            <span
              className="swatch-circle"
              aria-hidden
              style={{
                background: tokens.eq.fill,
                borderColor: tokens.eq.halo,
                borderWidth: `${active.has('earthquakes') && !active.has('faults') ? tokens.eq.haloWidthOnlyEQ : tokens.eq.haloWidth}px`,
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

export default function LegendControl({ position = 'bottomright' }) {
  const map = useMap();
  const { activeIds } = useOverlayState();
  const containerRef = useRef(null);
  const [, forceRender] = useState(0); // trigger a re-render after control attaches
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = sessionStorage.getItem('legendCollapsed');
      return saved === '1';
    } catch (_) {
      return false;
    }
  });

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

  // Keyboard shortcuts: G toggles Legend, Esc collapses
  useEffect(() => {
    const onKey = (e) => {
      // ignore if typing in input/textarea/contenteditable
      const t = e.target;
      const tag = (t && t.tagName) || '';
      const editable = (t && (t.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'));
      if (editable) return;
      if ((e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        setCollapsed((c) => !c);
      } else if (e.key === 'Escape') {
        setCollapsed(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Removed cross-panel coupling: no external collapse listeners

  // Focus trap inside the legend when expanded
  useEffect(() => {
    if (!containerRef.current || collapsed) return undefined;
    const shell = containerRef.current.querySelector('.legend-shell');
    if (!shell) return undefined;
    const focusables = shell.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (first && typeof first.focus === 'function') first.focus();
    const trap = (e) => {
      if (e.key !== 'Tab') return;
      if (!focusables.length) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    shell.addEventListener('keydown', trap);
    return () => shell.removeEventListener('keydown', trap);
  }, [collapsed]);

  // Render portal content into the control container
  const hasAny = activeIds.size > 0;
  const content = (
    <div
      className={`legend-shell ${collapsed ? 'is-collapsed' : ''}`}
      role={!collapsed ? 'dialog' : undefined}
      aria-labelledby={!collapsed ? 'legend-title' : undefined}
      aria-modal={!collapsed ? 'true' : undefined}
    >
      {collapsed ? (
        <button
          type="button"
          className="legend-toggle"
          title={hasAny ? 'Legend (G)' : 'Legend (enable overlays)'}
          aria-label="Legend"
          aria-pressed={!collapsed}
          onClick={() => {
            const next = !collapsed;
            setCollapsed(next);
            try { sessionStorage.setItem('legendCollapsed', next ? '1' : '0'); } catch (_) {}
          }}
        >
          Legend ▸
        </button>
      ) : (
        <>
          <div className="legend-header">
            <div id="legend-title" className="legend-title">Legend</div>
            <div className="legend-tools">
              <button
                type="button"
                className="legend-close"
                title="Close legend (G)"
                aria-label="Close legend"
                onClick={() => {
                  setCollapsed(true);
                  try { sessionStorage.setItem('legendCollapsed', '1'); } catch (_) {}
                }}
              >
                ×
              </button>
            </div>
          </div>
          <div className="legend-body">
            <LegendContent
              active={activeIds}
              tokens={buildThemeTokens({
                theme: themeFromMapContainer(map.getContainer()),
                // Exclude the very-close 5x scaling in legend swatches
                // so line symbols remain consistent regardless of map zoom.
                zoom: Math.min(zoomFromMap(map), 13.99),
                overlays: activeIds,
              })}
            />
          </div>
        </>
      )}
    </div>
  );

  if (!containerRef.current) return null;
  // Keep container class in sync for CSS adjustments in collapsed mode
  try {
    containerRef.current.classList.toggle('is-collapsed', !!collapsed);
  } catch (_) {}
  return ReactDOM.createPortal(content, containerRef.current);
}
