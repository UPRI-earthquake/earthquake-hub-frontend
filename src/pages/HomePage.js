import React, {useState, useEffect, useRef} from 'react';
import axios from 'axios';
import moment from 'moment';
import { MapContainer, LayersControl } from "react-leaflet";
import "./homePage.css";
import StationMarkers from "../components/StationMarkers";
import EventMarkers from "../components/EventMarkers";
import Sidebar from "../components/Sidebar";
import SidebarInfo from "../components/SidebarInfo";
import SidebarItems from "../components/SidebarItems";
import Header from "../components/Header";
import LoadingScreen from "../components/LoadingScreen";
import ErrorScreen from "../components/ErrorScreen";
import SSEContext from "../SSEContext";
import { EventSourcePolyfill } from 'event-source-polyfill';
import MapLayersControl from '../components/MapLayersControl';
import AttributionControl from '../components/AttributionControl';
import LegendControl from '../components/LegendControl';
import { OverlayStateProvider } from '../components/OverlayStateContext';
import RegisterableLayerGroup from '../components/RegisterableLayerGroup';

const HomePage = () => {
  // use loading screen (with min time) to wait for events and eventsSource
  const [loading, setLoading] = useState(true)
  const [serverError, setServerError] = useState(false)
  const stationsRef = useRef([]);  // initial stations data
  const eventsRef = useRef([]);  // initial eq-events data
  const eventSourceRef = useRef(null) // SSE-emitter
  // Sidebar UI state (frontend-only)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [presetTitle, setPresetTitle] = useState('Latest Earthquakes (30 days)');
  const [presetKey, setPresetKey] = useState('latest-30d');
  const [sseEnabled, setSseEnabled] = useState(true);
  const [customEvents, setCustomEvents] = useState(null);
  const [filters, setFilters] = useState(() => ({
    magMin: 0,
    magMax: 10,
    startDate: moment().subtract(30, 'days').format('YYYY-MM-DD'),
    endDate: moment().format('YYYY-MM-DD'),
  }));
  const [filterBounds, setFilterBounds] = useState(() => ({
    minDate: moment().subtract(30, 'days').format('YYYY-MM-DD'),
    maxDate: moment().format('YYYY-MM-DD'),
  }));
  useEffect(() => {
    // get initial eq-events from backend
    const backend_host = process.env.NODE_ENV === 'production'
                         ? window['ENV'].REACT_APP_BACKEND
                         : window['ENV'].REACT_APP_BACKEND_DEV

    // get past 1 month when in production
    const start_time = process.env.NODE_ENV === 'production'
                         ? moment().subtract(1, 'months')
                         : moment('2021-09-09 14:30:00.0')

    const fetchStationsPromise = axios.get(`${backend_host}/device/all`); 

    const fetchEventsPromise = axios.get(`${backend_host}/eq-events`,
      {params: {
        startTime: start_time.format("YYYY-MM-DD HH:mm:ss"),
        endTime: moment().format("YYYY-MM-DD HH:mm:ss"),
      }}
    );

    // connect to an emitter for SSE
    const eventSourcePromise = new Promise((resolve, reject) => {
      const source = new EventSourcePolyfill(
        `${backend_host}/messaging`
      )
      source ? resolve(source) : reject('EventSource connection error')
    });

    // to wait at least 3sec before trigerring a render
    const waitingPromise = new Promise(resolve => {
      setTimeout(()=>{
        resolve();
        //setDoneWaiting(true);
      }, 3000);
    })

    Promise.all([fetchStationsPromise, fetchEventsPromise,
                 eventSourcePromise, waitingPromise])
      .then((values) => {
        stationsRef.current = values[0].data.payload.map(station => (
          {...station, isPicked: false}
        ));

        eventsRef.current = values[1].data.payload//fetchResult.data
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
        setServerError(true);
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
    {serverError ? (
      <ErrorScreen />
    ):(
      loading ? (
        <LoadingScreen>
          {console.log('render loading screen')}
        </LoadingScreen>
      ):(
        <div className="App">
          {console.log('render app screen')}
          <Header initStations={stationsRef.current}/>
          <div className="App-body">
            <SSEContext.Provider value={eventSourceRef.current}>
              <Sidebar>
                <SidebarInfo
                  title={presetTitle}
                  collapsed={sidebarCollapsed}
                  onToggle={() => setSidebarCollapsed(v => !v)}
                  searchText={searchText}
                  onSearch={setSearchText}
                  defaultFilters={filters}
                  filterBounds={filterBounds}
                  onFiltersChange={(f) => setFilters(prev => ({ ...prev, ...f }))}
                  selectedPresetKey={presetKey}
                  onPresetChange={(key) => {
                    if (key === 'latest-30d') {
                      setPresetTitle('Latest Earthquakes (30 days)');
                      setPresetKey('latest-30d');
                      setSseEnabled(true);
                      setCustomEvents(null);
                      setFilters({
                        magMin: 0,
                        magMax: 10,
                        startDate: moment().subtract(30, 'days').format('YYYY-MM-DD'),
                        endDate: moment().format('YYYY-MM-DD')
                      });
                      setFilterBounds({
                        minDate: moment().subtract(30, 'days').format('YYYY-MM-DD'),
                        maxDate: moment().format('YYYY-MM-DD')
                      });
                    } else if (key === 'major-2022-2023') {
                      setPresetTitle('Major Earthquakes (2022–2023)');
                      setPresetKey('major-2022-2023');
                      setSseEnabled(false);
                      setFilters({
                        magMin: 7,
                        magMax: 10,
                        startDate: moment('2022-01-01').format('YYYY-MM-DD'),
                        endDate: moment('2023-12-31').format('YYYY-MM-DD')
                      });
                      setFilterBounds({
                        minDate: moment('2022-01-01').format('YYYY-MM-DD'),
                        maxDate: moment('2023-12-31').format('YYYY-MM-DD')
                      });
                      // Fetch curated significant EQs and transform to map/list shape
                      (async () => {
                        try {
                          const backend_host = process.env.NODE_ENV === 'production'
                            ? window['ENV'].REACT_APP_BACKEND
                            : window['ENV'].REACT_APP_BACKEND_DEV;
                          // Include cookies for backends that require auth/session
                          try { axios.defaults.withCredentials = true; } catch (_) {}
                          const res = await axios.get(`${backend_host}/significant-eqs/all`);
                          const arr = (res.data?.payload || [])
                            .map((x) => ({
                              publicID: x._id || `${x.latitude},${x.longitude},${x.eventTime}`,
                              OT: x.eventTime,
                              latitude_value: x.latitude,
                              longitude_value: x.longitude,
                              magnitude_value: x.magnitude,
                              depth_km: x.depth,
                              place: x.location,
                              text: x.eventSummary,
                              eventType: undefined,
                              last_modification: undefined,
                            }))
                            // ensure only 10, sorted by time desc
                            .sort((a,b) => new Date(b.OT) - new Date(a.OT))
                            .slice(0, 10);
                          setCustomEvents(arr);
                          // Optionally fit map to curated events so users can see them
                          try {
                            const map = window.__leaflet_map__;
                            if (map && arr.length) {
                              const lats = arr.map(e => Number(e.latitude_value)).filter(n => Number.isFinite(n));
                              const lngs = arr.map(e => Number(e.longitude_value)).filter(n => Number.isFinite(n));
                              if (lats.length && lngs.length) {
                                const south = Math.min(...lats);
                                const north = Math.max(...lats);
                                const west = Math.min(...lngs);
                                const east = Math.max(...lngs);
                                map.fitBounds([[south, west], [north, east]], { padding: [24, 24] });
                              }
                            }
                          } catch (err) {
                            // non-fatal
                          }
                        } catch (e) {
                          console.error('Failed fetching significant-eqs:', e);
                          // Leave customEvents as null so UI falls back to latest feed
                          setCustomEvents(null);
                        }
                      })();
                    } else if (key === 'year-2025') {
                      setPresetTitle('2025 Earthquakes');
                      setPresetKey('year-2025');
                      setSseEnabled(true);
                      setCustomEvents(null);
                      setFilters({
                        magMin: 0,
                        magMax: 10,
                        startDate: moment('2025-01-01').format('YYYY-MM-DD'),
                        endDate: moment('2025-12-31').format('YYYY-MM-DD')
                      });
                      setFilterBounds({
                        minDate: moment('2025-01-01').format('YYYY-MM-DD'),
                        maxDate: moment('2025-12-31').format('YYYY-MM-DD')
                      });
                    } else if (key === 'year-2024') {
                      setPresetTitle('2024 Earthquakes');
                      setPresetKey('year-2024');
                      setSseEnabled(true);
                      setCustomEvents(null);
                      setFilters({
                        magMin: 0,
                        magMax: 10,
                        startDate: moment('2024-01-01').format('YYYY-MM-DD'),
                        endDate: moment('2024-12-31').format('YYYY-MM-DD')
                      });
                      setFilterBounds({
                        minDate: moment('2024-01-01').format('YYYY-MM-DD'),
                        maxDate: moment('2024-12-31').format('YYYY-MM-DD')
                      });
                    }
                  }}
                />
                <SidebarItems initData={customEvents || eventsRef.current} filters={{ ...filters, searchText }} sseEnabled={sseEnabled} />
              </Sidebar>
              <MapContainer
                center={[12.2795, 122.049]}
                zoom={6}
                minZoom={2}
                worldCopyJump
                // Hard-stop vertically at WebMercator limits, but keep
                // very wide longitudes so horizontal panning is not blocked.
                maxBounds={[[-85.0511, -360], [85.0511, 360]]}
                maxBoundsViscosity={1.0}
                preferCanvas
                whenCreated={(m)=> (window.__leaflet_map__ = m)}
              >
                {/* Global attribution control without Leaflet prefix */}
                <AttributionControl />
                {/* Legend + Basemaps/Overlays with synced state */}
                <OverlayStateProvider>
                  <MapLayersControl>
                  <LayersControl.Overlay checked name="Earthquakes">
                    <RegisterableLayerGroup overlayId="earthquakes">
                      <EventMarkers initEvents={customEvents || eventsRef.current} filters={filters} sseEnabled={sseEnabled} />
                    </RegisterableLayerGroup>
                  </LayersControl.Overlay>
                  <LayersControl.Overlay checked name="Stations">
                    <RegisterableLayerGroup overlayId="stations">
                      <StationMarkers initStations={stationsRef.current}/>
                    </RegisterableLayerGroup>
                  </LayersControl.Overlay>
                  </MapLayersControl>
                  <LegendControl />
                </OverlayStateProvider>
              </MapContainer>
            </SSEContext.Provider>
          </div>
        </div>
      ) // loading
    )/* serverError*/}
    </>
  ); // return
}

export default HomePage
