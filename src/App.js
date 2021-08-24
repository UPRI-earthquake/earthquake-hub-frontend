import React from 'react';
import { MapContainer, Popup, TileLayer } from "react-leaflet";
import "./app.css";
import StationMarkers from "./components/StationMarkers";
import EventMarkers from "./components/EventMarkers";
import PickEventListener from "./components/PickEventListener";

function App() {
  return (
    // Header
    // Events bar
      // events tiles
    <div>

    <PickEventListener/>
    <MapContainer center={[12.2795, 122.049]} zoom={6}>
      <TileLayer
        url='https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />

      <StationMarkers />
      <EventMarkers />

    </MapContainer>
    </div>
      
  );
}

export default App
