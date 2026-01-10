import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { trackEvent } from '../analytics';

/**
 * Removes the default Leaflet attribution prefix for a cleaner footer.
 * @returns {null}
 */
export default function AttributionControl() {
  const map = useMap();
  useEffect(() => {
    if (!map || !map.attributionControl) return;
    const ctrl = map.attributionControl;
    ctrl.setPrefix(false);

    // Enhance the default attribution into a compact, collapsible control
    const el = ctrl._container; // Leaflet internal; stable for control containers
    if (!el) return;

    // Idempotent DOM enhancement that survives Leaflet's innerHTML updates
    const ensureEnhanced = () => {
      let btn = el.querySelector('button.attr-toggle');
      let panel = el.querySelector('span.attr-text');
      if (!panel) {
        panel = document.createElement('span');
        panel.className = 'attr-text';
        // Move all non-toggle children into panel
        const toMove = [];
        el.childNodes.forEach((n) => {
          if (!(n.nodeType === 1 && n.classList && n.classList.contains('attr-toggle'))) {
            toMove.push(n);
          }
        });
        toMove.forEach((n) => panel.appendChild(n));
        el.appendChild(panel);
      }
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'attr-toggle';
        btn.setAttribute('aria-label', 'Attribution');
        btn.setAttribute('title', 'Attribution');
        btn.innerHTML =
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="8"></line></svg>';
        el.insertBefore(btn, panel);
        // Wire events once
        const key = 'map:attr:collapsed';
        const toggle = (e) => {
          e && e.preventDefault && e.preventDefault();
          const collapsed = el.classList.toggle('is-collapsed');
          try { sessionStorage.setItem(key, collapsed ? '1' : '0'); } catch (_) {}
          try { btn.focus(); } catch (_) {}
          try {
            trackEvent('attribution_toggle', { state: collapsed ? 'closed' : 'open' });
          } catch (_) {}
        };
        btn.addEventListener('click', toggle);
        btn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') toggle(e);
        });
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && !el.classList.contains('is-collapsed')) toggle(e);
        });
      }
      return { btn: el.querySelector('button.attr-toggle'), panel: el.querySelector('span.attr-text') };
    };

    // Initial enhance
    const { btn } = ensureEnhanced();

    // Restore collapsed state from sessionStorage
    const key = 'map:attr:collapsed';
    // Default: expanded unless user previously collapsed
    let collapsed = false;
    try {
      const v = sessionStorage.getItem(key);
      if (v === '1') collapsed = true;
    } catch (_) {}
    el.classList.toggle('is-collapsed', collapsed);

    // Update ARIA label and tooltip based on state
    const setA11y = () => {
      const collapsed = el.classList.contains('is-collapsed');
      const lbl = collapsed ? 'Show attribution' : 'Hide attribution';
      try {
        btn?.setAttribute('aria-label', lbl);
        btn?.setAttribute('title', lbl);
        btn?.setAttribute('aria-expanded', String(!collapsed));
      } catch (_) {}
    };
    setA11y();

    // Keep ARIA in sync on class changes
    const moState = new MutationObserver(setA11y);
    moState.observe(el, { attributes: true, attributeFilter: ['class'] });

    // Observe and re‑enhance when Leaflet rewrites innerHTML
    const mo = new MutationObserver(() => ensureEnhanced());
    mo.observe(el, { childList: true, subtree: false });

    return () => {
      try { mo.disconnect(); } catch (_) {}
      try { moState.disconnect(); } catch (_) {}
    };
  }, [map]);
  return null;
}
