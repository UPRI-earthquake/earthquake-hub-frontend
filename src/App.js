import React, {useState, useEffect, useRef} from 'react';
import axios from 'axios';
import moment from 'moment';
import { MapContainer, TileLayer } from "react-leaflet";
import "./app.css";
import StationMarkers from "./components/StationMarkers";
import EventMarkers from "./components/EventMarkers";
import Sidebar from "./components/Sidebar";
import SidebarInfo from "./components/SidebarInfo";
import SidebarItems from "./components/SidebarItems";
import Header from "./components/Header";
import SSEContext from "./SSEContext";

const App = () => {
  const [events, setEvents] = useState([]); // useState to persist data
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

  // subscribe to events channel
  const eventSourceRef = useRef(null)
  useEffect(() => {// assign ref to source, will persist across renders
    eventSourceRef.current = new EventSource('http://192.168.1.12:5000/messaging')
    const eventSource = eventSourceRef.current

    const onError = error => {
      console.log(error)
      eventSource.close()
    }

    eventSource.addEventListener('error', onError);

    return () => {
      // clean up function 
      eventSource.close()
      //eventSource.removeEventListener('error',onError)
    }
  }, []);

  return (
    <div className="App">
      <Header />
      <div className="App-body">
        <SSEContext.Provider value={eventSourceRef.current}>
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
        </SSEContext.Provider>
      </div>
    </div>
      
  );
}

export default App
