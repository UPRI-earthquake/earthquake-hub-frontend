


import React, { createContext, useEffect, useMemo, useRef, useState } from "react";
import { formatCoordinate, formatDepth, formatEventTimePh, formatEventTimeUtc, formatMagnitudeValue } from "@/shared/utils/earthquakeFormat";
import { normalizeList } from "@/shared/utils/normalizeList";
import { useRemoteGetEartquakeInfo } from "../data/earthquake";
import { EarthquakeInfo, EarthquakeRecordingAvailabilityStatus } from "../types/earthquake";


interface EarthquakeInfoContextType {
  eventPublicId: string;
  eventId?: string;
  earthquakeInfo: EarthquakeInfo | null;
  earthquakeLabel: string | undefined;
  derived: {
    magnitude: string | null;
    depth: string | null;
    coordText: string | null;
    formattedUpdatedTime: string | null;
    formattedUpdatedTimeUtc: string | null;
  };
  debugInfo: any;
  status: {
    isFetching: boolean;
    fetchError: any;
    isRecordingAvailabilityPending: boolean;
    recordingAvailabilityStatus: EarthquakeRecordingAvailabilityStatus;
  };
  stations: {
    source: "verified" | "candidate";
    list: any[]
  };
  reload: () => void;
}

export const EarthquakeInfoContext = createContext<EarthquakeInfoContextType | undefined>(undefined);

interface EarthquakeInfoProviderProps {
  eventPublicId: string;
  children: React.ReactNode;
}

export function EarthquakeInfoProvider({ eventPublicId, children }: EarthquakeInfoProviderProps) {
  const { data: earthquakeInfo, isFetching, error: fetchError, refetch: reload } = useRemoteGetEartquakeInfo(eventPublicId);
  const eventId = useMemo<string | undefined>(() => earthquakeInfo?._id ?? undefined, [earthquakeInfo]);

  const magnitude = useMemo(() => formatMagnitudeValue(earthquakeInfo), [earthquakeInfo]);

  const depth = useMemo(() => {
    return formatDepth(earthquakeInfo?.depth_km ?? earthquakeInfo?.depth ?? earthquakeInfo?.depth_value);
  }, [earthquakeInfo]);

  const eventTime = earthquakeInfo?.eventTime || earthquakeInfo?.OT;
  const lastUpdatedTime =
    earthquakeInfo?.last_modification || earthquakeInfo?.updated || earthquakeInfo?.modified || eventTime;

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

  
  const earthquakeLabel = useMemo(() => {
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

  return (<EarthquakeInfoContext.Provider value={{
    eventPublicId, 
    eventId,
    earthquakeInfo,
    earthquakeLabel,
    status: { 
      isFetching,
      fetchError, 
      isRecordingAvailabilityPending, 
      recordingAvailabilityStatus 
    },
    derived: earthquakeInfo ? {
      magnitude: magnitude, depth,
      coordText,
      formattedUpdatedTime, formattedUpdatedTimeUtc,
    } : null,
    debugInfo,
    stations: {
      source: stationListSource,
      list: stationsForDisplay
    },
    reload
  }}>{children}</EarthquakeInfoContext.Provider>);
}