import { useEffect, useMemo, useState } from "react";
import useMapView from "./useMapView";
import { filterAndSortStations } from "../services/stationFilters";
import { useQuery } from "@tanstack/react-query";
import { StationsDataFilter } from "../types/station";

interface UseStationsReturn {
  allStations: any[];
  viewableStations: any[];
  filters: StationsDataFilter;
  updateFilters: (filters: StationsDataFilter) => void;
  isPending: boolean;
  isLoading: boolean;
  counts: {
    active: number;
    inactive: number;
  }
  fetchStations: () => void;
}

export default function useStations(): UseStationsReturn {
  const { stationsDataHandler } = useMapView();
  const [allStations, setAllStations] = useState(stationsDataHandler.getAllStations());
  const [filters, _setFilters] = useState(stationsDataHandler.getFilters());

  const initialStates = stationsDataHandler.getStatus();
  const [isPending, setIsPending] = useState(initialStates.isPending);
  const [isLoading, setIsLoading] = useState(initialStates.isLoading);
  
  // Ephemeral helper for fetching stations
  const fetchStationsQuery = useQuery({
    queryKey: ["stations"],
    queryFn: () => stationsDataHandler.reloadStations(),
    retry: 3,
    enabled: false   // do not automatically run, must be triggered via `fetchStations`
  });

  useEffect(() => stationsDataHandler.setStatus({ isPending: fetchStationsQuery.isFetching }), [ fetchStationsQuery.isFetching ]);
  useEffect(() => stationsDataHandler.setStatus({ isLoading: fetchStationsQuery.isLoading }), [ fetchStationsQuery.isLoading ]);

  const fetchStations = () => {
    fetchStationsQuery.refetch();
  };
  
  const counts = useMemo(
    () => ({
      active: (allStations || []).filter(
        (s) => String(s.activity || '').toLowerCase() === 'active',
      ).length,
      inactive: (allStations || []).filter(
        (s) => String(s.activity || '').toLowerCase() !== 'active',
      ).length,
    }),
    [allStations],
  );

  
  // Connect and listen to events from StationsDataHandler
  useEffect(() => {
    // Load initial values
    setAllStations(stationsDataHandler.getAllStations());
    _setFilters(stationsDataHandler.getFilters());

    const initialStates = stationsDataHandler.getStatus();
    setIsPending(initialStates.isPending);
    setIsLoading(initialStates.isLoading);
    

    const onUpdateListListener = stationsDataHandler.addEventListener(
      "update-list", (event) => setAllStations(event.stations));
      
    const onUpdateStatusListener = stationsDataHandler.addEventListener(
      "update-status", (event) => {
        setIsLoading(event.status.isLoading);
        setIsPending(event.status.isPending);
      });
      
    const onUpdateFiltersListener = stationsDataHandler.addEventListener(
      "update-filters", (event) => _setFilters(event.filters));


    return (() => {
      stationsDataHandler.removeEventListener("update-list", onUpdateListListener);
      stationsDataHandler.removeEventListener("update-status", onUpdateStatusListener);
      stationsDataHandler.removeEventListener("update-filters", onUpdateFiltersListener);
    });
  }, []);

  // Update viewable stations when filters are updated
  const viewableStations = useMemo(() => {
    return filterAndSortStations(allStations, filters);
  }, [allStations, filters]);

  const updateFilters = (filters) => stationsDataHandler.setFilters(filters);

  return { 
    allStations, 
    viewableStations, 
    filters, 
    updateFilters, 
    isPending, 
    isLoading, 
    counts,
    fetchStations };
}