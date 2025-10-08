import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import L from 'leaflet';
import { LayersControl, useMap } from 'react-leaflet';
import { BASEMAPS } from '../config/mapLayers';
import {
  buildThemeTokens,
  faultsStyle,
  platesStyle,
  themeFromMapContainer,
  zoomFromMap,
  eqScaleForZoom,
} from '../config/mapStyles';
import './mapLayers.css';
import { useOverlayState } from './OverlayStateContext';
import BasemapLayers from './layers/BasemapLayers';
import OverlayLayers from './layers/OverlayLayers';
// Removed metadata injection in Layers panel; keep lastUpdated utils for Legend only

/**
 * Map layers control: basemaps, overlays, and UX helpers for Leaflet layers.
 * TODO(frontend-team): Split into smaller modules (basemaps, overlays, keyboard) — file is large.
 */
//

export default function MapLayersControl({ children }) {
  const map = useMap();
  const { registerLayer, activeIds } = useOverlayState();
  // Memoize basemap provider props so layers are not recreated
  const bases = useMemo(
    () => ({
      osm: BASEMAPS.OSM_Standard(),
      positron: BASEMAPS.Carto_Positron(),
      dark: BASEMAPS.Carto_DarkMatter(),
      esri: BASEMAPS.Esri_WorldImagery(),
    }),
    [],
  );

  // overlays are handled by OverlayLayers subcomponent

  // Refs for registering overlays with the legend sync
  const faultsRef = useRef(null);
  const platesRef = useRef(null);
  const popRef = useRef(null);
  const customLayersToggleRef = useRef(null);
  const cleanupRefs = useRef({});

  const setFaultsRef = useCallback(
    (node) => {
      const layer = node && (node.leafletElement || node);
      faultsRef.current = layer;
      if (layer) registerLayer('faults', layer);
    },
    [registerLayer],
  );

  const setPlatesRef = useCallback(
    (node) => {
      const layer = node && (node.leafletElement || node);
      platesRef.current = layer;
      if (layer) registerLayer('plates', layer);
    },
    [registerLayer],
  );

  const setPopRef = useCallback(
    (node) => {
      const layer = node && (node.leafletElement || node);
      popRef.current = layer;
      if (layer) registerLayer('population', layer);
    },
    [registerLayer],
  );

  // Ensure Layers opens/closes on click (not hover) and add tooltip/ARIA
  useEffect(() => {
    if (!map) return undefined;
    // Snapshot for cleanup to avoid reading ref in cleanup
    let refsSnapshot = null;
    // Defer to next tick to ensure control is in the DOM
    const id = setTimeout(() => {
      const container = map.getContainer ? map.getContainer() : document;
      const btn = container && container.querySelector('.leaflet-control-layers-toggle');
      const ctrl = container && container.querySelector('.leaflet-control-layers');
      if (btn) {
        btn.setAttribute('title', 'Layers (L)');
        btn.setAttribute('aria-label', 'Layers');
        if (ctrl) {
          ctrl.setAttribute('id', 'layers-panel');
          btn.setAttribute('aria-controls', 'layers-panel');
        }
        // Always hide default Leaflet toggle; we provide a custom one
        btn.style.display = 'none';
      }
      // Disable hover expand/collapse by stopping Leaflet's mouseover/mouseout handlers
      if (ctrl) {
        // Create custom toggle control once
        if (!customLayersToggleRef.current) {
          const CustomToggle = L.Control.extend({
            onAdd: () => {
              const wrap = L.DomUtil.create('div', 'leaflet-control custom-layers-toggle');
              const a = L.DomUtil.create('a', 'layers-btn', wrap);
              a.href = '#';
              a.setAttribute('role', 'button');
              a.setAttribute('aria-label', 'Layers');
              a.setAttribute('title', 'Layers (L)');
              a.setAttribute('aria-controls', 'layers-panel');
              a.setAttribute('aria-expanded', 'false');
              a.innerHTML = `
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden>
                  <path d="M12 2l10 6-10 6L2 8l10-6z"></path>
                  <path d="M2 12l10 6 10-6"></path>
                  <path d="M2 17l10 6 10-6"></path>
                </svg>`;
              const togglePanel = () => {
                const expanded = ctrl.classList.contains('leaflet-control-layers-expanded');
                if (expanded) ctrl.classList.remove('leaflet-control-layers-expanded');
                else ctrl.classList.add('leaflet-control-layers-expanded');
                a.setAttribute('aria-expanded', expanded ? 'false' : 'true');
                try {
                  const el = map.getContainer();
                  el.setAttribute('data-layers-expanded', expanded ? '0' : '1');
                } catch (_) {}
                // When opening Layers, ensure Legend is closed and popups hidden
                if (!expanded) {
                  try {
                    map.closePopup();
                  } catch (_) {}
                  try {
                    window.dispatchEvent(new CustomEvent('ui:layers:open'));
                  } catch (_) {}
                }
              };
              L.DomEvent.on(a, 'click', (e) => {
                L.DomEvent.stop(e);
                togglePanel();
              });
              L.DomEvent.on(a, 'keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  L.DomEvent.stop(e);
                  togglePanel();
                }
              });
              L.DomEvent.disableClickPropagation(wrap);
              L.DomEvent.disableScrollPropagation(wrap);
              customLayersToggleRef.current = a;
              try { map.__customLayersToggleRef = a; } catch (_) {}
              return wrap;
            },
          });
          const customCtrl = new CustomToggle({ position: 'topright' });
          customCtrl.addTo(map);
          cleanupRefs.current.customCtrl = customCtrl;
        }

        const stop = (e) => {
          e.stopImmediatePropagation();
          e.stopPropagation();
        };
        // Prevent hover-driven expand/collapse and accidental collapses
        ctrl.addEventListener('mouseover', stop, true);
        ctrl.addEventListener('mouseout', stop, true);
        ctrl.addEventListener('mouseenter', stop, true);
        ctrl.addEventListener('mouseleave', stop, true);
        ctrl.addEventListener('focusin', stop, true);
        ctrl.addEventListener('focusout', stop, true);

        let trapCleanup = null;
        const installFocusTrap = () => {
          const list = ctrl.querySelector('.leaflet-control-layers-list') || ctrl;
          const getFocusables = () =>
            list.querySelectorAll(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            );
          const focusFirst = () => {
            const f = getFocusables();
            const first = f[0];
            if (first && first.focus) first.focus();
          };
          const onKeyDown = (e) => {
            if (e.key !== 'Tab') return;
            const focusables = getFocusables();
            if (!focusables.length) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last && last.focus && last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first && first.focus && first.focus();
            }
          };
          list.addEventListener('keydown', onKeyDown);
          // a11y semantics similar to Legend
          list.setAttribute('role', 'dialog');
          list.setAttribute('aria-modal', 'true');
          // Focus the title if available; else first focusable
          focusFirst();
          return () => {
            list.removeEventListener('keydown', onKeyDown);
            list.removeAttribute('role');
            list.removeAttribute('aria-modal');
          };
        };

        // Keep aria-expanded synced with expanded class and manage focus trap
        const syncAria = () => {
          const expanded = ctrl.classList.contains('leaflet-control-layers-expanded');
          if (btn) btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
          if (customLayersToggleRef.current)
            customLayersToggleRef.current.setAttribute('aria-expanded', expanded ? 'true' : 'false');
          try {
            const el = map.getContainer();
            el.setAttribute('data-layers-expanded', expanded ? '1' : '0');
          } catch (_) {}
          // Reflect open state to others (Legend) and manage focus trap
          if (expanded) {
            if (!trapCleanup) trapCleanup = installFocusTrap();
          } else if (trapCleanup) {
            trapCleanup();
            trapCleanup = null;
          }
        };
        const mo = new MutationObserver(syncAria);
        mo.observe(ctrl, { attributes: true, attributeFilter: ['class'] });
        syncAria();
        cleanupRefs.current.mo = mo;
        cleanupRefs.current.ctrl = ctrl;
        // Create a snapshot for effect cleanup
        refsSnapshot = { mo, ctrl, customCtrl: cleanupRefs.current.customCtrl };
      }
    }, 0);
    return () => {
      clearTimeout(id);
      // Use the snapshot instead of reading the ref at cleanup time
      const moRef = refsSnapshot && refsSnapshot.mo;
      const customCtrlRef = refsSnapshot && refsSnapshot.customCtrl;
      try {
        if (moRef) moRef.disconnect();
        if (customCtrlRef && typeof customCtrlRef.remove === 'function') customCtrlRef.remove();
        try {
          const el = map.getContainer();
          el.removeAttribute('data-layers-expanded');
        } catch (_) {}
      } catch (_) {}
    };
  }, [map]);

  // Keyboard shortcuts: L toggles Layers; Esc collapses only if focus is inside
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      const tag = (t && t.tagName) || '';
      const editable =
        t && (t.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT');
      if (editable) return;

      const container = map?.getContainer?.() || document;
      const ctrl = container && container.querySelector('.leaflet-control-layers');
      const btn = customLayersToggleRef.current ||
        (container && container.querySelector('.leaflet-control-layers-toggle'));
      if (!ctrl || !btn) return;

      const isExpanded = () => ctrl.classList.contains('leaflet-control-layers-expanded');
      const setExpanded = (next) => {
        if (next) ctrl.classList.add('leaflet-control-layers-expanded');
        else ctrl.classList.remove('leaflet-control-layers-expanded');
        btn.setAttribute('aria-expanded', next ? 'true' : 'false');
      };

      const focusCloseButton = () => {
        // Prefer a dedicated hook; fall back to common selectors in the header tools area
        const closeEl =
          ctrl.querySelector('[data-close="layers"]') ||
          ctrl.querySelector('.layers-tools [aria-label="Close layers panel"]') ||
          ctrl.querySelector('.layers-tools button, .layers-tools [role="button"]');
        (closeEl || btn).focus();
      };

      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        const wasExpanded = isExpanded();
        setExpanded(!wasExpanded);
        if (!wasExpanded) {
          // Just opened → move initial focus to the Close (×) button
          setTimeout(focusCloseButton, 0); // allow DOM to paint first
          try { map.closePopup(); } catch (_) {}
          try { window.dispatchEvent(new CustomEvent('ui:layers:open')); } catch (_) {}
        } else {
          // Just closed → return focus to the toggle
          btn.focus();
        }
        return;
      }

      if (e.key === 'Escape') {
        if (!isExpanded()) return;
        const active = document.activeElement;
        const focusedInside = active && ctrl.contains(active);
        if (focusedInside) {
          e.preventDefault();
          setExpanded(false);
          btn.focus();
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [map]);

  // Listen for Legend open or Popup open to collapse Layers
  useEffect(() => {
    if (!map) return undefined;
    const container = map.getContainer ? map.getContainer() : document;
    const ctrl = container && container.querySelector('.leaflet-control-layers');
    if (!ctrl) return undefined;
    const collapse = () => {
      try {
        ctrl.classList.remove('leaflet-control-layers-expanded');
        const btn = customLayersToggleRef.current ||
          (container && container.querySelector('.leaflet-control-layers-toggle'));
        if (btn) btn.setAttribute('aria-expanded', 'false');
        const el = map.getContainer();
        el.setAttribute('data-layers-expanded', '0');
      } catch (_) {}
    };
    const onLegendOpen = () => collapse();
    const onPopupOpen = () => collapse();
    window.addEventListener('ui:legend:open', onLegendOpen);
    window.addEventListener('ui:popup:open', onPopupOpen);
    return () => {
      window.removeEventListener('ui:legend:open', onLegendOpen);
      window.removeEventListener('ui:popup:open', onPopupOpen);
    };
  }, [map]);

  // Track basemap theme (light | dark | imagery) and set on map container for CSS
  useEffect(() => {
    if (!map) return undefined;
    const el = map.getContainer();
    // Heuristic detection by layer URL/name/attribution to avoid provider-specific misses
    const themeForLayer = (layer, nameHint = '') => {
      const url = (layer && (layer._url || (layer.options && layer.options.url))) || '';
      const attr =
        (layer && typeof layer.getAttribution === 'function' && layer.getAttribution()) ||
        (layer && layer.options && layer.options.attribution) ||
        '';
      const lc = String(url).toLowerCase();
      const la = String(attr).toLowerCase();
      const ln = String(nameHint).toLowerCase();

      // Imagery (Esri Satellite and similar)
      if (
        /worldimagery|world_imagery|arcgisonline|esri|satellite|imagery/.test(lc) ||
        /esri|imagery|satellite/.test(la) ||
        /satellite|imagery/.test(ln)
      ) {
        return 'imagery';
      }

      // Dark themes (Carto DarkMatter, variants, or other providers)
      const darkByUrlPair = /cartocdn|cartodb|carto/.test(lc) && /dark/.test(lc);
      const darkByToken = /darkmatter|dark_all|dark-matter/.test(lc);
      const darkByName = /dark/.test(ln);
      const darkByAttrib = /carto/.test(la) && /dark/.test(la);
      if (darkByUrlPair || darkByToken || darkByName || darkByAttrib) {
        return 'dark';
      }

      // Default to light
      return 'light';
    };
    const setThemeFromActiveBase = () => {
      try {
        let theme = 'light';
        const layers = map._layers || {};
        for (const k in layers) {
          const l = layers[k];
          // heuristic: TileLayer instances used as base will be at zIndex < 250 or have attribution
          if (l && l._url && typeof l.getAttribution === 'function') {
            theme = themeForLayer(l);
          }
        }
        el.setAttribute('data-basemap-theme', theme);
        try {
          document.documentElement.setAttribute('data-basemap-theme', theme);
        } catch (_) {}
      } catch (_) {}
    };
    setThemeFromActiveBase();
    const onBase = (e) => {
      const t = themeForLayer(e.layer, e && e.name);
      el.setAttribute('data-basemap-theme', t);
      try {
        document.documentElement.setAttribute('data-basemap-theme', t);
      } catch (_) {}
    };
    map.on('baselayerchange', onBase);
    return () => {
      map.off('baselayerchange', onBase);
    };
  }, [map]);

  // Keep a data-zoom attribute on the map container for CSS-based zoom tweaks
  useEffect(() => {
    if (!map) return undefined;
    const el = map.getContainer();
    const setZoomAttr = () => {
      const z = map.getZoom();
      el.setAttribute('data-zoom', String(z));
      el.setAttribute('data-zoom-lte4', z <= 4 ? '1' : '0');
    };
    setZoomAttr();
    // Update only at the end of zoom to avoid thrashing many markers
    map.on('zoomend', setZoomAttr);
    return () => {
      map.off('zoomend', setZoomAttr);
    };
  }, [map]);

  // Reflect active overlays as data-attrs for CSS-based tweaks
  useEffect(() => {
    if (!map) return undefined;
    const el = map.getContainer();
    try {
      el.setAttribute('data-ovl-earthquakes', activeIds.has('earthquakes') ? '1' : '0');
      el.setAttribute('data-ovl-faults', activeIds.has('faults') ? '1' : '0');
      el.setAttribute('data-ovl-plates', activeIds.has('plates') ? '1' : '0');
      el.setAttribute('data-ovl-stations', activeIds.has('stations') ? '1' : '0');
    } catch (_) {}
    return undefined;
  }, [map, activeIds]);

  // Theme tokens → CSS variables on map container (used by marker CSS)
  useEffect(() => {
    if (!map) return undefined;
    const el = map.getContainer();
    const apply = () => {
      const theme = themeFromMapContainer(el);
      const zoom = zoomFromMap(map);
      const toks = buildThemeTokens({ theme, zoom, overlays: activeIds });
      el.style.setProperty('--eq-fill', toks.eq.fill);
      el.style.setProperty('--eq-halo', toks.eq.halo);
      const haloW =
        activeIds.has('earthquakes') && !activeIds.has('faults')
          ? toks.eq.haloWidthOnlyEQ
          : toks.eq.haloWidth;
      el.style.setProperty('--eq-halo-w', `${haloW}px`);
      el.style.setProperty('--eq-opacity', String(toks.eq.fillOpacity));
      el.style.setProperty('--eq-scale', String(toks.eq.scale || 1));
      el.style.setProperty('--st-fill', toks.stations.fill);
      el.style.setProperty('--st-halo', toks.stations.halo);
      if (toks.stations.haloWidth) {
        el.style.setProperty('--st-halo-w', `${toks.stations.haloWidth}px`);
      } else {
        el.style.removeProperty('--st-halo-w');
      }
    };
    apply();
    // Update tokens only when zoom settles to avoid re-styling thousands of markers per frame
    map.on('zoomend', apply);
    map.on('baselayerchange', apply);
    // Also react immediately to overlay visibility changes to avoid stale styling
    map.on('overlayadd', apply);
    map.on('overlayremove', apply);
    return () => {
      map.off('zoomend', apply);
      map.off('baselayerchange', apply);
      map.off('overlayadd', apply);
      map.off('overlayremove', apply);
    };
  }, [map, activeIds]);

  // Keep only the EQ scale var in sync continuously during zoom animations for smoothness
  useEffect(() => {
    if (!map) return undefined;
    const el = map.getContainer();
    let raf = null;
    const onZoom = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        try {
          const z = map.getZoom();
          const s = eqScaleForZoom(z);
          el.style.setProperty('--eq-scale', String(s));
        } catch (_) {}
      });
    };
    map.on('zoom', onZoom);
    return () => {
      cancelAnimationFrame(raf);
      map.off('zoom', onZoom);
    };
  }, [map]);

  // Enhance LayersControl UI: header, thumbnails, overlay swatches
  useEffect(() => {
    if (!map) return undefined;
    const container = map.getContainer ? map.getContainer() : document;
    const ctrl = container && container.querySelector('.leaflet-control-layers');
    if (!ctrl) return undefined;
    const list = ctrl.querySelector('.leaflet-control-layers-list');
    const base = ctrl.querySelector('.leaflet-control-layers-base');
    const overlays = ctrl.querySelector('.leaflet-control-layers-overlays');
    if (!list || !base || !overlays) return undefined;

    // Inject header bar once
    if (!list.querySelector('.layers-header')) {
      const header = document.createElement('div');
      header.className = 'layers-header';
      const title = document.createElement('div');
      title.className = 'layers-title';
      title.textContent = '';
      const tools = document.createElement('div');
      tools.className = 'layers-tools';
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'layers-close';
      closeBtn.setAttribute('aria-label', 'Close layers panel');
      closeBtn.setAttribute('data-close', 'layers');
      closeBtn.textContent = '×';
      tools.appendChild(closeBtn);
      header.appendChild(title);
      header.appendChild(tools);
      list.insertBefore(header, list.firstChild);

      // Close collapses the control
      closeBtn.addEventListener(
        'click',
        (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          ctrl.classList.remove('leaflet-control-layers-expanded');
          const btn2 = ctrl.querySelector('.leaflet-control-layers-toggle');
          if (btn2) btn2.setAttribute('aria-expanded', 'false');
        },
        { passive: false },
      );

      // No focusable title; keep only the close button visible
    }

    // Wrap base+overlays inside a dedicated scroll body so header never scrolls
    if (!list.querySelector('.layers-body')) {
      const body = document.createElement('div');
      body.className = 'layers-body';
      // Move base and overlays inside body
      body.appendChild(base);
      body.appendChild(overlays);
      list.appendChild(body);
    }

    // Annotate base labels and set thumbnail background via CSS var
    const baseThumb = (name, urlTemplate) => {
      if (!urlTemplate) return '';
      const url = urlTemplate
        .replace('{s}', 'a')
        .replace('{z}', '2')
        .replace('{x}', '2')
        .replace('{y}', '2');
      return `url("${url}")`;
    };
    const baseMap = {
      'Standard Map': { key: 'osm', url: bases.osm.url },
      'Light Map': { key: 'positron', url: bases.positron.url },
      'Dark Map': { key: 'dark', url: bases.dark.url },
      'Satellite View': { key: 'esri', url: bases.esri.url },
    };
    base.querySelectorAll('label').forEach((lab) => {
      const text = (lab.textContent || '').trim();
      const m = baseMap[text];
      if (!m) return;
      lab.dataset.basemap = m.key;
      lab.classList.add('is-basemap');
      const thumb = baseThumb(m.key, m.url);
      if (thumb) lab.style.setProperty('--thumb', thumb);
      // Ensure input is first child and clickable area is full label
      const input = lab.querySelector('input[type="radio"]');
      if (input) {
        input.setAttribute('aria-label', text);
      }
      // Make every basemap row tabbable (not only the checked one)
      // so Tab traverses all basemap options in order.
      if (!lab.hasAttribute('tabindex')) {
        lab.setAttribute('tabindex', '0');
        lab.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const inp = lab.querySelector('input[type="radio"]');
            if (inp && !inp.checked) {
              inp.dispatchEvent(new MouseEvent('click', { bubbles: true }));
              inp.click();
              inp.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        });
      }
    });

    // Basic a11y labels on overlay rows, no symbology or metadata in this panel
    overlays.querySelectorAll('label').forEach((lab) => {
      const text = (lab.textContent || '').trim();
      const input = lab.querySelector('input[type="checkbox"]');
      if (input) input.setAttribute('aria-label', text);
    });

    // Layer overlay tooltips/ARIA
    const overlayHints = {
      earthquakes: 'Earthquake markers',
      faults: 'Active fault lines',
      plates: 'Plate boundary lines',
      stations: 'Station markers',
      population: 'Population density shading',
    };
    const applyOverlayHints = () => {
      const rows = ctrl.querySelectorAll('.leaflet-control-layers-overlays label');
      rows.forEach((row) => {
        const id = row && row.getAttribute('data-overlay');
        if (!id) return;
        const hint = overlayHints[id];
        if (hint) {
          row.setAttribute('title', hint);
          row.setAttribute('aria-label', `${row.textContent || id} – ${hint}`);
        }
      });
    };
    // Annotate overlay rows with stable ids and enforce a consistent order
    const annotateOverlayRows = () => {
      const mapRowToId = (labelText) => {
        const t = String(labelText || '').trim().toLowerCase();
        if (t === 'earthquakes') return 'earthquakes';
        if (t === 'fault lines') return 'faults';
        if (t === 'plate boundaries') return 'plates';
        if (t === 'stations') return 'stations';
        if (t === 'population density') return 'population';
        return null;
      };
      overlays.querySelectorAll('label').forEach((lab) => {
        const text = (lab.textContent || '').trim();
        const id = mapRowToId(text);
        if (id) lab.setAttribute('data-overlay', id);
      });
    };
    const enforceOverlayOrder = () => {
      // Keep Earthquakes at the top of overlays list
      const rows = overlays.querySelectorAll('label');
      if (!rows || rows.length === 0) return;
      const eq = overlays.querySelector('label[data-overlay="earthquakes"]');
      if (eq && overlays.firstElementChild !== eq) {
        overlays.insertBefore(eq, overlays.firstElementChild);
      }
    };

    // Initial annotate+order, then enhance with hints
    annotateOverlayRows();
    enforceOverlayOrder();
    applyOverlayHints();

    // Observe overlay list for changes (e.g., preset switch re-renders children)
    const mo = new MutationObserver(() => {
      annotateOverlayRows();
      enforceOverlayOrder();
      applyOverlayHints();
    });
    mo.observe(overlays, { childList: true, subtree: false });

    return () => {
      try {
        mo.disconnect();
      } catch (_) {}
    };
  }, [map, bases]);

  // ---- Tooltip builders moved to OverlayLayers; keep keyboard/ARIA helpers here ----

  // Keep line styles in sync with theme/zoom/overlay state
  useEffect(() => {
    if (!map) return undefined;
    const restyle = () => {
      const theme = themeFromMapContainer(map.getContainer());
      const zoom = zoomFromMap(map);
      const f = faultsStyle({ theme, zoom, overlays: activeIds });
      const p = platesStyle({ theme, zoom });
      try {
        faultsRef.current && faultsRef.current.setStyle && faultsRef.current.setStyle(f);
      } catch (_) {}
      try {
        platesRef.current && platesRef.current.setStyle && platesRef.current.setStyle(p);
      } catch (_) {}
    };
    let id = null;
    const schedule = () => {
      cancelAnimationFrame(id);
      id = requestAnimationFrame(restyle);
    };
    schedule();
    map.on('zoomend', schedule);
    map.on('baselayerchange', schedule);
    return () => {
      cancelAnimationFrame(id);
      map.off('zoomend', schedule);
      map.off('baselayerchange', schedule);
    };
  }, [map, activeIds]);

  // Keep faults visually above plates when both are on (shared pane)
  useEffect(() => {
    if (!map) return undefined;
    const bumpFaults = () => {
      try {
        if (
          faultsRef.current &&
          platesRef.current &&
          map.hasLayer(faultsRef.current) &&
          map.hasLayer(platesRef.current)
        ) {
          faultsRef.current.bringToFront && faultsRef.current.bringToFront();
        }
      } catch (_) {}
    };
    const id = setTimeout(bumpFaults, 0);
    map.on('overlayadd', bumpFaults);
    map.on('overlayremove', bumpFaults);
    return () => {
      clearTimeout(id);
      map.off('overlayadd', bumpFaults);
      map.off('overlayremove', bumpFaults);
    };
  }, [map]);

  // Pane for earthquake markers is created by a dedicated <Pane name="eqMarkers" />
  // added in HomePage.jsx before any markers mount.

  // Use default overlay pane for both vector overlays to allow hover on both
  if (map) {
    try {
      /* no custom panes */
    } catch (_) {}
  }

  const makeOnEachWith = useCallback(
    (baseStyle, buildTooltipFn, hoverClassName = null, options = {}) => {
      const getBase = () => {
        const s = typeof baseStyle === 'function' ? baseStyle() : baseStyle;
        return { ...(s || {}), interactive: true };
      };
      return (feature, layer) => {
        try {
          const html = buildTooltipFn(feature && feature.properties);
          const usePopup = Boolean(options && options.usePopup);
          if (html) {
            if (usePopup) {
              layer.bindPopup(html, {
                className: 'feature-popup',
                autoPan: true,
                closeButton: true,
                maxWidth: 280,
              });
            } else {
              layer.bindTooltip(html, {
                sticky: true,
                direction: 'top',
                className: 'feature-tooltip',
              });
            }
          }
          const hoverWeightFor = (baseW) =>
            usePopup ? Math.max(baseW + 1.25, baseW * 1.75) : Math.max(baseW + 2.5, baseW * 2.5);

          layer.on('mouseover', () => {
            try {
              const el = map?.getContainer?.();
              if (el && hoverClassName) el.classList.add(hoverClassName);
              const baseNow = getBase();
              const baseW = baseNow.weight || 2;
              // Slight bump on hover for readability; keep same scale for selected
              const hoverW = hoverWeightFor(baseW);
              layer.setStyle({ ...baseNow, weight: hoverW, opacity: 1 });
              if (layer.bringToFront) layer.bringToFront();
              const pathEl = layer.getElement ? layer.getElement() : layer._path || null;
              if (pathEl) {
                try {
                  pathEl.classList.add('hover-glow');
                } catch (_) {}
              }
              // keep the pane just below tooltip pane (650)
              const paneName = layer?.options?.pane;
              const paneEl = paneName && map?.getPane?.(paneName);
              if (paneEl) {
                if (paneEl._prevZ == null) paneEl._prevZ = paneEl.style.zIndex;
                paneEl.style.zIndex = '645';
              }
            } catch (_) {}
          });
          const reset = () => {
            // If tooltip is open (selected), keep selected styling
            const tip = !usePopup && typeof layer.getTooltip === 'function' ? layer.getTooltip() : null;
            const pop = usePopup && typeof layer.getPopup === 'function' ? layer.getPopup() : null;
            const isTipOpen = !!(tip && typeof tip.isOpen === 'function' && tip.isOpen());
            const isPopOpen = !!(pop && typeof pop.isOpen === 'function' && pop.isOpen());
            const open = usePopup ? isPopOpen : isTipOpen;
            if (!open) {
              try {
                layer.setStyle(getBase());
              } catch (_) {}
            } else {
              const baseNow = getBase();
              const baseW = baseNow.weight || 2;
              // Keep a highlight when info is pinned open, same scale as hover
              const selectedW = hoverWeightFor(baseW);
              try {
                layer.setStyle({ ...baseNow, weight: selectedW, opacity: 1 });
              } catch (_) {}
            }
            const el = map?.getContainer?.();
            if (el && hoverClassName) el.classList.remove(hoverClassName);
            const pathEl = layer.getElement ? layer.getElement() : layer._path || null;
            if (pathEl) {
              try {
                if (!open) pathEl.classList.remove('hover-glow');
              } catch (_) {}
            }
            const paneName = layer?.options?.pane;
            const paneEl = paneName && map?.getPane?.(paneName);
            if (paneEl && paneEl._prevZ != null) {
              paneEl.style.zIndex = paneEl._prevZ;
              paneEl._prevZ = null;
            }
          };
          layer.on('mouseout', reset);
          if (usePopup) {
            layer.on('popupclose', reset);
          } else {
            layer.on('tooltipclose', reset);
          }
          layer.on('remove', reset);
          // Click/tap toggling only for popups. Tooltips should be hover-only.
          if (usePopup) {
            const clickToggle = (e) => {
              try {
                const isOpen = typeof layer.isPopupOpen === 'function' && layer.isPopupOpen();
                if (isOpen) {
                  layer.closePopup();
                } else {
                  const baseNow = getBase();
                  const baseW = baseNow.weight || 2;
                  const selectedW = hoverWeightFor(baseW);
                  layer.setStyle({ ...baseNow, weight: selectedW, opacity: 1 });
                  if (layer.bringToFront) layer.bringToFront();
                  const pathEl = layer.getElement ? layer.getElement() : layer._path || null;
                  if (pathEl) {
                    try { pathEl.classList.add('selected-glow'); } catch (_) {}
                  }
                  if (e && e.latlng && typeof layer.openPopup === 'function') layer.openPopup(e.latlng);
                  else if (typeof layer.openPopup === 'function') layer.openPopup();
                }
              } catch (_) {}
            };
            layer.on('click', clickToggle);
            let __lastTapTs = 0;
            layer.on('tap', (ev) => {
              __lastTapTs = Date.now();
              clickToggle(ev);
            });
            layer.on('click', (ev) => {
              if (__lastTapTs && Date.now() - __lastTapTs < 350) return;
              clickToggle(ev);
            });
          }
          if (!usePopup) {
            layer.on('tooltipclose', () => {
              const pathEl = layer.getElement ? layer.getElement() : layer._path || null;
              if (pathEl) {
                try {
                  pathEl.classList.remove('selected-glow');
                } catch (_) {}
              }
              try {
                layer.setStyle(getBase());
              } catch (_) {}
            });
          } else {
            layer.on('popupclose', () => {
              const pathEl = layer.getElement ? layer.getElement() : layer._path || null;
              if (pathEl) {
                try { pathEl.classList.remove('selected-glow'); } catch (_) {}
              }
              try { layer.setStyle(getBase()); } catch (_) {}
            });
          }
        } catch (_) {}
      };
    },
    [map],
  );

  const faultsStyleFor = useCallback(
    () =>
      faultsStyle({
        theme: themeFromMapContainer(map.getContainer()),
        zoom: map.getZoom(),
        overlays: activeIds,
      }),
    [map, activeIds],
  );
  const platesStyleFor = useCallback(
    () => platesStyle({ theme: themeFromMapContainer(map.getContainer()), zoom: map.getZoom() }),
    [map],
  );

  return (
    <LayersControl position="topright" collapsed>
      <BasemapLayers bases={bases} />
      <OverlayLayers
        setFaultsRef={setFaultsRef}
        setPlatesRef={setPlatesRef}
        setPopRef={setPopRef}
        faultsStyleFor={faultsStyleFor}
        platesStyleFor={platesStyleFor}
        makeOnEachWith={makeOnEachWith}
      />
      {/* Inject external overlays from parent (e.g., Stations, Earthquakes) */}
      {children}
    </LayersControl>
  );
}
