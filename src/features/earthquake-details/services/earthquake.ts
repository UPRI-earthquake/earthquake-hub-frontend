
import { toFiniteNumber } from "@/shared/utils/earthquakeFormat";
import moment from "@/shared/utils/time";
import { EarthquakeInfo } from "../types/earthquake";

export function getEarthquakeEventId(earthquakeInfo: EarthquakeInfo, queryEventId: string) {
  return (
    earthquakeInfo?._id ||
    earthquakeInfo?.publicID ||
    earthquakeInfo?.id ||
    earthquakeInfo?.event_id ||
    queryEventId ||
    ''
  );
}

export function getEventCoordinates(earthquakeInfo: EarthquakeInfo): Coords {
  const latitude = toFiniteNumber(
    earthquakeInfo?.latitude_value ?? earthquakeInfo?.latitude ?? earthquakeInfo?.lat
  );
  const longitude = toFiniteNumber(
    earthquakeInfo?.longitude_value ?? earthquakeInfo?.longitude ?? earthquakeInfo?.lng
  );

  if (latitude == null || longitude == null) return null;
  return { latitude, longitude };
}

export function getMagnitudeValue(earthquakeInfo: EarthquakeInfo): number {
  return toFiniteNumber(
    earthquakeInfo?.magnitude ??
    earthquakeInfo?.magnitude_value ??
    earthquakeInfo?.mag ??
    earthquakeInfo?.magnitudeValue
  );
}

export function getDepthContext(earthquakeInfo: EarthquakeInfo): string {
  const depthKm = toFiniteNumber(earthquakeInfo?.depth_km ?? earthquakeInfo?.depth ?? earthquakeInfo?.depth_value);
  if (depthKm == null) return 'Depth unavailable';
  if (depthKm <= 70) return 'Shallow depth';
  if (depthKm <= 300) return 'Intermediate depth';
  return 'Deep event';
}


export function getEventTimeDisplay(earthquakeInfo: EarthquakeInfo): { primary: string, zone: string, utc: string } {
  const eventTime = earthquakeInfo?.eventTime || earthquakeInfo?.OT;
  const parsed = moment.utc(eventTime);

  if (!parsed || !parsed.isValid()) {
    return {
      primary: 'Date unavailable',
      zone: 'UTC+08:00',
      utc: 'UTC —',
    };
  }

  return {
    primary: parsed.clone().add(8, 'hour').format('MMM D, YYYY, h:mm A'),
    zone: 'UTC+08:00',
    utc: `${parsed.format('YYYY-MM-DD HH:mm:ss')} UTC`,
  };
}


export function parseEventTimeUtc(value) {
  const parsed = moment(value || Date.now()).utc();
  return parsed && typeof parsed.isValid === 'function' && parsed.isValid()
    ? parsed
    : moment().utc();
}


export function formatApproxDistance(distanceKm) {
  if (distanceKm < 1) return '<1 km';
  return `~${Math.round(distanceKm).toLocaleString()} km`;
}
