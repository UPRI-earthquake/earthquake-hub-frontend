import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { FiArrowDown, FiClock, FiMapPin, FiRadio } from 'react-icons/fi';
import Header from '../components/Header';
import NearbyEvents from '../components/NearbyEvents';
import LoadingScreen from '../components/LoadingScreen';
import ErrorScreen from '../components/ErrorScreen';
import moment from '../utils/time';
import { backendHost } from '../utils/env';
import { toFiniteNumber } from '../utils/earthquakeFormat';
import { calculateDistance } from '../utils/distanceCalculator';
import { useStations } from '../hooks/useStations';
import useEarthquakeDetailViewModel from '../hooks/useEarthquakeDetailViewModel';
import CatalogComparison from '../components/CatalogComparison';
import './EQInfoPage.css';

const SeismicWaveforms = lazy(() => import('../components/SeismicWaveforms'));
const DETAIL_CACHE_TTL_MS = 5 * 60 * 1000;
const DETAIL_CACHE_VERSION = 1;
const DETAIL_FETCH_TIMEOUT_MS = 12000;
const RECENT_EVENTS_FETCH_TIMEOUT_MS = 20000;
const MINI_MAP_ZOOM = 9;
const MINI_MAP_WIDTH = 168;
const MINI_MAP_HEIGHT = 92;
const MINI_MAP_TILE_SIZE = 256;
const MINI_MAP_TILE_URL = 'https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png';

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

function getEventCoordinates(earthquakeInfo) {
  const latitude = toFiniteNumber(
    earthquakeInfo?.latitude_value ?? earthquakeInfo?.latitude ?? earthquakeInfo?.lat
  );
  const longitude = toFiniteNumber(
    earthquakeInfo?.longitude_value ?? earthquakeInfo?.longitude ?? earthquakeInfo?.lng
  );

  if (latitude == null || longitude == null) return null;
  return { latitude, longitude };
}

function formatCoordinatePart(value, positiveLabel, negativeLabel) {
  const num = toFiniteNumber(value);
  if (num == null) return '—';
  return `${Math.abs(num).toFixed(3)}°${num >= 0 ? positiveLabel : negativeLabel}`;
}

function buildStationLocationLookup(backendStations) {
  if (!Array.isArray(backendStations)) return {};

  return backendStations.reduce((acc, station) => {
    const code = String(station?.code || station?.station || '').toUpperCase();
    const latitude = toFiniteNumber(station?.latitude);
    const longitude = toFiniteNumber(station?.longitude);

    if (code && latitude != null && longitude != null) {
      acc[code] = { latitude, longitude };
    }

    return acc;
  }, {});
}

function formatApproxDistance(distanceKm) {
  if (!Number.isFinite(distanceKm)) return '';
  if (distanceKm < 1) return '<1 km';
  return `~${Math.round(distanceKm).toLocaleString()} km`;
}

function getDepthContext(earthquakeInfo) {
  const depthKm = toFiniteNumber(earthquakeInfo?.depth_km ?? earthquakeInfo?.depth ?? earthquakeInfo?.depth_value);
  if (depthKm == null) return 'Depth unavailable';
  if (depthKm <= 70) return 'Shallow depth';
  if (depthKm <= 300) return 'Intermediate depth';
  return 'Deep event';
}

function getEventTimeDisplay(earthquakeInfo) {
  const eventTime = earthquakeInfo?.eventTime || earthquakeInfo?.OT;
  const parsed = moment.utc(eventTime);

  if (!parsed || !parsed.isValid()) {
    return {
      primary: 'Date unavailable',
      zone: 'UTC+08:00',
      utc: 'UTC —',
    };
  }

  return {
    primary: parsed.clone().add(8, 'hour').format('MMM D, YYYY, h:mm A'),
    zone: 'UTC+08:00',
    utc: `${parsed.format('YYYY-MM-DD HH:mm:ss')} UTC`,
  };
}

function getNearestRecordingStation(stationsForDisplay, earthquakeInfo, stationLocationsByCode) {
  const stationCode = String(stationsForDisplay?.[0] || '').toUpperCase();
  if (!stationCode) {
    return {
      code: null,
      subtext: 'No online station recordings',
    };
  }

  const eventCoordinates = getEventCoordinates(earthquakeInfo);
  const stationLocation = stationLocationsByCode[stationCode];
  const stationLatitude = toFiniteNumber(stationLocation?.latitude);
  const stationLongitude = toFiniteNumber(stationLocation?.longitude);

  if (!eventCoordinates || stationLatitude == null || stationLongitude == null) {
    return {
      code: stationCode,
      subtext: 'Nearest online recording',
      coordinates: stationLatitude != null && stationLongitude != null
        ? { latitude: stationLatitude, longitude: stationLongitude }
        : null,
    };
  }

  const distanceKm = calculateDistance(
    eventCoordinates.latitude,
    eventCoordinates.longitude,
    stationLatitude,
    stationLongitude
  );

  return {
    code: stationCode,
    subtext: Number.isFinite(distanceKm)
      ? `${formatApproxDistance(distanceKm)} from epicenter`
      : 'Nearest online recording',
    coordinates: { latitude: stationLatitude, longitude: stationLongitude },
  };
}

function lonToTilePixelX(longitude, zoom) {
  return ((longitude + 180) / 360) * MINI_MAP_TILE_SIZE * 2 ** zoom;
}

function latToTilePixelY(latitude, zoom) {
  const latRad = latitude * Math.PI / 180;
  return (
    (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
    2 *
    MINI_MAP_TILE_SIZE *
    2 ** zoom
  );
}

function buildMiniMapTiles(latitude, longitude, zoom = MINI_MAP_ZOOM) {
  const centerX = lonToTilePixelX(longitude, zoom);
  const centerY = latToTilePixelY(latitude, zoom);
  const centerTileX = Math.floor(centerX / MINI_MAP_TILE_SIZE);
  const centerTileY = Math.floor(centerY / MINI_MAP_TILE_SIZE);
  const maxTile = 2 ** zoom;
  const tiles = [];

  for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
    for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
      const rawX = centerTileX + xOffset;
      const tileX = ((rawX % maxTile) + maxTile) % maxTile;
      const tileY = centerTileY + yOffset;

      if (tileY < 0 || tileY >= maxTile) continue;

      tiles.push({
        key: `${tileX}-${tileY}`,
        url: MINI_MAP_TILE_URL
          .replace('{z}', zoom)
          .replace('{x}', tileX)
          .replace('{y}', tileY),
        left: rawX * MINI_MAP_TILE_SIZE - centerX + MINI_MAP_WIDTH / 2,
        top: tileY * MINI_MAP_TILE_SIZE - centerY + MINI_MAP_HEIGHT / 2,
      });
    }
  }

  return tiles;
}

function MiniMapPreview({ coordinates, marker = 'epicenter' }) {
  const latitude = toFiniteNumber(coordinates?.latitude);
  const longitude = toFiniteNumber(coordinates?.longitude);
  const tiles = useMemo(
    () => (latitude == null || longitude == null ? [] : buildMiniMapTiles(latitude, longitude)),
    [latitude, longitude]
  );

  if (latitude == null || longitude == null) {
    return (
      <div className="metric-mini-map metric-mini-map-empty" aria-hidden="true">
        <span />
      </div>
    );
  }

  return (
    <div className="metric-mini-map" aria-hidden="true">
      <div className="metric-mini-map-tiles">
        {tiles.map((tile) => (
          <img
            key={tile.key}
            src={tile.url}
            alt=""
            draggable="false"
            style={{
              left: `${tile.left}px`,
              top: `${tile.top}px`,
            }}
          />
        ))}
      </div>
      <span className={`metric-map-pin metric-map-pin-${marker}`} />
      <span className="metric-map-attribution">CARTO</span>
    </div>
  );
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
  const [stationLocationsByCode, setStationLocationsByCode] = useState({});
  const [waveformSentinelRef, shouldMountWaveforms] = useNearViewport();
  const { fetchStations } = useStations();
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
    formattedUpdatedTime,
    formattedUpdatedTimeUtc,
    pageTitle,
    stationsForDisplay,
    summaryMarkup,
  } = useEarthquakeDetailViewModel(earthquakeInfo);
  const nearestRecordingStation = useMemo(
    () => getNearestRecordingStation(stationsForDisplay, earthquakeInfo, stationLocationsByCode),
    [earthquakeInfo, stationLocationsByCode, stationsForDisplay]
  );
  const eventCoordinates = useMemo(() => getEventCoordinates(earthquakeInfo), [earthquakeInfo]);
  const epicenterParts = useMemo(() => ({
    latitude: formatCoordinatePart(eventCoordinates?.latitude, 'N', 'S'),
    longitude: formatCoordinatePart(eventCoordinates?.longitude, 'E', 'W'),
  }), [eventCoordinates]);
  const depthContext = useMemo(() => getDepthContext(earthquakeInfo), [earthquakeInfo]);
  const eventTimeDisplay = useMemo(() => getEventTimeDisplay(earthquakeInfo), [earthquakeInfo]);

  useEffect(() => {
    let isMounted = true;

    fetchStations()
      .then((backendStations) => {
        if (isMounted) setStationLocationsByCode(buildStationLocationLookup(backendStations));
      })
      .catch(() => {
        if (isMounted) setStationLocationsByCode({});
      });

    return () => {
      isMounted = false;
    };
  }, [fetchStations]);

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
            <div className="metric-card metric-card-depth" role="group" aria-label={`Depth ${depth || 'not available'}`} title={`Depth ${depth || 'Not available'}`}>
              <div className="metric-card-head">
                <span className="metric-icon" aria-hidden="true"><FiArrowDown /></span>
                <span className="metric-label">Depth</span>
              </div>
              <div className="metric-card-body">
                <strong>{depth || '—'}</strong>
                <em className="metric-sub">{depthContext}</em>
              </div>
            </div>
            <div className="metric-card metric-card-time" role="group" aria-label={`Event time ${eventTimeDisplay.primary || 'not available'}`} title={`Event time ${eventTimeDisplay.primary || 'Not available'}`}>
              <div className="metric-card-head">
                <span className="metric-icon" aria-hidden="true"><FiClock /></span>
                <span className="metric-label">Event time</span>
              </div>
              <div className="metric-card-body">
                <strong>{eventTimeDisplay.primary}</strong>
                <em className="metric-sub metric-zone">{eventTimeDisplay.zone}</em>
                <em className="metric-sub metric-tertiary">{eventTimeDisplay.utc}</em>
              </div>
            </div>
            <div className="metric-card metric-map-card metric-card-epicenter" role="group" aria-label={`Epicenter ${coordText || 'not available'}`} title={`Epicenter ${coordText || 'Not available'}`}>
              <MiniMapPreview coordinates={eventCoordinates} marker="epicenter" />
              <div className="metric-map-overlay">
                <div className="metric-card-head">
                  <span className="metric-icon" aria-hidden="true"><FiMapPin /></span>
                  <span className="metric-label">Epicenter</span>
                </div>
                <div className="metric-map-value">
                  <dl className="metric-coordinate-list">
                    <div>
                      <dt>Lat</dt>
                      <dd>{epicenterParts.latitude}</dd>
                    </div>
                    <div>
                      <dt>Lon</dt>
                      <dd>{epicenterParts.longitude}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
            <div className="metric-card metric-map-card metric-card-station" role="group" aria-label={`Nearest recording station ${nearestRecordingStation.code || 'not available'}`} title={`Nearest recording station ${nearestRecordingStation.code || 'Not available'}`}>
              <MiniMapPreview coordinates={nearestRecordingStation.coordinates} marker="station" />
              <div className="metric-map-overlay">
                <div className="metric-card-head">
                  <span className="metric-icon" aria-hidden="true"><FiRadio /></span>
                  <span className="metric-label">Nearest station</span>
                </div>
                <div className="metric-map-value">
                  <strong>{nearestRecordingStation.code || 'Unavailable'}</strong>
                  <em className="metric-sub">{nearestRecordingStation.subtext}</em>
                </div>
              </div>
            </div>
          </div>
          <p className="eqinfo-last-updated">
            Last updated {formattedUpdatedTime ? `${formattedUpdatedTime} UTC+08:00` : 'unavailable'}
            {formattedUpdatedTimeUtc ? ` (${formattedUpdatedTimeUtc} UTC)` : ''}
          </p>
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
