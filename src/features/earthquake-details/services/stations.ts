import { toFiniteNumber } from "@/shared/utils/earthquakeFormat";
import { calculateDistance, formatApproxDistance } from "@/shared/utils/distanceCalculator";
import { getEventCoordinates } from "./earthquake";
import { Station } from "../types/station";
import { EarthquakeInfo } from "../types/earthquake";

interface NearestRecordingStation {
  code: string;
  subtext: string;
  coordinates?: Coords;
}

export function getNearestRecordingStation(stationsForDisplay: Station[], allStations: Station[], earthquakeInfo: EarthquakeInfo, stationLocationsByCode: { [code: string]: Coords }): NearestRecordingStation {
  const stationCode = String(stationsForDisplay?.[0] || '').toUpperCase();
  const eventCoordinates = getEventCoordinates(earthquakeInfo);
  const resolveStationResult = (code, fallbackLabel) => {
    if (!code) return null;

    const stationLocation = stationLocationsByCode[code];
    const stationLatitude = toFiniteNumber(stationLocation?.latitude);
    const stationLongitude = toFiniteNumber(stationLocation?.longitude);

    if (!eventCoordinates || stationLatitude == null || stationLongitude == null) {
      return {
        code,
        subtext: fallbackLabel,
        coordinates:
          stationLatitude != null && stationLongitude != null
            ? { latitude: stationLatitude, longitude: stationLongitude }
            : null,
      };
    }

    const distanceKm = calculateDistance(
      eventCoordinates.latitude,
      eventCoordinates.longitude,
      stationLatitude,
      stationLongitude
    );

    return {
      code,
      subtext: Number.isFinite(distanceKm)
        ? `${formatApproxDistance(distanceKm)} from epicenter`
        : fallbackLabel,
      coordinates: { latitude: stationLatitude, longitude: stationLongitude },
    };
  };

  const onlineStationResult = resolveStationResult(stationCode, 'Nearest online recording');
  if (onlineStationResult) return onlineStationResult;

  const fallbackStationCode = Array.isArray(allStations) && eventCoordinates
    ? allStations
        .map((station) => {
          const code = String(station?.code || station?.station || '').toUpperCase();
          const latitude = toFiniteNumber(station?.latitude);
          const longitude = toFiniteNumber(station?.longitude);
          if (!code || latitude == null || longitude == null) return null;
          return {
            code,
            distanceKm: calculateDistance(
              eventCoordinates.latitude,
              eventCoordinates.longitude,
              latitude,
              longitude
            ),
          };
        })
        .filter((station) => station && Number.isFinite(station.distanceKm))
        .sort((a, b) => a.distanceKm - b.distanceKm)?.[0]?.code
    : String(allStations?.[0]?.code || allStations?.[0]?.station || '').toUpperCase();

  const fallbackStationResult = resolveStationResult(fallbackStationCode, 'Nearest station');
  if (fallbackStationResult) return fallbackStationResult;

  return {
    code: null,
    subtext: 'Station unavailable',
  };
}


export function buildStationLocationLookup(backendStations: Station[]): { [code: string]: Coords } {
  if (!Array.isArray(backendStations)) return {};

  return backendStations.reduce((acc, station) => {
    const code = String(station?.code || station?.station || '').toUpperCase();
    const latitude = toFiniteNumber(station?.latitude);
    const longitude = toFiniteNumber(station?.longitude);

    if (code && latitude != null && longitude != null) {
      acc[code] = { latitude, longitude };
    }

    return acc;
  }, {});
}



export function getStationDistanceLabel(stationCode, eventCoordinates, stationLocationsByCode) {
  if (!eventCoordinates) return '';

  const stationLocation = stationLocationsByCode[String(stationCode || '').toUpperCase()];
  const stationLatitude = toFiniteNumber(stationLocation?.latitude);
  const stationLongitude = toFiniteNumber(stationLocation?.longitude);

  if (stationLatitude == null || stationLongitude == null) return '';

  const distanceKm = calculateDistance(
    eventCoordinates.latitude,
    eventCoordinates.longitude,
    stationLatitude,
    stationLongitude
  );

  if (!Number.isFinite(distanceKm)) return '';
  return `${formatApproxDistance(distanceKm)} from epicenter`;
}