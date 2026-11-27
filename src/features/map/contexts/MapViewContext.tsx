import L from "leaflet";
import { createContext, useEffect, useMemo, useState } from "react";
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

  const [stationsDataHandler] = useState(() => new StationsDataHandler());
  const [earthquakesDataHandler] = useState(() => new EarthquakesDataHandler());

  // Use a single shared Canvas renderer with a higher click/hover tolerance
  // so both Faults and Plates participate in the same hit-testing layer.
  const vectorRenderer = useMemo(() => L.canvas({ padding: 0.5, tolerance: 12 }), []);


  useEffect(() => {
    earthquakesDataHandler.startTrackingActiveEarthquakes();
    const streamHandler = new SSEStreamHandler({
      stations: stationsDataHandler,
      earthquakes: earthquakesDataHandler
    });
    earthquakesDataHandler.reloadEarthquakes();
    stationsDataHandler.reloadStations();

    return () => {
      streamHandler.destroy();
      earthquakesDataHandler.destroy();
    };
  }, [earthquakesDataHandler, stationsDataHandler]);
  
  return (<MapViewContext.Provider value={{
    activeBase,
    setActiveBase,
    stationsDataHandler,
    earthquakesDataHandler,
    vectorRenderer,
  }}>
    <EarthquakesProvider>
      {children}  
    </EarthquakesProvider>
  </MapViewContext.Provider>);
}
