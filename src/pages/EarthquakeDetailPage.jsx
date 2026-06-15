import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { FiArrowDown, FiClock, FiImage, FiMapPin, FiRadio, FiSend, FiX } from 'react-icons/fi';
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
import EditableEventSummary from '../components/EditableEventSummary';
import CommunityReportsCarousel from '../components/CommunityReportsCarousel';
import InfoTooltip from '../components/InfoTooltip';
import './EQInfoPage.css';

const SeismicWaveforms = lazy(() => import('../components/SeismicWaveforms'));
const DETAIL_CACHE_TTL_MS = 5 * 60 * 1000;
const DETAIL_CACHE_VERSION = 1;
const DETAIL_FETCH_TIMEOUT_MS = 12000;
const RECENT_EVENTS_FETCH_TIMEOUT_MS = 20000;
const COMMENTS_FETCH_TIMEOUT_MS = 12000;
const COMMENT_POST_TIMEOUT_MS = 20000;
const REPORT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const REPORT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
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

function getEarthquakeEventId(earthquakeInfo, queryEventId) {
  return (
    earthquakeInfo?._id ||
    earthquakeInfo?.publicID ||
    earthquakeInfo?.id ||
    earthquakeInfo?.event_id ||
    queryEventId ||
    ''
  );
}

function getCommentsFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.payload)) return data.payload;
  if (Array.isArray(data?.comments)) return data.comments;
  if (Array.isArray(data?.payload?.comments)) return data.payload.comments;
  return [];
}

function getCommentTotalFromResponse(data, comments) {
  const total = Number(data?.pagination?.total ?? data?.total ?? data?.payload?.total);
  return Number.isFinite(total) ? total : comments.length;
}

function getCommentKey(comment, fallback = '') {
  return comment?.id || comment?._id || comment?.commentId || fallback;
}

function getCommentText(comment) {
  return (
    comment?.comment ||
    comment?.content ||
    comment?.description ||
    comment?.report ||
    comment?.text ||
    ''
  );
}

function getCommentImage(comment) {
  return (
    comment?.imageUrl ||
    comment?.imageURL ||
    comment?.image ||
    comment?.photoUrl ||
    comment?.photo ||
    comment?.attachmentUrl ||
    ''
  );
}

function resolveCommentImageUrl(imageUrl) {
  if (typeof imageUrl !== 'string') return '';

  const trimmedUrl = imageUrl.trim();
  if (!trimmedUrl) return '';

  const isSafeDataImageUrl = (url) => /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(url);
  const isSafeHttpUrl = (url) => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch (_) {
      return false;
    }
  };

  if (isSafeDataImageUrl(trimmedUrl) || isSafeHttpUrl(trimmedUrl) || /^\/\//.test(trimmedUrl)) {
    return trimmedUrl;
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmedUrl)) return '';

  const apiHost = backendHost();
  if (!apiHost) return trimmedUrl;

  try {
    const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
    const backendUrl = new URL(apiHost, fallbackOrigin);
    const resolvedUrl = new URL(trimmedUrl, `${backendUrl.origin}/`).toString();
    return isSafeHttpUrl(resolvedUrl) ? resolvedUrl : '';
  } catch (_) {
    const host = apiHost.replace(/\/api\/?$/i, '').replace(/\/+$/, '');
    const path = trimmedUrl.replace(/^\/+/, '');
    const resolvedUrl = `${host}/${path}`;
    return isSafeHttpUrl(resolvedUrl) ? resolvedUrl : '';
  }
}

function ReportAttachment({ src, onPreview }) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [isUnavailable, setIsUnavailable] = useState(false);

  useEffect(() => {
    setCurrentSrc(src);
    setIsUnavailable(false);
  }, [src]);

  if (isUnavailable) {
    return (
      <div className="report-attachment-unavailable" role="status">
        Attachment unavailable
      </div>
    );
  }

  if (!currentSrc) return null;

  return (
    <button
      type="button"
      className="report-attachment-button"
      onClick={() => onPreview?.(currentSrc)}
      aria-label="Open submitted report attachment"
    >
      <img
        src={currentSrc}
        alt="Submitted report attachment"
        onError={() => {
          setCurrentSrc('');
          setIsUnavailable(true);
        }}
      />
    </button>
  );
}

function getCommentAuthor(comment) {
  if (comment?.anonymous || comment?.isAnonymous) return 'Anonymous';
  return (
    comment?.author ||
    comment?.username ||
    comment?.user?.username ||
    comment?.user?.name ||
    'Anonymous'
  );
}

function formatCommentTime(comment) {
  const raw = comment?.createdAt || comment?.created_at || comment?.timestamp || comment?.date;
  if (!raw) return '';
  const parsed = moment(raw);
  return parsed.isValid() ? parsed.format('MMM D, YYYY, h:mm A') : '';
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

function ReportCommentsSection({
  eventId,
  comments = [],
  isLoading,
  loadError,
  onReportsChanged,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [postAnonymously, setPostAnonymously] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [accountIdentity, setAccountIdentity] = useState(null);
  const triggerButtonRef = useRef(null);
  const textareaRef = useRef(null);
  const canPostWithAccount = Boolean(accountIdentity?.username);
  const selectedFileSummary = imageFile ? `${imageFile.name} (${Math.max(1, Math.round(imageFile.size / 1024))} KB)` : '';

  const refreshAccountIdentity = useCallback(async (nextDetail = null) => {
    if (nextDetail && nextDetail.authenticated === false) {
      setAccountIdentity(null);
      return;
    }

    if (nextDetail && nextDetail.authenticated === true && nextDetail.username) {
      setAccountIdentity({ username: nextDetail.username });
      return;
    }

    try {
      const response = await axios.get(`${backendHost()}/accounts/profile`, {
        timeout: COMMENTS_FETCH_TIMEOUT_MS,
        withCredentials: true,
        validateStatus: (status) => status < 500,
      });
      if (response.status === 200 && response.data?.payload?.username) {
        setAccountIdentity({ username: response.data.payload.username });
        return;
      }
    } catch (_) {
      // Guest posting remains anonymous when account status cannot be confirmed.
    }

    setAccountIdentity(null);
  }, []);

  const resetForm = useCallback(() => {
    setReportText('');
    setImageFile(null);
    setImagePreviewUrl('');
    setPostAnonymously(true);
    setPostError('');
  }, []);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl('');
      return undefined;
    }

    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile]);

  useEffect(() => {
    refreshAccountIdentity();
  }, [refreshAccountIdentity]);

  useEffect(() => {
    const handleAuthState = (event) => {
      refreshAccountIdentity(event?.detail || null);
    };

    window.addEventListener('ui:auth-state', handleAuthState);
    return () => {
      window.removeEventListener('ui:auth-state', handleAuthState);
    };
  }, [refreshAccountIdentity]);

  useEffect(() => {
    if (!canPostWithAccount) {
      setPostAnonymously(true);
    }
  }, [canPostWithAccount]);

  useEffect(() => {
    if (!isModalOpen) return;
    refreshAccountIdentity();
  }, [isModalOpen, refreshAccountIdentity]);

  useEffect(() => {
    if (!isModalOpen) return undefined;

    const focusTimer = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!isPosting) {
          setIsModalOpen(false);
          resetForm();
          triggerButtonRef.current?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen, isPosting, resetForm]);

  useEffect(() => {
    if (!selectedAttachment) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSelectedAttachment(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedAttachment]);

  const closeModal = useCallback(() => {
    if (isPosting) return;
    setIsModalOpen(false);
    resetForm();
    triggerButtonRef.current?.focus();
  }, [isPosting, resetForm]);

  const handleImageChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    if (!nextFile) {
      setImageFile(null);
      return;
    }
    if (!REPORT_IMAGE_TYPES.includes(nextFile.type)) {
      setPostError('Report image must be a JPG, PNG, GIF, or WebP file.');
      event.target.value = '';
      setImageFile(null);
      return;
    }
    if (nextFile.size > REPORT_IMAGE_MAX_BYTES) {
      setPostError('Report image must be 5 MB or smaller.');
      event.target.value = '';
      setImageFile(null);
      return;
    }
    setPostError('');
    setImageFile(nextFile);
  };

  const handleSubmitReport = async (event) => {
    event.preventDefault();
    if (!eventId || isPosting) return;

    const trimmedText = reportText.trim();
    if (!trimmedText && !imageFile) {
      setPostError('Add a report or image before posting.');
      return;
    }
    const formData = new FormData();
    formData.append('eventId', eventId);
    formData.append('anonymous', postAnonymously ? 'true' : 'false');
    if (trimmedText) formData.append('content', trimmedText);
    if (imageFile) formData.append('image', imageFile);

    setIsPosting(true);
    setPostError('');
    try {
      const response = await axios.post(`${backendHost()}/comments`, formData, {
        timeout: COMMENT_POST_TIMEOUT_MS,
        withCredentials: true,
      });
      setIsModalOpen(false);
      resetForm();
      triggerButtonRef.current?.focus();
      await onReportsChanged?.({ createdComment: response?.data?.payload || null });
    } catch (error) {
      setPostError(error?.response?.data?.message || error?.message || 'Failed to post report.');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <section className="eqinfo-panel report-section" aria-labelledby="report-section-title">
      <div className="report-section-header">
        <div>
          <div className="report-section-heading-row">
            <h3 id="report-section-title">Reports</h3>
            <InfoTooltip
              title="Community reports"
              label="About community reports"
              variant="inline"
            >
              Community observations linked to this earthquake are public submissions and may not be verified by UPRI.
            </InfoTooltip>
          </div>
          <p className="report-trust-note">
            Public submissions may not be verified by UPRI.
          </p>
        </div>
        <button
          id="report-post-trigger"
          type="button"
          className="report-primary-button"
          ref={triggerButtonRef}
          onClick={() => setIsModalOpen(true)}
          disabled={!eventId}
        >
          Post a Report
        </button>
      </div>

      {loadError && <div className="report-message report-message-error" role="alert">{loadError}</div>}

      <div className="report-list" aria-live="polite">
        {isLoading && comments.length === 0 ? (
          <div className="report-empty" role="status">Loading reports...</div>
        ) : comments.length > 0 ? (
          comments.map((comment, index) => {
            const imageUrl = resolveCommentImageUrl(getCommentImage(comment));
            const text = getCommentText(comment);
            const commentKey = comment?.id || comment?._id || `${eventId}-comment-${index}`;
            const author = getCommentAuthor(comment);
            return (
              <article
                className={`report-card ${imageUrl ? 'report-card-with-media' : ''}`}
                key={commentKey}
                id={`comment-${commentKey}`}
              >
                {imageUrl && (
                  <div className="report-card-media">
                    <ReportAttachment
                      src={imageUrl}
                      onPreview={(src) => setSelectedAttachment({
                        src,
                        alt: `Submitted report attachment from ${author}`,
                      })}
                    />
                  </div>
                )}
                <div className="report-card-content">
                  <div className="report-card-meta">
                    <strong>{author}</strong>
                    {formatCommentTime(comment) && <span>{formatCommentTime(comment)}</span>}
                  </div>
                  {text && <p>{text}</p>}
                  {!text && imageUrl && <p className="report-image-only-label">Image report</p>}
                </div>
              </article>
            );
          })
        ) : (
          <div className="report-empty report-empty-compact" role="status">
            <strong>No reports yet.</strong>
            <span>Share the first on-the-ground observation for this event.</span>
            <small>Use “Post a Report” to add a public note or image.</small>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="report-modal-backdrop" role="presentation" onMouseDown={closeModal}>
          <form
            className="report-modal"
            aria-modal="true"
            aria-labelledby="report-modal-title"
            aria-describedby={postError ? 'report-form-error' : undefined}
            role="dialog"
            onSubmit={handleSubmitReport}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="report-modal-titlebar">
              <div className="report-modal-heading">
                <h3 id="report-modal-title">Post a Report</h3>
                <p>Share a public observation linked to this earthquake.</p>
              </div>
              <button type="button" className="report-icon-button" onClick={closeModal} aria-label="Close report form">
                <FiX />
              </button>
            </div>

            <div className="report-modal-intro">
              <div className="report-anonymous-status">
                <span aria-hidden="true" />
                {postAnonymously
                  ? 'Anonymous report'
                  : `Posting as ${accountIdentity?.username || 'your account'}`}
              </div>
              <p>
                Text or image is required. Avoid sharing personal contact details.
                {!canPostWithAccount ? ' Sign in from the account menu to post under your contributor name.' : ''}
              </p>
            </div>

            <div className="report-field-row">
              <label className="report-field-label" htmlFor="report-observation">
                Observation
              </label>
              <span>{reportText.trim().length} characters</span>
            </div>
            <textarea
              id="report-observation"
              ref={textareaRef}
              value={reportText}
              onChange={(event) => setReportText(event.target.value)}
              placeholder="Describe what you observed..."
              rows={5}
            />

            {imagePreviewUrl && (
              <div className="report-image-preview">
                <img src={imagePreviewUrl} alt="Selected report attachment preview" />
                <div className="report-image-preview-meta">
                  <strong>Attached image</strong>
                  <span>{selectedFileSummary}</span>
                  <button type="button" onClick={() => setImageFile(null)}>Remove image</button>
                </div>
              </div>
            )}

            <div className="report-modal-controls">
              <label className="report-image-button">
                <FiImage aria-hidden="true" />
                Add image
                <input type="file" accept={REPORT_IMAGE_TYPES.join(',')} onChange={handleImageChange} />
              </label>
              <span className="report-control-hint">JPG, PNG, GIF, or WebP up to 5 MB</span>
            </div>

            <div className="report-modal-controls report-modal-controls-secondary">
              {canPostWithAccount ? (
                <label className="report-checkbox">
                  <input
                    type="checkbox"
                    checked={postAnonymously}
                    onChange={(event) => setPostAnonymously(event.target.checked)}
                  />
                  <span>Post anonymously</span>
                </label>
              ) : (
                <div className="report-identity-note" aria-live="polite">
                  This report will be posted anonymously.
                </div>
              )}
            </div>

            {postError && (
              <div id="report-form-error" className="report-message report-message-error" role="alert">
                {postError}
              </div>
            )}

            <div className="report-modal-actions">
              <button type="button" className="report-secondary-button" onClick={closeModal} disabled={isPosting}>
                Cancel
              </button>
              <button type="submit" className="report-submit-button" disabled={isPosting}>
                <span>{isPosting ? 'Posting...' : 'Post Report'}</span>
                <FiSend aria-hidden="true" />
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedAttachment && (
        <div
          className="report-lightbox-backdrop"
          role="presentation"
          onMouseDown={() => setSelectedAttachment(null)}
        >
          <div
            className="report-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Report attachment preview"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="report-icon-button report-lightbox-close"
              onClick={() => setSelectedAttachment(null)}
              aria-label="Close attachment preview"
            >
              <FiX />
            </button>
            <img src={selectedAttachment.src} alt={selectedAttachment.alt} />
          </div>
        </div>
      )}
    </section>
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
  const [displaySummary, setDisplaySummary] = useState('');
  const [reportComments, setReportComments] = useState([]);
  const [reportCount, setReportCount] = useState(0);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState('');
  const reportsRef = useRef(null);
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
  const reportEventId = useMemo(
    () => (earthquakeInfo ? getEarthquakeEventId(earthquakeInfo, eventId) : ''),
    [earthquakeInfo, eventId]
  );
  const showCommunityPreview = reportsLoading || Boolean(reportsError) || reportComments.length > 0;

  const loadReports = useCallback(async () => {
    if (!reportEventId) {
      setReportComments([]);
      setReportCount(0);
      setReportsError('');
      return;
    }

    setReportsLoading(true);
    setReportsError('');
    try {
      const response = await axios.get(`${backendHost()}/comments/`, {
        params: { eventId: reportEventId },
        timeout: COMMENTS_FETCH_TIMEOUT_MS,
        withCredentials: true,
      });
      const nextComments = getCommentsFromResponse(response.data);
      setReportComments(nextComments);
      setReportCount(getCommentTotalFromResponse(response.data, nextComments));
    } catch (error) {
      setReportComments([]);
      setReportCount(0);
      setReportsError(error?.response?.data?.message || error?.message || 'Failed to load reports.');
    } finally {
      setReportsLoading(false);
    }
  }, [reportEventId]);

  const handleReportsChanged = useCallback(async ({ createdComment } = {}) => {
    if (createdComment) {
      setReportComments((prev) => {
        const createdKey = getCommentKey(createdComment, 'created-comment');
        const withoutDuplicate = prev.filter(
          (comment, index) => getCommentKey(comment, `existing-${index}`) !== createdKey
        );
        return [createdComment, ...withoutDuplicate];
      });
      setReportCount((prev) => Math.max(prev + 1, 1));
      void loadReports();
      return;
    }

    await loadReports();
  }, [loadReports]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Sync displaySummary with earthquakeInfo
  useEffect(() => {
    const summary = earthquakeInfo?.summaryOverride?.text || earthquakeInfo?.eventSummary || '';
    setDisplaySummary(summary);
  }, [earthquakeInfo?.summaryOverride?.text, earthquakeInfo?.eventSummary]);


  // Callback when summary is updated
  const handleSummaryUpdated = useCallback((updatedSummary) => {
    setDisplaySummary(updatedSummary);

    // Patch the in-memory fetched earthquake so it survives re-renders
    setFetchedEarthquake((prev) => {
      const base = prev || earthquakeInfo;
      if (!base) return prev;
      return {
        ...base,
        eventSummary: updatedSummary,
        summaryOverride: { ...(base.summaryOverride || {}), text: updatedSummary },
      };
    });

    // Also update the localStorage cache so refresh doesn't revert it
    if (eventId) {
      const base = fetchedEarthquake || cachedEarthquake || earthquakeInfo;
      if (base) {
        writeCachedEarthquake(eventId, {
          ...base,
          eventSummary: updatedSummary,
          summaryOverride: { ...(base.summaryOverride || {}), text: updatedSummary },
        });
      }
    }
  }, [eventId, earthquakeInfo, fetchedEarthquake, cachedEarthquake]);

  // Callback to scroll to reports section
  const scrollToReports = useCallback(() => {
    reportsRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const openReportComposer = useCallback(() => {
    scrollToReports();
    window.setTimeout(() => {
      document.getElementById('report-post-trigger')?.click();
    }, 250);
  }, [scrollToReports]);

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

        <div className="eqinfo-main-columns">
          <div className="eqinfo-main-column eqinfo-main-column-reference">
            <EditableEventSummary
              eventId={earthquakeInfo?.publicID || eventId}
              initialSummary={displaySummary}
              earthquakeInfo={earthquakeInfo}
              endpointType="eq-events"
              canEdit={false}
              onSummaryUpdated={handleSummaryUpdated}
              className="eqinfo-panel-summary-only"
            />

            <NearbyEvents
              earthquakeInfo={earthquakeInfo}
              nearbyEventCount={5}
              distanceThresholdKm={200}
            />

            <CatalogComparison earthquakeInfo={earthquakeInfo} />
          </div>

          <div className="eqinfo-main-column eqinfo-main-column-community">
            {showCommunityPreview ? (
              <section className="eqinfo-panel eqinfo-carousel-section">
                <div className="panel-header">
                  <div className="panel-title">
                    <h3>Community reports</h3>
                    {reportCount > 0 && <span className="panel-report-count">{reportCount} reports</span>}
                  </div>
                  <div className="community-preview-actions">
                    <button type="button" onClick={scrollToReports}>
                      View all
                    </button>
                    <button type="button" onClick={openReportComposer}>
                      Post report
                    </button>
                  </div>
                </div>
                <div className="panel-body eqinfo-panel-body-plain">
                  <CommunityReportsCarousel
                    reports={reportComments}
                    loading={reportsLoading}
                    error={reportsError}
                    onReportClick={scrollToReports}
                  />
                </div>
              </section>
            ) : null}

            <div ref={waveformSentinelRef} className="eqinfo-support-section">
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

            <div ref={reportsRef}>
              <ReportCommentsSection
                eventId={reportEventId}
                comments={reportComments}
                isLoading={reportsLoading}
                loadError={reportsError}
                onReportsChanged={handleReportsChanged}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default EarthquakeDetailPage;
