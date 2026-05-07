import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import NearbyEvents from '../components/NearbyEvents';
import LoadingScreen from '../components/LoadingScreen';
import ErrorScreen from '../components/ErrorScreen';
import moment from '../utils/time';
import sanitizeHtml from '../utils/sanitizeHtml';
import { generateEventSummary } from '../utils/generateEventSummary';
import { backendHost } from '../utils/env';
import { normalizeList } from '../utils/normalizeList';
import { SourceComparisonCompact } from '../components/EarthquakeSourceComparison';
import './EQInfoPage.css';

const SeismicWaveforms = lazy(() => import('../components/SeismicWaveforms'));

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
  const eventId = searchParams.get('id');
  const isDevelopment =
    typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development';

  const cachedEarthquake = useMemo(() => {
    if (!eventId || typeof window === 'undefined') return null;
    try {
      const cached = window.localStorage.getItem(`earthquake-detail:${eventId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (_) {
      return null;
    }
  }, [eventId]);

  // Get earthquake from navigation state, cached detail data, or a direct URL fetch.
  const earthquakeInfo = location.state?.earthquake || cachedEarthquake || fetchedEarthquake;

  // Fetch earthquake data if not available via location.state but ID is in URL
  useEffect(() => {
    if (location.state?.earthquake || cachedEarthquake || fetchedEarthquake) {
      // Already have data, no need to fetch
      return;
    }

    if (!eventId) {
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
        const found = events.find((ev) => ev.publicID === eventId);

        if (!isMounted) return;

        if (found) {
          setFetchedEarthquake(found);
          if (typeof window !== 'undefined') {
            try {
              window.localStorage.setItem(`earthquake-detail:${eventId}`, JSON.stringify(found));
            } catch (_) {
              // Ignore localStorage failures; fetched data is still usable for this render.
            }
          }
          setFetchError(null);
        } else {
          setFetchError(
            `Earthquake with ID "${eventId}" not found in recent events. It may have been archived.`
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
  }, [cachedEarthquake, eventId, fetchedEarthquake, location.state]);

  const formatEventTimePh = useCallback((eventTime) => {
    const parsed = moment.utc(eventTime);
    if (!parsed || !parsed.isValid()) return 'Date unavailable';
    return parsed.add(8, 'hour').format('YYYY-MM-DD HH:mm:ss');
  }, []);

  const formatEventTimeUtc = useCallback((eventTime) => {
    const parsed = moment.utc(eventTime);
    if (!parsed || !parsed.isValid()) return 'Date unavailable';
    return parsed.format('YYYY-MM-DD HH:mm:ss');
  }, []);

  const formatCoord = useCallback((value, positiveLabel, negativeLabel) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    const hemi = num >= 0 ? positiveLabel : negativeLabel;
    return `${Math.abs(num).toFixed(3)}°${hemi}`;
  }, []);

  const summaryMarkup = useMemo(
    () => sanitizeHtml(earthquakeInfo?.eventSummary || generateEventSummary(earthquakeInfo)), //using generated summary as fallback if eventSummary is not provided
    [earthquakeInfo],
  );
  const onlineStations = useMemo(
    () => normalizeList(earthquakeInfo?.onlineStations),
    [earthquakeInfo?.onlineStations],
  );

  // Network event detail uses online stations for waveform display.
  const stationsForDisplay = useMemo(() => {
    return onlineStations;
  }, [onlineStations]);

  // Debug: Check earthquake object structure
  if (isDevelopment && typeof window !== 'undefined') {
    window._earthquakeDebug = {
      hasEarthquakeInfo: !!earthquakeInfo,
      earthquakeKeys: earthquakeInfo ? Object.keys(earthquakeInfo) : [],
      onlineStations: onlineStations,
      stationsForDisplay: stationsForDisplay,
      onlineStationsLength: onlineStations.length,
      stationsForDisplayLength: stationsForDisplay.length,
    };
  }

  const magnitude =
    typeof earthquakeInfo?.magnitude === 'number'
      ? earthquakeInfo.magnitude.toFixed(1).replace(/\.0$/, '')
      : typeof earthquakeInfo?.magnitude_value === 'number'
      ? earthquakeInfo.magnitude_value.toFixed(1).replace(/\.0$/, '')
      : earthquakeInfo?.magnitude;

  const depthValue = Number(
    earthquakeInfo?.depth_km ?? earthquakeInfo?.depth ?? earthquakeInfo?.depth_value,
  );
  const depth = Number.isFinite(depthValue) ? `${depthValue.toFixed(0)} km` : null;

  const eventTime = earthquakeInfo?.eventTime || earthquakeInfo?.OT;
  const formattedEventTimePh = eventTime ? formatEventTimePh(eventTime) : null;
  const formattedEventTimeUtc = eventTime ? formatEventTimeUtc(eventTime) : null;
  const lastUpdatedTime =
    earthquakeInfo?.last_modification || earthquakeInfo?.updated || earthquakeInfo?.modified || eventTime;
  const formattedUpdatedTime = lastUpdatedTime ? formatEventTimePh(lastUpdatedTime) : null;
  const formattedUpdatedTimeUtc = lastUpdatedTime ? formatEventTimeUtc(lastUpdatedTime) : null;

  const latValue =
    earthquakeInfo?.latitude_value ?? earthquakeInfo?.latitude ?? earthquakeInfo?.lat;
  const lngValue =
    earthquakeInfo?.longitude_value ?? earthquakeInfo?.longitude ?? earthquakeInfo?.lng;
  const coordText = useMemo(() => {
    const latText = formatCoord(latValue, 'N', 'S');
    const lngText = formatCoord(lngValue, 'E', 'W');
    if (!latText || !lngText) return null;
    return `${latText}, ${lngText}`;
  }, [formatCoord, latValue, lngValue]);

  const placeDescription = earthquakeInfo?.place || '';
  const genericLocation = earthquakeInfo?.location || earthquakeInfo?.text || 'Location unavailable';

  // Use place description for location if available, otherwise use generic location
  // Generate dynamic event title
  const pageTitle = useMemo(() => {
    if (earthquakeInfo?.title) return earthquakeInfo.title;
    
    const magText = magnitude ? `M${magnitude} Earthquake` : 'Earthquake';
    
    if (placeDescription && placeDescription !== 'Unavailable') {
      return `${magText} ${placeDescription}`;
    } else if (genericLocation) {
      return `${magText} ${genericLocation}`;
    }
    
    return magText;
  }, [magnitude, placeDescription, genericLocation, earthquakeInfo?.title]);

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
            <div className="metric-card" role="group" aria-label={`Depth ${depth || 'not available'}`} title={`Depth ${depth || 'Not available'}`}>
              <span>Depth</span>
              <strong>{depth || '—'}</strong>
            </div>
            <div className="metric-card" role="group" aria-label={`Epicenter ${coordText || 'not available'}`} title={`Epicenter ${coordText || 'Not available'}`}>
              <span>Epicenter</span>
              <strong>{coordText || '—'}</strong>
            </div>
            <div className="metric-card" role="group" aria-label={`Event time ${formattedEventTimePh || 'not available'}`} title={`Event time ${formattedEventTimePh || 'Not available'}`}>
              <span>Event time</span>
              <strong>{formattedEventTimePh ? `${formattedEventTimePh} UTC+08:00` : '—'}</strong>
              <em className="metric-sub">{formattedEventTimeUtc ? `${formattedEventTimeUtc} UTC` : 'UTC —'}</em>
            </div>
            <div className="metric-card" role="group" aria-label={`Last updated ${formattedUpdatedTime || 'not available'}`} title={`Last updated ${formattedUpdatedTime || 'Not available'}`}>
              <span>Last updated</span>
              <strong>{formattedUpdatedTime ? `${formattedUpdatedTime} UTC+08:00` : '—'}</strong>
              <em className="metric-sub">{formattedUpdatedTimeUtc ? `${formattedUpdatedTimeUtc} UTC` : 'UTC —'}</em>
            </div>
          </div>
        </section>

        {summaryMarkup && (
          <section className="eqinfo-panel scrollable eqinfo-summary-panel">
            <div className="panel-header">
              <div className="panel-title">
                <h3>Event summary</h3>
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

        <Suspense fallback={<div className="eqinfo-panel muted">Loading waveform viewer...</div>}>
          <SeismicWaveforms
            earthquakeInfo={earthquakeInfo}
            stations={stationsForDisplay}
          />
        </Suspense>

        <div className="eqinfo-grid">
          <div className="eqinfo-related-source-row">
            <NearbyEvents
              earthquakeInfo={earthquakeInfo}
              nearbyEventCount={5}
              distanceThresholdKm={200}
            />

            <SourceComparisonCompact earthquakeInfo={earthquakeInfo} />
          </div>
        </div>
      </div>
    </>
  );
}

export default EarthquakeDetailPage;
