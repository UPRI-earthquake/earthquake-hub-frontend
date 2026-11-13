import { Popup, useMap } from "react-leaflet";
import styles from '../../../../styles/canvas/overlays/markers/StationMarkerItem.module.css';
import InfoTooltip from "@/shared/ui/components/InfoTooltip";
import moment from "@/shared/utils/time";
import axios from "axios";
import { normalizeDeviceActivity } from "@/shared/services/stations/deviceStatus";
import usePopupAutoPanPadding from "../../../../../hooks/usePopupAutoPanPadding";
import { DEFAULT_POPUP_AUTOPAN } from "@/config/popupAutoPan";
import { trackEvent } from "@/analytics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getFDSNWS, ringserverWS } from "@/config/env";
import downloadStationMetadata from "@/features/map/services/station";
import { Station } from "@/features/map/types/station";
import { buildThemeTokens, themeFromMapContainer, zoomFromMap } from "@/features/map/services/mapStyles";
import { STREAM_LINE_COLOR, STREAM_TITLE_COLOR } from "@/features/map/configs/contants";
import { deverror, devlog } from "@/shared/utils/devlog";

interface StationMarkerPopupProps {
  station: Station;
  setMarkerTheme: (theme: any) => void;
}



export default function StationMarkerPopup({ station, setMarkerTheme }: StationMarkerPopupProps) {
  

  return (<Popup
    className={styles.popUp}
    autoPan
    // autoPanPaddingTopLeft={popupPaddingTopLeft}
    // autoPanPaddingBottomRight={popupPaddingBottomRight}
  >
    <PopupContent station={station} setMarkerTheme={setMarkerTheme} />
    
  </Popup>);
}

interface PopupContentProps {
  station: Station;
  setMarkerTheme: (theme: any) => void;
}

function PopupContent({ station, setMarkerTheme }: PopupContentProps) {
  
  const realtimeDivRef = useRef(null);
  const spRef = useRef(null);
  const durationRef = useRef(null);
  const graphDurationRef = useRef(null);
  const timeWindowRef = useRef(null);
  const seisPlotConfigRef = useRef(null);

  const map = useMap();
  const graphListRef = useRef(new Map());
  const redrawInProgressRef = useRef(false);
  const datalinkRef = useRef(null);
  const connected = useRef(false); // flag used in connectDataLinkWS(), ws is not connected by default

  const demoTimerRef = useRef(null);
  const demoPlaybackRef = useRef({ plot: null, sdd: null, alignStart: null, alignEnd: null });
  const ringserver_ws = ringserverWS();


  useEffect(() => {
    stopDemoMseed();
    ensureSeis().then(() => {
      initDatalink();
      startGraph(station.network, station.code);
    });
  
    return () => stopDemoMseed();
  }, []);

  const markerDesc = String(station.description || '').trim();
  
  const { network, code, status, activity, statusSince } = station;
  const popupAutoPanPadding = usePopupAutoPanPadding();

  const { topLeft: popupPaddingTopLeft, bottomRight: popupPaddingBottomRight } =
      popupAutoPanPadding || DEFAULT_POPUP_AUTOPAN;

  
  const FDSNWS = getFDSNWS();
  

  
  const start_time = moment().subtract(1, 'days');

  // Build common query strings (without host) for reuse
  const dataQuery =
    '/dataselect/1/query?' +
    'starttime=' +
    start_time.format('YYYY-MM-DDTHH:mm:ss') +
    '&endtime=' +
    moment().format('YYYY-MM-DDTHH:mm:ss') +
    '&network=AM&station=' +
    code +
    '&location=00&channel=E*&nodata=404';
  const stationMetaQuery =
    '/station/1/query?' +
    'network=AM&station=' +
    code +
    '&level=resp&format=sc3ml&nodata=404';

  
  const data_download_URL = `${FDSNWS}${dataQuery}`;
  const metadata_download_URL = `${FDSNWS}${stationMetaQuery}`;

  const logDownload = useCallback(
    (payload) => {
      try {
        trackEvent('download_data', {
          station_code: code,
          network: String(network || 'AM').toUpperCase(),
          source: 'station_popup',
          ...payload,
        });
      } catch (_) {}
    },
    [code, network],
  );

  const handleDownloadMetadata = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    downloadStationMetadata(network, code, logDownload);
  };

  const handleDownloadData = async (e) => {
    // Download past 24h MiniSEED with a specific filename from FDSNWS only.
    try {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();

      const url = `${FDSNWS}${dataQuery}`;
      const resp = await axios.get(url, {
        responseType: 'blob',
        withCredentials: false,
        validateStatus: () => true,
        headers: { Accept: 'application/vnd.fdsn.mseed, application/octet-stream, */*;q=0.1' },
        timeout: 15000,
      });

      if (resp.status !== 200) {
        logDownload({ type: 'waveform', format: 'mseed', status: 'fallback' });
        try { window.open(url, '_blank', 'noreferrer'); } catch (_) {}
        return;
      }

      const blob = resp.data instanceof Blob ? resp.data : new Blob([resp.data]);
      const ct = (resp.headers && resp.headers['content-type']) || '';
      const looksMseed = typeof ct === 'string' && (ct.toLowerCase().includes('vnd.fdsn.mseed') || ct.toLowerCase().includes('application/octet-stream'));
      if (!blob || blob.size === 0 || (!looksMseed && blob.size < 64)) {
        logDownload({ type: 'waveform', format: 'mseed', status: 'fallback' });
        try { window.open(url, '_blank', 'noreferrer'); } catch (_) {}
        return;
      }

      const dateSuffix = moment().format('MMDDYY');
      const filename = `${network.toUpperCase()}.${code.toUpperCase()}.00.MULTI.${dateSuffix}.mseed`;
      const objUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(objUrl);
      logDownload({
        type: 'waveform',
        format: 'mseed',
        status: 'success',
        size_bytes: blob.size || 0,
      });
    } catch (_) {
      logDownload({ type: 'waveform', format: 'mseed', status: 'error' });
      try { window.open(data_download_URL, '_blank', 'noreferrer'); } catch (_) {}
    }
  };

  
  
  
  
  const ensureSeis = useCallback(async () => {
    if (spRef.current && seisPlotConfigRef.current && graphDurationRef.current && timeWindowRef.current) {
      return spRef.current;
    }
    const mod = await import('seisplotjs');
    spRef.current = mod;
    const duration = mod.luxon.Duration.fromObject({ minutes: 2, seconds: 45 });
    const graphDuration = mod.luxon.Duration.fromObject({ minutes: 2, seconds: 30 });
    const timeWindow = new mod.util.durationEnd(duration, mod.luxon.DateTime.utc());
    const cfg = new mod.seismographconfig.SeismographConfig();
    cfg.wheelZoom = false;
    cfg.linkedTimeScale.offset = mod.luxon.Duration.fromMillis(-1 * duration.toMillis());
    cfg.linkedTimeScale.duration = graphDuration;
    cfg.linkedAmplitudeScale = new mod.scale.IndividualAmplitudeScale();
    cfg.doGain = true;
    cfg.isRelativeTime = true;
    cfg.xLabel = 'Time (seconds)';
    cfg.lineColors = [STREAM_LINE_COLOR];
    durationRef.current = duration;
    graphDurationRef.current = graphDuration;
    timeWindowRef.current = timeWindow;
    seisPlotConfigRef.current = cfg;
    return mod;
  }, []);

  
  /* Graph data from DataLink WebSocket is configured lazily in ensureSeis() */

  const applySeismographTheme = useCallback((plot) => {
    try {
      const theme = themeFromMapContainer(map?.getContainer?.());
      const dark = theme === 'dark' || theme === 'satellite';
      const axis = dark ? '#e5e7eb' : '#111827';
      const sublbl = dark ? 'rgba(229,231,235,0.7)' : 'rgba(17,24,39,0.7)';
      const grid = dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.25)';
      const css = `
        /* tick numbers */
        svg.seismograph g.axis text { fill: ${axis}; color: ${axis}; }
        /* axis lines and ticks */
        svg.seismograph g.axis path.domain { stroke: ${axis}; }
        svg.seismograph g.axis line { stroke: ${axis}; }
        /* grid (if enabled by config) */
        svg.seismograph g.grid line { stroke: ${grid}; }
        /* main axis labels */
        svg.seismograph g.xLabel text { fill: ${axis}; color: ${axis}; }
        svg.seismograph g.yLabel.left text { fill: ${axis}; color: ${axis}; }
        svg.seismograph g.yLabel.right text { fill: ${axis}; color: ${axis}; }
        /* sublabels/units */
        svg.seismograph g.xSublabel text { fill: ${sublbl}; color: ${sublbl}; }
        svg.seismograph g.ySublabel text { fill: ${sublbl}; color: ${sublbl}; }
        /* keep stream title color consistent across light/dark */
        svg.seismograph g.title text,
        svg.seismograph text.title {
          fill: ${STREAM_TITLE_COLOR};
          color: ${STREAM_TITLE_COLOR};
        }
      `;
      // Replace existing theme style to avoid duplicates
      try {
        const existing = plot.shadowRoot && plot.shadowRoot.getElementById('app-seismo-theme');
        if (existing) existing.remove();
      } catch (_) {}
      plot.addStyle(css, 'app-seismo-theme');
    } catch (_) {}
  }, [map]);




  const packetHandler = function (packet) {
    const sp = spRef.current;
    if (!sp) return;
    if (packet.isMiniseed()) {
      let seisSegment = sp.miniseed.createSeismogramSegment(packet.asMiniseed()); // Create a SeismogramSegment from the packet
      let codes = seisSegment.codes(); // Get the codes (stream ID) of the SeismogramSegment
      let seisPlot = graphListRef.current.get(codes); // Retrieve the corresponding graph for the codes from the graphListRef

      if (!seisPlot) {
        // If the graph doesn't exist
        // seisPlotConfig.title = codes; // Set the title of the graph based on the stream_id

        let seismogram = new sp.seismogram.Seismogram([seisSegment]); // Create a Seismogram with the SeismogramSegment
        let seisData = sp.seismogram.SeismogramDisplayData.fromSeismogram(seismogram); // Create SeismogramDisplayData from the Seismogram
        seisData.alignmentTime = sp.luxon.DateTime.utc(); // Set the alignment time to current UTC time

        const seisPlotConfig = seisPlotConfigRef.current;
        seisPlot = new sp.seismograph.Seismograph([seisData], seisPlotConfig); // Create a new Seismograph with the SeismogramDisplayData and SeismographConfig
        realtimeDivRef.current.appendChild(seisPlot); // Append the Seismograph to the realtimeDiv
        graphListRef.current.set(codes, seisPlot); // Store the Seismograph in the graphListRef for future reference
        applySeismographTheme(seisPlot);

        devlog(`new plot: ${codes}`);
      } else {
        seisPlot.seisData[0].append(seisSegment);
        seisPlot.recheckAmpScaleDomain();
      }
      seisPlot.draw();
    } else {
      devlog(`not a mseed packet: ${packet.streamId}`);
    }
  };

  const errorFn = function (_error) {
    if (datalinkRef.current) {
      datalinkRef.current.close();
    } // Close the WebSocket connection
  };

  /***************************************************************************
   * new DataLinkConnection:
   *     A WebSocket based Datalink connection
   * Parameters:
   *     url            (string)                                    WebSocket URL to the ringserver
   *     packetHandler  (function (packet: DataLinkPacket): void)   callback for packets as they arrive
   *     errorHandler   (function (error: Error): void)             callback for errors
   *
   ***************************************************************************/
  const initDatalink = () => {
    const sp = spRef.current;
    if (!sp) return;
    datalinkRef.current = new sp.datalink.DataLinkConnection(ringserver_ws, packetHandler, errorFn);
  };

  const drawGraph = function () {
    if (redrawInProgressRef.current) return; // Skip if redraw is already in progress
    redrawInProgressRef.current = true; // Mark redraw as in progress
    window.requestAnimationFrame(() => {
      const sp = spRef.current; if (!sp) { redrawInProgressRef.current = false; return; }
      const now = sp.luxon.DateTime.utc();
      graphListRef.current.forEach(function (graph) {
        graph.seisData.forEach((sdd) => {
          sdd.alignmentTime = now;
        });
        graph.calcTimeScaleDomain(); // Recalculate time scale domain
        graph.calcAmpScaleDomain(); // Recalculate amplitude scale domain
        graph.draw();
      });
      redrawInProgressRef.current = false; // Mark redraw as complete
    });
  };

  const connectDataLinkWS = async function (network, station) {
    if (!connected.current && datalinkRef.current) {
      // start connection
      try {
        const matchPattern = `${network}_${station}_([0-9]{2})?_.HZ/MSEED`;

        devlog('Connecting to datalink via WebSocket');
        await datalinkRef.current.connect(); // Create WebSocket connection and send the client ID
        connected.current = true;
        const matchResponse = await datalinkRef.current.match(matchPattern); // Send match command
        if (matchResponse.isError()) {
          devlog(`response is not OK, ignore... ${matchResponse}`);
        }

        const positionResponse = await datalinkRef.current.positionAfter(timeWindowRef.current.start); // Send position after match command
        if (positionResponse.isError()) {
          devlog(`Oops, positionAfter response is not OK, ignore... ${positionResponse}`);
        }

        await datalinkRef.current.stream(); // Switch to streaming mode to receive data packets from the ringserver
        // NOTE: This part blocks while streaming,
        // until endStream() is called
      } catch (e) {
        deverror('Error occurred while connecting to WebSocket');
      }
    }
  };

  const disconnectDataLinkWS = async () => {
    try {
      if (connected.current && datalinkRef.current) {
        // close connection
        devlog('Disconnecting datalink WebSocket');
        await datalinkRef.current.endStream();
        await datalinkRef.current.close();

        connected.current = false;
      }
    } catch (e) {
      deverror('Error occurred while closing WebSocket');
    }
  };

  const startGraph = function (network, station) {
    if (!seisPlotConfigRef.current || !durationRef.current) return;
    const seisPlotConfig = seisPlotConfigRef.current;
    const timerInterval =
      durationRef.current.toMillis() /
      (realtimeDivRef.current.offsetWidth -
        seisPlotConfig.margin.left -
        seisPlotConfig.margin.right);
    //The offsetWidth property returns the viewable width of an element (in pixels)
    // You can think of the timerInterval as the number of data seconds per pixel
    // Meaning the interval refreshes whenever a pixel-length amount of data is
    // available.

    window.setInterval(drawGraph, timerInterval);
    connectDataLinkWS(network, station);
  };
  /* End of graph data from DataLink WebSocket */

  const stopDemoMseed = () => {
    try { clearInterval(demoTimerRef.current); } catch (_) {}
    demoTimerRef.current = null;
    const { plot } = demoPlaybackRef.current || {};
    if (plot && plot.remove && plot.parentNode) {
      try { plot.parentNode.removeChild(plot); } catch (_) {}
    }
    demoPlaybackRef.current = { plot: null, sdd: null, alignStart: null, alignEnd: null };
  };

  
  // Re-apply seismograph theme on basemap theme changes while popup remains open
  useEffect(() => {
    if (!map) return undefined;
    const retheme = () => {
      const theme = themeFromMapContainer(map?.getContainer?.());
      setMarkerTheme(theme);
      try {
        graphListRef.current.forEach((plot) => {
          try {
            if (plot && plot.seismographConfig) {
              plot.seismographConfig.lineColors = [STREAM_LINE_COLOR];
            }
          } catch (_) {}
          const css = plot.seismographConfig.createCSSForLineColors();
          const sr = plot.shadowRoot; 
          if (sr) sr.getElementById('seismographcolors')?.remove();
          plot.addStyle(css, 'seismographcolors');
          try { plot.draw && plot.draw(); } catch (_) {}
          try { applySeismographTheme(plot); } catch (_) {}
        });
      } catch (_) {}
    };
    map.on('baselayerchange', retheme);
    let mo = null;
    try {
      const el = map.getContainer();
      mo = new MutationObserver(retheme);
      mo.observe(el, { attributes: true, attributeFilter: ['data-basemap-theme'] });
    } catch (_) {}
    return () => {
      try { map.off('baselayerchange', retheme); } catch (_) {}
      try { mo && mo.disconnect(); } catch (_) {}
    };
  }, [map, applySeismographTheme]);


  return (<div className={styles.popUpBody}>
    <div className={styles.popupHeader}>
      <div className={styles.popupTitleRow}>
        <div className={styles.popupTitle}>Station {code}</div>
        <InfoTooltip label="Station location info" title="Approximate location" variant="inline">
          Location is intentionally offset to protect device privacy.
        </InfoTooltip>
      </div>
      {markerDesc ? <div className={styles.popupSubtitle}>{markerDesc}</div> : null}
    </div>
    <div className={styles.popupSection}>
      <div ref={realtimeDivRef} className={styles.realtimeGraphDiv}></div>
    </div>
    <div className={styles.popupSection}>
      <div className={styles.statusRow}>
        <span
          className={`
            ${styles.statusIndicator}
            ${normalizeDeviceActivity(status) === 'active' ? styles['streaming'] : styles['not-streaming']}
          `}
        ></span>
        <span className={styles.statusText}>
          {(() => {
            const state = normalizeDeviceActivity(activity);
            if (state === 'unlinked') return 'Device Offline';
            const label = status || (state === 'active' ? 'Streaming' : 'Inactive');
            if (!statusSince) return label;
            if (state === 'active' || moment(statusSince) > moment().subtract(1, 'month')) {
              return `${label} since ${moment(statusSince).fromNow()}`;
            }
            return 'Device Offline';
          })()}
        </span>
      </div>
    </div>
    <div className={`${styles.popupSection} ${styles.popupActions}`}>
      <a
        href={data_download_URL}
        target="_blank"
        rel="noreferrer"
        onClick={handleDownloadData}
        className={styles.actionLink}
      >
        Get past 24hrs data
      </a>
      <a
        href={metadata_download_URL}
        target="_blank"
        rel="noreferrer"
        onClick={handleDownloadMetadata}
        className={styles.actionLink}
      >
        Get station metadata
      </a>
    </div>
  </div>);

}