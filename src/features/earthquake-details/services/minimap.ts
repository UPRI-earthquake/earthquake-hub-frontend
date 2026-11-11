import { useEffect, useState } from "react";
import { toFiniteNumber } from "@/shared/utils/earthquakeFormat";
import { EPICENTER_MINI_MAP_ZOOM, MINI_MAP_DISTANCE_MAX_ZOOM, MINI_MAP_DISTANCE_MIN_ZOOM, MINI_MAP_HEIGHT, MINI_MAP_TILE_SIZE, MINI_MAP_TILE_URL, MINI_MAP_WIDTH, MINI_MAP_ZOOM } from "../constants/minimap";


export function useMiniMapDimensions(): [ React.Dispatch<any>, Dimensions] {
  const [node, setNode] = useState(null);
  const [dimensions, setDimensions] = useState({
    width: MINI_MAP_WIDTH,
    height: MINI_MAP_HEIGHT,
  });

  useEffect(() => {
    if (!node) return undefined;

    const updateDimensions = () => {
      const rect = node.getBoundingClientRect();
      const width = Math.max(1, rect.width || MINI_MAP_WIDTH);
      const height = Math.max(1, rect.height || MINI_MAP_HEIGHT);
      setDimensions((current) => (
        Math.abs(current.width - width) < 0.5 && Math.abs(current.height - height) < 0.5
          ? current
          : { width, height }
      ));
    };

    updateDimensions();
    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [setNode, dimensions];
}



export function buildMiniMapTiles(latitude: number, longitude: number, zoom: number = MINI_MAP_ZOOM, dimensions?: Dimensions) {
  const viewportWidth = dimensions.width || MINI_MAP_WIDTH;
  const viewportHeight = dimensions.height || MINI_MAP_HEIGHT;
  const centerX = lonToTilePixelX(longitude, zoom);
  const centerY = latToTilePixelY(latitude, zoom);
  const centerTileX = Math.floor(centerX / MINI_MAP_TILE_SIZE);
  const centerTileY = Math.floor(centerY / MINI_MAP_TILE_SIZE);
  const maxTile = 2 ** zoom;
  const tiles = [];

  for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
    for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
      const rawX = centerTileX + xOffset;
      const tileX = ((rawX % maxTile) + maxTile) % maxTile;
      const tileY = centerTileY + yOffset;

      if (tileY < 0 || tileY >= maxTile) continue;

      tiles.push({
        key: `${tileX}-${tileY}`,
        url: MINI_MAP_TILE_URL
          .replace('{z}', `${zoom}`)
          .replace('{x}', `${tileX}`)
          .replace('{y}', `${tileY}`),
        left: rawX * MINI_MAP_TILE_SIZE - centerX + viewportWidth / 2,
        top: tileY * MINI_MAP_TILE_SIZE - centerY + viewportHeight / 2,
      });
    }
  }

  return tiles;
}

export function getMiniMapTileStyle(tile) {
  return {
    left: `${tile.left}px`,
    top: `${tile.top}px`,
    width: `${MINI_MAP_TILE_SIZE}px`,
    height: `${MINI_MAP_TILE_SIZE}px`,
  };
}


export function lonToTilePixelX(longitude: number, zoom: number) {
  return ((longitude + 180) / 360) * MINI_MAP_TILE_SIZE * 2 ** zoom;
}

export function latToTilePixelY(latitude: number, zoom: number) {
  const latRad = latitude * Math.PI / 180;
  return (
    (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
    2 *
    MINI_MAP_TILE_SIZE *
    2 ** zoom
  );
}



export function getMagnitudeMarkerScale(magnitudeValue) {
  if (magnitudeValue == null) return 1;
  return Math.min(1.28, Math.max(0.88, 0.78 + magnitudeValue * 0.065));
}

export function getMagnitudeMarkerStyle(magnitudeValue: number, point: PointLT | null = null) {
  const markerScale = getMagnitudeMarkerScale(magnitudeValue);
  const style = { '--metric-epicenter-scale': markerScale } as any;
  if (point) {
    style.left = `${point.left}px`;
    style.top = `${point.top}px`;
  }
  return style;
}


function getMiniMapProjectedDelta(firstCoordinates: Coords, secondCoordinates: Coords, zoom: number) {
  const firstLatitude = toFiniteNumber(firstCoordinates?.latitude);
  const firstLongitude = toFiniteNumber(firstCoordinates?.longitude);
  const secondLatitude = toFiniteNumber(secondCoordinates?.latitude);
  const secondLongitude = toFiniteNumber(secondCoordinates?.longitude);

  if (
    firstLatitude == null ||
    firstLongitude == null ||
    secondLatitude == null ||
    secondLongitude == null
  ) {
    return null;
  }

  return {
    x: lonToTilePixelX(firstLongitude, zoom) - lonToTilePixelX(secondLongitude, zoom),
    y: latToTilePixelY(firstLatitude, zoom) - latToTilePixelY(secondLatitude, zoom),
  };
}


export function getMiniMapDistanceZoom(epicenterCoordinates, stationCoordinates, dimensions?: Dimensions) {
  const baseDelta = getMiniMapProjectedDelta(epicenterCoordinates, stationCoordinates, 0);
  const baseDistance = baseDelta ? Math.hypot(baseDelta.x, baseDelta.y) : 0;
  const viewportMin = Math.min(dimensions?.width ?? MINI_MAP_WIDTH, dimensions?.height ?? MINI_MAP_HEIGHT);
  const targetDistance = Math.min(92, Math.max(34, viewportMin * 0.34));

  if (!Number.isFinite(baseDistance) || baseDistance <= 0) {
    return EPICENTER_MINI_MAP_ZOOM;
  }

  const targetZoom = Math.round(Math.log2(targetDistance / baseDistance));
  return Math.min(
    MINI_MAP_DISTANCE_MAX_ZOOM,
    Math.max(MINI_MAP_DISTANCE_MIN_ZOOM, targetZoom)
  );
}


export function getMiniMapPoint(coordinates, centerCoordinates: Coords, zoom: number, dimensions?: Dimensions) {
  const latitude = toFiniteNumber(coordinates?.latitude);
  const longitude = toFiniteNumber(coordinates?.longitude);
  const centerLatitude = toFiniteNumber(centerCoordinates?.latitude);
  const centerLongitude = toFiniteNumber(centerCoordinates?.longitude);
  const viewportWidth = dimensions?.width ?? MINI_MAP_WIDTH;
  const viewportHeight = dimensions?.height ?? MINI_MAP_HEIGHT;

  if (
    latitude == null ||
    longitude == null ||
    centerLatitude == null ||
    centerLongitude == null
  ) {
    return null;
  }

  return {
    left: lonToTilePixelX(longitude, zoom) - lonToTilePixelX(centerLongitude, zoom) + viewportWidth / 2,
    top: latToTilePixelY(latitude, zoom) - latToTilePixelY(centerLatitude, zoom) + viewportHeight / 2,
  };
}