import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { useMap } from 'react-leaflet';
import { trackEvent } from '../analytics';

// Context that tracks registered overlay layers (Leaflet layer instance → id)
// and which ones are currently active on the map.
/**
 * Provides overlay registration and active-state tracking for map layers.
 * Exposes `registerLayer`, `unregisterLayer`, `activeIds` and `toggleOverlay`.
 */
const OverlayStateContext = createContext(null);

export function OverlayStateProvider({ children }) {
  const map = useMap();
  const registryRef = useRef(new WeakMap()); // LeafletLayer -> id
  const idToLayerRef = useRef(new Map()); // id -> LeafletLayer
  const [activeIds, setActiveIds] = useState(() => new Set());
  const readyRef = useRef(false);

  useEffect(() => {
    const id = setTimeout(() => {
      readyRef.current = true;
    }, 0);
    return () => clearTimeout(id);
  }, []);

  // Helper: resolve id for a given Leaflet layer using the registry
  const idForLayer = (layer) => registryRef.current.get(layer);

  const registerLayer = useCallback(
    (id, layer) => {
      if (!layer) return;
      registryRef.current.set(layer, id);
      idToLayerRef.current.set(id, layer);
      // initialize active state for this layer if needed
      if (map && map.hasLayer(layer)) {
        setActiveIds((prev) => {
          if (prev.has(id)) return prev; // no-op if unchanged
          const next = new Set(prev);
          next.add(id);
          return next;
        });
      }
    },
    [map],
  );

  const unregisterLayer = useCallback((layer) => {
    if (!layer) return;
    const id = idForLayer(layer);
    if (id) {
      setActiveIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      idToLayerRef.current.delete(id);
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
      if (readyRef.current) {
        try {
          trackEvent('layers_toggle', { action: 'overlay_toggle', overlay_id: id, visible: true });
        } catch (_) {}
      }
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
       if (readyRef.current) {
         try {
           trackEvent('layers_toggle', { action: 'overlay_toggle', overlay_id: id, visible: false });
         } catch (_) {}
       }
    };

    map.on('overlayadd', onAdd);
    map.on('overlayremove', onRemove);
    return () => {
      map.off('overlayadd', onAdd);
      map.off('overlayremove', onRemove);
    };
  }, [map]);

  const toggleOverlay = useCallback(
    (id) => {
      const layer = idToLayerRef.current.get(id);
      if (!map || !layer) return;
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      } else {
        map.addLayer(layer);
      }
    },
    [map],
  );

  const value = useMemo(
    () => ({ activeIds, registerLayer, unregisterLayer, toggleOverlay }),
    [activeIds, registerLayer, unregisterLayer, toggleOverlay],
  );

  return <OverlayStateContext.Provider value={value}>{children}</OverlayStateContext.Provider>;
}

export function useOverlayState() {
  const ctx = useContext(OverlayStateContext);
  if (!ctx) throw new Error('useOverlayState must be used within OverlayStateProvider');
  return ctx;
}
