import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import moment from 'moment';
import { MapContainer, LayersControl, ScaleControl, ZoomControl, Pane } from 'react-leaflet';
import './homePage.css';
import StationMarkers from '../components/StationMarkers';
import EventMarkers from '../components/EventMarkers';
import Sidebar from '../components/Sidebar';
import SidebarInfo from '../components/SidebarInfo';
import SidebarItems from '../components/SidebarItems';
import SidebarStations from '../components/SidebarStations';
import Header from '../components/Header';
import LoadingScreen from '../components/LoadingScreen';
import ErrorScreen from '../components/ErrorScreen';
import SSEContext from '../SSEContext';
import MapLayersControl from '../components/MapLayersControl';
import AttributionControl from '../components/AttributionControl';
import LegendControl from '../components/LegendControl';
import ResetViewControl from '../components/ResetViewControl';
import { resetToPH } from '../utils/resetView';
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
  const dispatch = useDispatch();
  // use loading screen (with min time) to wait for events and eventsSource
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState(false);
  const stationsRef = useRef([]); // initial stations data (for markers)
  const [stations, setStations] = useState([]); // reactive list for sidebar + counts
  const [events, setEvents] = useState([]); // initial eq-events data
  const sseEnabledRef = useRef(true);
  // Sidebar UI state (frontend-only)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [datasetTitle, setDatasetTitle] = useState('Latest Earthquakes (30 days)');
  const [datasetKey, setDatasetKey] = useState('latest-30d');
  const [listLoading, setListLoading] = useState(false);
  const [sseEnabled, setSseEnabled] = useState(true);
  const [customEvents, setCustomEvents] = useState(null);
  // Gate EQ markers during dataset switches until the map finishes returning to PH
  const [holdEqMarkers, setHoldEqMarkers] = useState(false);
  const [filters, setFilters] = useState(() => ({
    magMin: 0,
    magMax: 10,
    startDate: moment().subtract(30, 'days').format('YYYY-MM-DD'),
    endDate: moment().format('YYYY-MM-DD'),
  }));
  // Sorting: default to recent-first by time
  const [sort, setSort] = useState(() => ({ by: 'time', order: 'desc' }));
  // Dataset-driven control visibility (default: show both)
  const [controlVisibility, setControlVisibility] = useState(() => ({
    showFilter: true,
    showSort: true,
  }));
  const [stationActiveOnly, setStationActiveOnly] = useState(false);
  const [filterBounds, setFilterBounds] = useState(() => ({
    minDate: moment().subtract(30, 'days').format('YYYY-MM-DD'),
    maxDate: moment().format('YYYY-MM-DD'),
  }));
  const [lastEqKey, setLastEqKey] = useState('latest-30d');
  const eqBadgeLabel = lastEqKey === 'all-eqs' ? 'All EQs' : 'Latest EQs';
  // Cache for the expensive All EQs dataset to avoid refetching
  const allEqsCacheRef = useRef(null);
  // Scalebar: use a single, consistent mobile-style configuration

  // Extract initial load + SSE wiring and range fetching into a hook
  const setStationsRefStable = useCallback((arr) => {
    stationsRef.current = arr;
    setStations(arr);
  }, []);
  const applyStationUpdate = useCallback((raw) => {
    try {
      // Normalize incoming payload across various SSE event types
      const code = String(
        raw.stationCode || raw.station || raw.code || raw.station_id || raw.stationcode || '',
      ).toUpperCase();
      if (!code) return;
      const network = String(
        raw.network || raw.networkCode || raw.network_code || raw.net || 'AM',
      ).toUpperCase();
      let activity = null;
      const s = String(raw.status || raw.activity || '').toLowerCase();
      if (s === 'streaming' || s === 'active' || s === 'online') activity = 'active';
      else if (s === 'not streaming' || s === 'inactive' || s === 'offline') activity = 'inactive';
      else if (typeof raw.isActive === 'boolean') activity = raw.isActive ? 'active' : 'inactive';
      const since =
        raw.statusSince || raw.status_since || raw.timestamp || raw.time || raw.lastActive || null;
      setStations((prev) => {
        const idx = prev.findIndex(
          (st) => String(st.code || '').toUpperCase() === code && String(st.network || 'AM').toUpperCase() === network,
        );
        if (idx === -1) return prev;
        const curr = prev[idx];
        const next = { ...curr };
        if (activity) next.activity = activity;
        // Prefer provided statusSince; if switching state with none, set now
        const wasActive = String(curr.activity || '').toLowerCase() === 'active';
        const becameActive = activity === 'active' && !wasActive;
        const becameInactive = activity === 'inactive' && wasActive;
        if (since) next.statusSince = since;
        else if (becameActive || becameInactive) next.statusSince = new Date().toISOString();
        const arr = prev.slice();
        arr[idx] = next;
        stationsRef.current = arr;
        // Also refresh the shared tooltip cache so hover shows latest immediately
        try {
          const key = `${network}:${code}`;
          const cache =
            (typeof window !== 'undefined' && (window.__stationStatusCache || (window.__stationStatusCache = new Map()))) ||
            new Map();
          const statusStr = (raw.status && String(raw.status).toLowerCase()) ||
            (next.activity === 'active' ? 'streaming' : 'not streaming');
          cache.set(key, { t: Date.now(), status: statusStr, statusSince: next.statusSince || null });
          if (typeof window !== 'undefined') window.__stationStatusCache = cache;
        } catch (_) {}
        return arr;
      });
    } catch (_) {}
  }, []);

  const { eventSourceRef, fetchEventsForRange, performInitialLoad, fetchStations } = useAppData({
    sseEnabledRef,
    setEvents,
    setStationsRef: setStationsRefStable,
    setLoading,
    setServerError,
    applyStationUpdate,
  });

  useEffect(() => {
    // keep a current ref so SSE handler can check live mode
    sseEnabledRef.current = sseEnabled;
  }, [sseEnabled]);

  useEffect(() => performInitialLoad(), [performInitialLoad]);

  // No longer need a separate clear helper; reuse shared resetToPH

  // Helper to set filter bounds for All EQs using the fetched data
  const applyAllEqsBounds = useCallback(
    (arr) => {
      const end = moment().format('YYYY-MM-DD');
      const earliestStart = '1900-01-01';
      const minOT = (arr || [])
        .map((e) => (e.OT ? new Date(e.OT) : null))
        .filter((d) => d && !isNaN(d))
        .reduce((min, d) => (min && min < d ? min : d), null);
      const minDate = minOT ? moment(minOT).format('YYYY-MM-DD') : earliestStart;
      setFilters({
        magMin: 0,
        magMax: 10,
        startDate: minDate,
        endDate: end,
      });
      setFilterBounds({
        minDate,
        maxDate: end,
      });
    },
    [setFilters, setFilterBounds],
  );

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
                <Sidebar scrollResetKey={datasetKey}>
                  <SidebarInfo
                    title={datasetTitle}
                    collapsed={sidebarCollapsed}
                    onToggle={() => setSidebarCollapsed((v) => !v)}
                    searchText={searchText}
                    onSearch={setSearchText}
                    defaultFilters={filters}
                    filterBounds={filterBounds}
                    onFiltersChange={(f) => setFilters((prev) => ({ ...prev, ...f }))}
                    selectedDatasetKey={datasetKey}
                    showFilter={controlVisibility.showFilter}
                    showSort={controlVisibility.showSort}
                    sortBy={sort.by}
                    sortOrder={sort.order}
                    onSortChange={(next) => setSort((prev) => ({ ...prev, ...next }))}
                    onDatasetChange={(key) => {
                      // Hold EQ markers until map finishes flyTo to reduce clutter
                      try {
                        setHoldEqMarkers(true);
                        const map = typeof window !== 'undefined' ? window.__leaflet_map__ : null;
                        if (map && typeof map.once === 'function') {
                          const release = () => {
                            try { setHoldEqMarkers(false); } catch (_) {}
                          };
                          map.once('moveend', release);
                          // Safety: also release if no move occurred within 1.2s
                          setTimeout(release, 1200);
                        } else {
                          // Fallback release on next tick if map not yet ready
                          setTimeout(() => setHoldEqMarkers(false), 0);
                        }
                      } catch (_) {}
                      if (key === 'latest-30d') {
                        // Reset map to PH and clear selection/popup
                        resetToPH({ dispatch });
                        setLastEqKey('latest-30d');
                        setDatasetTitle('Latest Earthquakes (30 days)');
                        setDatasetKey('latest-30d');
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
                        setListLoading(true);
                        fetchEventsForRange(start, end)
                          .catch(console.error)
                          .finally(() => setListLoading(false));
                      } else if (key === 'all-eqs') {
                        // Reset map to PH and clear selection/popup
                        resetToPH({ dispatch });
                        setLastEqKey('all-eqs');
                        setDatasetTitle('All Earthquakes');
                        setDatasetKey('all-eqs');
                        setSseEnabled(true); // keep live SSE updates enabled
                        setCustomEvents(null);
                        setControlVisibility({ showFilter: true, showSort: true });

                        const end = moment().format('YYYY-MM-DD');
                        const earliestStart = '1900-01-01';
                        // Use cached All EQs if available; otherwise fetch and cache
                        if (allEqsCacheRef.current && Array.isArray(allEqsCacheRef.current)) {
                          // Use cached data and update the visible list immediately
                          applyAllEqsBounds(allEqsCacheRef.current);
                          setEvents(allEqsCacheRef.current);
                        } else {
                          setListLoading(true);
                          fetchEventsForRange(earliestStart, end)
                            .then((arr) => {
                              allEqsCacheRef.current = arr || [];
                              applyAllEqsBounds(arr || []);
                            })
                            .catch(console.error)
                            .finally(() => setListLoading(false));
                        }
                      } else if (key === 'all-stations') {
                        // Reset map to PH and clear selection/popup
                        resetToPH({ dispatch });
                        setDatasetTitle('All Stations');
                        setDatasetKey('all-stations');
                        setSseEnabled(true);
                        setCustomEvents(null);
                        setControlVisibility({ showFilter: false, showSort: false });
                        setStationActiveOnly(false);
                        setListLoading(false);
                        // Refresh station list from backend so counts and status are current
                        try {
                          fetchStations()
                            .then((arr) => setStationsRefStable(arr || []))
                            .catch(() => {})
                            .finally(() => {});
                        } catch (_) {}
                        // No EQ markers for stations dataset; safe to release immediately
                        try { setHoldEqMarkers(false); } catch (_) {}
                      }
                    }}
                    eqBadgeLabel={eqBadgeLabel}
                    stationCounts={{
                      active: (stations || []).filter(
                        (s) => String(s.activity || '').toLowerCase() === 'active',
                      ).length,
                      inactive: (stations || []).filter(
                        (s) => String(s.activity || '').toLowerCase() !== 'active',
                      ).length,
                    }}
                    activeOnlyStations={stationActiveOnly}
                    onActiveOnlyChange={setStationActiveOnly}
                  />
                  {datasetKey === 'all-stations' ? (
                    <SidebarStations initStations={stations} searchText={searchText} activeOnly={stationActiveOnly} />
                  ) : (
                    <SidebarItems
                      initData={customEvents || events}
                      filters={{ ...filters, searchText }}
                      sort={sort}
                      sseEnabled={sseEnabled}
                      loading={listLoading}
                    />
                  )}
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
                  {/* Ensure the custom EQ pane exists before any markers mount */}
                  <Pane name="eqMarkers" style={{ zIndex: 620, pointerEvents: 'auto' }} />
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
                        {/**
                         * Key the LayerGroup by the active dataset so Leaflet gets a
                         * brand‑new group whenever datasets switch. This prevents any
                         * stale markers from a previous dataset lingering in the group
                         * when the overlay is toggled off and later re‑enabled.
                         */}
                        <RegisterableLayerGroup overlayId="earthquakes" key={datasetKey}>
                          {/* Render earthquake markers after map settles back to PH */}
                          {!holdEqMarkers && (
                            <EventMarkers
                              initEvents={customEvents || events}
                              filters={{ ...filters, searchText }}
                              sseEnabled={sseEnabled}
                              datasetKey={datasetKey}
                            />
                          )}
                        </RegisterableLayerGroup>
                      </LayersControl.Overlay>
                      <LayersControl.Overlay checked name="Stations">
                        <RegisterableLayerGroup overlayId="stations">
                          <StationMarkers initStations={stationsRef.current} />
                        </RegisterableLayerGroup>
                      </LayersControl.Overlay>
                    </MapLayersControl>
                    {/* Metric scalebar; always top-center (mobile style) */}
                    <ScaleControl position="topleft" metric imperial={false} maxWidth={140} />
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
