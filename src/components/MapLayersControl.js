import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { LayersControl, TileLayer, useMap } from 'react-leaflet';
import { BASEMAPS, OVERLAYS, styles } from '../config/mapLayers';
import './mapLayers.css';
import RemoteGeoJSONOverlay from './RemoteGeoJSONOverlay';
import { useOverlayState } from './OverlayStateContext';

const { BaseLayer, Overlay } = LayersControl;

export default function MapLayersControl({ children }) {
  const map = useMap();
  const { registerLayer } = useOverlayState();
  // Memoize basemap provider props so layers are not recreated
  const bases = useMemo(
    () => ({
      osm: BASEMAPS.OSM_Standard(),
      positron: BASEMAPS.Carto_Positron(),
      dark: BASEMAPS.Carto_DarkMatter(),
      esri: BASEMAPS.Esri_WorldImagery(),
    }),
    []
  );

  const pop = useMemo(() => OVERLAYS.PopulationDensity_XYZ(), []);

  // Refs for registering overlays with the legend sync
  const faultsRef = useRef(null);
  const platesRef = useRef(null);
  const popRef = useRef(null);

  const setFaultsRef = useCallback((node) => {
    const layer = node && (node.leafletElement || node);
    faultsRef.current = layer;
    if (layer) registerLayer('faults', layer);
  }, [registerLayer]);

  const setPlatesRef = useCallback((node) => {
    const layer = node && (node.leafletElement || node);
    platesRef.current = layer;
    if (layer) registerLayer('plates', layer);
  }, [registerLayer]);

  const setPopRef = useCallback((node) => {
    const layer = node && (node.leafletElement || node);
    popRef.current = layer;
    if (layer) registerLayer('population', layer);
  }, [registerLayer]);

  // Ensure Layers opens/closes on click (not hover) and add tooltip/ARIA
  useEffect(() => {
    if (!map) return undefined;
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
      }
      // Disable hover expand/collapse by stopping Leaflet's mouseover/mouseout handlers
      if (ctrl) {
        const stop = (e) => { e.stopImmediatePropagation(); e.stopPropagation(); };
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
          const getFocusables = () => list.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const focusFirst = () => {
            const f = getFocusables();
            const first = f[0];
            const title = list.querySelector('.layers-title');
            if (title && title.focus) title.focus();
            else if (first && first.focus) first.focus();
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
      }
    }, 0);
    return () => clearTimeout(id);
  }, [map]);

  // Keyboard shortcuts: L toggles Layers; Esc collapses only if focus is inside
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      const tag = (t && t.tagName) || '';
      const editable =
        (t && (t.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'));
      if (editable) return;

      const container = map?.getContainer?.() || document;
      const ctrl = container && container.querySelector('.leaflet-control-layers');
      const btn  = container && container.querySelector('.leaflet-control-layers-toggle');
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


  // Track basemap theme (light | dark | imagery) and set on map container for CSS
  useEffect(() => {
    if (!map) return undefined;
    const el = map.getContainer();
    const themeForLayer = (layer) => {
      const url = (layer && layer._url) || '';
      const lc = url.toLowerCase();
      if (lc.includes('cartocdn') && lc.includes('dark')) return 'dark';
      if (lc.includes('worldimagery') || lc.includes('world_imagery') || lc.includes('arcgisonline') || lc.includes('esri')) return 'imagery';
      // treat others (osm, positron) as light
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
      } catch (_) {}
    };
    setThemeFromActiveBase();
    const onBase = (e) => {
      el.setAttribute('data-basemap-theme', themeForLayer(e.layer));
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
    map.on('zoomend', setZoomAttr);
    return () => map.off('zoomend', setZoomAttr);
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
      title.textContent = 'Map layers';
      const tools = document.createElement('div');
      tools.className = 'layers-tools';
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'layers-close';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.textContent = '×';
      tools.appendChild(closeBtn);
      header.appendChild(title);
      header.appendChild(tools);
      list.insertBefore(header, list.firstChild);

      // Close collapses the control
      closeBtn.addEventListener('click', (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        ctrl.classList.remove('leaflet-control-layers-expanded');
        const btn2 = ctrl.querySelector('.leaflet-control-layers-toggle');
        if (btn2) btn2.setAttribute('aria-expanded', 'false');
      }, { passive: false });

      // Make header focusable target
      title.setAttribute('tabindex', '-1');
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
      'OSM Standard': { key: 'osm', url: bases.osm.url },
      'CartoDB Positron': { key: 'positron', url: bases.positron.url },
      'CartoDB DarkMatter': { key: 'dark', url: bases.dark.url },
      'Esri WorldImagery': { key: 'esri', url: bases.esri.url },
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

    // Annotate overlay labels for swatches
    const overlayMap = {
      'Fault Lines': 'faults',
      'Plate Boundaries': 'plates',
      'Population Density': 'population',
      'Earthquakes': 'earthquakes',
      'Stations': 'stations',
    };
    overlays.querySelectorAll('label').forEach((lab) => {
      const text = (lab.textContent || '').trim();
      const k = overlayMap[text];
      if (!k) return;
      lab.dataset.overlay = k;
      lab.classList.add('is-overlay');
      const input = lab.querySelector('input[type="checkbox"]');
      if (input) input.setAttribute('aria-label', text);
    });

    return undefined;
  }, [map, bases]);

  return (
    <LayersControl position="topright" collapsed>
      {/* Basemaps */}
      <BaseLayer name="OSM Standard">
        <TileLayer url={bases.osm.url} {...bases.osm.options} />
      </BaseLayer>

      <BaseLayer checked name="CartoDB Positron">
        <TileLayer url={bases.positron.url} {...bases.positron.options} />
      </BaseLayer>

      <BaseLayer name="CartoDB DarkMatter">
        <TileLayer url={bases.dark.url} {...bases.dark.options} />
      </BaseLayer>

      <BaseLayer name="Esri WorldImagery">
        <TileLayer url={bases.esri.url} {...bases.esri.options} />
      </BaseLayer>

      {/* Overlays */}
      <Overlay name="Fault Lines">
        <RemoteGeoJSONOverlay
          ref={setFaultsRef}
          url="https://cdn.jsdelivr.net/gh/GEMScienceTools/gem-global-active-faults@master/geojson/gem_active_faults_harmonized.geojson"
          style={styles.faults}
          // Philippines bbox (lon/lat): 116..127E, 4.5..21.5N
          filterBbox={[116, 4.5, 127, 21.5]}
          lineOnly
        />
      </Overlay>

      <Overlay name="Plate Boundaries">
        <RemoteGeoJSONOverlay
          ref={setPlatesRef}
          url="https://cdn.jsdelivr.net/gh/fraxen/tectonicplates@master/GeoJSON/PB2002_boundaries.json"
          style={styles.plates}
          worldCopies
          lineOnly
        />
      </Overlay>

      {pop && pop.url ? (
        <Overlay name="Population Density">
          <TileLayer ref={setPopRef} url={pop.url} {...(pop.options || {})} />
        </Overlay>
      ) : null}

      {/* Inject external overlays from parent (e.g., Stations, Earthquakes) */}
      {children}
    </LayersControl>
  );
}
