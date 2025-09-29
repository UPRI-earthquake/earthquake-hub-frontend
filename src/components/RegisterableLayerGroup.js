import React, { forwardRef, useEffect, useRef } from 'react';
import { LayerGroup, useMap } from 'react-leaflet';
import { useOverlayState } from './OverlayStateContext';

// LayerGroup that registers itself with the overlay legend sync under a given overlayId
const RegisterableLayerGroup = forwardRef(function RegisterableLayerGroup(
  { overlayId, children },
  ref
) {
  const map = useMap();
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

  // Defensive: when this overlay layer is re-added to the map via the LayersControl,
  // clear any stale Leaflet children that might have been left by third-party states.
  // React will immediately repopulate the group with the current children.
  useEffect(() => {
    if (!map) return undefined;
    const node = innerRef.current;
    const layer = node && (node.leafletElement || node);
    if (!layer) return undefined;
    const onOverlayAdd = (e) => {
      if (e && e.layer === layer && typeof layer.clearLayers === 'function') {
        try { layer.clearLayers(); } catch (_) {}
      }
    };
    map.on('overlayadd', onOverlayAdd);
    return () => { map.off('overlayadd', onOverlayAdd); };
  }, [map]);

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
