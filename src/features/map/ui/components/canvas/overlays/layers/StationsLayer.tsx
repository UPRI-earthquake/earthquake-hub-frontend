import { LayersControl } from "react-leaflet";
import { lazy, Suspense } from "react";

import useStations from "../../../../../hooks/useStations";
import RegisterableLayerGroup from "../RegisterableLayerGroup";
import { ATTRIBUTIONS } from "@/config/attribution";

const StationMarkers = lazy(() => import('../markers/StationMarkers'));


export default function StationsLayer() {
  return (<LayersControl.Overlay checked name="Stations">
    <RegisterableLayerGroup
      overlayId="stations"
      attribution={`<span class="attr-line attr-stations">${ATTRIBUTIONS.UPRIStations}</span>`}
    >
      <Suspense fallback={null}>
        <StationMarkers />
      </Suspense>
    </RegisterableLayerGroup>
  </LayersControl.Overlay>);
}