import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  const isDevelopment =
    typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development';

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
      if (!earthquakeInfo?.eventTime && !earthquakeInfo?.OT) {
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

        const eventTime = earthquakeInfo.eventTime || earthquakeInfo.OT;
        const startTime = formatDateTime(eventTime, -60); // 60 seconds before
        const endTime = formatDateTime(eventTime, 600); // 600 seconds (10 minutes) after

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
            const fdsnwsUrl = `${baseUrl}/dataselect/1/query?starttime=${startTime}Z&endtime=${endTime}Z&network=AM&station=${stationCodeUpper}&location=00&channel=E*&nodata=404`;

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
              // Parse MiniSEED data using correct seisplotjs API
              const ms = sp.miniseed || {};
              let records = [];
              try {
                if (typeof ms.parseDataRecords === 'function') records = ms.parseDataRecords(response.data);
                else if (typeof ms.parseMiniseed === 'function') records = ms.parseMiniseed(response.data);
                else if (typeof ms.parse === 'function') records = ms.parse(response.data);
              } catch (_) {
                records = [];
              }

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
        const FDSNWS_PRIMARY = window['ENV']?.REACT_APP_FDSNWS;
        const FDSNWS_BACKUP = window['ENV']?.REACT_APP_RS_FDSNWS;

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
            const records = waveformData.data;
            
            // Create seismogram segment from records
            const seg = sp.miniseed.createSeismogramSegment(records);
            const seis = new sp.seismogram.Seismogram([seg]);
            const seisData = sp.seismogram.SeismogramDisplayData.fromSeismogram(seis);
            seisData.alignmentTime = sp.luxon.DateTime.utc();

            const config = new sp.seismographconfig.SeismographConfig();
            config.wheelZoom = false;
            config.doGain = true;
            config.isRelativeTime = true;
            config.linkedAmplitudeScale = new sp.scale.IndividualAmplitudeScale();
            config.lineColors = ['#0ea5e9'];

            setWaveforms((prev) => ({
              ...prev,
              [stationCode]: {
                data: seisData,
                config,
                timestamp: new Date().toISOString(),
                isDemoData: false,
                source: sourceProvider,
              },
            }));

            trackEvent('waveform_loaded', {
              station_code: stationCode,
              source: sourceProvider,
            });

            if (isDevelopment && typeof window !== 'undefined' && window._waveformDebug && window._waveformDebug[stationCode]) {
              window._waveformDebug[stationCode].result = `success_from_${waveformData.provider}`;
            }
            return;
          } catch (renderError) {
            if (isDevelopment && typeof window !== 'undefined' && window._waveformDebug && window._waveformDebug[stationCode]) {
              window._waveformDebug[stationCode].renderError = renderError?.message || 'Render failed';
            }
          }
        }

        // Fallback to demo waveform for testing/development
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
            // Parse MiniSEED data using correct seisplotjs API
            const ms = sp.miniseed || {};
            let records = [];
            try {
              if (typeof ms.parseDataRecords === 'function') records = ms.parseDataRecords(demoResponse.data);
              else if (typeof ms.parseMiniseed === 'function') records = ms.parseMiniseed(demoResponse.data);
              else if (typeof ms.parse === 'function') records = ms.parse(demoResponse.data);
            } catch (_) {
              records = [];
            }

            if (Array.isArray(records) && records.length > 0) {
              // Create seismogram segment from records
              const seg = sp.miniseed.createSeismogramSegment(records);
              const seis = new sp.seismogram.Seismogram([seg]);
              const seisData = sp.seismogram.SeismogramDisplayData.fromSeismogram(seis);
              seisData.alignmentTime = sp.luxon.DateTime.utc();

              const config = new sp.seismographconfig.SeismographConfig();
              config.wheelZoom = false;
              config.doGain = true;
              config.isRelativeTime = true;
              config.linkedAmplitudeScale = new sp.scale.IndividualAmplitudeScale();
              config.lineColors = ['#0ea5e9'];

              setWaveforms((prev) => ({
                ...prev,
                [stationCode]: {
                  data: seisData,
                  config,
                  timestamp: new Date().toISOString(),
                  isDemoData: true,
                  source: 'demo.mseed',
                },
              }));

              if (isDevelopment && typeof window !== 'undefined' && window._waveformDebug && window._waveformDebug[stationCode]) {
                window._waveformDebug[stationCode].result = 'success_from_demo';
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
    [earthquakeInfo, formatDateTime, ensureSeisplotjs, isDevelopment]
  );

  // Load waveforms when component mounts or stations change
  useEffect(() => {
    if (isDevelopment && typeof window !== 'undefined') {
      window._effectDebug = {
        stationsArray: stations,
        stationsLength: stations?.length || 0,
        waveformsObject: waveforms,
        waveformsKeys: Object.keys(waveforms),
        willLoop: stations && stations.length > 0
      };
    }
    
    if (stations && stations.length > 0) {
      stations.forEach((stationCode) => {
        if (isDevelopment && typeof window !== 'undefined') {
          window._effectDebug[stationCode] = {
            exists: !!stationCode,
            alreadyLoaded: !!waveforms[stationCode],
            willLoad: stationCode && !waveforms[stationCode]
          };
        }
        
        if (stationCode && !waveforms[stationCode]) {
          if (isDevelopment && typeof window !== 'undefined') {
            window._effectDebug[stationCode].loadingNow = true;
          }
          loadWaveform(stationCode);
        }
      });
    }
  }, [stations, loadWaveform, waveforms, isDevelopment]);

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

/**
 * Individual waveform row component
 */
function WaveformRow({ stationCode, waveformData, isLoading, earthquakeInfo }) {
  const waveformCanvasRef = useRef(null);
  const plotRef = useRef(null);
  const seisplotjsRef = useRef(null);

  // Render seisplotjs plot when waveform data is available
  useEffect(() => {
    if (!waveformCanvasRef.current || !waveformData) {
      return;
    }

    const canvasElement = waveformCanvasRef.current;
    let timeoutId = null;

    const renderWaveform = async () => {
      try {
        if (!seisplotjsRef.current) {
          seisplotjsRef.current = await import('seisplotjs');
        }
        const sp = seisplotjsRef.current;
        const { data, config } = waveformData;

        // Clear previous plot
        while (canvasElement.firstChild) {
          canvasElement.removeChild(canvasElement.firstChild);
        }

        // Create and render the seismograph
        const seismograph = new sp.seismograph.Seismograph([data], config);
        plotRef.current = seismograph;

        // Ensure proper sizing and display
        seismograph.style.width = '100%';
        seismograph.style.height = '100%';
        seismograph.style.display = 'block';
        seismograph.style.position = 'relative';

        // Append to DOM
        canvasElement.appendChild(seismograph);

        // Critical: Calculate domains and render (seisplotjs requires these calls)
        try {
          if (typeof seismograph.calcTimeScaleDomain === 'function') {
            seismograph.calcTimeScaleDomain();
          }
          if (typeof seismograph.recheckAmpScaleDomain === 'function') {
            seismograph.recheckAmpScaleDomain();
          }
          if (typeof seismograph.draw === 'function') {
            seismograph.draw();
          }
        } catch (e) {
          // Rendering methods may not be available in all versions
        }

        // Re-render after layout settles
        timeoutId = setTimeout(() => {
          try {
            if (typeof seismograph.calcTimeScaleDomain === 'function') {
              seismograph.calcTimeScaleDomain();
            }
            if (typeof seismograph.recheckAmpScaleDomain === 'function') {
              seismograph.recheckAmpScaleDomain();
            }
            if (typeof seismograph.draw === 'function') {
              seismograph.draw();
            }
          } catch (e) {
            // Rendering error
          }
        }, 250);

        // Apply theme styling
        applyPlotTheme(seismograph);
      } catch (error) {
        console.error('Waveform render error:', error);
      }
    };

    renderWaveform();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
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
  }, [waveformData, stationCode]);

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
          <div ref={waveformCanvasRef} className={styles.plot} />
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

      trackEvent('download_data', {
        type: 'waveform',
        source: 'waveform_visualization',
        station_code: stationCode,
      });

      const response = await axios.get(waveformUrl, {
        responseType: 'blob',
        timeout: 15000,
      });

      // Create download link
      const blob = new Blob([response.data], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = waveformFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      // Download error - silently fail
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
