import { LayersControl, useMap } from "react-leaflet";
import RemoteGeoJSONOverlay from "../RemoteGeoJSONOverlay";
import useMakeOnEachWith from "../../../../../hooks/useMakeOnEachWith";
import { useCallback, useRef } from "react";

import { DATASETS } from '@/config/datasets';

import {
  platesStyle,
  themeFromMapContainer,
} from '../../../../../services/mapStyles';
import { useOverlayState } from "../../../../../hooks/useOverlayState";
import { buildPlateTitle, buildPlateTooltip } from "../../../../../services/overlayTooltips";
import { ATTRIBUTIONS } from "@/config/attribution";
import useMapView from "../../../../../hooks/useMapView";

export default function PlateBoundariesLayer() {
  const map = useMap();
  const { vectorRenderer } = useMapView();
  const { registerLayer, platesRef } = useOverlayState();

  
  const setPlatesRef = useCallback(
    (node) => {
      const layer = node && (node.leafletElement || node);
      platesRef.current = layer;
      if (layer) {
        try {
          layer.getAttribution = () => `<span class="attr-line attr-plates">${ATTRIBUTIONS.PB2002}</span>`;
        } catch (_) {}
        registerLayer('plates', layer);
      }
    },
    [registerLayer],
  );

  const platesStyleFor = useCallback(
    () => platesStyle({ theme: themeFromMapContainer(map.getContainer()), zoom: map.getZoom() }),
    [map],
  );

  const makeOnEachWith = useMakeOnEachWith({ 
    nativeTitleFn: buildPlateTitle,
    overlayTooltipBuilder: buildPlateTooltip,
    baseStyle: platesStyleFor
  });

  return (<LayersControl.Overlay name="Plate Boundaries" checked>
      <RemoteGeoJSONOverlay
        ref={setPlatesRef}
        fetchPath={DATASETS.PLATES.path}
        style={platesStyleFor}
        renderer={vectorRenderer}
        worldCopies
        lineOnly
        interactive
        onEachFeature={makeOnEachWith}
      />
    </LayersControl.Overlay>);
}