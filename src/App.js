import React from 'react';
import { MapContainer, TileLayer } from "react-leaflet";
import "./app.css";
import StationMarkers from "./components/StationMarkers";
import EventMarkers from "./components/EventMarkers";
import Sidebar from "./components/Sidebar";
import SidebarItem from "./components/SidebarItem"

function App() {
  const data = require('./components/events.json');
  return (
    // Header
    // Events bar
      // events tiles
    <div className="App">
    <Sidebar >
      {data.map(row => 
        <SidebarItem 
          key={row.publicId}
          title={+row.magnitude_value.toFixed(1)}
          description={row.place}
          subDescription={row.OT}
        />
      )}
    </Sidebar>
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
