import { useMemo } from 'react';
import sanitizeHtml from '../utils/sanitizeHtml';
import { generateEventSummary } from '../utils/generateEventSummary';
import { normalizeList } from '../utils/normalizeList';
import {
  formatCoordinate,
  formatDepth,
  formatEventTimePh,
  formatEventTimeUtc,
  formatMagnitudeValue,
} from '../utils/earthquakeFormat';

export default function useEarthquakeDetailViewModel(earthquakeInfo) {
  const magnitude = useMemo(() => formatMagnitudeValue(earthquakeInfo), [earthquakeInfo]);

  const depth = useMemo(() => {
    return formatDepth(earthquakeInfo?.depth_km ?? earthquakeInfo?.depth ?? earthquakeInfo?.depth_value);
  }, [earthquakeInfo]);

  const eventTime = earthquakeInfo?.eventTime || earthquakeInfo?.OT;
  const lastUpdatedTime =
    earthquakeInfo?.last_modification || earthquakeInfo?.updated || earthquakeInfo?.modified || eventTime;

  const formattedEventTimePh = useMemo(
    () => (eventTime ? formatEventTimePh(eventTime) : null),
    [eventTime],
  );
  const formattedEventTimeUtc = useMemo(
    () => (eventTime ? formatEventTimeUtc(eventTime) : null),
    [eventTime],
  );
  const formattedUpdatedTime = useMemo(
    () => (lastUpdatedTime ? formatEventTimePh(lastUpdatedTime) : null),
    [lastUpdatedTime],
  );
  const formattedUpdatedTimeUtc = useMemo(
    () => (lastUpdatedTime ? formatEventTimeUtc(lastUpdatedTime) : null),
    [lastUpdatedTime],
  );

  const latValue = earthquakeInfo?.latitude_value ?? earthquakeInfo?.latitude ?? earthquakeInfo?.lat;
  const lngValue = earthquakeInfo?.longitude_value ?? earthquakeInfo?.longitude ?? earthquakeInfo?.lng;
  const coordText = useMemo(() => {
    const latText = formatCoordinate(latValue, 'N', 'S', { separator: '°' });
    const lngText = formatCoordinate(lngValue, 'E', 'W', { separator: '°' });
    if (!latText || !lngText) return null;
    return `${latText}, ${lngText}`;
  }, [latValue, lngValue]);

  const summaryMarkup = useMemo(() => {
    if (!earthquakeInfo) return '';
    return sanitizeHtml(
      earthquakeInfo?.summaryOverride?.text ||
      earthquakeInfo.eventSummary ||
      generateEventSummary(earthquakeInfo)
    );
  }, [earthquakeInfo]);

  const recordingStations = useMemo(
    () => normalizeList(earthquakeInfo?.recordingStations),
    [earthquakeInfo?.recordingStations],
  );
  const candidateStations = useMemo(
    () => normalizeList(earthquakeInfo?.candidateStations || earthquakeInfo?.onlineStations),
    [earthquakeInfo?.candidateStations, earthquakeInfo?.onlineStations],
  );
  const recordingAvailabilityStatus = earthquakeInfo?.recordingAvailabilityStatus || (
    recordingStations.length > 0
      ? 'verified'
      : candidateStations.length > 0
        ? 'pending'
        : 'unavailable'
  );
  const stationListSource = recordingStations.length > 0 ? 'verified' : 'candidate';
  const stationsForDisplay = recordingStations.length > 0 ? recordingStations : candidateStations;
  const isRecordingAvailabilityPending = (
    recordingStations.length === 0 &&
    candidateStations.length > 0 &&
    ['pending', 'partial'].includes(recordingAvailabilityStatus)
  );

  const pageTitle = useMemo(() => {
    if (earthquakeInfo?.title) return earthquakeInfo.title;

    const magText = magnitude ? `M${magnitude} Earthquake` : 'Earthquake';
    const placeDescription = earthquakeInfo?.place || '';
    const genericLocation = earthquakeInfo?.location || earthquakeInfo?.text || 'Location unavailable';

    if (placeDescription && placeDescription !== 'Unavailable') {
      return `${magText} ${placeDescription}`;
    }
    if (genericLocation) {
      return `${magText} ${genericLocation}`;
    }
    return magText;
  }, [earthquakeInfo, magnitude]);

  const debugInfo = useMemo(() => ({
    hasEarthquakeInfo: Boolean(earthquakeInfo),
    earthquakeKeys: earthquakeInfo ? Object.keys(earthquakeInfo) : [],
    onlineStations: stationsForDisplay,
    stationsForDisplay,
    onlineStationsLength: stationsForDisplay.length,
    stationsForDisplayLength: stationsForDisplay.length,
    candidateStations,
    recordingStations,
    recordingAvailabilityStatus,
    stationListSource,
  }), [candidateStations, earthquakeInfo, recordingAvailabilityStatus, recordingStations, stationListSource, stationsForDisplay]);

  return {
    coordText,
    debugInfo,
    depth,
    formattedEventTimePh,
    formattedEventTimeUtc,
    formattedUpdatedTime,
    formattedUpdatedTimeUtc,
    magnitude,
    pageTitle,
    candidateStations,
    isRecordingAvailabilityPending,
    recordingAvailabilityStatus,
    recordingStations,
    stationListSource,
    stationsForDisplay,
    summaryMarkup,
  };
}
