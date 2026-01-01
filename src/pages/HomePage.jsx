import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense, lazy } from 'react';
import { useDispatch } from 'react-redux';
import moment from '../utils/time';
import './homePage.css';
import Header from '../components/Header';
import LoadingScreen from '../components/LoadingScreen';
import ErrorScreen from '../components/ErrorScreen';
import SSEContext from '../SSEContext';
import EventsPanel from '../components/EventsPanel';
import StationsPanel from '../components/StationsPanel';
import { resetToPH } from '../utils/resetView';
import { trackEvent } from '../analytics';
import { useAppData } from '../hooks/useAppData';
import { useTheme } from '../theme/ThemeProvider';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { normalizeDeviceActivity } from '../utils/deviceStatus';

const MapView = lazy(() => import('../components/MapView'));

const latestRangeDefaults = () => ({
  startDate: moment().subtract(30, 'days').format('YYYY-MM-DD'),
  endDate: moment().format('YYYY-MM-DD'),
});

const earliestAllStart = '1900-01-01';
const ChevronLeftIcon = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <polyline points="14 4 8 12 14 20" />
  </svg>
);
const ChevronRightIcon = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <polyline points="10 4 16 12 10 20" />
  </svg>
);

const HomePage = () => {
  const dispatch = useDispatch();
  const { resolvedTheme } = useTheme();
  const isCompactPanels = useMediaQuery('(max-width: 1100px)');
  const [activePanel, setActivePanel] = useState('events');
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef(null);
  const revealButtonRef = useRef(null);

  useEffect(() => {
    if (!isCompactPanels) {
      setActivePanel('events');
    }
  }, [isCompactPanels]);

  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState(false);

  const stationsRef = useRef([]);
  const [stations, setStations] = useState([]);
  const [stationSearch, setStationSearch] = useState('');
  const [stationStatusFilter, setStationStatusFilter] = useState(null);

  const [latestEvents, setLatestEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [eventScope, setEventScope] = useState('latest');
  const [eventsLoading, setEventsLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const initialRange = latestRangeDefaults();
  const [filters, setFilters] = useState({
    magMin: 0,
    magMax: 10,
    startDate: initialRange.startDate,
    endDate: initialRange.endDate,
  });
  const [filterBounds, setFilterBounds] = useState({
    minDate: initialRange.startDate,
    maxDate: initialRange.endDate,
  });
  const [sort, setSort] = useState({ by: 'time', order: 'desc' });

  const allEqsCacheRef = useRef(null);
  const sseEnabledRef = useRef(true);

  const setStationsRefStable = useCallback((arr) => {
    stationsRef.current = arr;
    setStations(arr);
  }, []);

  const applyStationUpdate = useCallback((raw) => {
    try {
      const code = String(
        raw.stationCode || raw.station || raw.code || raw.station_id || raw.stationcode || '',
      ).toUpperCase();
      if (!code) return;
      const network = String(
        raw.network || raw.networkCode || raw.network_code || raw.net || 'AM',
      ).toUpperCase();
      let activity = null;
      const state = normalizeDeviceActivity(raw.activity || raw.status || '');
      if (state === 'active' || state === 'inactive' || state === 'unlinked') activity = state;
      else if (typeof raw.isActive === 'boolean') activity = raw.isActive ? 'active' : 'inactive';
      const since =
        raw.statusSince || raw.status_since || raw.timestamp || raw.time || raw.lastActive || null;
      setStations((prev) => {
        const idx = prev.findIndex(
          (st) =>
            String(st.code || '').toUpperCase() === code &&
            String(st.network || 'AM').toUpperCase() === network,
        );
        if (idx === -1) return prev;
        const curr = prev[idx];
        const next = { ...curr };
        if (activity) next.activity = activity;
        const wasActive = String(curr.activity || '').toLowerCase() === 'active';
        const becameActive = activity === 'active' && !wasActive;
        const becameInactive = activity === 'inactive' && wasActive;
        if (since) next.statusSince = since;
        else if (becameActive || becameInactive) next.statusSince = new Date().toISOString();
        const arr = prev.slice();
        arr[idx] = next;
        stationsRef.current = arr;
        try {
          const key = `${network}:${code}`;
          const cache =
            (typeof window !== 'undefined' &&
              (window.__stationStatusCache || (window.__stationStatusCache = new Map()))) ||
            new Map();
          const statusStr =
            (raw.status && String(raw.status).toLowerCase()) ||
            (next.activity === 'active' ? 'streaming' : next.activity === 'unlinked' ? 'unlinked' : 'inactive');
          cache.set(key, {
            t: Date.now(),
            status: statusStr,
            statusSince: next.statusSince || null,
            activity: next.activity || null,
          });
          if (typeof window !== 'undefined') window.__stationStatusCache = cache;
        } catch (_) {}
        return arr;
      });
    } catch (_) {}
  }, []);

  const { eventSourceRef, fetchEventsForRange, performInitialLoad } = useAppData({
    sseEnabledRef,
    setEvents: setLatestEvents,
    setStationsRef: setStationsRefStable,
    setLoading,
    setServerError,
    applyStationUpdate,
  });

  useEffect(() => performInitialLoad(), [performInitialLoad]);

  useEffect(() => {
    sseEnabledRef.current = true;
  }, []);

  const applyAllEqsBounds = useCallback(
    (arr) => {
      const end = moment().format('YYYY-MM-DD');
      const minOT = (arr || [])
        .map((e) => (e.OT ? new Date(e.OT) : null))
        .filter((d) => d && !Number.isNaN(d))
        .reduce((min, d) => (min && min < d ? min : d), null);
      const minDate = minOT ? moment(minOT).format('YYYY-MM-DD') : earliestAllStart;
      setAllEvents(arr || []);
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
    [],
  );

  const handleScopeChange = useCallback(
    (nextScope) => {
      if (!nextScope || nextScope === eventScope) return;
      try {
        trackEvent('dataset_change', {
          dataset_key_from: eventScope,
          dataset_key_to: nextScope,
        });
      } catch (_) {}
      resetToPH({ dispatch });
      setEventScope(nextScope);
      setEventsLoading(true);
      if (nextScope === 'latest') {
        const range = latestRangeDefaults();
        setFilters({
          magMin: 0,
          magMax: 10,
          startDate: range.startDate,
          endDate: range.endDate,
        });
        setFilterBounds({
          minDate: range.startDate,
          maxDate: range.endDate,
        });
        fetchEventsForRange(range.startDate, range.endDate, { setState: true })
          .catch(console.error)
          .finally(() => setEventsLoading(false));
      } else {
        const end = moment().format('YYYY-MM-DD');
        const cached = allEqsCacheRef.current;
        if (cached && Array.isArray(cached)) {
          applyAllEqsBounds(cached);
          setEventsLoading(false);
        } else {
          fetchEventsForRange(earliestAllStart, end, { setState: false })
            .then((arr) => {
              allEqsCacheRef.current = arr || [];
              applyAllEqsBounds(arr || []);
            })
            .catch(console.error)
            .finally(() => setEventsLoading(false));
        }
      }
    },
    [eventScope, dispatch, applyAllEqsBounds, fetchEventsForRange],
  );

  const activeEvents = eventScope === 'all' ? allEvents : latestEvents;
  const holdEqMarkers = eventsLoading;

  const stationCounts = useMemo(
    () => ({
      active: (stations || []).filter(
        (s) => String(s.activity || '').toLowerCase() === 'active',
      ).length,
      inactive: (stations || []).filter(
        (s) => String(s.activity || '').toLowerCase() !== 'active',
      ).length,
    }),
    [stations],
  );

  const stationScrollKey = `${stationStatusFilter || 'all'}-${stationSearch}`;
  const eventScrollKey = eventScope;

  const blurIfFocusInsidePanel = useCallback(() => {
    try {
      const active = document.activeElement;
      if (panelRef.current && active && panelRef.current instanceof HTMLElement) {
        if (panelRef.current.contains(active) && typeof active.blur === 'function') {
          active.blur();
        }
      }
    } catch (_) {}
  }, []);

  const handlePanelSelect = useCallback((panelKey) => {
    setActivePanel(panelKey);
    setPanelOpen(true);
  }, []);

  const hidePanel = useCallback(() => {
    blurIfFocusInsidePanel();
    setPanelOpen(false);
  }, [blurIfFocusInsidePanel]);
  const showPanel = useCallback(() => setPanelOpen(true), []);
  const visiblePanelLabel = activePanel === 'stations' ? 'Stations' : 'Events';

  useEffect(() => {
    if (!panelOpen) {
      blurIfFocusInsidePanel();
      if (revealButtonRef.current) {
        revealButtonRef.current.focus();
      }
    }
  }, [panelOpen, blurIfFocusInsidePanel]);

  return serverError ? (
    <ErrorScreen />
  ) : loading ? (
    <LoadingScreen />
  ) : (
    <div className="App">
      <Header initStations={stationsRef.current} />
      <div className="App-body" id="main" role="main" aria-label="Main content">
        <SSEContext.Provider value={eventSourceRef.current}>
          <div className="mapShell">
            <Suspense fallback={null}>
              <MapView
                datasetKey={eventScope}
                holdEqMarkers={holdEqMarkers}
                events={activeEvents}
                filters={{ ...filters, searchText }}
                sseEnabled
                customEvents={null}
                stations={stationsRef.current}
                stationFilters={{ searchText: stationSearch, statusFilter: stationStatusFilter }}
                theme={resolvedTheme}
              />
            </Suspense>
          </div>

          <div
            className={`panelColumn ${panelOpen ? 'isOpen' : 'isCollapsed'}`}
            data-compact={isCompactPanels}
            role="complementary"
            aria-label="Data panels"
            aria-hidden={!panelOpen}
            ref={panelRef}
          >
            <div className="panelControls">
              <button
                type="button"
                className="panelHideBtn"
                onClick={hidePanel}
                aria-label={`Hide ${visiblePanelLabel} panel`}
                title="Hide panel"
              >
                <ChevronLeftIcon />
              </button>
              <div className="panelSwitcher" aria-label="Choose panel">
                <button
                  type="button"
                  className={activePanel === 'events' ? 'isActive' : ''}
                  onClick={() => handlePanelSelect('events')}
                  aria-pressed={activePanel === 'events'}
                  aria-expanded={panelOpen && activePanel === 'events'}
                >
                  Events
                </button>
                <button
                  type="button"
                  className={activePanel === 'stations' ? 'isActive' : ''}
                  onClick={() => handlePanelSelect('stations')}
                  aria-pressed={activePanel === 'stations'}
                  aria-expanded={panelOpen && activePanel === 'stations'}
                >
                  Stations
                </button>
              </div>
            </div>

            <div className={`panelSlot ${activePanel !== 'events' ? 'isHidden' : ''}`}>
              <EventsPanel
                events={activeEvents}
                scope={eventScope}
                onScopeChange={handleScopeChange}
                searchText={searchText}
                onSearchText={setSearchText}
                filters={filters}
                onFiltersChange={setFilters}
                filterBounds={filterBounds}
                sort={sort}
                onSortChange={setSort}
                loading={eventsLoading}
                scrollKey={eventScrollKey}
              />
            </div>

            <div className={`panelSlot ${activePanel !== 'stations' ? 'isHidden' : ''}`}>
              <StationsPanel
                stations={stations}
                searchText={stationSearch}
                onSearchText={setStationSearch}
                statusFilter={stationStatusFilter}
                onStatusFilterChange={setStationStatusFilter}
                counts={stationCounts}
                scrollKey={stationScrollKey}
              />
            </div>
          </div>

          {!panelOpen && (
            <button
              type="button"
              className="panelRevealBtn"
              onClick={showPanel}
              aria-label={`Show ${visiblePanelLabel} panel`}
              ref={revealButtonRef}
            >
              <ChevronRightIcon />
              Show {visiblePanelLabel}
            </button>
          )}
          {isCompactPanels && panelOpen && (
            <div
              className="panelScrim"
              onClick={hidePanel}
              aria-hidden
            />
          )}
        </SSEContext.Provider>
      </div>
    </div>
  );
};

export default HomePage;
