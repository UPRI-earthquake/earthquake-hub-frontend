import { LayersControl, useMap } from "react-leaflet";
import RemoteGeoJSONOverlay from "../RemoteGeoJSONOverlay";
import { useCallback, useMemo, useRef } from "react";

import { DATASETS } from '@/config/datasets';

import {
  parStyle,
  themeFromMapContainer,
} from '../../../../../services/mapStyles';
import { ATTRIBUTIONS } from '@/config/attribution';
import { useOverlayState } from "../../../../../hooks/useOverlayState";
import useMapView from "../../../../../hooks/useMapView";

export default function PARBoundaryLayer() {
  const map = useMap();

  const { vectorRenderer } = useMapView();
  const { registerLayer, parRef } = useOverlayState();
  
  const setParRef = useCallback(
    (node) => {
      const layer = node && (node.leafletElement || node);
      parRef.current = layer;
      if (layer) {
        try {
          layer.getAttribution = () => `<span class="attr-line attr-par">${ATTRIBUTIONS.PAR}</span>`;
        } catch (_) {}
        registerLayer('par', layer);
      }
    },
    [registerLayer],
  );

  const parStyleFor = useCallback(
    () => parStyle({ theme: themeFromMapContainer(map.getContainer()), zoom: map.getZoom() }),
    [map],
  );


  return (<LayersControl.Overlay name="PAR Boundary" checked>
    <RemoteGeoJSONOverlay
      ref={setParRef}
      fetchPath={DATASETS.PAR.path}
      style={parStyleFor}
      renderer={vectorRenderer}
      lineOnly={false}
      interactive={false}
    />
  </LayersControl.Overlay>);
}