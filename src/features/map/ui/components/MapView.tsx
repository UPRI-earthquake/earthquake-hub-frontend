import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import useDevice from "@/shared/hooks/useDevice";
import MapCanvas from "./canvas/MapCanvas";
import FloatingPanels from "./floating/panels/FloatingPanels";

import "../styles/MapView.css";
import useStations from "../../hooks/useStations";
import useEarthquakes from "../../hooks/useEarthquakes";

export default function MapView() {
  const { isMobileLandscape, isCompactPanels } = useDevice();
  const [panelOpen, setPanelOpen] = useState(!isCompactPanels);

  const { fetchStations } = useStations();
  const { fetchEarthquakes } = useEarthquakes();
  useEffect(() => {
    fetchStations();
    fetchEarthquakes();
  }, []);
  

  return (<div
    className="App-body"
    id="main"
    role="main"
    aria-label="Main content"
    data-mobile-landscape={isMobileLandscape ? '1' : '0'}
    data-panel-open={panelOpen ? '1' : '0'}
  >
      <div
        className="mapShell"
        data-mobile-landscape={isMobileLandscape ? '1' : '0'}
        data-panel-open={panelOpen ? '1' : '0'}
      >
        <Suspense fallback={null}>
          <MapCanvas />
        </Suspense>
      </div>



      {/* Floating layer */}
      <FloatingPanels />
  </div>);
}