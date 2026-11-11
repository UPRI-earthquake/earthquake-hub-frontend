import { useMemo } from "react";
import { toFiniteNumber } from "@/shared/utils/earthquakeFormat";
import { buildMiniMapTiles, getMagnitudeMarkerStyle, getMiniMapTileStyle, useMiniMapDimensions } from "../../../../services/minimap";
import MiniMapStationPin from "./MiniMapStationPin";
import { MINI_MAP_ZOOM } from "../../../../constants/minimap";

interface MiniMapPreviewProps  {
  coordinates: Coords;
  magnitudeValue?: number; 
  marker?: string;
  zoom?: number;
}

export default function MiniMapPreview({ 
  coordinates, 
  magnitudeValue, 
  marker = 'epicenter', 
  zoom = MINI_MAP_ZOOM }: MiniMapPreviewProps) {

  const [setMapNode, dimensions] = useMiniMapDimensions();
  const latitude = toFiniteNumber(coordinates?.latitude);
  const longitude = toFiniteNumber(coordinates?.longitude);
  const tiles = useMemo(
    () => (latitude == null || longitude == null ? [] : buildMiniMapTiles(latitude, longitude, zoom, dimensions)),
    [dimensions, latitude, longitude, zoom]
  );

  if (latitude == null || longitude == null) {
    return (
      <div className="metric-mini-map metric-mini-map-empty" aria-hidden="true">
        <span />
      </div>
    );
  }

  return (
    <div ref={setMapNode} className="metric-mini-map" aria-hidden="true">
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
      {marker === 'station' ? (
        <MiniMapStationPin />
      ) : (
        <span
          className={`metric-map-pin metric-map-pin-${marker}`}
          style={marker === 'epicenter' ? getMagnitudeMarkerStyle(magnitudeValue) : undefined}
        />
      )}
      <span className="metric-map-attribution">CARTO</span>
    </div>
  );
}

