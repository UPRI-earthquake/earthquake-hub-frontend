import { useMemo } from "react";
import { buildMiniMapTiles, getMagnitudeMarkerStyle, getMiniMapDistanceZoom, getMiniMapPoint, getMiniMapTileStyle, useMiniMapDimensions } from "../../../../services/minimap";
import MiniMapStationPin from "./MiniMapStationPin";
import { toFiniteNumber } from "@/shared/utils/earthquakeFormat";
import { MINI_MAP_ZOOM } from "../../../../constants/minimap";
import MiniMapPreview from "./MiniMapPreview";

interface MiniMapDistancePreviewProps {
  epicenterCoordinates: Coords;
  magnitudeValue: number | null;
  stationCode: string;
  stationCoordinates: Coords;
}

export default function MiniMapDistancePreview({ epicenterCoordinates, magnitudeValue = null, stationCode, stationCoordinates }: MiniMapDistancePreviewProps) {
  const [setMapNode, dimensions] = useMiniMapDimensions();
  const centerCoordinates = useMemo(
    () => {
      const latitude = toFiniteNumber(stationCoordinates?.latitude);
      const longitude = toFiniteNumber(stationCoordinates?.longitude);
      return latitude == null || longitude == null ? null : { latitude, longitude };
    },
    [stationCoordinates]
  );
  const zoom = useMemo(
    () => (
      centerCoordinates
        ? getMiniMapDistanceZoom(epicenterCoordinates, stationCoordinates, dimensions)
        : MINI_MAP_ZOOM
    ),
    [centerCoordinates, dimensions, epicenterCoordinates, stationCoordinates]
  );
  const tiles = useMemo(
    () => (
      centerCoordinates
        ? buildMiniMapTiles(centerCoordinates.latitude, centerCoordinates.longitude, zoom, dimensions)
        : []
    ),
    [centerCoordinates, dimensions, zoom]
  );
  const epicenterPoint = useMemo(
    () => getMiniMapPoint(epicenterCoordinates, centerCoordinates, zoom, dimensions),
    [centerCoordinates, dimensions, epicenterCoordinates, zoom]
  );
  const stationPoint = useMemo(
    () => getMiniMapPoint(stationCoordinates, centerCoordinates, zoom, dimensions),
    [centerCoordinates, dimensions, stationCoordinates, zoom]
  );

  if (!centerCoordinates || !epicenterPoint || !stationPoint) {
    return <MiniMapPreview coordinates={stationCoordinates} marker="station" />;
  }

  const wavefrontRadius = Math.hypot(
    stationPoint.left - epicenterPoint.left,
    stationPoint.top - epicenterPoint.top
  );
  const wavefrontRadii = wavefrontRadius > 0
    ? [0.46, 0.73, 1].map((ratio) => wavefrontRadius * ratio)
    : [];

  return (
    <div ref={setMapNode} className="metric-mini-map metric-mini-map-distance" aria-hidden="true">
      <div className="metric-mini-map-tiles">
        {tiles.map((tile) => (
          <img
            key={tile.key}
            src={tile.url}
            alt=""
            draggable="false"
            style={getMiniMapTileStyle(tile)}
          />
        ))}
      </div>
      <svg
        className="metric-map-distance-line"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        preserveAspectRatio="none"
        focusable="false"
      >
        {wavefrontRadii.map((radius, index) => (
          <circle
            key={`station-wavefront-${index}`}
            className={`metric-map-wavefront metric-map-wavefront-${index + 1}`}
            cx={epicenterPoint.left}
            cy={epicenterPoint.top}
            r={radius}
          />
        ))}
      </svg>
      <span
        className="metric-map-pin metric-map-pin-epicenter metric-map-pin-paired"
        style={getMagnitudeMarkerStyle(magnitudeValue, epicenterPoint)}
      />
      <MiniMapStationPin stationCode={stationCode} style={{ left: `${stationPoint.left}px`, top: `${stationPoint.top}px` }} />
      <span className="metric-map-attribution">CARTO</span>
    </div>
  );
}