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
import LoadingScreen from "./components/LoadingScreen";
import ErrorScreen from "./components/ErrorScreen";
import SSEContext from "./SSEContext";
import { EventSourcePolyfill } from 'event-source-polyfill';

const App = () => {
  // use loading screen (with min time) to wait for events and eventsSource
  const [loading, setLoading] = useState(true) 
  const [serverTimedout, setServerTimedout] = useState(false) 
  const stationsRef = useRef([]);  // initial stations data
  const eventsRef = useRef([]);  // initial eq-events data
  const eventSourceRef = useRef(null) // SSE-emitter
  useEffect(() => {
    // get initial eq-events from backend
    const backend_host = process.env.NODE_ENV === 'production'
                         ? process.env.REACT_APP_BACKEND
                         : process.env.REACT_APP_BACKEND_DEV
    
    const fetchStationsPromise = axios.get(`${backend_host}/stationLocations`); 

    const fetchEventsPromise = axios.get(`${backend_host}/eventsList`,
      {params: {
        startTime:moment('2021-09-09 14:30:00.0').format("YYYY-MM-DD HH:mm:ss"),
        endTime:moment().format("YYYY-MM-DD HH:mm:ss"),
      }}
    ); 

    // connect to an emitter for SSE
    const eventSourcePromise = new Promise((resolve, reject) => {
      const source = new EventSourcePolyfill(
        `${backend_host}/messaging`
      )
      source ? resolve(source) : reject('EventSource connection error')
    });

    // to wait at least timeoutPromise time before trigerring a render
    // or timeout if reached and still loading
    const timeoutPromise = new Promise(resolve => {
      setTimeout(()=>{
        resolve();
        if(loading) {setServerTimedout(true)}
      }, 3000);
    })

    Promise.all([fetchStationsPromise, fetchEventsPromise, 
                 eventSourcePromise, timeoutPromise])
      .then((values) => {
        stationsRef.current = values[0].data.map(station => (
          {...station, isPicked: false}
        ));

        eventsRef.current = values[1].data//fetchResult.data
        //TODO: Get last_modification

        eventSourceRef.current = values[2]
        eventSourceRef.current.addEventListener('error', (error) =>{
          //console.log(error)
          console.log('Enetered error handler')
          if(eventSourceRef.current.readyState === 0){ // reconnecting
            console.log('Reconnecting...')
          }
          //eventSourceRef.current.close()
        });
        setLoading(false);
      })
      .catch(errorArray => {
        console.log(errorArray);
      })

    return () => {
      // clean up function 
      if(eventSourceRef.current){
        eventSourceRef.current.close()
      }
      //eventSource.removeEventListener('error',onError)
      //TODO: Remove all event listeners?
    }
  }, []);

  return (
    <>
    {loading ? (
      serverTimedout ? (
        <ErrorScreen />
      ):(
        <LoadingScreen>
          {console.log('render loading screen')}
        </LoadingScreen>
      )
    ):(
      <div className="App">
        {console.log('render app screen')}
        <Header />
        <div className="App-body">
          <SSEContext.Provider value={eventSourceRef.current}>
            <Sidebar >
              <SidebarInfo/>
              <SidebarItems initData={eventsRef.current}/>
            </Sidebar>
            <MapContainer center={[12.2795, 122.049]} zoom={6}>
              <TileLayer
                url='https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              />
              <EventMarkers initEvents={eventsRef.current}/>
              <StationMarkers initStations={stationsRef.current}/>
            </MapContainer>
          </SSEContext.Provider>
        </div>
      </div>
    )}
    </>
  );
}

export default App
