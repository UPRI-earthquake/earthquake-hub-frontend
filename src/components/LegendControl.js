import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { useOverlayState } from './OverlayStateContext';
import { styles } from '../config/mapLayers';
import './legend.css';

// Lightweight metadata per supported overlay. Sources align with existing config/docs.
const META = {
  faults: {
    label: 'Faults',
    source: 'GEM Global Active Faults (harmonized)',
    // Last-Modified is fetched at runtime; fallback is N/A.
    lastUpdateHintUrl:
      'https://cdn.jsdelivr.net/gh/GEMScienceTools/gem-global-active-faults@master/geojson/gem_active_faults_harmonized.geojson',
  },
  plates: {
    label: 'Plate Boundaries',
    source: 'PB2002 (Bird, 2003) via tectonicplates',
    lastUpdateHintUrl:
      'https://cdn.jsdelivr.net/gh/fraxen/tectonicplates@master/GeoJSON/PB2002_boundaries.json',
  },
  population: {
    label: 'Population Density',
    source: 'WorldPop (or configured provider)',
    units: 'people/km²',
    // Try to infer last update from XYZ template by probing z/x/y = 0/0/0
    lastUpdateFromTemplateEnv: 'REACT_APP_POP_XYZ_URL',
  },
};

function useLastModified(url) {
  const [lastMod, setLastMod] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!url) return undefined;

    const controller = new AbortController();

    const cacheKey = `lm:${url}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setLastMod(cached);
        return undefined; // use cached value
      }
    } catch (_) {
      // ignore caching errors
    }

    const isoFromHeaders = (headers) => {
      const lm = headers.get('last-modified') || headers.get('date');
      return lm ? new Date(lm).toISOString() : null;
    };

    const parseJsDelivrGh = (rawUrl) => {
      try {
        const u = new URL(rawUrl);
        if (u.hostname !== 'cdn.jsdelivr.net') return null;
        const m = u.pathname.match(/^\/gh\/([^/]+)\/([^@/]+)@([^/]+)\/(.+)$/);
        if (!m) return null;
        return { owner: m[1], repo: m[2], ref: m[3], path: m[4] };
      } catch (e) {
        return null;
      }
    };

    async function resolveLastModified() {
      // 1) Try HEAD
      try {
        const res = await fetch(url, { method: 'HEAD', cache: 'no-cache', signal: controller.signal });
        if (res.ok) {
          const iso = isoFromHeaders(res.headers);
          if (iso && !cancelled) {
            setLastMod(iso);
            try { sessionStorage.setItem(cacheKey, iso); } catch (_) {}
            return;
          }
        }
      } catch (_) {
        // fall through to GitHub API
      }

      // 2) Fallback for jsDelivr GitHub sources → use GitHub commits API
      const gh = parseJsDelivrGh(url);
      if (gh) {
        try {
          const q = new URL(`https://api.github.com/repos/${gh.owner}/${gh.repo}/commits`);
          q.searchParams.set('path', gh.path);
          q.searchParams.set('per_page', '1');
          if (gh.ref) q.searchParams.set('sha', gh.ref);
          const headers = { Accept: 'application/vnd.github+json' };
          try {
            const token = (window && window.ENV && window.ENV.REACT_APP_GITHUB_TOKEN) || '';
            if (token) headers.Authorization = `Bearer ${token}`;
          } catch (_) {}
          const res = await fetch(q.toString(), { headers, signal: controller.signal });
          if (res.ok) {
            const arr = await res.json();
            let date = null;
            if (Array.isArray(arr) && arr.length > 0) {
              const c = arr[0]?.commit;
              date = c?.committer?.date || c?.author?.date || null;
            }
            if (!cancelled) {
              setLastMod(date);
              if (date) try { sessionStorage.setItem(cacheKey, date); } catch (_) {}
            }
            return;
          }
        } catch (_) {
          // ignore
        }
      }

      // 3) Give up
      if (!cancelled) setLastMod(null);
    }

    resolveLastModified();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url]);

  return lastMod;
}

function LegendContent({ active }) {
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

  const faultsLM = useLastModified(shown.faults ? META.faults.lastUpdateHintUrl : null);
  const platesLM = useLastModified(shown.plates ? META.plates.lastUpdateHintUrl : null);
  const popLM = useLastModified(shown.population ? popHeadUrl : null);

  return (
    <div className="map-legend" role="region" aria-label="Map legend">
      {shown.faults && (
        <div className="legend-item" data-key="faults">
          <div className="legend-swatch">
            <span
              className="swatch-line"
              style={{
                background: styles.faults.color,
                opacity: styles.faults.opacity,
                height: 0,
                // Make a bit thicker than on map for readability
                borderTop: `${Math.max(2, (styles.faults.weight || 1) * 2)}px ${(styles.faults.dashArray ? 'dashed' : 'solid')} ${styles.faults.color}`,
              }}
            />
          </div>
          <div className="legend-meta">
            <div className="legend-label">{META.faults.label}</div>
            <div className="legend-source-line">{META.faults.source}</div>
            <div className="legend-update-line">{faultsLM ? `Last update: ${new Date(faultsLM).toLocaleDateString()}` : 'Last update: —'}</div>
          </div>
        </div>
      )}
      {shown.plates && (
        <div className="legend-item" data-key="plates">
          <div className="legend-swatch">
            <span
              className="swatch-line"
              style={{
                borderTop: `${Math.max(2, (styles.plates.weight || 1) * 2)}px ${(styles.plates.dashArray ? 'dashed' : 'solid')} ${styles.plates.color}`,
                opacity: styles.plates.opacity,
              }}
            />
          </div>
          <div className="legend-meta">
            <div className="legend-label">{META.plates.label}</div>
            <div className="legend-source-line">{META.plates.source}</div>
            <div className="legend-update-line">{platesLM ? `Last update: ${new Date(platesLM).toLocaleDateString()}` : 'Last update: —'}</div>
          </div>
        </div>
      )}
      {shown.population && (
        <div className="legend-item" data-key="population">
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
        <div className="legend-item" data-key="stations">
          <div className="legend-swatch">
            <span className="swatch-triangle" aria-hidden />
          </div>
          <div className="legend-meta">
            <div className="legend-label">Stations</div>
          </div>
        </div>
      )}
      {shown.earthquakes && (
        <div className="legend-item" data-key="earthquakes">
          <div className="legend-swatch">
            <span className="swatch-circle" aria-hidden />
          </div>
          <div className="legend-meta">
            <div className="legend-label">Earthquakes</div>
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

  // Render portal content into the control container
  const hasAny = activeIds.size > 0;
  const content = (
    <div className={`legend-shell ${collapsed ? 'is-collapsed' : ''}`}>
      <button
        type="button"
        className="legend-toggle"
        title={collapsed ? (hasAny ? 'Show legend' : 'Show legend (enable overlays)') : 'Hide legend'}
        aria-label={collapsed ? 'Show legend' : 'Hide legend'}
        aria-pressed={!collapsed}
        onClick={() => {
          const next = !collapsed;
          setCollapsed(next);
          try { sessionStorage.setItem('legendCollapsed', next ? '1' : '0'); } catch (_) {}
        }}
      >
        {collapsed ? (
          // Icon-only placeholder; text intentionally omitted for design swap later
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            aria-hidden
            focusable="false"
            fill="currentColor"
          >
            <path d="M9 3l6 2 6-2v18l-6 2-6-2-6 2V5l6-2zm0 2v14l6 2V7L9 5zM3 7v14l4-1.33V5.67L3 7zm18-2l-4 1.33v15.66L21 19V5z" />
          </svg>
        ) : (
          'Hide'
        )}
      </button>
      {!collapsed && <LegendContent active={activeIds} />}
    </div>
  );

  if (!containerRef.current) return null;
  // Keep container class in sync for CSS adjustments in collapsed mode
  try {
    containerRef.current.classList.toggle('is-collapsed', !!collapsed);
  } catch (_) {}
  return ReactDOM.createPortal(content, containerRef.current);
}
