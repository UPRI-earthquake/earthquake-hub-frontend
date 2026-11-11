import { LayersControl, useMap } from "react-leaflet";
import RemoteGeoJSONOverlay from "../RemoteGeoJSONOverlay";
import useMakeOnEachWith from "../../../../../hooks/useMakeOnEachWith";
import { buildFaultTitle, buildFaultTooltip } from "../../../../../services/overlayTooltips";
import { ATTRIBUTIONS } from "@/config/attribution";
import { useCallback, useMemo, useRef } from "react";

import {
  faultsStyle,
  themeFromMapContainer,
} from '../../../../../services/mapStyles';
import { DATASETS } from '@/config/datasets';
import { useOverlayState } from "../../../../../hooks/useOverlayState";
import useMapView from "../../../../../hooks/useMapView";

export default function FaultLinesLayer() {
  const map = useMap();
  
  const { vectorRenderer } = useMapView();
  const { registerLayer, activeIds, faultsRef } = useOverlayState();
  const faultsStyleFor = useCallback(
    () =>
      faultsStyle({
        theme: themeFromMapContainer(map.getContainer()),
        zoom: map.getZoom(),
        overlays: activeIds,
      }),
    [map, activeIds],
  );

  const makeOnEachWith = useMakeOnEachWith({ 
    nativeTitleFn: buildFaultTitle,
    overlayTooltipBuilder: buildFaultTooltip,
    baseStyle: faultsStyleFor
  });

  const setFaultsRef = useCallback(
    (node) => {
      const layer = node && (node.leafletElement || node);
      faultsRef.current = layer;
      if (layer) {
        try {
          // Expose attribution for Leaflet control; wrap with a marker class for formatting
          layer.getAttribution = () => `<span class="attr-line attr-faults">${ATTRIBUTIONS.GEMFaults}</span>`;
        } catch (_) {}
        registerLayer('faults', layer);
      }
    },
    [registerLayer],
  );

  return (<LayersControl.Overlay name="Fault Lines" checked>
      <RemoteGeoJSONOverlay
        ref={setFaultsRef}
        fetchPath={DATASETS.FAULTS.path}
        style={faultsStyleFor}
        renderer={vectorRenderer}
        // Philippines bbox (lon/lat): 116..127E, 4.5..21.5N
        filterBbox={[116, 4.5, 127, 21.5]}
        lineOnly
        interactive
        onEachFeature={makeOnEachWith}
      />
    </LayersControl.Overlay>);
}