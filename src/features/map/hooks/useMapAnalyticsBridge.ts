import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { trackEvent } from "@/analytics";

export default function useMapAnalyticsBridge() {
  const map = useMap();
  const ctrlRef = useRef({ dragging: false });

  useEffect(() => {
    if (!map) return undefined;

    const centerPayload = () => {
      try {
        const center = map.getCenter();
        return {
          center_lat: Number(center.lat.toFixed(4)),
          center_lng: Number(center.lng.toFixed(4)),
        };
      } catch (_) {
        return {};
      }
    };

    const emitMapInteraction = (action, extra = {}) => {
      try {
        trackEvent('map_interaction', {
          action,
          zoom_level: typeof map.getZoom === 'function' ? map.getZoom() : undefined,
          ...centerPayload(),
          ...extra,
        });
      } catch (_) {}
    };

    const onZoomEnd = (e) => {
      emitMapInteraction('zoom', {
        source: e && e.originalEvent ? 'user' : 'programmatic',
      });
    };

    const onDragStart = () => {
      ctrlRef.current.dragging = true;
    };

    const onDragEnd = (e) => {
      const wasDragging = ctrlRef.current.dragging;
      ctrlRef.current.dragging = false;
      if (!wasDragging) return;
      emitMapInteraction('pan', {
        source: e && e.originalEvent ? 'user' : 'programmatic',
      });
    };

    const onBaseLayerChange = (e) => {
      try {
        trackEvent('layers_toggle', {
          action: 'basemap_change',
          layer_name: e && e.name ? e.name : 'unknown',
        });
      } catch (_) {}
    };

    map.on('zoomend', onZoomEnd);
    map.on('dragstart', onDragStart);
    map.on('dragend', onDragEnd);
    map.on('baselayerchange', onBaseLayerChange);
    return () => {
      map.off('zoomend', onZoomEnd);
      map.off('dragstart', onDragStart);
      map.off('dragend', onDragEnd);
      map.off('baselayerchange', onBaseLayerChange);
    };
  }, [map]);
}