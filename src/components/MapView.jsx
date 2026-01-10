import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { MapContainer, LayersControl, ScaleControl, ZoomControl, Pane, useMap } from 'react-leaflet';
// Leaflet CSS is loaded via non-blocking CDN link in public/index.html to avoid render-blocking
import '../map.css';

import MapLayersControl from './MapLayersControl';
import AttributionControl from './AttributionControl';
import LegendControl from './LegendControl';
import ResetViewControl from './ResetViewControl';
import RegisterableLayerGroup from './RegisterableLayerGroup';
import { OverlayStateProvider } from './OverlayStateContext';
import { trackEvent } from '../analytics';
import { resetToPH } from '../utils/resetView';

// Keep markers lazy inside the map chunk to avoid blocking map shell render
const StationMarkers = lazy(() => import('./StationMarkers'));
const EventMarkers = lazy(() => import('./EventMarkers'));

function MapView({
  datasetKey,
  holdEqMarkers,
  events,
  filters,
  sseEnabled,
  customEvents,
  stations,
  stationFilters,
  theme,
}) {
  return (
    <MapContainer
      center={[12.2795, 122.049]}
      zoom={6}
      minZoom={2}
      zoomControl={false}
      worldCopyJump
      maxBounds={[
        [-85.0511, -360],
        [85.0511, 360],
      ]}
      maxBoundsViscosity={1.0}
      preferCanvas
      whenCreated={(m) => (window.__leaflet_map__ = m)}
    >
      <Pane name="eqMarkers" style={{ zIndex: 620, pointerEvents: 'auto' }} />
      <ZoomControl position="topright" />
      <ResetViewControl position="topright" />
      <AttributionControl />
      <OverlayStateProvider>
        <MapLayersControl activeTheme={theme}>
          <LayersControl.Overlay checked name="Earthquakes">
            <RegisterableLayerGroup overlayId="earthquakes" key={datasetKey}>
              {!holdEqMarkers && (
                <Suspense fallback={null}>
                  <EventMarkers
                    initEvents={customEvents || events}
                    filters={filters}
                    sseEnabled={sseEnabled}
                    datasetKey={datasetKey}
                  />
                </Suspense>
              )}
            </RegisterableLayerGroup>
          </LayersControl.Overlay>
          <LayersControl.Overlay checked name="Stations">
            <RegisterableLayerGroup overlayId="stations">
              <Suspense fallback={null}>
                <StationMarkers initStations={stations} filters={stationFilters} />
              </Suspense>
            </RegisterableLayerGroup>
          </LayersControl.Overlay>
        </MapLayersControl>
        <ScaleControl position="bottomright" metric imperial={false} maxWidth={140} />
        <LegendControl />
        <MapAnalyticsBridge />
        <InitialResetView />
      </OverlayStateProvider>
    </MapContainer>
  );
}

export default MapView;

function MapAnalyticsBridge() {
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

  return null;
}

function InitialResetView() {
  const map = useMap();
  const didResetRef = useRef(false);

  useEffect(() => {
    if (!map || didResetRef.current) return undefined;
    didResetRef.current = true;
    try {
      resetToPH({ map, animate: false, padding: [20, 20] });
    } catch (_) {}
    return undefined;
  }, [map]);

  return null;
}
