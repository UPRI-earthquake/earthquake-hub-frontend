import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import InfoTooltip from './InfoTooltip';
import { trackEvent } from '../analytics';

const AttributionIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 10.5v6" />
    <circle cx="12" cy="7.25" r="0.85" fill="currentColor" />
  </svg>
);

const equalEntries = (a, b) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const collectActiveAttributions = (ctrl) => {
  try {
    const dict = (ctrl && ctrl._attributions) || {};
    return Object.keys(dict)
      .filter((entry) => dict[entry])
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  } catch (_) {
    return [];
  }
};

function AttributionList({ entries }) {
  if (!entries || entries.length === 0) {
    return <span className="map-attribution-empty">No active attributions.</span>;
  }
  return (
    <ul className="map-attribution-list">
      {entries.map((entry, index) => (
        <li
          // Attribution strings are controlled by known map providers and overlay configs.
          key={`attr-${index}-${entry.slice(0, 24)}`}
          dangerouslySetInnerHTML={{ __html: entry }}
        />
      ))}
    </ul>
  );
}

/**
 * Replaces Leaflet's collapsing attribution footer with a tooltip-style control.
 * Source entries stay dynamic via Leaflet attribution bookkeeping.
 */
export default function AttributionControl({ position = 'bottomright' }) {
  const map = useMap();
  const containerRef = useRef(null);
  const [attributionEntries, setAttributionEntries] = useState([]);
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!map || !map.attributionControl) return undefined;
    const ctrl = map.attributionControl;
    ctrl.setPrefix(false);

    const hiddenEl = ctrl._container; // Leaflet internal control element
    if (hiddenEl) {
      hiddenEl.classList.add('leaflet-attribution-hidden');
      hiddenEl.setAttribute('aria-hidden', 'true');
    }

    const syncAttributions = () => {
      const next = collectActiveAttributions(ctrl);
      setAttributionEntries((prev) => (equalEntries(prev, next) ? prev : next));
    };

    // Patch Leaflet's internal attribution update path so dynamic changes remain in sync.
    const originalUpdate = ctrl._update;
    if (typeof originalUpdate === 'function') {
      ctrl._update = function patchedUpdate(...args) {
        const result = originalUpdate.apply(this, args);
        syncAttributions();
        return result;
      };
    }

    const Control = L.Control.extend({
      onAdd: () => {
        const div = L.DomUtil.create('div', 'leaflet-control custom-attribution-control');
        div.setAttribute('aria-label', 'Attributions');
        div.setAttribute('role', 'group');
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);
        containerRef.current = div;
        return div;
      },
    });

    const customCtrl = new Control({ position });
    customCtrl.addTo(map);
    forceRender((n) => n + 1);

    map.on('baselayerchange', syncAttributions);
    map.on('overlayadd', syncAttributions);
    map.on('overlayremove', syncAttributions);
    map.on('layeradd', syncAttributions);
    map.on('layerremove', syncAttributions);

    syncAttributions();

    return () => {
      map.off('baselayerchange', syncAttributions);
      map.off('overlayadd', syncAttributions);
      map.off('overlayremove', syncAttributions);
      map.off('layeradd', syncAttributions);
      map.off('layerremove', syncAttributions);
      if (typeof originalUpdate === 'function') ctrl._update = originalUpdate;
      try {
        if (hiddenEl) {
          hiddenEl.classList.remove('leaflet-attribution-hidden');
          hiddenEl.removeAttribute('aria-hidden');
        }
      } catch (_) {}
      try {
        customCtrl.remove();
      } catch (_) {}
      containerRef.current = null;
    };
  }, [map, position]);

  if (!containerRef.current) return null;

  return ReactDOM.createPortal(
    <div className="map-attribution-shell">
      <InfoTooltip
        label="Attributions"
        title="Attributions"
        triggerClassName="map-attribution-trigger"
        tooltipClassName="map-attribution-tooltip"
        bodyClassName="map-attribution-body"
        icon={<AttributionIcon className="map-attribution-icon" />}
        onToggle={(isOpen) => {
          try {
            trackEvent('attribution_toggle', { state: isOpen ? 'open' : 'closed' });
          } catch (_) {}
        }}
      >
        <AttributionList entries={attributionEntries} />
      </InfoTooltip>
    </div>,
    containerRef.current,
  );
}
