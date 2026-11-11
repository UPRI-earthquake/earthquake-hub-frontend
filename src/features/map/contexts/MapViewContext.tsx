import L from "leaflet";
import { createContext, useEffect, useMemo, useRef, useState } from "react";
import StationsDataHandler from "../data/local/StationsDataHandler";
import EarthquakesDataHandler from "../data/local/EarthquakesDataHandler";
import { useEventsFeed } from "../hooks/useEventsFeed";
import SSEStreamHandler from "../data/local/SSEStreamHandler";
import { EarthquakesProvider } from "./EarthquakesContext";


interface MapViewContextType {
  activeBase: any;
  setActiveBase: (base: any) => void;
  stationsDataHandler: StationsDataHandler;
  earthquakesDataHandler: EarthquakesDataHandler;
  vectorRenderer: L.Canvas;
}

export const MapViewContext = createContext<MapViewContextType | undefined>(undefined);

export function MapViewProvider({ children }: { children: React.ReactNode}) {
  const [activeBase, setActiveBase] = useState('satellite');

  const stationsDataHandlerRef = useRef(new StationsDataHandler());
  const earthquakesDataHandlerRef = useRef(new EarthquakesDataHandler());
  const sseStreamHandlerRef = useRef(new SSEStreamHandler({
    stations: stationsDataHandlerRef.current,
    earthquakes: earthquakesDataHandlerRef.current
  }));

  // Use a single shared Canvas renderer with a higher click/hover tolerance
  // so both Faults and Plates participate in the same hit-testing layer.
  const vectorRenderer = useMemo(() => L.canvas({ padding: 0.5, tolerance: 12 }), []);


  useEffect(() => {
    earthquakesDataHandlerRef.current.reloadEarthquakes();
    stationsDataHandlerRef.current.reloadStations();

    return () => {
      sseStreamHandlerRef.current.destroy();
      earthquakesDataHandlerRef.current.destroy();
    };
  }, []);
  
  return (<MapViewContext.Provider value={{
    activeBase,
    setActiveBase,
    stationsDataHandler: stationsDataHandlerRef.current,
    earthquakesDataHandler: earthquakesDataHandlerRef.current,
    vectorRenderer,
  }}>
    <EarthquakesProvider>
      {children}  
    </EarthquakesProvider>
  </MapViewContext.Provider>);
}