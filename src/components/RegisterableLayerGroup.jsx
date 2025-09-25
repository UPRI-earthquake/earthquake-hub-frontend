import React, { forwardRef, useRef, useEffect } from 'react';
import { LayerGroup } from 'react-leaflet';
import { useOverlayState } from './OverlayStateContext';

/**
 * LayerGroup that registers itself with the overlay legend sync under a given overlayId.
 */
const RegisterableLayerGroup = forwardRef(function RegisterableLayerGroup(
  { overlayId, children },
  ref,
) {
  const { registerLayer, unregisterLayer } = useOverlayState();
  const innerRef = useRef(null);

  useEffect(() => {
    const node = innerRef.current;
    const layer = node && (node.leafletElement || node); // compat for react-leaflet variants
    if (layer) registerLayer(overlayId, layer);
    return () => {
      if (layer) unregisterLayer(layer);
    };
  }, [overlayId, registerLayer, unregisterLayer]);

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

  return <LayerGroup ref={setRef}>{children}</LayerGroup>;
});

export default RegisterableLayerGroup;
