import { createContext, useEffect, useMemo, useRef, useState } from "react";
import { EarthquakesDataFilter, EarthquakeShortInfo } from "../types/earthquake";
import useMapView from "../hooks/useMapView";
import { useQuery } from "@tanstack/react-query";


interface EarthquakesContextType {
  earthquakes: EarthquakeShortInfo[];
  activeEarthquakes: Set<string>;
  filters: EarthquakesDataFilter;
  updateFilters: (filters: EarthquakesDataFilter, triggerFetch?: boolean) => void;
  isPending: boolean;
  isLoading: boolean;
  fetchEarthquakes: () => void;
}

export const EarthquakesContext = createContext<EarthquakesContextType | undefined>(undefined);

export function EarthquakesProvider({ children }: { children: React.ReactNode}) {
  const { earthquakesDataHandler } = useMapView();
  const [earthquakes, setEarthquakes] = useState(earthquakesDataHandler.getEarthquakes());
  const [filters, _setFilters] = useState(earthquakesDataHandler.getFilters());

  const initialStates = earthquakesDataHandler.getStatus();
  const [isPending, setIsPending] = useState(initialStates.isPending);
  const [isLoading, setIsLoading] = useState(initialStates.isLoading);

  const [activeEarthquakes, setActiveEarthquakes] = useState(earthquakesDataHandler.getActiveEarthquakes());
  
  // Ephemeral helper for fetching earthquakes
  const fetchEarthquakesQuery = useQuery({
    queryKey: ["earthquakes"],
    queryFn: () => earthquakesDataHandler.reloadEarthquakes(),
    retry: 3,
    enabled: false   // do not automatically run, must be triggered via `fetchEarthquakes`
  });

  useEffect(() => earthquakesDataHandler.setStatus({ isPending: fetchEarthquakesQuery.isFetching }), [ fetchEarthquakesQuery.isFetching ]);
  useEffect(() => earthquakesDataHandler.setStatus({ isLoading: fetchEarthquakesQuery.isLoading }), [ fetchEarthquakesQuery.isLoading ]);

  const fetchEarthquakes = () => {
    fetchEarthquakesQuery.refetch();
  };
  
  
  // Connect and listen to events from EarthquakesDataHandler
  useEffect(() => {
    // Load initial values
    setEarthquakes(earthquakesDataHandler.getEarthquakes());
    setActiveEarthquakes(earthquakesDataHandler.getActiveEarthquakes());
    _setFilters(earthquakesDataHandler.getFilters());

    const initialStates = earthquakesDataHandler.getStatus();
    setIsPending(initialStates.isPending);
    setIsLoading(initialStates.isLoading);
    

    const onUpdateListListener = earthquakesDataHandler.addEventListener(
      "update-list", (event) => setEarthquakes(event.earthquakes));

    const onUpdateActiveListListener = earthquakesDataHandler.addEventListener(
      "update-active-list", (event) => setActiveEarthquakes(event.activeEarthquakes));
      
    const onUpdateStatusListener = earthquakesDataHandler.addEventListener(
      "update-status", (event) => {
        setIsLoading(event.status.isLoading);
        setIsPending(event.status.isPending);
      });
      
    const onUpdateFiltersListener = earthquakesDataHandler.addEventListener(
      "update-filters", (event) => _setFilters(event.filters));


    return (() => {
      earthquakesDataHandler.removeEventListener("update-list", onUpdateListListener);
      earthquakesDataHandler.removeEventListener("update-active-list", onUpdateActiveListListener);
      earthquakesDataHandler.removeEventListener("update-status", onUpdateStatusListener);
      earthquakesDataHandler.removeEventListener("update-filters", onUpdateFiltersListener);
    });
  }, []);


  const updateFilters = (filters, triggerFetch = true) => {
    earthquakesDataHandler.setFilters(filters);
    if(triggerFetch) fetchEarthquakes();
  };
  
  return (<EarthquakesContext.Provider value={{
    earthquakes, 
    activeEarthquakes,
    filters, 
    updateFilters, 
    isPending, 
    isLoading, 
    fetchEarthquakes
  }}>{children}</EarthquakesContext.Provider>);
}