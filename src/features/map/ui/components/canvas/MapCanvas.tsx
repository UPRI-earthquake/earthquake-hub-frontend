import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { MapContainer, LayersControl, ScaleControl, ZoomControl, Pane, useMap } from 'react-leaflet';
// Leaflet CSS is loaded via non-blocking CDN link in public/index.html to avoid render-blocking
import '../../styles/canvas/MapLayers.css';
import '../../styles/canvas/Map.css';

import { resetToPH } from '../../../services/resetView';
import MapOverlays from './overlays/MapOverlays';
import BasemapLayer from './BasemapLayer';
import useMapAnalyticsBridge from '../../../hooks/useMapAnalyticsBridge';
import useResetViewControl from '../../../hooks/useResetViewControl';
import { OverlayStateProvider } from '../../../contexts/OverlayStateContext';
import LegendPopover from '../floating/popovers/legend/LegendPopover';
import AttributionsPopover from '../floating/popovers/AttributionsPopover';

export default function MapCanvas() {
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
      whenCreated={(m) => (window["__leaflet_map__"] = m)}
    >
      <MapCanvasInner />
      
    </MapContainer>
  );
}

function MapCanvasInner() {
  const map = useMap();
  const didResetRef = useRef(false);

  useMapAnalyticsBridge();
  useResetViewControl({ position: "topright" });

  useEffect(() => {
    if (!map || didResetRef.current) return undefined;
    didResetRef.current = true;
    try {
      resetToPH({ map, animate: false, padding: [20, 20] });
    } catch (_) {}
    return undefined;
  }, [map]);


  return (<>
    <Pane name="eqMarkers" style={{ zIndex: 620, pointerEvents: 'auto' }} />
      <ZoomControl position="topright" />
      <OverlayStateProvider>
        <LayersControl position="topright" collapsed>
          <BasemapLayer />
          <MapOverlays />
        </LayersControl>
        <ScaleControl position="bottomright" metric imperial={false} maxWidth={140} />
        <LegendPopover />
        <AttributionsPopover />
      </OverlayStateProvider>
  </>);
}