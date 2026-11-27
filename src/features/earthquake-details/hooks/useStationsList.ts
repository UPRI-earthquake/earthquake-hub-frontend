import { useMemo } from "react";
import { buildStationLocationLookup } from "../services/stations";
import { Station } from "../types/station";
import { useRemoteGetStations } from "../data/stations";

interface UseStationsListReturn {
  allStations: Station[];
  stationLocationsByCode: { [code: string]: Coords }
}

export default function useStationsList(): UseStationsListReturn {
  const { data: allStations } = useRemoteGetStations();
  const stationLocationsByCode = useMemo(() => buildStationLocationLookup(allStations), [allStations]);

  return { allStations, stationLocationsByCode };
}