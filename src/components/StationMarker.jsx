import React, { useEffect, useState, useRef, useContext, useCallback } from 'react';
import ReactDOMServer from 'react-dom/server';
import { Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import { DivIcon } from 'leaflet';
import { ReactComponent as Logo } from '../assets/triangle.svg';
import styles from './StationMarker.module.css';
import SSEContext from '../SSEContext';
import moment from 'moment';
import axios from 'axios';
import * as sp from 'seisplotjs';
import demoMseedUrl from '../assets/demo.mseed';
import { devlog, deverror } from '../utils/devlog';
import { useSelector, useDispatch } from 'react-redux';
import { themeFromMapContainer } from '../config/mapStyles';
/**
 * Single station marker with real-time miniseed plot via DataLink WebSocket.
 */
const StationMarker = ({ network, code, latLng, description }) => {
  const map = useMap();
  const realtimeDivRef = useRef(null);
  const graphListRef = useRef(new Map());
  const redrawInProgressRef = useRef(false);
  const datalinkRef = useRef(null);
  const connected = useRef(false); // flag used in connectDataLinkWS(), ws is not connected by default
  const demoTimerRef = useRef(null);
  const demoPlaybackRef = useRef({ plot: null, sdd: null, alignStart: null, alignEnd: null });
  const ringserver_ws =
    process.env.NODE_ENV === 'production'
      ? window['ENV'].REACT_APP_RINGSERVER_WS
      : window['ENV'].REACT_APP_RINGSERVER_WS_DEV;

  /* Graph data from DataLink WebSocket */
  const duration = sp.luxon.Duration.fromObject({ minutes: 2, seconds: 45 });
  const graphDuration = sp.luxon.Duration.fromObject({ minutes: 2, seconds: 30 }); // Set the graphDuration 30 seconds shorter than the duration to make the trace look more realtime
  const timeWindow = new sp.util.durationEnd(duration, sp.luxon.DateTime.utc());
  const seisPlotConfig = new sp.seismographconfig.SeismographConfig();
  seisPlotConfig.wheelZoom = false;
  seisPlotConfig.linkedTimeScale.offset = sp.luxon.Duration.fromMillis(-1 * duration.toMillis());
  seisPlotConfig.linkedTimeScale.duration = graphDuration;
  seisPlotConfig.linkedAmplitudeScale = new sp.scale.IndividualAmplitudeScale();
  seisPlotConfig.doGain = true;
  seisPlotConfig.isRelativeTime = true; // Display the time to be relative from the current time (in millis)
  seisPlotConfig.xLabel = 'Time (seconds)';

  const applySeismographTheme = useCallback((plot) => {
    try {
      const theme = themeFromMapContainer(map?.getContainer?.());
      const dark = theme === 'dark' || theme === 'satellite';
      const axis = dark ? '#e5e7eb' : '#111827';
      const label = axis;
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
        svg.seismograph g.xLabel text { fill: ${label}; color: ${label}; }
        svg.seismograph g.yLabel.left text { fill: ${label}; color: ${label}; }
        svg.seismograph g.yLabel.right text { fill: ${label}; color: ${label}; }
        /* sublabels/units */
        svg.seismograph g.xSublabel text { fill: ${sublbl}; color: ${sublbl}; }
        svg.seismograph g.ySublabel text { fill: ${sublbl}; color: ${sublbl}; }
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
    } // Close the websocket connection
  };

  /***************************************************************************
   * new DataLinkConnection:
   *     A websocket based Datalink connection
   * Parameters:
   *     url            (string)                                    websocket url to the ringserver
   *     packetHandler  (function (packet: DataLinkPacket): void)   callback for packets as they arrive
   *     errorHandler   (function (error: Error): void)             callback for errors
   *
   ***************************************************************************/
  datalinkRef.current = new sp.datalink.DataLinkConnection(ringserver_ws, packetHandler, errorFn);

  const drawGraph = function () {
    if (redrawInProgressRef.current) return; // Skip if redraw is already in progress
    redrawInProgressRef.current = true; // Mark redraw as in progress
    window.requestAnimationFrame(() => {
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

        devlog('Connecting to datalink via websocket');
        await datalinkRef.current.connect(); // Create websocket connection and send the client ID
        connected.current = true;
        const matchResponse = await datalinkRef.current.match(matchPattern); // Send match command
        if (matchResponse.isError()) {
          devlog(`response is not OK, ignore... ${matchResponse}`);
        }

        const positionResponse = await datalinkRef.current.positionAfter(timeWindow.start); // Send position after match command
        if (positionResponse.isError()) {
          devlog(`Oops, positionAfter response is not OK, ignore... ${positionResponse}`);
        }

        await datalinkRef.current.stream(); // Switch to streaming mode to receive data packets from the ringserver
        // NOTE: This part blocks while streaming,
        // until endStream() is called
      } catch (e) {
        deverror('Error occurred while connecting to websocket');
      }
    }
  };

  const disconnectDataLinkWS = async () => {
    try {
      if (connected.current && datalinkRef.current) {
        // close connection
        devlog('Disconnecting datalink websocket');
        await datalinkRef.current.endStream();
        await datalinkRef.current.close();

        connected.current = false;
      }
    } catch (e) {
      deverror('Error occurred while closing websocket');
    }
  };

  const startGraph = function (network, station) {
    const timerInterval =
      duration.toMillis() /
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

  // MiniSEED demo playback using seisplotjs, looping through file time
  const startDemoFromMseed = async () => {
    try {
      stopDemoMseed();
      const url = (window.ENV && window.ENV.REACT_APP_SEIS_DEMO_URL) || demoMseedUrl;
      const resp = await fetch(url, { cache: 'no-store' });
      const buf = await resp.arrayBuffer();
      const ms = sp.miniseed || {};
      let records = [];
      try {
        if (typeof ms.parseDataRecords === 'function') records = ms.parseDataRecords(buf);
        else if (typeof ms.parseMiniseed === 'function') records = ms.parseMiniseed(buf);
        else if (typeof ms.parse === 'function') records = ms.parse(buf);
      } catch (e) {
        records = [];
      }
      if (!Array.isArray(records) || records.length === 0) throw new Error('No MiniSEED records parsed');

      // Create a single segment from records
      const seg = sp.miniseed.createSeismogramSegment(records);
      const codes = seg.codes ? seg.codes() : `${network}_${code}_00_EHZ/MSEED`;

      // Build display data and plot, matching production config
      const seis = new sp.seismogram.Seismogram([seg]);
      const sdd = sp.seismogram.SeismogramDisplayData.fromSeismogram(seis);
      sdd.alignmentTime = sp.luxon.DateTime.utc();

      try {
        const theme = themeFromMapContainer(map?.getContainer?.());
        const dark = theme === 'dark' || theme === 'satellite';
        seisPlotConfig.lineColors = [dark ? '#7dd3fc' : '#0891b2'];
      } catch (_) {}
      const plot = new sp.seismograph.Seismograph([sdd], seisPlotConfig);
      realtimeDivRef.current.appendChild(plot);
      graphListRef.current.set(codes, plot);
      applySeismographTheme(plot);
      try { plot.calcTimeScaleDomain && plot.calcTimeScaleDomain(); } catch (_) {}
      try { plot.recheckAmpScaleDomain && plot.recheckAmpScaleDomain(); } catch (_) {}
      try { plot.draw && plot.draw(); } catch (_) {}
      // Draw once more shortly after layout settles (popup open animation)
      setTimeout(() => {
        try {
          plot.calcTimeScaleDomain && plot.calcTimeScaleDomain();
          plot.recheckAmpScaleDomain && plot.recheckAmpScaleDomain();
          plot.draw && plot.draw();
        } catch (_) {}
      }, 60);

      // Determine segment time range for looping
      const segStart = seg.start || seg.startTime || (seg.timeRange && seg.timeRange.start) || null;
      const segEnd = seg.end || seg.endTime || (seg.timeRange && seg.timeRange.end) || null;
      if (!segStart || !segEnd) {
        // Fallback: static render only
        demoPlaybackRef.current = { plot, sdd, alignStart: null, alignEnd: null };
        plot.draw && plot.draw();
        return;
      }

      // We want window [-graphDuration .. 0] relative to a moving alignment time.
      const alignStart = segStart.plus(graphDuration);
      const alignEnd = segEnd;
      demoPlaybackRef.current = { plot, sdd, alignStart, alignEnd };

      // Advance alignment time based on real time; loop at end
      let alignNow = alignStart;
      const stepMs = 250;
      const advanceAndDraw = () => {
        try {
          alignNow = alignNow.plus({ milliseconds: stepMs });
          if (alignNow > alignEnd) alignNow = alignStart;
          sdd.alignmentTime = alignNow;
          plot.draw && plot.draw();
        } catch (_) {}
      };
      // Kick once immediately so the trace moves without waiting for first interval tick
      advanceAndDraw();
      demoTimerRef.current = setInterval(advanceAndDraw, stepMs);
    } catch (e) {
      // Swallow demo errors; do not fallback to canvas demo
    }
  };

  const [pick, setPick] = useState(false);
  const timerId = useRef(null); // hold running timeout-id across renders
  const eventSource = useContext(SSEContext);
  const [statusState, setStatusState] = useState({ status: null, statusSince: null });
  const prevStatusRef = useRef(null);
  const [statusChange, setStatusChange] = useState(null); // 'went-online' | 'went-offline' | null
  const statusAnimTimerRef = useRef(null);
  const backend_host =
    process.env.NODE_ENV === 'production'
      ? window['ENV'].REACT_APP_BACKEND
      : window['ENV'].REACT_APP_BACKEND_DEV;

  useEffect(() => {
    if (!eventSource || typeof eventSource.addEventListener !== 'function') {
      return () => {};
    }
    const handlePickEvent = (event) => {
      const data = JSON.parse(event.data); // to parse to get valid json-obj
      if (data.stationCode === code) {
        setPick(true);
        // clear previous timeouts, if any
        clearTimeout(timerId.current); // it's ok to clear on null
        timerId.current = setTimeout(() => {
          setPick(false);
          timerId.current = null; // to avoid clearing other ids
        }, 15000);
      }
    };

    try {
      eventSource.addEventListener('SC_PICK', handlePickEvent);
    } catch (_) {}

    return () => {
      try { clearTimeout(timerId.current); } catch (_) {}
      timerId.current = null;
      try {
        eventSource.removeEventListener('SC_PICK', handlePickEvent);
      } catch (_) {}
    };
  }, [code, eventSource]);

  const divTriangle = new DivIcon({
    className: pick ? styles.dynamic : styles.static,
    html: ReactDOMServer.renderToString(<Logo />),
    iconSize: [25, 25],
  });

  const handleStationClick = async () => {
    try { setTooltipDisabled(true); } catch (_) {}
    try { const el = map && map.getContainer && map.getContainer(); el && el.classList.add('hide-marker-tooltips'); } catch (_) {}
    // Ensure map UI panels (Layers/Legend) collapse when a popup opens
    try { window.dispatchEvent(new CustomEvent('ui:popup:open')); } catch (_) {}
    try {
      const response = await axios.get(
        `${backend_host}/device/status?network=${network.toUpperCase()}&station=${code.toUpperCase()}`,
      );
      const payload = response.data.payload;
      const nextStatus = payload.status;
      const prevStatus = prevStatusRef.current;
      setStatusState({
        status: nextStatus,
        statusSince: payload.statusSince,
      });
      // Trigger a one-shot animation when status changes (online/offline)
      try {
        if (prevStatus && prevStatus !== nextStatus) {
          const cls = nextStatus === 'Streaming' ? 'went-online' : 'went-offline';
          setStatusChange(cls);
          if (statusAnimTimerRef.current) clearTimeout(statusAnimTimerRef.current);
          statusAnimTimerRef.current = setTimeout(() => setStatusChange(null), 900);
        }
      } catch (_) {}
      prevStatusRef.current = nextStatus;

      const demoFlag = window.ENV && window.ENV.REACT_APP_SEIS_DEMO === '1';
      if (payload.status === 'Streaming' && demoFlag) {
        // Demo enabled and station is streaming: show demo
        stopDemoMseed();
        await startDemoFromMseed();
      } else if (payload.status === 'Streaming') {
        // Non-demo mode: start the real streaming graph
        stopDemoMseed();
        startGraph(network, code);
      } else {
        // Not streaming: ensure no demo lingering
        stopDemoMseed();
      }
    } catch (error) {
      deverror(
        'Error occurred while fetching device status or while starting datalink graph:',
        error,
      );
      setStatusState({ status: null, statusSince: null });
      // In case backend is unavailable, still allow demo for styling verification (.env only)
      try {
        const demoFlag = window.ENV && window.ENV.REACT_APP_SEIS_DEMO === '1';
        if (demoFlag) await startDemoFromMseed();
      } catch (_) {}
    }
  };

  const handlePopupClose = async () => {
    await disconnectDataLinkWS();
    stopDemoMseed();
    try { if (statusAnimTimerRef.current) clearTimeout(statusAnimTimerRef.current); } catch (_) {}
    try { setTooltipDisabled(false); } catch (_) {}
    try { const el = map && map.getContainer && map.getContainer(); el && el.classList.remove('hide-marker-tooltips'); } catch (_) {}
    try {
      if (selectedId === `station:${code}`) {
        dispatch({ type: 'DESELECT' });
      }
    } catch (_) {}
  };

  const start_time = moment().subtract(1, 'days');
  const data_download_URL =
    window['ENV'].REACT_APP_FDSNWS +
    '/dataselect/1/query?' +
    'starttime=' +
    start_time.format('YYYY-MM-DDTHH:mm:ss') +
    '&endtime=' +
    moment().format('YYYY-MM-DDTHH:mm:ss') +
    '&network=AM&station=' +
    code +
    '&location=00&channel=E*&nodata=404';
  const metadata_download_URL =
    window['ENV'].REACT_APP_RS_FDSNWS +
    '/station/1/query?' +
    '&network=AM&station=' +
    code +
    '&level=resp&format=sc3ml&nodata=404';
  const handleDownloadMetadata = async (e) => {
    // Attempt to download XML directly with a custom filename
    // Do NOT download if response is 404/empty/non-XML; open the link instead
    try {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();

      const resp = await axios.get(metadata_download_URL, {
        responseType: 'blob',
        withCredentials: false,
        validateStatus: () => true, // we will handle non-200 statuses ourselves
      });

      // If not OK (e.g., 404 from nodata), open the URL instead of downloading
      if (resp.status !== 200) {
        try {
          window.open(metadata_download_URL, '_blank', 'noreferrer');
        } catch (_) {}
        return;
      }

      const blob = resp.data instanceof Blob ? resp.data : new Blob([resp.data]);
      const contentType = (resp.headers && resp.headers['content-type']) || '';
      const looksXml = typeof contentType === 'string' && contentType.toLowerCase().includes('xml');

      // If empty or not xml-ish, open the link instead of downloading
      if (!blob || blob.size === 0 || (!looksXml && blob.size < 64)) {
        try {
          window.open(metadata_download_URL, '_blank', 'noreferrer');
        } catch (_) {}
        return;
      }

      const filename = `${network.toUpperCase()}.${code.toUpperCase()}.00.MULTI.xml`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (_) {
      // If CORS or other error occurs, open the URL as a fallback
      try {
        window.open(metadata_download_URL, '_blank', 'noreferrer');
      } catch (_) {}
    }
  };
  const markerRef = useRef(null);
  const dispatch = useDispatch();
  const selectedId = useSelector((state) => state);
  const isSelected = selectedId === `station:${code}`;
  const [tooltipDisabled, setTooltipDisabled] = useState(false);

  /* Tooltip text mirrors Sidebar station list items */
  const statusCacheRef = useRef(
    (typeof window !== 'undefined' && (window.__stationStatusCache || (window.__stationStatusCache = new Map()))) ||
      new Map(),
  );
  const [tooltipText, setTooltipText] = useState('Loading status…');
  const computeTooltip = useCallback((status, statusSince) => {
    const s = (status || '').toLowerCase();
    const m = statusSince ? moment(statusSince) : null;
    if (s === 'streaming') {
      return m ? `Streaming since ${m.fromNow()}` : 'Streaming';
    }
    if (m && m.isAfter(moment().subtract(1, 'month'))) {
      return `Not streaming since ${m.fromNow()}`;
    }
    return 'Device Offline';
  }, []);
  const refreshTooltipFromAPI = useCallback(async () => {
    try {
      const key = `${(network || 'AM').toUpperCase()}:${(code || '').toUpperCase()}`;
      const cache = statusCacheRef.current;
      const now = Date.now();
      const cached = cache.get(key);
      if (cached && now - cached.t < 60_000) {
        setTooltipText(computeTooltip(cached.status, cached.statusSince));
        return;
      }
      const url = `${backend_host}/device/status?network=${(network || 'AM').toUpperCase()}&station=${(code || '').toUpperCase()}`;
      const resp = await axios.get(url);
      const payload = resp?.data?.payload || {};
      cache.set(key, { t: now, status: payload.status, statusSince: payload.statusSince });
      setTooltipText(computeTooltip(payload.status, payload.statusSince));
    } catch (_) {
      // Keep previous tooltip on failure
    }
  }, [network, code, backend_host, computeTooltip]);

  // Tooltips stay mounted; on mobile they are visually hidden via CSS

  // Re-apply seismograph theme on basemap theme changes while popup remains open
  useEffect(() => {
    if (!map) return undefined;
    const retheme = () => {
      try {
        graphListRef.current.forEach((plot) => {
          try {
            const theme = themeFromMapContainer(map?.getContainer?.());
            const dark = theme === 'dark' || theme === 'satellite';
            if (plot && plot.seismographConfig) {
              plot.seismographConfig.lineColors = [dark ? '#7dd3fc' : '#0891b2'];
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

  useEffect(() => {
    const m = markerRef.current;
    if (!m || typeof m.openPopup !== 'function') return;
    try {
      if (isSelected) m.openPopup();
      else m.closePopup();
    } catch (_) {}
  }, [isSelected]);

  return (
    <Marker
      position={latLng}
      icon={divTriangle}
      ref={markerRef}
      eventHandlers={{
        click: () => {
          try {
            const id = `station:${code}`;
            dispatch({ type: 'SELECT', payload: id });
            try {
              const ev = new CustomEvent('selection:fromMarker', { detail: { id } });
              window.dispatchEvent(ev);
            } catch (_) {}
          } catch (_) {}
        },
        // Fetch status and start graph whenever the popup actually opens
        // (works for both map-click and programmatic open from sidebar)
        mouseover: refreshTooltipFromAPI,
        tooltipopen: refreshTooltipFromAPI,
        popupopen: handleStationClick,
        popupclose: handlePopupClose,
      }}
    >
      <Tooltip
        direction="top"
        offset={[0, -2]}
        opacity={1}
        sticky
        className={`feature-tooltip marker-tooltip ${tooltipDisabled ? 'tt-hidden' : ''}`}
      >
        <div>
          <div><strong>Station {code}</strong></div>
          <div>{tooltipText}</div>
        </div>
      </Tooltip>
      <Popup className={styles.popUp}
        autoPan
        >
        <div className={styles.popUpBody}>
          <div>
            <b>Station {code} </b>
            <i>{description}</i>
          </div>
          <hr />
          <div ref={realtimeDivRef} className={styles.realtimeGraphDiv}></div>
          <p>
            <span
              className={
                `
                ${styles.statusIndicator}
                ${statusState.status === 'Streaming' ? styles['streaming'] : styles['not-streaming']}
                ${statusChange ? styles[statusChange] : ''}
              `
              }
            ></span>
            {statusState.statusSince
              ? statusState.status === 'Streaming' ||
                moment(statusState.statusSince) > moment().subtract(1, 'month')
                ? // If streaming or time of last status toggle is within one month, follow: "<status> since <time> ago"
                  // else (meaning Not streaming for more than 1 month): "Offline"
                  `${statusState.status} since ${moment(statusState.statusSince).fromNow()}`
                : 'Device Offline'
              : statusState.status}
          </p>
          <a href={data_download_URL} target="_blank" rel="noreferrer">
            Get past 24hrs data
          </a>
          <br />
          <a
            href={metadata_download_URL}
            target="_blank"
            rel="noreferrer"
            onClick={handleDownloadMetadata}
          >
            Get station metadata
          </a>
          <br />
        </div>
      </Popup>
    </Marker>
  );
};

export default StationMarker;
