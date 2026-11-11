import { LayersControl } from "react-leaflet";
import RegisterableLayerGroup from "../RegisterableLayerGroup";
import { lazy, Suspense } from "react";
import { ATTRIBUTIONS } from "@/config/attribution";
import usePopupAutoPanPadding from "../../../../../hooks/usePopupAutoPanPadding";
import useEarthquakes from "../../../../../hooks/useEarthquakes";

const EventMarkers = lazy(() => import('../markers/EventMarkers'));

export default function EarthquakesLayer() {
  const popupAutoPanPadding = usePopupAutoPanPadding();
  const { earthquakes, filters } = useEarthquakes();
  const eventScope = filters.scope;

  return (<LayersControl.Overlay checked name="Earthquakes">
      <RegisterableLayerGroup
        overlayId="earthquakes"
        key={eventScope}
        attribution={`<span class="attr-line attr-earthquakes">${ATTRIBUTIONS.UPRIEarthquakes}</span>`}
      >
        <Suspense fallback={null}>
          <EventMarkers
            initEvents={earthquakes}
            filters={filters}
            sseEnabled
            datasetKey={eventScope}
            popupAutoPanPadding={popupAutoPanPadding}
          />
        </Suspense>
      </RegisterableLayerGroup>
    </LayersControl.Overlay>);
}