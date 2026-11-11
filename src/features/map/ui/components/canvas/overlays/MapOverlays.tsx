import EarthquakesLayer from "./layers/EarthquakesLayer";
import FaultLinesLayer from "./layers/FaultLinesLayer";
import PARBoundaryLayer from "./layers/PARBoundaryLayer";
import PlateBoundariesLayer from "./layers/PlateBoundariesLayer";
import StationsLayer from "./layers/StationsLayer";

export default function MapOverlays() {
  return (<>
    <FaultLinesLayer />
    <PlateBoundariesLayer />
    <PARBoundaryLayer />
    <EarthquakesLayer />
    <StationsLayer />
  </>);
}