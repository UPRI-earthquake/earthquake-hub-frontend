import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import styles from './SeismicWaveforms.module.css';
import { trackEvent } from '../analytics';
import Button from './Button';
import InfoTooltip from './InfoTooltip';
import axios from 'axios';
import moment from '../utils/time';
import { useStations } from '../hooks/useStations';
import { calculateDistance } from '../utils/distanceCalculator';
import { toFiniteNumber } from '../utils/earthquakeFormat';
import { FiChevronDown, FiDownload, FiMaximize2 } from 'react-icons/fi';

/**
 * SeismicWaveforms component displays recorded seismic waveforms for multiple stations
 * during an earthquake event. Each station shows a compact waveform visualization with
 * access to station metadata.
 */
function SeismicWaveforms({
  earthquakeInfo,
  stations = [],
  availabilityStatus = 'verified',
  isAvailabilityPending = false,
  stationListSource = 'verified',
  initialVisibleCount = DEFAULT_VISIBLE_STATION_COUNT,
  showAllByDefault = false,
  showStationToggle = true,
  onViewAllStations,
  className = '',
  title = 'Station Recordings',
}) {
  const [waveforms, setWaveforms] = useState({});
  const [loadingStations, setLoadingStations] = useState(new Set());
  const [showAllStations, setShowAllStations] = useState(showAllByDefault);
  const [stationLocationsByCode, setStationLocationsByCode] = useState({});
  const containerRef = useRef(null);
  const seisplotjsRef = useRef(null);
  const requestedWaveformsRef = useRef(new Set());
  const { fetchStations } = useStations();
  const nodeEnv =
    typeof process !== 'undefined' && process.env ? process.env.NODE_ENV : '';
  const isDevelopment =
    nodeEnv === 'development';
  const runtimeEnv = useMemo(
    () => (typeof window !== 'undefined' && window.ENV ? window.ENV : {}),
    [],
  );
  const canUseDemoWaveform =
    isDevelopment || nodeEnv === 'test' || runtimeEnv.REACT_APP_SEIS_DEMO === '1';
  const eventTimeKey = earthquakeInfo?.eventTime || earthquakeInfo?.OT || '';
  const stationList = useMemo(
    () => (Array.isArray(stations) ? stations : []),
    [stations]
  );
  const hasStations = stationList.length > 0;
  const visibleStationCount = Math.max(1, Number(initialVisibleCount) || DEFAULT_VISIBLE_STATION_COUNT);
  const visibleStations = useMemo(
    () => (showAllStations ? stationList : stationList.slice(0, visibleStationCount)),
    [showAllStations, stationList, visibleStationCount]
  );
  const canToggleStations = stationList.length > visibleStationCount;
  const eventCoordinates = useMemo(
    () => getEventCoordinates(earthquakeInfo),
    [earthquakeInfo]
  );

  useEffect(() => {
    let isMounted = true;

    fetchStations()
      .then((backendStations) => {
        if (!isMounted) return;
        setStationLocationsByCode(buildStationLocationLookup(backendStations));
      })
      .catch(() => {
        if (isMounted) setStationLocationsByCode({});
      });

    return () => {
      isMounted = false;
    };
  }, [fetchStations]);

  useEffect(() => {
    setShowAllStations(showAllByDefault);
  }, [showAllByDefault, stationList.length]);

  // Lazy load seisplotjs
  const ensureSeisplotjs = useCallback(async () => {
    if (seisplotjsRef.current) return seisplotjsRef.current;
    const sp = await import('seisplotjs');
    seisplotjsRef.current = sp;
    return sp;
  }, []);

  // Format times for data retrieval
  const formatDateTime = useCallback((dateString, secondsOffset = 0) => {
    const parsed = moment.utc(dateString);
    if (!parsed || !parsed.isValid()) return null;
    return parsed.add(secondsOffset, 'seconds').format('YYYY-MM-DDTHH:mm:ss');
  }, []);

  // Fetch and plot waveform for a station
  const loadWaveform = useCallback(
    async (stationCode) => {
      if (!eventTimeKey) {
        return;
      }

      try {
        setLoadingStations((prev) => new Set([...prev, stationCode]));
        
        // Initialize debug object safely
        if (isDevelopment && typeof window !== 'undefined') {
          if (!window._waveformDebug) window._waveformDebug = {};
          window._waveformDebug[stationCode] = {
            attempt: 'started',
            timestamp: new Date().toISOString()
          };
        }
        
        const sp = await ensureSeisplotjs();

        const startTime = formatDateTime(eventTimeKey, -60); // 60 seconds before
        const endTime = formatDateTime(eventTimeKey, 600); // 600 seconds (10 minutes) after

        if (!startTime || !endTime) {
          setLoadingStations((prev) => {
            const updated = new Set(prev);
            updated.delete(stationCode);
            return updated;
          });
          return;
        }

        const stationCodeUpper = String(stationCode || '').toUpperCase();
        
        // Query FDSNWS for MSEED data with fallback strategy
        const tryFdsnwsProvider = async (baseUrl, providerName) => {
          if (isDevelopment && typeof window !== 'undefined' && window._waveformDebug && window._waveformDebug[stationCode]) {
            window._waveformDebug[stationCode][`${providerName}_attempt`] = 'started';
          }

          try {
            // FDSNWS Data Select query
            const fdsnwsUrl = `${baseUrl}/dataselect/1/query?starttime=${startTime}Z&endtime=${endTime}Z&network=AM&station=${stationCodeUpper}&location=00&channel=*&nodata=404`;

            if (isDevelopment && typeof window !== 'undefined' && window._waveformDebug && window._waveformDebug[stationCode]) {
              window._waveformDebug[stationCode][`${providerName}_url`] = fdsnwsUrl;
            }

            const response = await axios.get(fdsnwsUrl, {
              responseType: 'arraybuffer',
              timeout: 10000,
              withCredentials: false,
              validateStatus: () => true,
            });

            if (isDevelopment && typeof window !== 'undefined' && window._waveformDebug && window._waveformDebug[stationCode]) {
              window._waveformDebug[stationCode][`${providerName}_status`] = response.status;
              window._waveformDebug[stationCode][`${providerName}_size`] = response.data.byteLength;
            }

            if (response.status === 200 && response.data.byteLength > 0) {
              const records = parseMiniSeedRecords(sp, response.data);

              if (Array.isArray(records) && records.length > 0) {
                return { success: true, data: records, provider: providerName };
              }
            }
            return null;
          } catch (error) {
            if (isDevelopment && typeof window !== 'undefined' && window._waveformDebug && window._waveformDebug[stationCode]) {
              window._waveformDebug[stationCode][`${providerName}_error`] = error?.message || 'Request failed';
            }
            return null;
          }
        };

        // Try multiple FDSNWS providers in order
        const FDSNWS_PRIMARY = runtimeEnv.REACT_APP_FDSNWS;
        const FDSNWS_BACKUP = runtimeEnv.REACT_APP_RS_FDSNWS;

        let waveformData = null;
        let sourceProvider = null;

        // Try primary FDSNWS
        if (FDSNWS_PRIMARY) {
          waveformData = await tryFdsnwsProvider(FDSNWS_PRIMARY, 'primary');
          if (waveformData) sourceProvider = 'FDSNWS-Primary';
        }

        // Try backup Raspberry Shake FDSNWS if primary failed
        if (!waveformData && FDSNWS_BACKUP) {
          waveformData = await tryFdsnwsProvider(FDSNWS_BACKUP, 'backup_rs');
          if (waveformData) sourceProvider = 'FDSNWS-RaspberryShake';
        }

        // If FDSNWS succeeded, render the waveform
        if (waveformData && waveformData.success) {
          try {
            const preparedWaveform = createWaveformDisplay(sp, waveformData.data);

            setWaveforms((prev) => ({
              ...prev,
              [stationCode]: {
                dataList: preparedWaveform.dataList,
                config: preparedWaveform.config,
                timestamp: new Date().toISOString(),
                isDemoData: false,
                source: sourceProvider,
                channels: preparedWaveform.channels,
                channelSamples: preparedWaveform.channelSamples,
              },
            }));

            trackEvent('waveform_loaded', {
              station_code: stationCode,
              source: sourceProvider,
            });

            if (isDevelopment && typeof window !== 'undefined' && window._waveformDebug && window._waveformDebug[stationCode]) {
              window._waveformDebug[stationCode].result = `success_from_${waveformData.provider}`;
              window._waveformDebug[stationCode].channels = preparedWaveform.channels;
            }
            return;
          } catch (renderError) {
            if (isDevelopment && typeof window !== 'undefined' && window._waveformDebug && window._waveformDebug[stationCode]) {
              window._waveformDebug[stationCode].renderError = renderError?.message || 'Render failed';
            }
          }
        }

        // Fallback to demo waveform only for non-production diagnostics or explicit opt-in.
        if (canUseDemoWaveform) {
          if (isDevelopment && typeof window !== 'undefined' && window._waveformDebug && window._waveformDebug[stationCode]) {
            window._waveformDebug[stationCode].demoAttempt = 'started';
          }
          try {
            const demoResponse = await axios.get('/demo.mseed', {
              responseType: 'arraybuffer',
              timeout: 5000,
            });

            if (isDevelopment && typeof window !== 'undefined' && window._waveformDebug && window._waveformDebug[stationCode]) {
              window._waveformDebug[stationCode].demoAttempt = 'got_response';
              window._waveformDebug[stationCode].demoSize = demoResponse.data.byteLength;
            }

            if (demoResponse.data.byteLength > 0) {
              const records = parseMiniSeedRecords(sp, demoResponse.data);

              if (Array.isArray(records) && records.length > 0) {
                const preparedWaveform = createWaveformDisplay(sp, records);

                setWaveforms((prev) => ({
                  ...prev,
                  [stationCode]: {
                    dataList: preparedWaveform.dataList,
                    config: preparedWaveform.config,
                    timestamp: new Date().toISOString(),
                    isDemoData: true,
                    source: 'demo.mseed',
                    channels: preparedWaveform.channels,
                    channelSamples: preparedWaveform.channelSamples,
                  },
                }));

                if (isDevelopment && typeof window !== 'undefined' && window._waveformDebug && window._waveformDebug[stationCode]) {
                  window._waveformDebug[stationCode].result = 'success_from_demo';
                  window._waveformDebug[stationCode].channels = preparedWaveform.channels;
                }
              }
            }
          } catch (demoError) {
            // Demo also failed
            if (isDevelopment && typeof window !== 'undefined' && window._waveformDebug && window._waveformDebug[stationCode]) {
              window._waveformDebug[stationCode].demoError = demoError?.message || 'Demo fallback also failed';
              window._waveformDebug[stationCode].result = 'all_sources_failed';
            }
          }
        }
      } catch (error) {
        // Outer error handling
        if (isDevelopment && typeof window !== 'undefined' && window._waveformDebug && window._waveformDebug[stationCode]) {
          window._waveformDebug[stationCode].outerError = error?.message || 'Unknown outer error';
        }
      } finally {
        setLoadingStations((prev) => {
          const updated = new Set(prev);
          updated.delete(stationCode);
          return updated;
        });
      }
    },
    [eventTimeKey, formatDateTime, ensureSeisplotjs, isDevelopment, canUseDemoWaveform, runtimeEnv]
  );

  useEffect(() => {
    requestedWaveformsRef.current = new Set();
    setWaveforms({});
    setLoadingStations(new Set());
    setShowAllStations(showAllByDefault);
  }, [eventTimeKey, showAllByDefault]);

  // Load waveforms when the event or visible station list changes.
  useEffect(() => {
    if (isDevelopment && typeof window !== 'undefined') {
      window._effectDebug = {
        stationsArray: stationList,
        stationsLength: stationList.length,
        requestedWaveforms: Array.from(requestedWaveformsRef.current),
        willLoop: stationList.length > 0
      };
    }
    
    if (eventTimeKey && visibleStations.length > 0) {
      visibleStations.forEach((stationCode) => {
        const normalizedStationCode = String(stationCode || '').toUpperCase();
        const requestKey = `${eventTimeKey}|${normalizedStationCode}`;
        const alreadyRequested = requestedWaveformsRef.current.has(requestKey);

        if (isDevelopment && typeof window !== 'undefined') {
          window._effectDebug[stationCode] = {
            exists: !!stationCode,
            requestKey,
            alreadyRequested,
            willLoad: !!(stationCode && !alreadyRequested)
          };
        }
        
        if (stationCode && !alreadyRequested) {
          requestedWaveformsRef.current.add(requestKey);
          if (isDevelopment && typeof window !== 'undefined') {
            window._effectDebug[stationCode].loadingNow = true;
          }
          loadWaveform(stationCode);
        }
      });
    }
  }, [visibleStations, loadWaveform, isDevelopment, eventTimeKey, stationList]);

  // Debug: Always track what's passed to this component
  if (isDevelopment && typeof window !== 'undefined') {
    window._seismicWaveformsDebug = {
      hasEarthquakeInfo: !!earthquakeInfo,
      earthquakeEventTime: earthquakeInfo?.eventTime,
      earthquakeOT: earthquakeInfo?.OT,
      hasEventTime: !!(earthquakeInfo?.eventTime || earthquakeInfo?.OT),
      stations: stations,
      stationsLength: stations?.length || 0,
      componentWillRender: !!(earthquakeInfo && stations && stations.length > 0),
      effectDebug: window._effectDebug || {},
      waveformLoadDetails: window._waveformDebug || {}
    };
  }

  const availabilityNote = isAvailabilityPending || stationListSource === 'candidate'
    ? 'Candidate stations were active near detection time. Waveform availability is still being checked as FDSN data catches up.'
    : 'Only stations with confirmed data for this event are listed.';

  if (!earthquakeInfo) {
    return null;
  }

  return (
    <section
      className={`${styles.waveformContainer} ${!hasStations ? styles.waveformContainerCompact : ''} ${className}`}
      ref={containerRef}
    >
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>
          <h3>{title}</h3>
          <InfoTooltip title="Station recordings" label="About station recordings" variant="inline">
            {availabilityNote}
          </InfoTooltip>
        </div>
      </div>

      {hasStations ? (
        <>
          <div className={styles.waveformList}>
            {visibleStations.map((stationCode, index) => (
              <WaveformRow
                key={stationCode}
                stationCode={stationCode}
                stationIndex={index}
                waveformData={waveforms[stationCode]}
                isLoading={loadingStations.has(stationCode)}
                earthquakeInfo={earthquakeInfo}
                distanceLabel={getStationDistanceLabel(stationCode, eventCoordinates, stationLocationsByCode)}
                isAvailabilityPending={isAvailabilityPending}
              />
            ))}
          </div>
          {canToggleStations && showStationToggle ? (
            <div className={styles.toggleRow}>
              <button
                type="button"
                className={styles.toggleButton}
                aria-expanded={showAllStations}
                aria-haspopup={onViewAllStations ? 'dialog' : undefined}
                onClick={() => {
                  if (onViewAllStations && !showAllStations) {
                    onViewAllStations();
                    return;
                  }
                  setShowAllStations((prev) => !prev);
                }}
              >
                {onViewAllStations && !showAllStations
                  ? `View all ${stationList.length} stations`
                  : showAllStations
                    ? 'Show fewer stations'
                    : `Show all ${stationList.length} stations`}
                {onViewAllStations && !showAllStations ? (
                  <FiMaximize2 className={styles.toggleIcon} aria-hidden="true" focusable="false" />
                ) : (
                  <FiChevronDown className={styles.toggleIcon} aria-hidden="true" focusable="false" />
                )}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className={`${styles.emptyState} ${styles.emptyStateCompact} eqinfo-empty-state eqinfo-empty-state--compact`}>
          <span>No station recordings</span>
          <small>
            {availabilityStatus === 'pending'
              ? 'Recording availability is still being checked for this event.'
              : 'No online station recordings are currently available for this event.'}
          </small>
        </div>
      )}
    </section>
  );
}

function parseMiniSeedRecords(sp, arrayBuffer) {
  const ms = sp.miniseed || {};
  try {
    if (typeof ms.parseDataRecords === 'function') return ms.parseDataRecords(arrayBuffer);
    if (typeof ms.parseMiniseed === 'function') return ms.parseMiniseed(arrayBuffer);
    if (typeof ms.parse === 'function') return ms.parse(arrayBuffer);
  } catch (_) {
    return [];
  }
  return [];
}

function createWaveformDisplay(sp, records) {
  const ms = sp.miniseed || {};
  let seismograms = [];

  if (typeof ms.seismogramPerChannel === 'function') {
    seismograms = ms.seismogramPerChannel(records);
  } else if (typeof ms.merge === 'function') {
    seismograms = [ms.merge(records)];
  } else {
    const seg = ms.createSeismogramSegment(records);
    seismograms = [new sp.seismogram.Seismogram([seg])];
  }

  const channelOrder = { Z: 0, N: 1, E: 2, '1': 3, '2': 4, '3': 5 };
  const selectedSeismograms = seismograms
    .slice()
    .sort((a, b) => {
      const aChannel = String(a?.channelCode || '').toUpperCase();
      const bChannel = String(b?.channelCode || '').toUpperCase();
      const aSuffix = aChannel.slice(-1);
      const bSuffix = bChannel.slice(-1);
      const aOrder = channelOrder[aSuffix] ?? 99;
      const bOrder = channelOrder[bSuffix] ?? 99;
      return aOrder === bOrder
        ? aChannel.localeCompare(bChannel)
        : aOrder - bOrder;
    });

  const dataList = selectedSeismograms
    .map((seis) => {
      const seisData = sp.seismogram.SeismogramDisplayData.fromSeismogram(seis);
      seisData.alignmentTime = seis.startTime || sp.luxon.DateTime.utc();
      return seisData;
    })
    .filter(Boolean);

  if (dataList.length === 0) {
    throw new Error('No displayable MiniSEED channels parsed');
  }

  const config = new sp.seismographconfig.SeismographConfig();
  config.wheelZoom = false;
  config.doGain = true;
  config.isRelativeTime = true;
  config.linkedAmplitudeScale = new sp.scale.IndividualAmplitudeScale();
  config.lineColors = selectedSeismograms.map((_, index) => WAVEFORM_CHANNEL_COLORS[index % WAVEFORM_CHANNEL_COLORS.length]);

  return {
    dataList,
    config,
    channels: selectedSeismograms.map((seis) => seis.codes()),
    channelSamples: selectedSeismograms
      .map((seis, index) => ({
        code: seis.codes(),
        samples: extractSeismogramSamples(seis),
        color: WAVEFORM_CHANNEL_COLORS[index % WAVEFORM_CHANNEL_COLORS.length],
      }))
      .filter((channel) => channel.samples.length > 0),
  };
}

function extractSeismogramSamples(seismogram) {
  const segments = Array.isArray(seismogram?.segments) ? seismogram.segments : [];
  const samples = [];

  segments.forEach((segment) => {
    try {
      const yValues = segment?.y;
      if (yValues && typeof yValues.length === 'number') {
        samples.push(...Array.from(yValues));
      }
    } catch (_) {
      // Skip a segment if seisplotjs cannot decode it.
    }
  });

  return samples
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

const WAVEFORM_CHANNEL_COLORS = [
  '#0284c7',
  '#16a34a',
  '#ea580c',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#ca8a04',
  '#be185d',
];

const DEFAULT_WAVEFORM_CHANNELS = ['EHZ', 'ENZ', 'ENN', 'ENE'];
const DEFAULT_VISIBLE_STATION_COUNT = 3;

/**
 * Individual waveform row component
 */
function WaveformRow({
  stationCode,
  stationIndex,
  waveformData,
  isLoading,
  earthquakeInfo,
  distanceLabel,
  isAvailabilityPending,
}) {
  const channels = useMemo(
    () => (Array.isArray(waveformData?.channelSamples) ? waveformData.channelSamples : []),
    [waveformData]
  );
  const preferredChannel = useMemo(() => getPreferredChannelCode(channels), [channels]);
  const [selectedChannel, setSelectedChannel] = useState(DEFAULT_WAVEFORM_CHANNELS[0]);
  const activeChannel = selectedChannel || preferredChannel || DEFAULT_WAVEFORM_CHANNELS[0];
  const displayedChannels = activeChannel
    ? channels.filter((channel) => channel.code === activeChannel)
    : channels;

  useEffect(() => {
    if (channels.length === 0) return;
    setSelectedChannel((current) => (
      channels.some((channel) => channel.code === current)
        ? current
        : preferredChannel
    ));
  }, [channels, preferredChannel]);

  return (
    <div className={styles.waveformRow}>
      <div className={styles.waveformHeader}>
        <StationChannelControl
          stationCode={stationCode}
          channels={channels}
          selectedChannel={activeChannel}
          onChange={setSelectedChannel}
          distanceLabel={distanceLabel}
        />
        <div className={styles.rowActions}>
          <MetadataButton stationCode={stationCode} earthquakeInfo={earthquakeInfo} />
          <DownloadButton stationCode={stationCode} earthquakeInfo={earthquakeInfo} />
        </div>
      </div>

      <div className={styles.waveformCanvas}>
        <CompactWaveform
          stationCode={stationCode}
          stationIndex={stationIndex}
          channels={displayedChannels}
          isLoading={isLoading}
          eventTime={earthquakeInfo?.eventTime || earthquakeInfo?.OT}
          isAvailabilityPending={isAvailabilityPending}
        />
      </div>
    </div>
  );
}

function StationChannelControl({ stationCode, channels, selectedChannel, onChange, distanceLabel }) {
  const channelOptions = channels.length > 0
    ? channels.map((channel) => channel.code)
    : DEFAULT_WAVEFORM_CHANNELS;

  return (
    <div className={styles.stationControlGroup}>
      <div className={styles.stationControl}>
        <div className={styles.stationLabel}>{stationCode.toUpperCase()}</div>
        <select
          className={styles.channelSelect}
          aria-label={`Waveform channel for ${stationCode}`}
          value={selectedChannel}
          onChange={(event) => onChange(event.target.value)}
          style={{ '--channel-label-width': `${Math.max(formatChannelLabel(selectedChannel).length, 3)}ch` }}
        >
          {channelOptions.map((channelCode) => (
            <option
              key={channelCode}
              value={channelCode}
              title={channelCode}
            >
              {formatChannelLabel(channelCode)}
            </option>
          ))}
        </select>
        {distanceLabel ? (
          <div className={styles.stationDistance}>{distanceLabel}</div>
        ) : null}
      </div>
    </div>
  );
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

function getStationDistanceLabel(stationCode, eventCoordinates, stationLocationsByCode) {
  if (!eventCoordinates) return '';

  const stationLocation = stationLocationsByCode[String(stationCode || '').toUpperCase()];
  const stationLatitude = toFiniteNumber(stationLocation?.latitude);
  const stationLongitude = toFiniteNumber(stationLocation?.longitude);

  if (stationLatitude == null || stationLongitude == null) return '';

  const distanceKm = calculateDistance(
    eventCoordinates.latitude,
    eventCoordinates.longitude,
    stationLatitude,
    stationLongitude
  );

  if (!Number.isFinite(distanceKm)) return '';
  return `${formatApproxDistance(distanceKm)} from epicenter`;
}

function formatApproxDistance(distanceKm) {
  if (distanceKm < 1) return '<1 km';
  return `~${Math.round(distanceKm).toLocaleString()} km`;
}

function formatChannelLabel(code) {
  const parts = String(code || '').split('.');
  return parts[parts.length - 1] || String(code || 'Channel');
}

const WAVEFORM_VIEW_WIDTH = 820;
const WAVEFORM_VIEW_HEIGHT = 98;
const WAVEFORM_PLOT_LEFT = 82;
const WAVEFORM_PLOT_RIGHT = 16;
const WAVEFORM_PLOT_TOP = 12;
const WAVEFORM_PLOT_BOTTOM = 74;
const WAVEFORM_PLOT_WIDTH = WAVEFORM_VIEW_WIDTH - WAVEFORM_PLOT_LEFT - WAVEFORM_PLOT_RIGHT;
const WAVEFORM_BASELINE_Y = 43;
const WAVEFORM_AMPLITUDE_Y = 25;
const WAVEFORM_MARKER_TOP_Y = WAVEFORM_PLOT_TOP;
const WAVEFORM_MARKER_BOTTOM_Y = WAVEFORM_PLOT_BOTTOM;
const WAVEFORM_TIME_TICK_COUNT = 7;
const WAVEFORM_AXIS_LABELS = [
  { key: 'max', top: `${(WAVEFORM_PLOT_TOP / WAVEFORM_VIEW_HEIGHT) * 100}%` },
  { key: 'zero', top: `${(WAVEFORM_BASELINE_Y / WAVEFORM_VIEW_HEIGHT) * 100}%` },
  { key: 'min', top: `${(WAVEFORM_PLOT_BOTTOM / WAVEFORM_VIEW_HEIGHT) * 100}%` },
];

function getPreferredChannelCode(channels) {
  if (!Array.isArray(channels) || channels.length === 0) return '';
  const preferred = channels.find((channel) => formatChannelLabel(channel.code).toUpperCase() === 'EHZ');
  return (preferred || channels[0]).code;
}

function CompactWaveform({ stationCode, stationIndex, channels, isLoading, eventTime, isAvailabilityPending }) {
  const color = getStationTraceColor(stationIndex);
  const waveformDisplay = useMemo(
    () => buildWaveformPaths(channels),
    [channels]
  );
  const paths = waveformDisplay.paths;
  const eventMarkerX = useMemo(
    () => getEventMarkerX(eventTime),
    [eventTime]
  );
  const maxAmplitudeLabel = formatAmplitudeLabel(waveformDisplay.maxAmplitude);
  const minAmplitudeLabel = formatAmplitudeLabel(-waveformDisplay.maxAmplitude);
  const timeTicks = useMemo(() => buildWaveformTimeTicks(eventTime), [eventTime]);
  const eventMarkerPercent = eventMarkerX == null ? '' : toWaveformPercent(eventMarkerX);

  if (isLoading) {
    return (
      <div className={styles.compactPlaceholder}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (paths.length === 0) {
    return (
      <div className={styles.compactEmpty}>
        <span>{isAvailabilityPending ? 'Checking waveform availability' : 'No waveform data available'}</span>
      </div>
    );
  }

  return (
    <div
      className={styles.waveformPlot}
      style={eventMarkerPercent ? { '--event-marker-left': eventMarkerPercent } : undefined}
    >
      <svg
        className={styles.compactWaveform}
        viewBox={`0 0 ${WAVEFORM_VIEW_WIDTH} ${WAVEFORM_VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Recorded waveform for ${stationCode}`}
      >
        <rect
          className={styles.waveformTrackBackground}
          x="0"
          y="0"
          width={WAVEFORM_VIEW_WIDTH}
          height={WAVEFORM_VIEW_HEIGHT}
        />
        <g className={styles.waveformAxisLayer} aria-hidden="true">
          <line
            className={styles.waveformAxisLine}
            x1={WAVEFORM_PLOT_LEFT}
            y1={WAVEFORM_PLOT_TOP}
            x2={WAVEFORM_PLOT_LEFT}
            y2={WAVEFORM_PLOT_BOTTOM}
            vectorEffect="non-scaling-stroke"
          />
          <line
            className={styles.waveformAxisLine}
            x1={WAVEFORM_PLOT_LEFT}
            y1={WAVEFORM_PLOT_BOTTOM}
            x2={WAVEFORM_VIEW_WIDTH - WAVEFORM_PLOT_RIGHT}
            y2={WAVEFORM_PLOT_BOTTOM}
            vectorEffect="non-scaling-stroke"
          />
          {[
            { y: WAVEFORM_PLOT_TOP, label: maxAmplitudeLabel },
            { y: WAVEFORM_BASELINE_Y, label: '0' },
            { y: WAVEFORM_PLOT_BOTTOM, label: minAmplitudeLabel },
          ].map((tick) => (
            <g key={tick.y}>
              <line
                className={styles.waveformAxisTick}
                x1={WAVEFORM_PLOT_LEFT - 8}
                y1={tick.y}
                x2={WAVEFORM_PLOT_LEFT}
                y2={tick.y}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
          <line
            className={styles.waveformBaselineLine}
            x1={WAVEFORM_PLOT_LEFT}
            y1={WAVEFORM_BASELINE_Y}
            x2={WAVEFORM_VIEW_WIDTH - WAVEFORM_PLOT_RIGHT}
            y2={WAVEFORM_BASELINE_Y}
            vectorEffect="non-scaling-stroke"
          />
          {timeTicks.map((tick) => (
            <g key={tick.x}>
              <line
                className={styles.waveformGridLine}
                x1={tick.x}
                y1={WAVEFORM_PLOT_TOP}
                x2={tick.x}
                y2={WAVEFORM_PLOT_BOTTOM}
                vectorEffect="non-scaling-stroke"
              />
              <line
                className={styles.waveformAxisTick}
                x1={tick.x}
                y1={WAVEFORM_PLOT_BOTTOM}
                x2={tick.x}
                y2={WAVEFORM_PLOT_BOTTOM + 7}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
        </g>
        {paths.map((path, index) => (
          <path
            key={path.code || index}
            d={path.points}
            fill="none"
            stroke={path.color || color}
            strokeWidth={index === 0 ? '2.35' : '1.8'}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={index === 0 ? '0.95' : '0.68'}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {eventMarkerX != null && (
          <g className={styles.eventTimeMarkerLayer}>
            <title>{`Arrival time: ${moment.utc(eventTime).format('YYYY-MM-DD HH:mm:ss')} UTC`}</title>
            <line
              className={styles.eventTimeMarkerHalo}
              x1={eventMarkerX}
              y1={WAVEFORM_MARKER_TOP_Y}
              x2={eventMarkerX}
              y2={WAVEFORM_MARKER_BOTTOM_Y}
              vectorEffect="non-scaling-stroke"
            />
            <line
              className={styles.eventTimeMarker}
              x1={eventMarkerX}
              y1={WAVEFORM_MARKER_TOP_Y}
              x2={eventMarkerX}
              y2={WAVEFORM_MARKER_BOTTOM_Y}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}
      </svg>
      <div className={styles.waveformAxisLabels} aria-hidden="true">
        {WAVEFORM_AXIS_LABELS.map((label) => {
          const labelText = {
            max: maxAmplitudeLabel,
            zero: '0',
            min: minAmplitudeLabel,
          }[label.key];

          return (
            <span
              key={label.key}
              className={`${styles.waveformAxisLabel} ${styles.waveformYAxisLabel}`}
              style={{ top: label.top }}
            >
              {labelText}
            </span>
          );
        })}
        <span className={`${styles.waveformAxisLabel} ${styles.waveformUtcLabel}`}>UTC</span>
        {timeTicks
          .filter((tick) => tick.label)
          .map((tick) => (
            <span
              key={tick.x}
              className={`${styles.waveformAxisLabel} ${styles.waveformTimeLabel} ${tick.isSecondary ? styles.waveformTimeLabelSecondary : ''}`}
              style={{ left: tick.percent }}
            >
              {tick.label}
            </span>
          ))}
        {eventMarkerPercent ? (
          <span className={`${styles.waveformAxisLabel} ${styles.waveformEventMarkerLabel}`}>
            Event time
          </span>
        ) : null}
      </div>
    </div>
  );
}

function getEventMarkerX(eventTime) {
  const eventMoment = moment.utc(eventTime);

  if (!eventMoment.isValid()) {
    return null;
  }

  const start = eventMoment.clone().add(-60, 'second');
  const end = eventMoment.clone().add(600, 'second');
  const totalMs = end.diff(start);
  const elapsedMs = eventMoment.diff(start);

  if (totalMs <= 0 || elapsedMs < 0 || elapsedMs > totalMs) {
    return null;
  }

  return WAVEFORM_PLOT_LEFT + (elapsedMs / totalMs) * WAVEFORM_PLOT_WIDTH;
}

function getStationTraceColor(stationIndex) {
  const colors = ['#45b58f', '#5aa3e8', '#e37357'];
  return colors[stationIndex % colors.length];
}

function buildWaveformPaths(channels) {
  const preparedChannels = channels
    .map((channel) => ({
      code: channel.code,
      color: channel.color,
      values: prepareWaveformValues(channel.samples),
    }))
    .filter((channel) => channel.values.length >= 2);
  const sharedMax = preparedChannels.reduce(
    (largest, channel) => Math.max(largest, getMaxAbs(channel.values)),
    0
  );

  if (!sharedMax) {
    return { paths: [], maxAmplitude: 0 };
  }

  return {
    maxAmplitude: sharedMax,
    paths: preparedChannels
      .map((channel) => ({
        code: channel.code,
        color: channel.color,
        points: buildWaveformPath(channel.values, sharedMax),
      }))
      .filter((channel) => channel.points),
  };
}

function prepareWaveformValues(samples) {
  if (!Array.isArray(samples) || samples.length < 2) {
    return [];
  }

  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const centeredSamples = samples.map((value) => value - mean);
  return minMaxDownsample(centeredSamples, 420);
}

function buildWaveformPath(values, sharedMax) {
  if (!Array.isArray(values) || values.length < 2 || !sharedMax) {
    return '';
  }

  return values
    .map((value, index) => {
      const x = WAVEFORM_PLOT_LEFT + (index / (values.length - 1)) * WAVEFORM_PLOT_WIDTH;
      const y = WAVEFORM_BASELINE_Y - (value / sharedMax) * WAVEFORM_AMPLITUDE_Y;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function formatAmplitudeLabel(value) {
  if (!Number.isFinite(value)) return '';
  const absValue = Math.abs(value);
  if (absValue >= 1000) {
    return value.toExponential(1);
  }
  if (absValue >= 100) {
    return Math.round(value).toLocaleString();
  }
  if (absValue >= 10) {
    return value.toFixed(1);
  }
  return value.toFixed(2);
}

function buildWaveformTimeTicks(eventTime) {
  const eventMoment = moment.utc(eventTime);
  const start = eventMoment.isValid()
    ? eventMoment.clone().subtract(60, 'second')
    : null;

  return Array.from({ length: WAVEFORM_TIME_TICK_COUNT }, (_, index) => {
    const ratio = index / (WAVEFORM_TIME_TICK_COUNT - 1);
    const x = WAVEFORM_PLOT_LEFT + ratio * WAVEFORM_PLOT_WIDTH;
    const shouldLabel = index > 0 && index < WAVEFORM_TIME_TICK_COUNT - 1 && index % 2 === 0;
    const label = shouldLabel && start
      ? start.clone().add(Math.round(ratio * 660), 'second').format('HH:mm:ss')
      : '';

    return { x, label, percent: toWaveformPercent(x), isSecondary: index !== 4 };
  });
}

function toWaveformPercent(x) {
  return `${((x / WAVEFORM_VIEW_WIDTH) * 100).toFixed(3)}%`;
}

function getMaxAbs(values) {
  return values.reduce((largest, value) => Math.max(largest, Math.abs(value)), 0);
}

function minMaxDownsample(samples, bucketCount) {
  if (samples.length <= bucketCount * 2) {
    return samples;
  }

  const result = [];
  const bucketSize = samples.length / bucketCount;

  for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
    const start = Math.floor(bucketIndex * bucketSize);
    const end = Math.min(samples.length, Math.floor((bucketIndex + 1) * bucketSize));
    if (end <= start) continue;

    let min = samples[start];
    let max = samples[start];
    let minIndex = start;
    let maxIndex = start;

    for (let index = start + 1; index < end; index += 1) {
      const value = samples[index];
      if (value < min) {
        min = value;
        minIndex = index;
      }
      if (value > max) {
        max = value;
        maxIndex = index;
      }
    }

    if (minIndex < maxIndex) {
      result.push(min, max);
    } else if (maxIndex < minIndex) {
      result.push(max, min);
    } else {
      result.push(samples[start]);
    }
  }

  return result;
}

/**
 * Download button component
 */
function DownloadButton({ stationCode, earthquakeInfo }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    try {
      setDownloading(true);
      const { waveformUrl, waveformFilename } = buildStationFdsnDownloads(stationCode, earthquakeInfo);
      await fetchAndDownload(
        waveformUrl,
        waveformFilename,
        'waveform',
        'application/vnd.fdsn.mseed, application/octet-stream, */*;q=0.1'
      );
    } catch (_) {
      // Download fallback is handled inside fetchAndDownload.
    } finally {
      setDownloading(false);
    }
  }, [stationCode, earthquakeInfo]);

  return (
    <Button
      onClick={handleDownload}
      disabled={downloading}
      aria-label={`Download waveform for ${stationCode} (MiniSEED)`}
      title={`Download waveform data for ${stationCode}`}
      className={styles.downloadBtn}
    >
      <FiDownload className={styles.actionIcon} aria-hidden="true" focusable="false" />
      {downloading ? 'Downloading...' : 'Waveform'}
    </Button>
  );
}

/**
 * Metadata button component
 */
function MetadataButton({ stationCode, earthquakeInfo }) {
  const [downloading, setDownloading] = useState(false);

  const handleMetadata = useCallback(async () => {
    try {
      setDownloading(true);
      const { metadataUrl, metadataFilename } = buildStationFdsnDownloads(stationCode, earthquakeInfo);
      await fetchAndDownload(
        metadataUrl,
        metadataFilename,
        'metadata',
        'application/xml, text/xml; q=0.9, */*; q=0.1'
      );
    } finally {
      setDownloading(false);
    }
  }, [stationCode, earthquakeInfo]);

  return (
    <Button
      onClick={handleMetadata}
      disabled={downloading}
      variant="secondary"
      aria-label={`Download station metadata for ${stationCode}`}
      title={`Download station metadata for ${stationCode}`}
      className={styles.metadataBtn}
    >
      <FiDownload className={styles.actionIcon} aria-hidden="true" focusable="false" />
      {downloading ? 'Loading...' : 'Metadata'}
    </Button>
  );
}

function buildStationFdsnDownloads(stationCode, earthquakeInfo) {
  const network = 'AM';
  const baseUrl = getFdsnwsBaseUrl();
  const stationCodeUpper = String(stationCode || '').toUpperCase();
  const eventTime = earthquakeInfo?.eventTime || earthquakeInfo?.OT;
  const startTime = formatFdsnDateTime(eventTime, -60);
  const endTime = formatFdsnDateTime(eventTime, 60 * 10);
  const dateSuffix = parseEventTimeUtc(eventTime).format('MMDDYY');
  const startSuffix = parseEventTimeUtc(eventTime).add(-60, 'second').format('YYYYMMDDTHHmmss') + 'Z';
  const endSuffix = parseEventTimeUtc(eventTime).add(60 * 10, 'second').format('YYYYMMDDTHHmmss') + 'Z';
  const common = `starttime=${startTime}&endtime=${endTime}&network=${network}&station=${stationCodeUpper}&location=00`;

  return {
    metadataUrl: `${baseUrl}/station/1/query?level=response&${common}&formatted=true&nodata=404`,
    waveformUrl: `${baseUrl}/dataselect/1/query?${common}&channel=*&nodata=404`,
    metadataFilename: `${network}.${stationCodeUpper}.00.MULTI.xml`,
    waveformFilename: `${network}.${stationCodeUpper}.00.MULTI.${dateSuffix}.${startSuffix}-${endSuffix}.mseed`,
  };
}

function getFdsnwsBaseUrl() {
  const env = typeof window !== 'undefined' && window.ENV ? window.ENV : {};
  return String(env.REACT_APP_FDSNWS || 'https://earthquake.up.edu.ph/fdsnws').replace(/\/$/, '');
}

function parseEventTimeUtc(value) {
  const parsed = moment(value || Date.now()).utc();
  return parsed && typeof parsed.isValid === 'function' && parsed.isValid()
    ? parsed
    : moment().utc();
}

function formatFdsnDateTime(dateString, secondsToAdd = 0) {
  return parseEventTimeUtc(dateString)
    .add(secondsToAdd, 'second')
    .format('YYYY-MM-DDTHH:mm:ss')
    .replace(/:/g, '%3A');
}

async function fetchAndDownload(url, filename, kind, acceptHeader) {
  try {
    trackEvent('download_data', {
      type: kind,
      source: 'waveform_visualization',
      station_code: filename.split('.')[1],
    });
  } catch (_) {}

  try {
    const response = await axios.get(url, {
      responseType: 'blob',
      withCredentials: false,
      validateStatus: () => true,
      headers: acceptHeader ? { Accept: acceptHeader } : undefined,
      timeout: 15000,
    });

    if (response.status !== 200) {
      window.open(url, '_blank', 'noreferrer');
      return;
    }

    const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
    if (!blob || blob.size === 0) {
      window.open(url, '_blank', 'noreferrer');
      return;
    }

    const objUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objUrl);
  } catch (_) {
    try {
      window.open(url, '_blank', 'noreferrer');
    } catch (_) {}
  }
}

export default SeismicWaveforms;
