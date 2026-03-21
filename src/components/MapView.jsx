import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
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
import FloatingButton from './FloatingButton';
import { ATTRIBUTIONS } from '../config/attribution';
import { computeHeaderAwarePopupAutoPanPadding } from '../config/popupAutoPan';

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
      <FloatingButton />
      <AttributionControl />
      <OverlayStateProvider>
        <MarkerLayers
          datasetKey={datasetKey}
          holdEqMarkers={holdEqMarkers}
          events={events}
          filters={filters}
          sseEnabled={sseEnabled}
          customEvents={customEvents}
          stations={stations}
          stationFilters={stationFilters}
          theme={theme}
        />
        <ScaleControl position="bottomright" metric imperial={false} maxWidth={140} />
        <LegendControl />
        <MapAnalyticsBridge />
        <InitialResetView />
      </OverlayStateProvider>
    </MapContainer>
  );
}

export default MapView;

function usePopupAutoPanPadding() {
  const map = useMap();
  const [padding, setPadding] = useState(() => computeHeaderAwarePopupAutoPanPadding(map));

  useEffect(() => {
    if (!map) return undefined;

    const update = () => {
      try {
        setPadding(computeHeaderAwarePopupAutoPanPadding(map));
      } catch (_) {}
    };

    update();

    const container = map.getContainer && map.getContainer();
    let mo = null;

    try { map.on('resize', update); } catch (_) {}
    try {
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', update);
        window.addEventListener('orientationchange', update);
      }
    } catch (_) {}
    try {
      if (container && typeof MutationObserver !== 'undefined') {
        mo = new MutationObserver(update);
        mo.observe(container, {
          attributes: true,
          attributeFilter: ['class', 'style', 'data-basemap-theme'],
        });
      }
    } catch (_) {}

    return () => {
      try { map.off('resize', update); } catch (_) {}
      try {
        if (typeof window !== 'undefined') {
          window.removeEventListener('resize', update);
          window.removeEventListener('orientationchange', update);
        }
      } catch (_) {}
      try { if (mo) mo.disconnect(); } catch (_) {}
    };
  }, [map]);

  return padding;
}

function MarkerLayers({
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
  const popupAutoPanPadding = usePopupAutoPanPadding();

  return (
    <MapLayersControl activeTheme={theme}>
      <LayersControl.Overlay checked name="Earthquakes">
        <RegisterableLayerGroup
          overlayId="earthquakes"
          key={datasetKey}
          attribution={`<span class="attr-line attr-earthquakes">${ATTRIBUTIONS.UPRIEarthquakes}</span>`}
        >
          {!holdEqMarkers && (
            <Suspense fallback={null}>
              <EventMarkers
                initEvents={customEvents || events}
                filters={filters}
                sseEnabled={sseEnabled}
                datasetKey={datasetKey}
                popupAutoPanPadding={popupAutoPanPadding}
              />
            </Suspense>
          )}
        </RegisterableLayerGroup>
      </LayersControl.Overlay>
      <LayersControl.Overlay checked name="Stations">
        <RegisterableLayerGroup
          overlayId="stations"
          attribution={`<span class="attr-line attr-stations">${ATTRIBUTIONS.UPRIStations}</span>`}
        >
          <Suspense fallback={null}>
            <StationMarkers
              initStations={stations}
              filters={stationFilters}
              popupAutoPanPadding={popupAutoPanPadding}
            />
          </Suspense>
        </RegisterableLayerGroup>
      </LayersControl.Overlay>
    </MapLayersControl>
  );
}

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
