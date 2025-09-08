import React, { createContext, useContext, useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useMap } from 'react-leaflet';

// Context that tracks registered overlay layers (Leaflet layer instance → id)
// and which ones are currently active on the map.
const OverlayStateContext = createContext(null);

export function OverlayStateProvider({ children }) {
  const map = useMap();
  const registryRef = useRef(new WeakMap()); // LeafletLayer -> id
  const [activeIds, setActiveIds] = useState(() => new Set());

  // Helper: resolve id for a given Leaflet layer using the registry
  const idForLayer = (layer) => registryRef.current.get(layer);

  const registerLayer = useCallback((id, layer) => {
    if (!layer) return;
    registryRef.current.set(layer, id);
    // initialize active state for this layer if needed
    if (map && map.hasLayer(layer)) {
      setActiveIds((prev) => {
        if (prev.has(id)) return prev; // no-op if unchanged
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }
  }, [map]);

  const unregisterLayer = useCallback((layer) => {
    if (!layer) return;
    const id = idForLayer(layer);
    if (id) {
      setActiveIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
    registryRef.current.delete(layer);
  }, []);

  // Listen to Leaflet overlay add/remove events to keep active set in sync
  useEffect(() => {
    if (!map) return undefined;
    const onAdd = (e) => {
      const id = idForLayer(e.layer);
      if (!id) return;
      setActiveIds((prev) => {
        if (prev.has(id)) return prev; // stable if already present
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    };
    const onRemove = (e) => {
      const id = idForLayer(e.layer);
      if (!id) return;
      setActiveIds((prev) => {
        if (!prev.has(id)) return prev; // stable if already absent
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    };

    map.on('overlayadd', onAdd);
    map.on('overlayremove', onRemove);
    return () => {
      map.off('overlayadd', onAdd);
      map.off('overlayremove', onRemove);
    };
  }, [map]);

  const value = useMemo(() => ({ activeIds, registerLayer, unregisterLayer }), [activeIds, registerLayer, unregisterLayer]);

  return (
    <OverlayStateContext.Provider value={value}>{children}</OverlayStateContext.Provider>
  );
}

export function useOverlayState() {
  const ctx = useContext(OverlayStateContext);
  if (!ctx) throw new Error('useOverlayState must be used within OverlayStateProvider');
  return ctx;
}
