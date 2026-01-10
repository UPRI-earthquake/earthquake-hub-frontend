import React, { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import L from 'leaflet';
import { LayersControl, useMap } from 'react-leaflet';
import { BASEMAPS } from '../config/mapLayers';
import {
  buildThemeTokens,
  faultsStyle,
  platesStyle,
  themeFromMapContainer,
  zoomFromMap,
} from '../config/mapStyles';
import './mapLayers.css';
import { useOverlayState } from './OverlayStateContext';
import BasemapLayers from './layers/BasemapLayers';
import OverlayLayers from './layers/OverlayLayers';
import { ATTRIBUTIONS } from '../config/attribution';
import { trackEvent } from '../analytics';
import { useTheme } from '../theme/ThemeProvider';
// Removed metadata injection in Layers panel; keep lastUpdated utils for Legend only

/**
 * Map layers control: basemaps, overlays, and UX helpers for Leaflet layers.
 * TODO(frontend-team): Split into smaller modules (basemaps, overlays, keyboard) — file is large.
 */
//

// Stable Layers icon (outline only) - keep tool icon constant; do not swap to chevrons or close symbols.
const LAYERS_ICON_SVG = [
  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
  '<path d="M12 2l10 6-10 6L2 8l10-6z"></path>',
  '<path d="M2 12l10 6 10-6"></path>',
  '<path d="M2 17l10 6 10-6"></path>',
  '</svg>',
].join('');

export default function MapLayersControl({ children, activeTheme }) {
  const map = useMap();
  const { registerLayer, activeIds } = useOverlayState();
  const baseLayerRefs = useRef({});
  const basemapThemeRef = useRef(null);
  const prevBaseRef = useRef('default');
  const defaultThemeRef = useRef(null);
  const [activeBase, setActiveBase] = useState('default');
  const { theme, setTheme, setThemeToggleDisabled } = useTheme();
  // Memoize basemap provider props so layers are not recreated
  const bases = useMemo(
    () => ({
      defaultLight: BASEMAPS.Carto_Positron(),
      defaultDark: BASEMAPS.Carto_DarkMatter(),
      terrain: BASEMAPS.Esri_WorldTopoMap(),
      satellite: BASEMAPS.Esri_WorldImagery(),
    }),
    [],
  );

  const registerBaseLayer = useCallback(
    (key, layer) => {
      if (!layer) return;
      baseLayerRefs.current[key] = layer?.leafletElement || layer;
    },
    [],
  );

  useEffect(() => {
    if (!map) return undefined;
    const normalizeBase = (name) => {
      const n = String(name || '').toLowerCase();
      if (n.includes('satellite')) return 'satellite';
      if (n.includes('terrain') || n.includes('topo')) return 'terrain';
      return 'default';
    };
    const onBaseLayerChange = (e) => {
      const next = normalizeBase(e && e.name);
      setActiveBase(next);
    };
    map.on('baselayerchange', onBaseLayerChange);
    return () => {
      map.off('baselayerchange', onBaseLayerChange);
    };
  }, [map]);

  useEffect(() => {
    const prevBase = prevBaseRef.current;
    const isDefault = activeBase === 'default';
    const wasDefault = prevBase === 'default';

    if (setThemeToggleDisabled) {
      const lockThemeToggle = activeBase === 'terrain' || activeBase === 'satellite';
      setThemeToggleDisabled(lockThemeToggle);
    }

    if (isDefault) {
      if (!wasDefault) {
        const desired = defaultThemeRef.current;
        if (setTheme) {
          if (desired == null) setTheme(null);
          else setTheme(desired);
        }
      } else {
        defaultThemeRef.current = theme;
      }
    } else {
      if (wasDefault) defaultThemeRef.current = theme;
      if (setTheme) {
        if (activeBase === 'satellite') setTheme('dark');
        else if (activeBase === 'terrain') setTheme('light');
      }
    }

    prevBaseRef.current = activeBase;
  }, [activeBase, theme, setTheme, setThemeToggleDisabled]);

  useEffect(() => {
    return () => {
      if (setThemeToggleDisabled) setThemeToggleDisabled(false);
    };
  }, [setThemeToggleDisabled]);

  // overlays are handled by OverlayLayers subcomponent

  // Refs for registering overlays with the legend sync
  const faultsRef = useRef(null);
  const platesRef = useRef(null);
  const customLayersToggleRef = useRef(null);
  const cleanupRefs = useRef({});
  const emitPanelToggle = useCallback((isOpen, trigger = 'button') => {
    try {
      trackEvent('layers_toggle', {
        action: 'panel',
        state: isOpen ? 'open' : 'closed',
        trigger,
      });
    } catch (_) {}
  }, []);
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const applyLayersButtonState = useCallback((open) => {
    const btn = customLayersToggleRef.current;
    if (!btn) return;
    btn.classList.toggle('is-active', !!open);
    btn.setAttribute('data-active', open ? '1' : '0');
  }, []);
  const setLayersOpenState = useCallback(
    (next, trigger = 'button') => {
      setIsLayersOpen(next);
      applyLayersButtonState(next);
      emitPanelToggle(next, trigger);
      try {
        const el = map?.getContainer?.();
        if (el) el.setAttribute('data-layers-expanded', next ? '1' : '0');
      } catch (_) {}
    },
    [applyLayersButtonState, emitPanelToggle, map],
  );

  const setFaultsRef = useCallback(
    (node) => {
      const layer = node && (node.leafletElement || node);
      faultsRef.current = layer;
      if (layer) {
        try {
          // Expose attribution for Leaflet control; wrap with a marker class for formatting
          layer.getAttribution = () => `<span class="attr-line attr-faults">${ATTRIBUTIONS.GEMFaults}</span>`;
        } catch (_) {}
        registerLayer('faults', layer);
      }
    },
    [registerLayer],
  );

  const setPlatesRef = useCallback(
    (node) => {
      const layer = node && (node.leafletElement || node);
      platesRef.current = layer;
      if (layer) {
        try {
          layer.getAttribution = () => `<span class="attr-line attr-plates">${ATTRIBUTIONS.PB2002}</span>`;
        } catch (_) {}
        registerLayer('plates', layer);
      }
    },
    [registerLayer],
  );

  // Population overlay removed

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
              a.innerHTML = LAYERS_ICON_SVG;
              applyLayersButtonState(false);
              const togglePanel = () => {
                const expanded = ctrl.classList.contains('leaflet-control-layers-expanded');
                const nextState = !expanded;
                if (expanded) ctrl.classList.remove('leaflet-control-layers-expanded');
                else ctrl.classList.add('leaflet-control-layers-expanded');
                a.setAttribute('aria-expanded', expanded ? 'false' : 'true');
                setLayersOpenState(nextState, 'button');
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
          setLayersOpenState(expanded, 'sync');
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
  }, [map, emitPanelToggle, setLayersOpenState, applyLayersButtonState]);

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
        setLayersOpenState(next, 'keyboard');
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
        const nextState = !wasExpanded;
        setExpanded(nextState);
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
  }, [map, emitPanelToggle, setLayersOpenState]);

  // Listen for Legend open or Popup open to collapse Layers
  useEffect(() => {
    if (!map) return undefined;
    const container = map.getContainer ? map.getContainer() : document;
    const ctrl = container && container.querySelector('.leaflet-control-layers');
    if (!ctrl) return undefined;
        const collapse = (trigger = 'legend') => {
          try {
            ctrl.classList.remove('leaflet-control-layers-expanded');
            const btn = customLayersToggleRef.current ||
              (container && container.querySelector('.leaflet-control-layers-toggle'));
            if (btn) btn.setAttribute('aria-expanded', 'false');
            setLayersOpenState(false, trigger);
          } catch (_) {}
        };
        const onLegendOpen = () => collapse('legend');
        const onPopupOpen = () => collapse('popup');
    window.addEventListener('ui:legend:open', onLegendOpen);
    window.addEventListener('ui:popup:open', onPopupOpen);
    return () => {
      window.removeEventListener('ui:legend:open', onLegendOpen);
      window.removeEventListener('ui:popup:open', onPopupOpen);
    };
  }, [map, setLayersOpenState]);

  // Close when clicking outside the button/panel
  useEffect(() => {
    if (!map) return undefined;
    const container = map.getContainer ? map.getContainer() : document;
    const onPointerDown = (e) => {
      if (!isLayersOpen) return;
      const panel = container && container.querySelector('.leaflet-control-layers');
      const btn = customLayersToggleRef.current;
      if ((panel && panel.contains(e.target)) || (btn && btn.contains(e.target))) return;
      if (panel) panel.classList.remove('leaflet-control-layers-expanded');
      if (btn) btn.setAttribute('aria-expanded', 'false');
      setLayersOpenState(false, 'outside');
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [map, isLayersOpen, setLayersOpenState]);

  const restyleOverlays = useCallback(() => {
    if (!map) return;
    const theme = basemapThemeRef.current || themeFromMapContainer(map.getContainer());
    const zoom = zoomFromMap(map);
    const f = faultsStyle({ theme, zoom, overlays: activeIds });
    const p = platesStyle({ theme, zoom });
    try {
      faultsRef.current && faultsRef.current.setStyle && faultsRef.current.setStyle(f);
    } catch (_) {}
    try {
      platesRef.current && platesRef.current.setStyle && platesRef.current.setStyle(p);
    } catch (_) {}
  }, [map, activeIds]);

  // Track basemap theme (light | dark | imagery) and set on map container for CSS
  useEffect(() => {
    if (!map) return undefined;
    const el = map.getContainer();
    const resolveThemeForBase = (base) => {
      if (base === 'satellite') return 'imagery';
      if (base === 'default') return activeTheme === 'dark' ? 'dark' : 'light';
      return 'light';
    };
    const normalizeBase = (name) => {
      const n = String(name || '').toLowerCase();
      if (n.includes('satellite')) return 'satellite';
      if (n.includes('terrain') || n.includes('topo')) return 'terrain';
      return 'default';
    };
    const applyBasemapTheme = (baseOverride = null) => {
      const theme = resolveThemeForBase(baseOverride || activeBase);
      if (!theme) return;
      try {
        el.setAttribute('data-basemap-theme', theme);
        basemapThemeRef.current = theme;
      } catch (_) {}
    };
    applyBasemapTheme();
    restyleOverlays();
    const onBase = (e) => {
      const nextBase = normalizeBase(e && e.name);
      applyBasemapTheme(nextBase);
      restyleOverlays();
    };
    map.on('baselayerchange', onBase);
    return () => {
      map.off('baselayerchange', onBase);
    };
  }, [map, activeTheme, activeBase, restyleOverlays]);

  // When Default is active, swap the provider URL to match the theme
  // and emit a synthetic baselayerchange so dependent styling re-syncs.
  useEffect(() => {
    if (!map || activeBase !== 'default') return undefined;
    const layer = baseLayerRefs.current.default;
    const desiredTheme = activeTheme === 'dark' ? 'dark' : 'light';
    const desiredUrl =
      desiredTheme === 'dark' ? bases.defaultDark.url : bases.defaultLight.url;
    const maybeSwapUrl = () => {
      try {
        if (layer && typeof layer.setUrl === 'function' && layer._url !== desiredUrl) {
          layer.setUrl(desiredUrl);
          map.fire('baselayerchange', { layer, name: 'Default', _autoTheme: true });
        }
      } catch (_) {}
    };
    maybeSwapUrl();
    return undefined;
  }, [map, activeBase, activeTheme, bases]);

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
  }, [map, activeIds, activeTheme]);

  // Theme tokens → CSS variables on map container (used by marker CSS)
  useEffect(() => {
    if (!map) return undefined;
    const el = map.getContainer();
    const apply = () => {
      const theme = themeFromMapContainer(el);
      const zoom = zoomFromMap(map);
      const toks = buildThemeTokens({ theme, zoom, overlays: activeIds });
      const root = document.documentElement;
      const hexToRgb = (hex) => {
        try {
          const m = String(hex || '').replace('#', '');
          const v = m.length === 3
            ? m.split('').map((ch) => parseInt(ch + ch, 16))
            : [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
          if (v.some((n) => !isFinite(n))) return [0, 0, 0];
          return v;
        } catch (_) { return [0, 0, 0]; }
      };
      el.style.setProperty('--eq-fill', toks.eq.fill);
      el.style.setProperty('--eq-halo', toks.eq.halo);
      const haloW =
        activeIds.has('earthquakes') && !activeIds.has('faults')
          ? toks.eq.haloWidthOnlyEQ
          : toks.eq.haloWidth;
      el.style.setProperty('--eq-halo-w', `${haloW}px`);
      el.style.setProperty('--eq-opacity', String(toks.eq.fillOpacity));
      // No zoom-based EQ marker scaling; keep size constant for smoother zooms
      el.style.setProperty('--st-fill', toks.stations.fill);
      el.style.setProperty('--st-fill-off', toks.stations.offlineFill);
      el.style.setProperty('--st-halo', toks.stations.halo);
      el.style.setProperty('--st-pulse-on', toks.stations.pulseOn);
      el.style.setProperty('--st-pulse-off', toks.stations.pulseOff);
      // Also expose pulse tints on :root so sidebar items can reuse them
      try {
        const [r1, g1, b1] = hexToRgb(toks.stations.pulseOn);
        const [r2, g2, b2] = hexToRgb(toks.stations.pulseOff);
        const on1 = `rgba(${r1}, ${g1}, ${b1}, 0.16)`;
        const on2 = `rgba(${r1}, ${g1}, ${b1}, 0.08)`;
        const off1 = `rgba(${r2}, ${g2}, ${b2}, 0.16)`;
        const off2 = `rgba(${r2}, ${g2}, ${b2}, 0.08)`;
        el.style.setProperty('--sta-pulse-on-1', on1);
        el.style.setProperty('--sta-pulse-on-2', on2);
        el.style.setProperty('--sta-pulse-off-1', off1);
        el.style.setProperty('--sta-pulse-off-2', off2);
        // Duplicate to document root for non-map UI (e.g., sidebar items)
        root.style.setProperty('--st-pulse-on', toks.stations.pulseOn);
        root.style.setProperty('--st-pulse-off', toks.stations.pulseOff);
        root.style.setProperty('--sta-pulse-on-1', on1);
        root.style.setProperty('--sta-pulse-on-2', on2);
        root.style.setProperty('--sta-pulse-off-1', off1);
        root.style.setProperty('--sta-pulse-off-2', off2);
        root.style.setProperty('--st-fill-off', toks.stations.offlineFill);
        root.style.setProperty('--st-fill', toks.stations.fill);
      } catch (_) {}
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
  }, [map, activeIds, activeTheme]);

  // Removed continuous EQ marker scale updates to avoid zoom jitter

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

    // Wrap base+overlays inside a dedicated scroll body so header never scrolls
    if (!list.querySelector('.layers-body')) {
      const body = document.createElement('div');
      body.className = 'layers-body';
      // Move base and overlays inside body
      body.appendChild(base);
      body.appendChild(overlays);
      list.appendChild(body);
    }

    // Replace label content with div-based rows to control sizing
    const ensureLayerRows = (section) => {
      if (!section) return;
      section.querySelectorAll('label').forEach((lab) => {
        if (lab.getAttribute('data-layer-row') === '1') return;
        const existing = lab.querySelector('.layer-row');
        const existingText = existing && existing.querySelector('.layer-text');
        if (existing && (existingText?.textContent || '').trim()) {
          lab.setAttribute('data-layer-row', '1');
          return;
        }
        const textValue = (lab.innerText || lab.textContent || '').replace(/\s+/g, ' ').trim();
        const input = lab.querySelector('input');
        if (!input) return;
        const text = textValue || input.getAttribute('aria-label') || input.getAttribute('name') || '';
        const row = document.createElement('div');
        row.className = 'layer-row';
        const control = document.createElement('div');
        control.className = 'layer-control';
        control.appendChild(input);
        const labelDiv = document.createElement('div');
        labelDiv.className = 'layer-text';
        labelDiv.textContent = text;
        row.appendChild(control);
        row.appendChild(labelDiv);
        lab.innerHTML = '';
        lab.appendChild(row);
        lab.setAttribute('data-layer-row', '1');
      });
    };

    const updatePanelWidth = () => {
      if (!ctrl) return;
      const rows = ctrl.querySelectorAll('.layer-row');
      if (!rows || rows.length === 0) return;
      let max = 0;
      rows.forEach((row) => {
        const w = row.scrollWidth || row.offsetWidth || 0;
        if (w > max) max = w;
      });
      const padding = 16; // breathing room after text
      const desired = Math.ceil(max + padding);
      const capPx = Math.min(window.innerWidth * 0.92, 32 * 16, window.innerWidth - 48);
      const finalW = Math.max(0, Math.min(desired, capPx));
      ctrl.style.setProperty('--layers-auto-width', `${finalW}px`);
      ctrl.style.minWidth = `${finalW}px`;
    };
    ensureLayerRows(base);
    ensureLayerRows(overlays);

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
      Default: {
        key: 'default',
        url:
          String(activeTheme || '').toLowerCase() === 'dark'
            ? bases.defaultDark.url
            : bases.defaultLight.url,
      },
      Terrain: { key: 'terrain', url: bases.terrain.url },
      Satellite: { key: 'satellite', url: bases.satellite.url },
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
        // Ensure radios have a stable group name and id for a11y/tools
        if (!input.hasAttribute('name')) input.setAttribute('name', 'basemap');
        const id = `basemap-${m.key}`;
        input.setAttribute('id', id);
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
    // Enforce order: Default, Terrain, Satellite
    const enforceBaseOrder = () => {
      const order = ['Default', 'Terrain', 'Satellite'];
      const labels = Array.from(base.querySelectorAll('label'));
      order.forEach((name) => {
        const node = labels.find((lab) => (lab.textContent || '').trim() === name);
        if (node) base.appendChild(node);
      });
    };
    enforceBaseOrder();

    // Basic a11y labels on overlay rows, no symbology or metadata in this panel
    overlays.querySelectorAll('label').forEach((lab) => {
      const text = (lab.textContent || '').trim();
      const input = lab.querySelector('input[type="checkbox"]');
      if (input) {
        input.setAttribute('aria-label', text);
        // Add stable id/name so audits don't flag missing identifiers
        const norm = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        input.setAttribute('name', `overlay-${norm}`);
        input.setAttribute('id', `overlay-${norm}`);
      }
    });

    // Layer overlay tooltips/ARIA
    const overlayHints = {
      earthquakes: 'Earthquake markers',
      faults: 'Active fault lines',
      plates: 'Plate boundary lines',
      stations: 'Station markers',
    };
    const applyOverlayHints = () => {
      const rows = ctrl.querySelectorAll('.leaflet-control-layers-overlays label');
      rows.forEach((row) => {
        const id = row && row.getAttribute('data-overlay');
        if (!id) return;
        const hint = overlayHints[id];
        if (hint) {
          const text = row.querySelector('.layer-text');
          row.setAttribute('title', hint);
          row.setAttribute('aria-label', `${text?.textContent || id} – ${hint}`);
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

    // Initial annotate+order, then enhance with hints and ensure row wrappers
    ensureLayerRows(base);
    ensureLayerRows(overlays);
    updatePanelWidth();
    annotateOverlayRows();
    enforceOverlayOrder();
    applyOverlayHints();

    // Observe overlay list for changes (e.g., preset switch re-renders children)
    const overlaysObserver = new MutationObserver(() => {
      overlaysObserver.disconnect();
      ensureLayerRows(overlays);
      annotateOverlayRows();
      enforceOverlayOrder();
      applyOverlayHints();
      updatePanelWidth();
      overlaysObserver.observe(overlays, { childList: true, subtree: false });
    });
    overlaysObserver.observe(overlays, { childList: true, subtree: false });

    // Also observe basemap list for delayed mount or theme-driven rebuilds
    const baseObserver = new MutationObserver(() => {
      baseObserver.disconnect();
      ensureLayerRows(base);
      enforceBaseOrder();
      updatePanelWidth();
      baseObserver.observe(base, { childList: true, subtree: false });
    });
    baseObserver.observe(base, { childList: true, subtree: false });

    const onResize = () => {
      updatePanelWidth();
    };
    window.addEventListener('resize', onResize);

    return () => {
      try {
        overlaysObserver.disconnect();
      } catch (_) {}
      try {
        baseObserver.disconnect();
      } catch (_) {}
      try {
        window.removeEventListener('resize', onResize);
      } catch (_) {}
    };
  }, [map, bases, activeTheme]);

  // ---- Tooltip builders moved to OverlayLayers; keep keyboard/ARIA helpers here ----

  // Keep line styles in sync with theme/zoom/overlay state
  useEffect(() => {
    if (!map) return undefined;
    let id = null;
    const schedule = () => {
      cancelAnimationFrame(id);
      id = requestAnimationFrame(restyleOverlays);
    };
    schedule();
    // Update styles continuously during zoom/fly animations for smoother transitions
    map.on('zoom', schedule);
    map.on('zoomend', schedule);
    map.on('baselayerchange', schedule);
    map.on('overlayadd', schedule);
    map.on('overlayremove', schedule);
    return () => {
      cancelAnimationFrame(id);
      map.off('zoom', schedule);
      map.off('zoomend', schedule);
      map.off('baselayerchange', schedule);
      map.off('overlayadd', schedule);
      map.off('overlayremove', schedule);
    };
  }, [map, activeIds, restyleOverlays, activeTheme, activeBase]);

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
          const props = feature && feature.properties;
          const html = buildTooltipFn ? buildTooltipFn(props) : '';
          const usePopup = Boolean(options && options.usePopup);
          const nativeTitleFn = options && options.nativeTitleFn;
          const nativeTitle = nativeTitleFn ? String(nativeTitleFn(props) || '') : '';
          const disableHover = Boolean(options && options.disableHover);
          const disableHoverStyling = Boolean(options && options.disableHoverStyling);
          const applyDomTitle = () => {
            if (!nativeTitle) return false;
            const pathEl = layer.getElement ? layer.getElement() : layer._path || null;
            if (!pathEl) return false;
            try {
              pathEl.setAttribute('title', nativeTitle);
              pathEl.setAttribute('aria-label', nativeTitle);
              return true;
            } catch (_) {
              return false;
            }
          };
          const setContainerTitle = (value) => {
            const container = map?.getContainer?.();
            if (!container) return;
            if (value) {
              if (!Object.prototype.hasOwnProperty.call(container, '__prevTitle')) {
                container.__prevTitle = container.getAttribute('title');
              }
              container.setAttribute('title', value);
              container.__nativeTitleOwner = layer;
            } else if (container.__nativeTitleOwner === layer) {
              const prev = container.__prevTitle;
              if (prev) container.setAttribute('title', prev);
              else container.removeAttribute('title');
              delete container.__prevTitle;
              delete container.__nativeTitleOwner;
            }
          };
          if (html) {
            if (usePopup) {
              layer.bindPopup(html, {
                className: 'feature-popup',
                autoPan: true,
                closeButton: true,
                maxWidth: 280,
              });
              try {
                if (layer._openPopup) {
                  layer.off('click', layer._openPopup, layer);
                  layer.off('keypress', layer._openPopup, layer);
                }
              } catch (_) {}
            } else {
              layer.bindTooltip(html, {
                sticky: true,
                direction: 'top',
                className: 'feature-tooltip',
              });
            }
          }
          applyDomTitle();
          layer.on('add', applyDomTitle);
          const hoverWeightFor = (baseW) =>
            usePopup ? Math.max(baseW + 1.25, baseW * 1.75) : Math.max(baseW + 2.5, baseW * 2.5);

          if (!disableHover) {
            layer.on('mouseover', () => {
              try {
                const el = map?.getContainer?.();
                if (el && hoverClassName) el.classList.add(hoverClassName);
                if (nativeTitle) {
                  applyDomTitle();
                  setContainerTitle(nativeTitle);
                }
                if (!disableHoverStyling) {
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
                }
              } catch (_) {}
            });
          }
          const reset = () => {
            // If tooltip is open (selected), keep selected styling
            const tip = !usePopup && typeof layer.getTooltip === 'function' ? layer.getTooltip() : null;
            const pop = usePopup && typeof layer.getPopup === 'function' ? layer.getPopup() : null;
            const isTipOpen = !!(tip && typeof tip.isOpen === 'function' && tip.isOpen());
            const isPopOpen = !!(pop && typeof pop.isOpen === 'function' && pop.isOpen());
            const open = usePopup ? isPopOpen : isTipOpen;
            if (!disableHoverStyling) {
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
            }
            const el = map?.getContainer?.();
            if (el && hoverClassName) el.classList.remove(hoverClassName);
            if (nativeTitle) setContainerTitle('');
            const pathEl = layer.getElement ? layer.getElement() : layer._path || null;
            if (!disableHoverStyling) {
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
            }
          };
          if (!disableHover) {
            layer.on('mouseout', reset);
          }
          if (usePopup) {
            layer.on('popupclose', reset);
          } else if (!disableHover) {
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
                  if (!disableHoverStyling) {
                    const baseNow = getBase();
                    const baseW = baseNow.weight || 2;
                    const selectedW = hoverWeightFor(baseW);
                    layer.setStyle({ ...baseNow, weight: selectedW, opacity: 1 });
                  }
                  if (layer.bringToFront) layer.bringToFront();
                  const pathEl = layer.getElement ? layer.getElement() : layer._path || null;
                  if (pathEl && !disableHoverStyling) {
                    try { pathEl.classList.add('selected-glow'); } catch (_) {}
                  }
                  if (e && e.latlng && typeof layer.openPopup === 'function') layer.openPopup(e.latlng);
                  else if (typeof layer.openPopup === 'function') layer.openPopup();
                }
              } catch (_) {}
            };
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
              if (!disableHoverStyling) {
                const pathEl = layer.getElement ? layer.getElement() : layer._path || null;
                if (pathEl) {
                  try {
                    pathEl.classList.remove('selected-glow');
                  } catch (_) {}
                }
                try {
                  layer.setStyle(getBase());
                } catch (_) {}
              }
            });
          } else {
            layer.on('popupclose', () => {
              if (!disableHoverStyling) {
                const pathEl = layer.getElement ? layer.getElement() : layer._path || null;
                if (pathEl) {
                  try { pathEl.classList.remove('selected-glow'); } catch (_) {}
                }
                try { layer.setStyle(getBase()); } catch (_) {}
              }
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
      <BasemapLayers
        bases={bases}
        registerBaseLayer={registerBaseLayer}
        activeTheme={activeTheme}
        activeBase={activeBase}
      />
      <OverlayLayers
        setFaultsRef={setFaultsRef}
        setPlatesRef={setPlatesRef}
        faultsStyleFor={faultsStyleFor}
        platesStyleFor={platesStyleFor}
        makeOnEachWith={makeOnEachWith}
      />
      {/* Inject external overlays from parent (e.g., Stations, Earthquakes) */}
      {children}
    </LayersControl>
  );
}
