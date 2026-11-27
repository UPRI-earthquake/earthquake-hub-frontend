import L from "leaflet";
import { createContext, useEffect, useMemo, useRef, useState } from "react";
import StationsDataHandler from "../data/local/StationsDataHandler";
import EarthquakesDataHandler from "../data/local/EarthquakesDataHandler";
import SSEStreamHandler from "../data/local/SSEStreamHandler";
import { EarthquakesProvider } from "./EarthquakesContext";


interface MapViewContextType {
  activeBase: string;
  setActiveBase: (base: string) => void;
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
    const earthquakeHandler = earthquakesDataHandlerRef.current;
    const streamHandler = sseStreamHandlerRef.current;
    earthquakeHandler.reloadEarthquakes();
    stationsDataHandlerRef.current.reloadStations();

    return () => {
      streamHandler.destroy();
      earthquakeHandler.destroy();
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