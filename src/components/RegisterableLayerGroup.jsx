import React, { forwardRef, useRef, useEffect } from 'react';
import { LayerGroup } from 'react-leaflet';
import { useOverlayState } from './OverlayStateContext';

/**
 * LayerGroup that registers itself with the overlay legend sync under a given overlayId.
 */
const RegisterableLayerGroup = forwardRef(function RegisterableLayerGroup(
  { overlayId, children, clearOnRemove = false, ...layerProps },
  ref,
) {
  const { registerLayer, unregisterLayer } = useOverlayState();
  const innerRef = useRef(null);

  useEffect(() => {
    const node = innerRef.current;
    const layer = node && (node.leafletElement || node); // compat for react-leaflet variants
    if (layer) registerLayer(overlayId, layer);
    // Optionally clear inner layers when this overlay is removed from the map.
    // This avoids re-attaching stale markers after users toggle the overlay.
    let detach = null;
    if (layer && clearOnRemove && typeof layer.on === 'function') {
      const onRemove = () => {
        try {
          if (typeof layer.clearLayers === 'function') layer.clearLayers();
        } catch (_) {}
      };
      layer.on('remove', onRemove);
      detach = () => layer.off('remove', onRemove);
    }
    return () => {
      try { detach && detach(); } catch (_) {}
      if (layer) unregisterLayer(layer);
    };
  }, [overlayId, registerLayer, unregisterLayer, clearOnRemove]);

  // Note: Avoid clearing layers on overlay re-add; React-Leaflet will remount
  // children correctly. Forcibly clearing here caused stations to disappear
  // when toggling the overlay back on.

  // Pass-through ref support
  const setRef = (node) => {
    innerRef.current = node;
    if (!ref) return;
    if (typeof ref === 'function') ref(node);
    else ref.current = node; // eslint-disable-line no-param-reassign
  };

  return (
    <LayerGroup ref={setRef} {...layerProps}>
      {children}
    </LayerGroup>
  );
});

export default RegisterableLayerGroup;
