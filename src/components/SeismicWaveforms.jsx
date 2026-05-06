import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import styles from './SeismicWaveforms.module.css';
import { trackEvent } from '../analytics';
import InfoTooltip from './InfoTooltip';
import Button from './Button';
import axios from 'axios';
import moment from '../utils/time';

/**
 * SeismicWaveforms component displays recorded seismic waveforms for multiple stations
 * during an earthquake event. Each station shows a waveform visualization with options to
 * download the raw data or view metadata.
 */
function SeismicWaveforms({ earthquakeInfo, stations = [] }) {
  const [waveforms, setWaveforms] = useState({});
  const [loadingStations, setLoadingStations] = useState(new Set());
  const containerRef = useRef(null);
  const seisplotjsRef = useRef(null);
  const requestedWaveformsRef = useRef(new Set());
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
  }, [eventTimeKey]);

  // Load waveforms when the event or station list changes.
  useEffect(() => {
    if (isDevelopment && typeof window !== 'undefined') {
      window._effectDebug = {
        stationsArray: stations,
        stationsLength: stations?.length || 0,
        requestedWaveforms: Array.from(requestedWaveformsRef.current),
        willLoop: stations && stations.length > 0
      };
    }
    
    if (eventTimeKey && stations && stations.length > 0) {
      stations.forEach((stationCode) => {
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
  }, [stations, loadWaveform, isDevelopment, eventTimeKey]);

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

  if (!earthquakeInfo || !stations || stations.length === 0) {
    return null;
  }

  return (
    <section className={styles.waveformContainer} ref={containerRef}>
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>
          <h3>Recorded Seismic Waveforms</h3>
          <InfoTooltip title="Recorded Seismic Waveforms" label="About this section" variant="inline">
            Waveforms recorded at nearby seismic stations during the event.
          </InfoTooltip>
        </div>
      </div>

      <div className={styles.waveformList}>
        {stations.map((stationCode) => (
          <WaveformRow
            key={stationCode}
            stationCode={stationCode}
            waveformData={waveforms[stationCode]}
            isLoading={loadingStations.has(stationCode)}
            earthquakeInfo={earthquakeInfo}
          />
        ))}
      </div>
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
  };
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

/**
 * Individual waveform row component
 */
function WaveformRow({ stationCode, waveformData, isLoading, earthquakeInfo }) {
  const waveformCanvasRef = useRef(null);
  const plotRef = useRef(null);
  const seisplotjsRef = useRef(null);
  const [renderError, setRenderError] = useState(null);

  // Render seisplotjs plot when waveform data is available
  useEffect(() => {
    if (isLoading || !waveformCanvasRef.current || !waveformData) {
      return;
    }

    const canvasElement = waveformCanvasRef.current;
    const timeoutIds = [];
    const animationFrameIds = [];
    let resizeObserver = null;
    let cancelled = false;
    setRenderError(null);

    const getDrawableRect = () => {
      const rect = canvasElement.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 ? rect : null;
    };

    const waitForDrawableRect = () => new Promise((resolve) => {
      const immediateRect = getDrawableRect();
      if (immediateRect) {
        resolve(immediateRect);
        return;
      }

      let settled = false;
      const finish = (rect) => {
        if (settled) return;
        settled = true;
        resolve(rect);
      };

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          const rect = getDrawableRect();
          if (rect) finish(rect);
        });
        resizeObserver.observe(canvasElement);
      }

      const poll = () => {
        if (cancelled || settled) return;
        const rect = getDrawableRect();
        if (rect) {
          finish(rect);
          return;
        }
        const timeoutId = setTimeout(poll, 50);
        timeoutIds.push(timeoutId);
      };
      poll();

      const timeoutId = setTimeout(() => finish(null), 2500);
      timeoutIds.push(timeoutId);
    });

    const renderWaveform = async () => {
      try {
        if (!seisplotjsRef.current) {
          seisplotjsRef.current = await import('seisplotjs');
        }
        if (cancelled) return;
        const sp = seisplotjsRef.current;
        const { config } = waveformData;
        const dataList = Array.isArray(waveformData.dataList)
          ? waveformData.dataList
          : [waveformData.data].filter(Boolean);

        if (dataList.length === 0) {
          throw new Error('No displayable waveform channels');
        }

        const drawableRect = await waitForDrawableRect();
        if (cancelled) return;
        if (!drawableRect) {
          throw new Error('Waveform plot did not receive a drawable size');
        }

        // Clear previous plot
        while (canvasElement.firstChild) {
          canvasElement.removeChild(canvasElement.firstChild);
        }

        // Create and render the seismograph
        const seismograph = new sp.seismograph.Seismograph(dataList, config);
        plotRef.current = seismograph;

        // Ensure proper sizing and display
        seismograph.style.width = '100%';
        seismograph.style.height = '100%';
        seismograph.style.display = 'block';
        seismograph.style.position = 'relative';
        seismograph.style.minWidth = `${Math.floor(drawableRect.width)}px`;
        seismograph.style.minHeight = `${Math.floor(drawableRect.height)}px`;

        // Append to DOM
        canvasElement.appendChild(seismograph);

        const drawSeismograph = (isFinalAttempt = false) => {
          if (cancelled || !seismograph.isConnected) return;
          try {
            const containerRect = canvasElement.getBoundingClientRect();
            if (containerRect.width === 0 || containerRect.height === 0) {
              if (isFinalAttempt) {
                setRenderError('Waveform plot did not receive a drawable size');
              }
              return;
            }
            if (typeof seismograph.calcTimeScaleDomain === 'function') {
              seismograph.calcTimeScaleDomain();
            }
            if (typeof seismograph.recheckAmpScaleDomain === 'function') {
              seismograph.recheckAmpScaleDomain();
            }
            if (typeof seismograph.draw === 'function') {
              seismograph.draw();
            }
            if (isFinalAttempt) {
              const svg = seismograph.shadowRoot && seismograph.shadowRoot.querySelector('svg');
              const rect = svg && typeof svg.getBoundingClientRect === 'function'
                ? svg.getBoundingClientRect()
                : null;
              if (!rect || rect.width === 0 || rect.height === 0) {
                setRenderError('Waveform plot did not receive a drawable size');
              }
            }
          } catch (e) {
            if (isFinalAttempt) {
              setRenderError(e?.message || 'Waveform render failed');
            }
          }
        };

        const drawOnNextFrame = (isFinalAttempt = false) => {
          if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            const frameId = window.requestAnimationFrame(() => drawSeismograph(isFinalAttempt));
            animationFrameIds.push(frameId);
            return;
          }
          drawSeismograph(isFinalAttempt);
        };

        const scheduleDraw = (delay, isFinalAttempt = false) => {
          if (delay === 'frame' && typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            drawOnNextFrame(isFinalAttempt);
            return;
          }
          const timeoutId = setTimeout(() => drawSeismograph(isFinalAttempt), delay);
          timeoutIds.push(timeoutId);
        };

        if (resizeObserver) {
          try {
            resizeObserver.disconnect();
          } catch (_) {
            // Resize observer reset failed.
          }
        }

        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver((entries) => {
            const entry = entries && entries[0];
            const width = entry?.contentRect?.width || 0;
            const height = entry?.contentRect?.height || 0;
            if (width > 0 && height > 0) {
              drawOnNextFrame();
            }
          });
          resizeObserver.observe(canvasElement);
        }

        // seisplotjs skips draw when layout reports 0x0; retry across layout ticks.
        scheduleDraw('frame');
        scheduleDraw(80);
        scheduleDraw(250);
        scheduleDraw(700);
        scheduleDraw(1500, true);

        // Apply theme styling
        applyPlotTheme(seismograph);
      } catch (error) {
        console.error('Waveform render error:', error);
        setRenderError(error?.message || 'Waveform render failed');
      }
    };

    renderWaveform();

    return () => {
      cancelled = true;
      if (resizeObserver) {
        try {
          resizeObserver.disconnect();
        } catch (_) {
          // Resize observer cleanup failed.
        }
      }
      timeoutIds.forEach((timeoutId) => clearTimeout(timeoutId));
      if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        animationFrameIds.forEach((frameId) => window.cancelAnimationFrame(frameId));
      }
      if (canvasElement) {
        try {
          while (canvasElement.firstChild) {
            canvasElement.removeChild(canvasElement.firstChild);
          }
        } catch (_) {
          // Cleanup error
        }
      }
    };
  }, [waveformData, stationCode, isLoading]);

  return (
    <div className={styles.waveformRow}>
      <div className={styles.stationLabel}>{stationCode.toUpperCase()}</div>

      <div className={styles.waveformCanvas}>
        {isLoading ? (
          <div className={styles.loadingPlaceholder}>
            <div className={styles.spinner} />
            <span>Loading waveform...</span>
          </div>
        ) : !waveformData ? (
          <div className={styles.emptyPlaceholder}>
            <span>No waveform data available</span>
          </div>
        ) : (
          <>
            <div ref={waveformCanvasRef} className={styles.plot} />
            {renderError && (
              <div className={styles.renderOverlay}>
                <span>Unable to render waveform</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className={styles.actionButtons}>
        <DownloadButton stationCode={stationCode} earthquakeInfo={earthquakeInfo} />
        <MetadataButton stationCode={stationCode} />
      </div>
    </div>
  );
}

/**
 * Download button component
 */
function DownloadButton({ stationCode, earthquakeInfo }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    try {
      setDownloading(true);
      const network = 'AM';
      const stationCodeUpper = String(stationCode || '').toUpperCase();

      const parseEventTimeUtc = (value) => {
        const parsed = moment(value || Date.now()).utc();
        return parsed && typeof parsed.isValid === 'function' && parsed.isValid()
          ? parsed
          : moment().utc();
      };

      const formatDateTime = (dateString, secondsToAdd = 0) => {
        return parseEventTimeUtc(dateString)
          .add(secondsToAdd, 'second')
          .format('YYYY-MM-DDTHH:mm:ss')
          .replace(/:/g, '%3A');
      };

      const eventTime = earthquakeInfo?.eventTime || earthquakeInfo?.OT;
      const startTime = formatDateTime(eventTime, -60);
      const endTime = formatDateTime(eventTime, 60 * 10);
      const dateSuffix = parseEventTimeUtc(eventTime).format('MMDDYY');

      const waveformUrl = `/data/waveform?network=${network}&station=${stationCodeUpper}&start=${startTime}&end=${endTime}`;
      const waveformFilename = `${network}.${stationCodeUpper}.00.MULTI.${dateSuffix}.mseed`;
      const openWaveformUrl = () => {
        try {
          window.open(waveformUrl, '_blank', 'noreferrer');
        } catch (_) {
          // Ignore popup failures; the user can retry the download action.
        }
      };

      trackEvent('download_data', {
        type: 'waveform',
        source: 'waveform_visualization',
        station_code: stationCode,
      });

      const response = await axios.get(waveformUrl, {
        responseType: 'blob',
        timeout: 15000,
        validateStatus: () => true,
      });

      if (response.status !== 200) {
        openWaveformUrl();
        return;
      }

      // Create download link
      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: 'application/octet-stream' });
      if (!blob || blob.size === 0) {
        openWaveformUrl();
        return;
      }
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = waveformFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (_) {
      try {
        const network = 'AM';
        const stationCodeUpper = String(stationCode || '').toUpperCase();
        const eventTime = earthquakeInfo?.eventTime || earthquakeInfo?.OT;
        const parsed = moment(eventTime || Date.now()).utc();
        const safeEventTime = parsed && parsed.isValid() ? parsed : moment().utc();
        const startTime = safeEventTime.clone().add(-60, 'second').format('YYYY-MM-DDTHH:mm:ss').replace(/:/g, '%3A');
        const endTime = safeEventTime.clone().add(60 * 10, 'second').format('YYYY-MM-DDTHH:mm:ss').replace(/:/g, '%3A');
        const waveformUrl = `/data/waveform?network=${network}&station=${stationCodeUpper}&start=${startTime}&end=${endTime}`;
        window.open(waveformUrl, '_blank', 'noreferrer');
      } catch (_) {
        // Download fallback failed.
      }
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
      {downloading ? 'Downloading...' : 'DOWNLOAD'}
    </Button>
  );
}

/**
 * Metadata button component
 */
function MetadataButton({ stationCode }) {
  const handleMetadata = useCallback(() => {
    trackEvent('view_metadata', {
      station_code: stationCode,
      source: 'waveform_visualization',
    });
    // TODO: Implement metadata view modal or panel
  }, [stationCode]);

  return (
    <Button
      onClick={handleMetadata}
      variant="secondary"
      aria-label={`View metadata for ${stationCode}`}
      title={`View station metadata for ${stationCode}`}
      className={styles.metadataBtn}
    >
      METADATA
    </Button>
  );
}

/**
 * Apply theme styling to seisplotjs plot
 */
function applyPlotTheme(plot) {
  try {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const axis = isDark ? '#e5e7eb' : '#111827';
    const sublbl = isDark ? 'rgba(229,231,235,0.7)' : 'rgba(17,24,39,0.7)';
    const grid = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.25)';

    const css = `
      svg.seismograph g.axis text { fill: ${axis}; color: ${axis}; }
      svg.seismograph g.axis path.domain { stroke: ${axis}; }
      svg.seismograph g.axis line { stroke: ${axis}; }
      svg.seismograph g.grid line { stroke: ${grid}; }
      svg.seismograph g.xLabel text { fill: ${axis}; color: ${axis}; }
      svg.seismograph g.yLabel.left text { fill: ${axis}; color: ${axis}; }
      svg.seismograph g.yLabel.right text { fill: ${axis}; color: ${axis}; }
      svg.seismograph g.xSublabel text { fill: ${sublbl}; color: ${sublbl}; }
      svg.seismograph g.ySublabel text { fill: ${sublbl}; color: ${sublbl}; }
      svg.seismograph g.title text,
      svg.seismograph text.title { fill: #0ea5e9; color: #0ea5e9; }
    `;

    if (plot.addStyle) {
      try {
        const existing = plot.shadowRoot && plot.shadowRoot.getElementById('waveform-theme');
        if (existing) existing.remove();
      } catch (_) {
        // Theme update error
      }
      plot.addStyle(css, 'waveform-theme');
    }
  } catch (_) {
    // Theme application error
  }
}

export default SeismicWaveforms;
