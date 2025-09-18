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
  const [events, setEvents] = useState([]);  // initial eq-events data
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

  const fetchEventsForRange = async (startDateISO, endDateISO) => {
    const backend_host = process.env.NODE_ENV === 'production'
      ? window['ENV'].REACT_APP_BACKEND
      : window['ENV'].REACT_APP_BACKEND_DEV;

    // Normalize to whole-day bounds to be safe for date-only inputs
    const startTs = moment(startDateISO).startOf('day').format('YYYY-MM-DD HH:mm:ss');
    const endTs   = moment(endDateISO).endOf('day').format('YYYY-MM-DD HH:mm:ss');

    try { axios.defaults.withCredentials = true; } catch (_) {}

    const res = await axios.get(`${backend_host}/eq-events`, {
      params: { startTime: startTs, endTime: endTs },
    });

    // Replace with a new array reference so children see an update
    setEvents((res.data?.payload || []).slice());
    // console.log(`Fetched ${events.length} events for ${startDateISO} to ${endDateISO}`);
  };

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

        setEvents(values[1].data.payload || []);//fetchResult.data
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
                      setSseEnabled(true);       // live mode
                      setCustomEvents(null);

                      const start = moment().subtract(30, 'days').format('YYYY-MM-DD');
                      const end   = moment().format('YYYY-MM-DD');

                      setFilters({
                        magMin: 0,
                        magMax: 10,
                        startDate: start,
                        endDate: end,
                      });
                      setFilterBounds({
                        minDate: start,
                        maxDate: end,
                      });

                      // Refetch events for the latest 30d whenever switching back
                      fetchEventsForRange(start, end).catch(console.error);

                    } else if (key === 'year-2025') {
                      setPresetTitle('2025 Earthquakes');
                      setPresetKey('year-2025');
                      setSseEnabled(false);      // historical view (freeze live stream)
                      setCustomEvents(null);

                      const start = '2025-01-01';
                      const end   = '2025-12-31';

                      setFilters({
                        magMin: 0,
                        magMax: 10,
                        startDate: start,
                        endDate: end,
                      });
                      setFilterBounds({
                        minDate: start,
                        maxDate: end,
                      });

                      fetchEventsForRange(start, end).catch(console.error);

                    } else if (key === 'year-2024') {
                      setPresetTitle('2024 Earthquakes');
                      setPresetKey('year-2024');
                      setSseEnabled(false);
                      setCustomEvents(null);

                      const start = '2024-01-01';
                      const end   = '2024-12-31';

                      setFilters({
                        magMin: 0,
                        magMax: 10,
                        startDate: start,
                        endDate: end,
                      });
                      setFilterBounds({
                        minDate: start,
                        maxDate: end,
                      });

                      fetchEventsForRange(start, end).catch(console.error);

                    } else if (key === 'year-2023') {
                      setPresetTitle('2023 Earthquakes');
                      setPresetKey('year-2023');
                      setSseEnabled(false);
                      setCustomEvents(null);

                      const start = '2023-01-01';
                      const end   = '2023-12-31';

                      setFilters({
                        magMin: 0,
                        magMax: 10,
                        startDate: start,
                        endDate: end,
                      });
                      setFilterBounds({
                        minDate: start,
                        maxDate: end,
                      });

                      fetchEventsForRange(start, end).catch(console.error);
                    }
                  }}
                />
                <SidebarItems initData={customEvents || events} filters={{ ...filters, searchText }} sseEnabled={sseEnabled} />
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
                      <EventMarkers initEvents={customEvents || events} filters={filters} sseEnabled={sseEnabled} />
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
