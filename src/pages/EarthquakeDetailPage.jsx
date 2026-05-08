import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import NearbyEvents from '../components/NearbyEvents';
import LoadingScreen from '../components/LoadingScreen';
import ErrorScreen from '../components/ErrorScreen';
import moment from '../utils/time';
import { backendHost } from '../utils/env';
import useEarthquakeDetailViewModel from '../hooks/useEarthquakeDetailViewModel';
import CatalogComparison from '../components/CatalogComparison';
import './EQInfoPage.css';

const SeismicWaveforms = lazy(() => import('../components/SeismicWaveforms'));
const DETAIL_CACHE_TTL_MS = 5 * 60 * 1000;
const DETAIL_CACHE_VERSION = 1;
const DETAIL_FETCH_TIMEOUT_MS = 12000;
const RECENT_EVENTS_FETCH_TIMEOUT_MS = 20000;

function getDetailCacheKey(eventId) {
  return `earthquake-detail:${eventId}`;
}

function readCachedEarthquake(eventId) {
  if (!eventId || typeof window === 'undefined') return null;

  const cacheKey = getDetailCacheKey(eventId);
  try {
    const cached = window.localStorage.getItem(cacheKey);
    if (!cached) return null;

    const parsed = JSON.parse(cached);
    if (parsed?.publicID === eventId && parsed.version !== DETAIL_CACHE_VERSION) {
      writeCachedEarthquake(eventId, parsed);
      return parsed;
    }

    const isFresh =
      parsed?.version === DETAIL_CACHE_VERSION &&
      parsed?.cachedAt &&
      Date.now() - parsed.cachedAt < DETAIL_CACHE_TTL_MS;

    if (!isFresh) {
      window.localStorage.removeItem(cacheKey);
      return null;
    }

    return parsed.payload || null;
  } catch (_) {
    window.localStorage.removeItem(cacheKey);
    return null;
  }
}

function writeCachedEarthquake(eventId, earthquake) {
  if (!eventId || typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      getDetailCacheKey(eventId),
      JSON.stringify({
        cachedAt: Date.now(),
        payload: earthquake,
        version: DETAIL_CACHE_VERSION,
      }),
    );
  } catch (_) {
    // Ignore localStorage failures; fetched data is still usable for this render.
  }
}

function useNearViewport(rootMargin = '600px') {
  const [targetNode, setTargetNode] = useState(null);
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    if (isNearViewport || !targetNode) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setIsNearViewport(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(targetNode);
    return () => observer.disconnect();
  }, [isNearViewport, rootMargin, targetNode]);

  return [setTargetNode, isNearViewport];
}

function getEventRevisionMs(earthquake) {
  const revisionTime =
    earthquake?.last_modification || earthquake?.updated || earthquake?.modified || earthquake?.updatedAt;
  const parsed = revisionTime ? new Date(revisionTime).getTime() : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function isNewerEvent(candidate, current) {
  const candidateRevision = getEventRevisionMs(candidate);
  const currentRevision = getEventRevisionMs(current);
  if (candidateRevision || currentRevision) {
    return candidateRevision > currentRevision;
  }
  return JSON.stringify(candidate) !== JSON.stringify(current);
}

async function fetchEarthquakeByPublicID(eventId) {
  const res = await axios.get(`${backendHost()}/eq-events/${encodeURIComponent(eventId)}`, {
    timeout: DETAIL_FETCH_TIMEOUT_MS,
    withCredentials: true,
  });
  return res.data?.payload || null;
}

async function fetchEarthquakeFromRecentEvents(eventId) {
  const endDate = moment().format('YYYY-MM-DD HH:mm:ss');
  const startDate = moment().subtract(90, 'days').format('YYYY-MM-DD HH:mm:ss');

  const res = await axios.get(`${backendHost()}/eq-events`, {
    params: { startTime: startDate, endTime: endDate },
    timeout: RECENT_EVENTS_FETCH_TIMEOUT_MS,
    withCredentials: true,
  });

  const events = res.data?.payload || [];
  return events.find((ev) => ev.publicID === eventId) || null;
}

async function fetchEarthquakeWithFallback(eventId) {
  try {
    const directEvent = await fetchEarthquakeByPublicID(eventId);
    if (directEvent) return directEvent;
  } catch (_) {
    // Fall back to the older range query so the frontend still works while
    // the direct detail endpoint is being rolled out or restarted locally.
  }

  return fetchEarthquakeFromRecentEvents(eventId);
}

function getFetchErrorMessage(error) {
  if (error?.code === 'ECONNABORTED') {
    return 'The earthquake detail request timed out. Please check that the backend is running and try again.';
  }

  return error?.message || 'Failed to load earthquake data. Please try again or select from the events list.';
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
  const [waveformSentinelRef, shouldMountWaveforms] = useNearViewport();
  const eventId = searchParams.get('id');
  const isDevelopment =
    typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development';

  const cachedEarthquake = useMemo(() => {
    return readCachedEarthquake(eventId);
  }, [eventId]);

  // Get earthquake from navigation state, cached detail data, or a direct URL fetch.
  const earthquakeInfo = location.state?.earthquake || cachedEarthquake || fetchedEarthquake;
  const {
    coordText,
    debugInfo,
    depth,
    formattedEventTimePh,
    formattedEventTimeUtc,
    formattedUpdatedTime,
    formattedUpdatedTimeUtc,
    pageTitle,
    stationsForDisplay,
    summaryMarkup,
  } = useEarthquakeDetailViewModel(earthquakeInfo);

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
        const found = await fetchEarthquakeWithFallback(eventId);

        if (!isMounted) return;

        if (found) {
          setFetchedEarthquake(found);
          writeCachedEarthquake(eventId, found);
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
        setFetchError(getFetchErrorMessage(error));
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

  useEffect(() => {
    if (location.state?.earthquake || fetchedEarthquake || !cachedEarthquake || !eventId) {
      return undefined;
    }

    let isMounted = true;
    const revalidateCachedEarthquake = async () => {
      try {
        const freshEvent = await fetchEarthquakeByPublicID(eventId);
        if (!isMounted || !freshEvent) return;

        if (isNewerEvent(freshEvent, cachedEarthquake)) {
          setFetchedEarthquake(freshEvent);
          writeCachedEarthquake(eventId, freshEvent);
        }
      } catch (_) {
        // Keep the cached event when background revalidation fails.
      }
    };

    revalidateCachedEarthquake();

    return () => {
      isMounted = false;
    };
  }, [cachedEarthquake, eventId, fetchedEarthquake, location.state]);

  // Debug: Check earthquake object structure
  if (isDevelopment && typeof window !== 'undefined') {
    window._earthquakeDebug = debugInfo;
  }

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

        <div ref={waveformSentinelRef}>
          {shouldMountWaveforms ? (
            <Suspense fallback={<div className="eqinfo-panel muted">Loading waveform viewer...</div>}>
              <SeismicWaveforms
                earthquakeInfo={earthquakeInfo}
                stations={stationsForDisplay}
              />
            </Suspense>
          ) : (
            <div className="eqinfo-panel muted">Preparing station recordings...</div>
          )}
        </div>

        <div className="eqinfo-grid">
          <div className="eqinfo-related-source-row">
            <NearbyEvents
              earthquakeInfo={earthquakeInfo}
              nearbyEventCount={5}
              distanceThresholdKm={200}
            />

            <CatalogComparison earthquakeInfo={earthquakeInfo} />
          </div>
        </div>
      </div>
    </>
  );
}

export default EarthquakeDetailPage;
