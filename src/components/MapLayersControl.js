import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { LayersControl, TileLayer, useMap } from 'react-leaflet';
import { BASEMAPS, OVERLAYS, styles } from '../config/mapLayers';
import './mapLayers.css';
import RemoteGeoJSONOverlay from './RemoteGeoJSONOverlay';
import { useOverlayState } from './OverlayStateContext';
import { getLastUpdated, partsForCdnUrl } from '../utils/lastUpdated';
import { DATASETS } from '../config/datasets';

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
    // Heuristic detection by layer URL/name/attribution to avoid provider-specific misses
    const themeForLayer = (layer, nameHint = '') => {
      const url = (layer && (layer._url || (layer.options && layer.options.url))) || '';
      const attr = (layer && typeof layer.getAttribution === 'function' && layer.getAttribution()) || (layer && layer.options && layer.options.attribution) || '';
      const lc = String(url).toLowerCase();
      const la = String(attr).toLowerCase();
      const ln = String(nameHint).toLowerCase();

      // Imagery (Esri Satellite and similar)
      if (/worldimagery|world_imagery|arcgisonline|esri|satellite|imagery/.test(lc) || /esri|imagery|satellite/.test(la) || /satellite|imagery/.test(ln)) {
        return 'imagery';
      }

      // Dark themes (Carto DarkMatter, variants, or other providers)
      const darkByUrlPair = /cartocdn|cartodb|carto/.test(lc) && /dark/.test(lc);
      const darkByToken   = /darkmatter|dark_all|dark-matter/.test(lc);
      const darkByName    = /dark/.test(ln);
      const darkByAttrib  = /carto/.test(la) && /dark/.test(la);
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
      } catch (_) {}
    };
    setThemeFromActiveBase();
    const onBase = (e) => {
      el.setAttribute('data-basemap-theme', themeForLayer(e.layer, e && e.name));
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
      closeBtn.addEventListener('click', (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        ctrl.classList.remove('leaflet-control-layers-expanded');
        const btn2 = ctrl.querySelector('.leaflet-control-layers-toggle');
        if (btn2) btn2.setAttribute('aria-expanded', 'false');
      }, { passive: false });

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

    // Add/update "Last updated" metadata below the label text for specific overlays
    const targets = [
      { key: DATASETS.FAULTS.key, label: DATASETS.FAULTS.label, meta: partsForCdnUrl(DATASETS.FAULTS.cdnUrl) },
      { key: DATASETS.PLATES.key, label: DATASETS.PLATES.label, meta: partsForCdnUrl(DATASETS.PLATES.cdnUrl) },
    ];

    const renderMeta = (lab, result) => {
      if (!lab) return;
      let row = lab.querySelector('.overlay-meta');
      if (!row) {
        row = document.createElement('div');
        row.className = 'overlay-meta';
        row.setAttribute('role', 'status');
        row.setAttribute('aria-live', 'polite');
        lab.appendChild(row);
      }
      // Clear and rebuild contents for accessibility
      row.innerHTML = '';
      const text = document.createElement('span');
      text.className = 'meta-text';
      const src = result?.source || 'unknown';
      const display = result?.displayDate || 'Unknown';
      text.textContent = `Last updated: ${display}`;
      if (result?.tooltip) text.title = result.tooltip;
      text.setAttribute('aria-label', result?.tooltip || `Last updated: ${display}`);
      row.appendChild(text);
      if (src === 'github' && result?.commitUrl && result?.commitSha) {
        const sep = document.createElement('span');
        sep.textContent = ' · ';
        row.appendChild(sep);
        const a = document.createElement('a');
        a.href = result.commitUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = result.commitSha;
        a.setAttribute('aria-label', `View commit ${result.commitSha} on GitHub`);
        row.appendChild(a);
      } else if (src === 'cdn') {
        const warn = document.createElement('span');
        warn.className = 'meta-fallback';
        warn.setAttribute('title', 'From CDN Last-Modified header; may not match repo history');
        warn.setAttribute('aria-label', 'From CDN Last-Modified header');
        warn.textContent = ' (from CDN header)';
        row.appendChild(warn);
      } else if (src === 'unknown') {
        const warn = document.createElement('span');
        warn.className = 'meta-fallback';
        warn.setAttribute('title', 'Last updated is unknown; GitHub and CDN metadata unavailable');
        warn.setAttribute('aria-label', 'Last updated unknown');
        warn.textContent = ' ⚠ (unknown)';
        row.appendChild(warn);
      }
    };

    const updateAll = async () => {
      for (const t of targets) {
        const lab = overlays.querySelector(`label[data-overlay="${t.key}"]`);
        if (!lab) continue;
        try {
          // Render a placeholder immediately for a11y
          renderMeta(lab, null);
          const res = await getLastUpdated(t.meta);
          renderMeta(lab, res);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('Last updated fetch failed for', t.key, e);
          renderMeta(lab, { source: 'unknown' });
        }
      }
    };
    updateAll();

    return undefined;
  }, [map, bases]);

  // ---- Tooltip builders for overlays ----
  const parseTriple = useCallback((val) => {
    const s = String(val == null ? '' : val);
    const m = s.match(/\(?\s*([+-]?\d*\.?\d+)?\s*,\s*([+-]?\d*\.?\d+)?\s*,\s*([+-]?\d*\.?\d+)?\s*\)?/);
    if (!m) return null;
    const nums = m.slice(1).map((x) => (x == null || x === '' ? null : parseFloat(x)));
    return nums; // [center, min, max]
  }, []);

  const escapeHtml = useCallback((txt) => {
    return String(txt == null ? '' : txt)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }, []);

  const buildFaultTooltip = useCallback((props) => {
    if (!props) return '';
    const name = props.name || 'Unnamed Fault';
    const slipType = props.slip_type || props.slipType || '';
    const slip = parseTriple(props.net_slip_rate);
    const dip = parseTriple(props.average_dip);
    const rake = parseTriple(props.average_rake);
    const dipDir = props.dip_dir || props.dip_direction || '';
    const usd = parseTriple(props.upper_seis_depth);
    const lsd = parseTriple(props.lower_seis_depth);

    const fmtNum = (n, unit = '') => (typeof n === 'number' && !Number.isNaN(n) ? `${n}${unit}` : null);
    const slipCenter = fmtNum(slip && slip[0], ' mm/yr');
    const slipMin = fmtNum(slip && slip[1], '');
    const slipMax = fmtNum(slip && slip[2], '');
    const slipStr = slipCenter ? (slipMin && slipMax ? `${slipCenter} (${slipMin}–${slipMax})` : slipCenter) : null;

    const dipStr = fmtNum(dip && dip[0], '°');
    const rakeStr = fmtNum(rake && rake[0], '°');
    const usdKm = fmtNum(usd && usd[0], ' km');
    const lsdKm = fmtNum(lsd && lsd[0], ' km');
    const depthStr = usdKm && lsdKm ? `${usdKm} – ${lsdKm}` : (usdKm || lsdKm);

    const rows = [];
    if (slipType) rows.push(`<div class="ft-row"><span class="ft-k">Slip Type</span><span class="ft-v">${escapeHtml(slipType)}</span></div>`);
    if (slipStr) rows.push(`<div class="ft-row"><span class="ft-k">Slip Rate</span><span class="ft-v">${escapeHtml(slipStr)}</span></div>`);
    if (dipStr || dipDir) rows.push(`<div class="ft-row"><span class="ft-k">Dip</span><span class="ft-v">${escapeHtml([dipStr, dipDir].filter(Boolean).join(' '))}</span></div>`);
    if (rakeStr) rows.push(`<div class="ft-row"><span class="ft-k">Rake</span><span class="ft-v">${escapeHtml(rakeStr)}</span></div>`);
    if (depthStr) rows.push(`<div class="ft-row"><span class="ft-k">Seis. Depth</span><span class="ft-v">${escapeHtml(depthStr)}</span></div>`);

    return `
      <div class="ft-tip">
        <div class="ft-title">${escapeHtml(name)}</div>
        ${rows.join('')}
      </div>
    `;
  }, [escapeHtml, parseTriple]);

  const buildPlateTooltip = useCallback((props) => {
    if (!props) return '';
    const a = props.PlateA || '';
    const b = props.PlateB || '';
    const name = props.Name || (a && b ? `${a}-${b}` : 'Plate Boundary');
    const type = props.Type || '';
    const src = props.Source || '';
    const rows = [];
    if (a || b) rows.push(`<div class="ft-row"><span class="ft-k">Plates</span><span class="ft-v">${escapeHtml([a, b].filter(Boolean).join(' – '))}</span></div>`);
    if (type) rows.push(`<div class="ft-row"><span class="ft-k">Type</span><span class="ft-v">${escapeHtml(type)}</span></div>`);
    if (src) rows.push(`<div class="ft-row"><span class="ft-k">Source</span><span class="ft-v">${escapeHtml(src)}</span></div>`);
    return `
      <div class="ft-tip">
        <div class="ft-title">${escapeHtml(name)}</div>
        ${rows.join('')}
      </div>
    `;
  }, [escapeHtml]);

  const makeOnEachWith = useCallback((baseStyle, buildTooltipFn) => {
    const baseInteractiveStyle = { ...baseStyle, interactive: true };
    return (feature, layer) => {
      try {
        const html = buildTooltipFn(feature && feature.properties);
        if (html) {
          layer.bindTooltip(html, {
            sticky: true,
            direction: 'top',
            className: 'feature-tooltip',
          });
        }
        layer.on('mouseover', () => {
          try {
            layer.setStyle({ ...baseInteractiveStyle, weight: (baseStyle.weight || 2) + 1.5, opacity: 1 });
            if (layer.bringToFront) layer.bringToFront();
          } catch (_) {}
        });
        layer.on('mouseout', () => {
          try { layer.setStyle(baseInteractiveStyle); } catch (_) {}
        });
      } catch (_) {}
    };
  }, []);

  return (
    <LayersControl position="topright" collapsed>
      {/* Basemaps */}
      <BaseLayer name="Standard Map">
        <TileLayer url={bases.osm.url} {...bases.osm.options} />
      </BaseLayer>

      <BaseLayer checked name="Light Map">
        <TileLayer url={bases.positron.url} {...bases.positron.options} />
      </BaseLayer>

      <BaseLayer name="Dark Map">
        <TileLayer url={bases.dark.url} {...bases.dark.options} />
      </BaseLayer>

      <BaseLayer name="Satellite View">
        <TileLayer url={bases.esri.url} {...bases.esri.options} />
      </BaseLayer>

      {/* Overlays */}
      <Overlay name="Fault Lines">
        <RemoteGeoJSONOverlay
          ref={setFaultsRef}
          url={DATASETS.FAULTS.cdnUrl}
          style={styles.faults}
          // Philippines bbox (lon/lat): 116..127E, 4.5..21.5N
          filterBbox={[116, 4.5, 127, 21.5]}
          lineOnly
          interactive
          onEachFeature={makeOnEachWith(styles.faults, buildFaultTooltip)}
        />
      </Overlay>

      <Overlay name="Plate Boundaries">
        <RemoteGeoJSONOverlay
          ref={setPlatesRef}
          url={DATASETS.PLATES.cdnUrl}
          style={styles.plates}
          worldCopies
          lineOnly
          interactive
          onEachFeature={makeOnEachWith(styles.plates, buildPlateTooltip)}
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
