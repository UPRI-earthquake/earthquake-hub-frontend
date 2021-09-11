import React, {useState, useEffect} from 'react';
import axios from 'axios';
import moment from 'moment';
import { MapContainer, TileLayer } from "react-leaflet";
import "./app.css";
import StationMarkers from "./components/StationMarkers";
import EventMarkers from "./components/EventMarkers";
import Sidebar from "./components/Sidebar";
import SidebarInfo from "./components/SidebarInfo"
import SidebarItems from "./components/SidebarItems"
import Header from "./components/Header"

const App = () => {
  const [events, setEvents] = useState([]);  
  useEffect(() => {
    const fetchData = async () => {
      const result = await axios.get('http://192.168.1.12:5000/eventsList',
        {params: {
          startTime:moment('2021-09-09 14:30:00.0').format("YYYY-MM-DD HH:mm:ss"),
          endTime:moment().format("YYYY-MM-DD HH:mm:ss"),
        }}
      ); 
      setEvents(result.data);
    };
    fetchData();
  }, []);

  return (
    <div className="App">
      <Header />
      <div className="App-body">
        <Sidebar >
          <SidebarInfo/>
          <SidebarItems initData={events}/>
        </Sidebar>
        <MapContainer center={[12.2795, 122.049]} zoom={6}>
          <TileLayer
            url='https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />

          <EventMarkers events={events}/>
          <StationMarkers />

        </MapContainer>
      </div>
    </div>
      
  );
}

export default App
