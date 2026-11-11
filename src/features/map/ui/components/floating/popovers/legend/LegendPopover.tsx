import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { buildThemeTokens, themeFromMapContainer, zoomFromMap } from '../../../../../services/mapStyles';
import '../../../../styles/floating/popovers/legend/LegendPopover.css';
import { trackEvent } from '@/analytics';
import { useOverlayState } from '../../../../../hooks/useOverlayState';
import LegendContent from './LegendContent';



export default function LegendPopover() {
  const position = "bottomright";
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
    let mo = null;
    try {
      mo = new MutationObserver(applyTheme);
      mo.observe(el, { attributes: true, attributeFilter: ['data-basemap-theme'] });
    } catch (_) {}
    return () => {
      map.off('baselayerchange', applyTheme);
      map.off('zoomend', applyZoom);
      try { mo && mo.disconnect(); } catch (_) {}
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
      try {
        if (e && e.target && typeof e.target.closest === 'function') {
          if (e.target.closest('[data-info-tooltip="true"]')) return;
        }
      } catch (_) {}
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