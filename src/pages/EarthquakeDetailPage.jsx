import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import StationDownloadButtons from '../components/StationDownloadButton';
import Articles from '../components/Articles';
import NearbyEvents from '../components/NearbyEvents';
import SeismicWaveforms from '../components/SeismicWaveforms';
import LoadingScreen from '../components/LoadingScreen';
import ErrorScreen from '../components/ErrorScreen';
import moment from '../utils/time';
import sanitizeHtml from '../utils/sanitizeHtml';
import { generateEventSummary } from '../utils/generateEventSummary';
import { backendHost } from '../utils/env';
import InfoTooltip from '../components/InfoTooltip';
import './EQInfoPage.css';

// Normalize backend list fields that may arrive as an Array or a bracketed CSV string.
function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const stripped = trimmed.startsWith('[') && trimmed.endsWith(']')
      ? trimmed.slice(1, -1)
      : trimmed;
    return stripped
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Earthquake detail page for network-detected earthquakes. Displays event information
 * passed via navigation state from the earthquakes list page.
 * If location.state?.earthquake is missing (e.g., on refresh/direct navigation),
 * reads the id from URL query params and fetches the earthquake data.
 * @returns {JSX.Element}
 */
function EarthquakeDetailPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [fetchedEarthquake, setFetchedEarthquake] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Get earthquake from either location.state or fetched data
  const earthquakeInfo = location.state?.earthquake || fetchedEarthquake;
  const idFromUrl = searchParams.get('id');

  // Fetch earthquake data if not available via location.state but ID is in URL
  useEffect(() => {
    if (earthquakeInfo) {
      // Already have data, no need to fetch
      return;
    }

    if (!idFromUrl) {
      // No ID in URL, can't fetch anything
      return;
    }

    let isMounted = true;
    const fetchEarthquake = async () => {
      setIsFetching(true);
      setFetchError(null);
      try {
        // Fetch events from a 90-day range to find the one with matching ID
        // This covers most earthquake queries; adjust if needed
        const endDate = moment().format('YYYY-MM-DD HH:mm:ss');
        const startDate = moment().subtract(90, 'days').format('YYYY-MM-DD HH:mm:ss');

        const res = await axios.get(`${backendHost()}/eq-events`, {
          params: { startTime: startDate, endTime: endDate },
          withCredentials: true,
        });

        const events = res.data?.payload || [];
        const found = events.find((ev) => ev.publicID === idFromUrl);

        if (!isMounted) return;

        if (found) {
          setFetchedEarthquake(found);
          setFetchError(null);
        } else {
          setFetchError(
            `Earthquake with ID "${idFromUrl}" not found in recent events. It may have been archived.`
          );
        }
      } catch (error) {
        if (!isMounted) return;
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.error('Error fetching earthquake:', error);
        }
        setFetchError(
          error?.message || 'Failed to load earthquake data. Please try again or select from the events list.'
        );
      } finally {
        if (isMounted) {
          setIsFetching(false);
        }
      }
    };

    fetchEarthquake();

    return () => {
      isMounted = false;
    };
  }, [idFromUrl, earthquakeInfo]);

  const formatEventTime = useCallback((eventTime) => {
    const parsed = moment(eventTime);
    if (!parsed || !parsed.isValid()) return 'Date unavailable';
    return parsed.format('MMMM D, YYYY h:mm A');
  }, []);

  const summaryMarkup = useMemo(
    () => sanitizeHtml(earthquakeInfo?.eventSummary || generateEventSummary(earthquakeInfo)), //using generated summary as fallback if eventSummary is not provided
    [earthquakeInfo],
  );
  const instrumentRecordings = useMemo(
    () => normalizeList(earthquakeInfo?.instrumentRecordings),
    [earthquakeInfo?.instrumentRecordings],
  );
  const onlineStations = useMemo(
    () => normalizeList(earthquakeInfo?.onlineStations),
    [earthquakeInfo?.onlineStations],
  );
  const references = useMemo(() => normalizeList(earthquakeInfo?.references), [earthquakeInfo?.references]);

  // For development/demo purposes, use mock stations if none exist
  const stationsForDisplay = useMemo(() => {
    const hasStations = onlineStations.length > 0 || instrumentRecordings.length > 0;
    if (hasStations) {
      return onlineStations.length > 0 ? onlineStations : instrumentRecordings;
    }
    // Development fallback: show demo stations
    if (process.env.NODE_ENV === 'development') {
      return ['R1382', 'R8095', 'RBD68'];
    }
    return [];
  }, [onlineStations, instrumentRecordings]);

  // Debug: Check earthquake object structure
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    window._earthquakeDebug = {
      hasEarthquakeInfo: !!earthquakeInfo,
      earthquakeKeys: earthquakeInfo ? Object.keys(earthquakeInfo) : [],
      onlineStations: onlineStations,
      instrumentRecordings: instrumentRecordings,
      stationsForDisplay: stationsForDisplay,
      onlineStationsLength: onlineStations.length,
      instrumentRecordingsLength: instrumentRecordings.length,
      stationsForDisplayLength: stationsForDisplay.length,
    };
  }

  const magnitude =
    typeof earthquakeInfo?.magnitude === 'number'
      ? earthquakeInfo.magnitude.toFixed(1).replace(/\.0$/, '')
      : typeof earthquakeInfo?.magnitude_value === 'number'
      ? earthquakeInfo.magnitude_value.toFixed(1).replace(/\.0$/, '')
      : earthquakeInfo?.magnitude;

  const depthValue = Number(earthquakeInfo?.depth || earthquakeInfo?.depth_value);
  const depth = Number.isFinite(depthValue) ? `${depthValue.toFixed(0)} km` : null;

  const eventTime = earthquakeInfo?.eventTime || earthquakeInfo?.OT;
  const formattedEventTime = eventTime ? formatEventTime(eventTime) : null;

  const place_description = earthquakeInfo?.place || '';
  const generic_location = earthquakeInfo?.location || earthquakeInfo?.text || 'Location unavailable';
  
  // Use place description for location if available, otherwise use generic location
  const location_display = place_description && place_description !== 'Unavailable' 
    ? place_description 
    : generic_location;

  // Generate dynamic event title
  const pageTitle = useMemo(() => {
    if (earthquakeInfo?.title) return earthquakeInfo.title;
    
    const magText = magnitude ? `M${magnitude} Earthquake` : 'Earthquake';
    
    if (place_description && place_description !== 'Unavailable') {
      return `${magText} ${place_description}`;
    } else if (generic_location) {
      return `${magText} ${generic_location}`;
    }
    
    return magText;
  }, [magnitude, place_description, generic_location, earthquakeInfo?.title]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = `${pageTitle} | Earthquake Hub`;
  }, [pageTitle]);

  // Show loading screen while fetching
  if (isFetching) {
    return <LoadingScreen />;
  }

  // Show error screen if fetch failed
  if (fetchError) {
    return (
      <>
        <Header />
        <div className="eqinfo-shell">
          <ErrorScreen
            title="Unable to Load Earthquake"
            message={fetchError}
            actionLabel="Back to Events"
            onAction={() => window.history.back()}
          />
        </div>
      </>
    );
  }

  // If no earthquake data show error
  if (!earthquakeInfo) {
    return (
      <>
        <Header />
        <div className="eqinfo-shell">
          <div className="eqinfo-panel alert" role="status">
            No earthquake data available. Please select an earthquake from the list.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="eqinfo-shell">
        <section className="eqinfo-hero">
          <h1>{pageTitle}</h1>
          <div className="eqinfo-meta-grid">
            <div className="metric-card" role="group" aria-label={`Magnitude ${magnitude || 'not available'}`} title={`Magnitude ${magnitude || 'Not available'}`}>
              <span>Magnitude</span>
              <strong>{magnitude || '—'}</strong>
            </div>
            <div className="metric-card" role="group" aria-label={`Depth ${depth || 'not available'}`} title={`Depth ${depth || 'Not available'}`}>
              <span>Depth</span>
              <strong>{depth || '—'}</strong>
            </div>
            <div className="metric-card" role="group" aria-label={`Location ${location_display || 'not available'}`} title={`Location ${location_display || 'Not available'}`}>
              <span>Location</span>
              <strong>{location_display || '—'}</strong>
            </div>
            <div className="metric-card" role="group" aria-label={`Local time ${formattedEventTime || 'not available'}`} title={`Local time ${formattedEventTime || 'Not available'}`}>
              <span>Local time</span>
              <strong>{formattedEventTime ? `${formattedEventTime} (Local)` : '—'}</strong>
            </div>
          </div>
        </section>

        <SeismicWaveforms 
          earthquakeInfo={earthquakeInfo} 
          stations={stationsForDisplay}
        />

        <div className="eqinfo-grid">
          <NearbyEvents
            earthquakeInfo={earthquakeInfo}
            nearbyEventCount={5}
            distanceThresholdKm={200}
          />

          {summaryMarkup && (
            <section className="eqinfo-panel scrollable">
              <div className="panel-header">
                <div className="panel-title">
                  <h3>Event summary</h3>
                  <InfoTooltip title="Event summary" label="About this section" variant="inline">
                    Vetted narrative from authoritative sources.
                  </InfoTooltip>
                </div>
              </div>
              <div className="panel-body">
                <div
                  className="eqinfo-copy"
                  dangerouslySetInnerHTML={{ __html: summaryMarkup }}
                />
              </div>
            </section>
          )}

          {instrumentRecordings.length > 0 && (
            <section className="eqinfo-panel scrollable">
              <div className="panel-header">
                <div className="panel-title">
                  <h3>Instrument recordings</h3>
                  <InfoTooltip title="Instrument recordings" label="About this section" variant="inline">
                    Download station traces around the event origin time.
                  </InfoTooltip>
                </div>
              </div>
              <div className="panel-body">
                <ul className="station-list">
                  {instrumentRecordings.map((station, idx) => (
                    <li key={`${station}-${idx}`} aria-label={`Station ${station}`}>
                      <div className="list-items">
                        <div className="station-label">{station}</div>
                        <StationDownloadButtons stationCode={station} eventTime={eventTime} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {references.length > 0 && (
            <section className="eqinfo-panel scrollable">
              <div className="panel-header">
                <div className="panel-title">
                  <h3>Reports & references</h3>
                  <InfoTooltip title="Reports & references" label="About this section" variant="inline">
                    Open source links in a new tab.
                  </InfoTooltip>
                </div>
              </div>
              <div className="panel-body">
                <div className="reference-grid">
                  {references.map((reference, index) => (
                    <Articles key={`ref-${index}`} url={reference} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {!summaryMarkup && instrumentRecordings.length === 0 && references.length === 0 && (
            <section className="eqinfo-panel scrollable">
              <div className="panel-header">
                <div className="panel-title">
                  <h3>Event details</h3>
                </div>
              </div>
              <div className="panel-body">
                <p className="muted">
                  This earthquake was detected by the network. Additional analysis and authoritative reports may be available from official sources.
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

export default EarthquakeDetailPage;