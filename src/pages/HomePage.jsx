import React, { useState, useEffect, useRef, useCallback } from 'react';
import moment from 'moment';
import { MapContainer, LayersControl, ScaleControl, ZoomControl } from 'react-leaflet';
import './homePage.css';
import StationMarkers from '../components/StationMarkers';
import EventMarkers from '../components/EventMarkers';
import Sidebar from '../components/Sidebar';
import SidebarInfo from '../components/SidebarInfo';
import SidebarItems from '../components/SidebarItems';
import Header from '../components/Header';
import LoadingScreen from '../components/LoadingScreen';
import ErrorScreen from '../components/ErrorScreen';
import SSEContext from '../SSEContext';
import MapLayersControl from '../components/MapLayersControl';
import AttributionControl from '../components/AttributionControl';
import LegendControl from '../components/LegendControl';
import ResetViewControl from '../components/ResetViewControl';
import { OverlayStateProvider } from '../components/OverlayStateContext';
import RegisterableLayerGroup from '../components/RegisterableLayerGroup';
import { useAppData } from '../hooks/useAppData';

/**
 * Main map page with live SSE updates, filters, and sidebar controls.
 * Keeps station list and event stream local to the page.
 *
 * TODO(frontend-team): Extract data fetching and SSE wiring into hooks — simplifies component and improves testability.
 * TODO(frontend-team): Virtualize long lists in SidebarItems — to keep scrolling smooth with many events.
 * @returns {JSX.Element}
 */
const HomePage = () => {
  // use loading screen (with min time) to wait for events and eventsSource
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState(false);
  const stationsRef = useRef([]); // initial stations data
  const [events, setEvents] = useState([]); // initial eq-events data
  const sseEnabledRef = useRef(true);
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
  // Sorting: default to recent-first by time
  const [sort, setSort] = useState(() => ({ by: 'time', order: 'desc' }));
  // Future preset-driven control visibility (default: show both)
  const [controlVisibility, setControlVisibility] = useState(() => ({
    showFilter: true,
    showSort: true,
  }));
  const [filterBounds, setFilterBounds] = useState(() => ({
    minDate: moment().subtract(30, 'days').format('YYYY-MM-DD'),
    maxDate: moment().format('YYYY-MM-DD'),
  }));
  // Responsive scalebar width to avoid overlap with Legend on small screens
  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1024));
  useEffect(() => {
    const onR = () => setVw(window.innerWidth || 1024);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

  // Extract initial load + SSE wiring and range fetching into a hook
  const setStationsRefStable = useCallback((arr) => {
    stationsRef.current = arr;
  }, []);
  const { eventSourceRef, fetchEventsForRange, performInitialLoad } = useAppData({
    sseEnabledRef,
    setEvents,
    setStationsRef: setStationsRefStable,
    setLoading,
    setServerError,
  });

  useEffect(() => {
    // keep a current ref so SSE handler can check live mode
    sseEnabledRef.current = sseEnabled;
  }, [sseEnabled]);

  useEffect(() => performInitialLoad(), [performInitialLoad]);

  return (
    <>
      {
        serverError ? (
          <ErrorScreen />
        ) : loading ? (
          <LoadingScreen />
        ) : (
          <div className="App">
            <Header initStations={stationsRef.current} />
            <div className="App-body">
              <SSEContext.Provider value={eventSourceRef.current}>
                <Sidebar>
                  <SidebarInfo
                    title={presetTitle}
                    collapsed={sidebarCollapsed}
                    onToggle={() => setSidebarCollapsed((v) => !v)}
                    searchText={searchText}
                    onSearch={setSearchText}
                    defaultFilters={filters}
                    filterBounds={filterBounds}
                    onFiltersChange={(f) => setFilters((prev) => ({ ...prev, ...f }))}
                    selectedPresetKey={presetKey}
                    showFilter={controlVisibility.showFilter}
                    showSort={controlVisibility.showSort}
                    sortBy={sort.by}
                    sortOrder={sort.order}
                    onSortChange={(next) => setSort((prev) => ({ ...prev, ...next }))}
                    onPresetChange={(key) => {
                      if (key === 'latest-30d') {
                        setPresetTitle('Latest Earthquakes (30 days)');
                        setPresetKey('latest-30d');
                        setSseEnabled(true); // live mode
                        setCustomEvents(null);
                        setControlVisibility({ showFilter: true, showSort: true });

                        const start = moment().subtract(30, 'days').format('YYYY-MM-DD');
                        const end = moment().format('YYYY-MM-DD');

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
                        setSseEnabled(false); // historical view (freeze live stream)
                        setCustomEvents(null);
                        setControlVisibility({ showFilter: true, showSort: true });

                        const start = '2025-01-01';
                        const end = '2025-12-31';

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
                        setControlVisibility({ showFilter: true, showSort: true });

                        const start = '2024-01-01';
                        const end = '2024-12-31';

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
                        setControlVisibility({ showFilter: true, showSort: true });

                        const start = '2023-01-01';
                        const end = '2023-12-31';

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
                  <SidebarItems
                    initData={customEvents || events}
                    filters={{ ...filters, searchText }}
                    sort={sort}
                    sseEnabled={sseEnabled}
                  />
                </Sidebar>
                <MapContainer
                  center={[12.2795, 122.049]}
                  zoom={6}
                  minZoom={2}
                  zoomControl={false}
                  worldCopyJump
                  // Hard-stop vertically at WebMercator limits, but keep
                  // very wide longitudes so horizontal panning is not blocked.
                  maxBounds={[
                    [-85.0511, -360],
                    [85.0511, 360],
                  ]}
                  maxBoundsViscosity={1.0}
                  preferCanvas
                  whenCreated={(m) => (window.__leaflet_map__ = m)}
                >
                  {/* Zoom at top-left (requested) */}
                  <ZoomControl position="topleft" />
                  {/* Reset to Philippines bbox, placed under Zoom with spacing */}
                  <ResetViewControl position="topleft" />
                  {/* Global attribution control without Leaflet prefix */}
                  <AttributionControl />
                  {/* Legend + Basemaps/Overlays with synced state */}
                  <OverlayStateProvider>
                    <MapLayersControl>
                      <LayersControl.Overlay checked name="Earthquakes">
                        <RegisterableLayerGroup overlayId="earthquakes">
                          {/* Render earthquake markers for the current dataset + filters */}
                          <EventMarkers
                            initEvents={customEvents || events}
                            filters={filters}
                            sseEnabled={sseEnabled}
                            datasetKey={presetKey}
                          />
                        </RegisterableLayerGroup>
                      </LayersControl.Overlay>
                      <LayersControl.Overlay checked name="Stations">
                        <RegisterableLayerGroup overlayId="stations">
                          <StationMarkers initStations={stationsRef.current} />
                        </RegisterableLayerGroup>
                      </LayersControl.Overlay>
                    </MapLayersControl>
                    {/* Metric scalebar; bottom-left on desktop, top-center on mobile */}
                    <ScaleControl
                      position={vw < 768 ? 'topleft' : 'bottomleft'}
                      metric
                      imperial={false}
                      maxWidth={vw < 480 ? 110 : vw < 768 ? 140 : 200}
                    />
                    <LegendControl />
                  </OverlayStateProvider>
                </MapContainer>
              </SSEContext.Provider>
            </div>
          </div>
        ) /* serverError*/ // loading
      }
    </>
  ); // return
};

export default HomePage;
