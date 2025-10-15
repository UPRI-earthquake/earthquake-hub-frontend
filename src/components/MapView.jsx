import React, { Suspense, lazy } from 'react';
import { MapContainer, LayersControl, ScaleControl, ZoomControl, Pane } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../map.css';

import MapLayersControl from './MapLayersControl';
import AttributionControl from './AttributionControl';
import LegendControl from './LegendControl';
import ResetViewControl from './ResetViewControl';
import RegisterableLayerGroup from './RegisterableLayerGroup';
import { OverlayStateProvider } from './OverlayStateContext';

// Keep markers lazy inside the map chunk to avoid blocking map shell render
const StationMarkers = lazy(() => import('./StationMarkers'));
const EventMarkers = lazy(() => import('./EventMarkers'));

function MapView({ datasetKey, holdEqMarkers, events, filters, sseEnabled, customEvents, stations }) {
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
      <ZoomControl position="topleft" />
      <ResetViewControl position="topleft" />
      <AttributionControl />
      <OverlayStateProvider>
        <MapLayersControl>
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
                <StationMarkers initStations={stations} />
              </Suspense>
            </RegisterableLayerGroup>
          </LayersControl.Overlay>
        </MapLayersControl>
        <ScaleControl position="topleft" metric imperial={false} maxWidth={140} />
        <LegendControl />
      </OverlayStateProvider>
    </MapContainer>
  );
}

export default MapView;

