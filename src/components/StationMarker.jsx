import React, { useEffect, useState, useRef, useContext, useCallback } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import { DivIcon } from 'leaflet';
import styles from './StationMarker.module.css';
import SSEContext from '../SSEContext';
import moment from '../utils/time';
import axios from 'axios';
import { normalizeDeviceActivity, toMarkerActivity } from '../utils/deviceStatus';
// Defer loading of the heavy seisplotjs library until the popup/graph is used
import { ringserverWS } from '../utils/env';
import demoMseedUrl from '../assets/demo.mseed';
import { devlog, deverror } from '../utils/devlog';
import { useSelector, useDispatch } from 'react-redux';
import { themeFromMapContainer } from '../config/mapStyles';
import { trackEvent } from '../analytics';
/**
 * Single station marker with real-time miniseed plot via DataLink WebSocket.
 */

// Lightly shaded triangular marker builder (returns inline SVG string)
function tintHex(hex, amt) {
  const h = String(hex || '').replace('#', '');
  if (![3, 6].includes(h.length)) return hex;
  const n = h.length === 3 ? h.split('').map((c) => parseInt(c + c, 16)) : [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const res = n.map((v) => clamp(v + 255 * amt));
  const toHex = (v) => v.toString(16).padStart(2, '0');
  return `#${toHex(res[0])}${toHex(res[1])}${toHex(res[2])}`;
}

function buildTriangleSVG(baseHex = '#2e8b57', idSuffix = 'tri') {
  const safeId = String(idSuffix || 'tri').replace(/[^a-zA-Z0-9_-]/g, '') || 'tri';
  const prefix = `tri-${safeId}`;
  const leftId = `${prefix}-left`;
  const rightId = `${prefix}-right`;
  const baseId = `${prefix}-base`;
  const shadowId = `${prefix}-shadow`;
  const facet1 = tintHex(baseHex, 0.18);
  const facet2 = tintHex(baseHex, -0.12);
  const facet3 = tintHex(baseHex, -0.28);
  const shadow = 'rgba(0,0,0,0.22)';
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 110" role="img" aria-label="Station marker">
  <defs>
    <linearGradient id="${leftId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${facet1}"/>
      <stop offset="100%" stop-color="${facet2}"/>
    </linearGradient>
    <linearGradient id="${rightId}" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${facet2}"/>
      <stop offset="100%" stop-color="${facet3}"/>
    </linearGradient>
    <linearGradient id="${baseId}" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="${facet2}"/>
      <stop offset="100%" stop-color="${facet3}"/>
    </linearGradient>
    <filter id="${shadowId}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="${shadow}"/>
    </filter>
  </defs>
  <g filter="url(#${shadowId})">
    <polygon points="60 6 6 104 60 84" fill="url(#${leftId})"/>
    <polygon points="60 6 114 104 60 84" fill="url(#${rightId})"/>
    <polygon points="6 104 114 104 60 84" fill="url(#${baseId})"/>
  </g>
</svg>`;
}

const StationMarker = ({ network, code, latLng, description, activity: initActivity }) => {
  const map = useMap();
  const realtimeDivRef = useRef(null);
  const graphListRef = useRef(new Map());
  const redrawInProgressRef = useRef(false);
  const datalinkRef = useRef(null);
  const connected = useRef(false); // flag used in connectDataLinkWS(), ws is not connected by default
  const demoTimerRef = useRef(null);
  const demoPlaybackRef = useRef({ plot: null, sdd: null, alignStart: null, alignEnd: null });
  const ringserver_ws = ringserverWS();
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

  // Lazy-loaded seisplotjs and derived config/state
  const spRef = useRef(null);
  const durationRef = useRef(null);
  const graphDurationRef = useRef(null);
  const timeWindowRef = useRef(null);
  const seisPlotConfigRef = useRef(null);

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

  // MiniSEED demo playback using seisplotjs, looping through file time
  const startDemoFromMseed = async () => {
    try {
      await ensureSeis();
      const sp = spRef.current; if (!sp) return;
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
        if (seisPlotConfigRef.current) {
          seisPlotConfigRef.current.lineColors = [dark ? '#7dd3fc' : '#0891b2'];
        }
      } catch (_) {}
      const plot = new sp.seismograph.Seismograph([sdd], seisPlotConfigRef.current);
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
      const alignStart = segStart.plus(graphDurationRef.current);
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
  const [statusState, setStatusState] = useState({ status: null, statusSince: null, activity: null });
  const prevStatusRef = useRef(null);
  const [statusChange, setStatusChange] = useState(null); // 'went-online' | 'went-offline' | null
  const statusAnimTimerRef = useRef(null);
  // One-shot pulse on marker when status changes (via SSE/API)
  const [markerPulse, setMarkerPulse] = useState(null); // same class names as CSS: 'went-online' | 'went-offline'
  const markerPulseTimerRef = useRef(null);
  // Keep per-marker unique SVG ids so gradients don't collide across markers
  const gradientIdRef = useRef(null);
  if (!gradientIdRef.current) {
    const safeNet = String(network || 'am').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const safeCode = String(code || 'station').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const salt = Math.random().toString(36).slice(2, 8);
    gradientIdRef.current = `${safeNet || 'net'}-${safeCode || 'station'}-${salt}`;
  }
  // Track current marker activity to tint marker (active vs inactive)
  const [markerActivity, setMarkerActivity] = useState(null); // updated via SSE/API
  const backend_host =
    process.env.NODE_ENV === 'production'
      ? window['ENV'].REACT_APP_BACKEND
      : window['ENV'].REACT_APP_BACKEND_DEV;

  // Derive display activity from live state, status, or initial prop
  const displayActivity = normalizeDeviceActivity(
    markerActivity || statusState.activity || initActivity,
  );

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

    // Live station status updates to mirror sidebar list behavior
    const handleStatusEvent = (event) => {
      try {
        const raw = JSON.parse(event.data);
        const sc = String(
          raw.stationCode || raw.station || raw.code || raw.station_id || raw.stationcode || '',
        ).toUpperCase();
        if (!sc || sc !== String(code || '').toUpperCase()) return;
        const net = String(
          raw.network || raw.networkCode || raw.network_code || raw.net || 'AM',
        ).toUpperCase();
        if (String(network || 'AM').toUpperCase() !== net) return;
        let next = null;
        const state = normalizeDeviceActivity(raw.activity || raw.status || '');
        if (state === 'active') next = 'active';
        else if (state === 'inactive' || state === 'unlinked') next = 'inactive';
        else if (typeof raw.isActive === 'boolean') next = raw.isActive ? 'active' : 'inactive';
        if (next) {
          setMarkerActivity((prev) => {
            if (prev && prev !== next) {
              const cls = next === 'active' ? 'pulse-online' : 'pulse-offline';
              setMarkerPulse(cls);
              try { if (markerPulseTimerRef.current) clearTimeout(markerPulseTimerRef.current); } catch (_) {}
              markerPulseTimerRef.current = setTimeout(() => setMarkerPulse(null), 4500);
            }
            return next;
          });
        }
      } catch (_) {}
    };
    const names = [
      'STATION_STATUS',
      'SC_STATION_STATUS',
      'SC_STATION',
      'SC_DEVICE',
      'DEVICE_STATUS',
      'STATION_EVENT',
    ];
    try { names.forEach((n) => eventSource.addEventListener(n, handleStatusEvent)); } catch (_) {}

    return () => {
      try { clearTimeout(timerId.current); } catch (_) {}
      timerId.current = null;
      try { if (markerPulseTimerRef.current) clearTimeout(markerPulseTimerRef.current); } catch (_) {}
      try {
        eventSource.removeEventListener('SC_PICK', handlePickEvent);
      } catch (_) {}
      try { names.forEach((n) => eventSource.removeEventListener(n, handleStatusEvent)); } catch (_) {}
    };
  }, [code, network, eventSource]);

  const isInactive = displayActivity !== 'active';
  // Online markers should float above offline ones; add a small extra for pick highlight
  const zIndexOffset = (isInactive ? 0 : 200) + (pick ? 20 : 0);
  // Use legend-consistent colors
  const baseHex = isInactive ? '#9ca3af' : '#22c55e'; // gray-400 for offline, green-500 for online
  const triangleMarkup = buildTriangleSVG(baseHex, gradientIdRef.current);
  const divTriangle = new DivIcon({
    className: `${pick ? styles.dynamic : styles.static} ${isInactive ? styles.offline : ''} ${
      markerPulse ? styles[markerPulse] : ''
    }`,
    html: triangleMarkup,
    iconSize: [25, 25],
  });

  const handleStationClick = async () => {
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
        activity: payload.activity || null,
      });
      // Also update marker activity color based on current status
      try {
        const next = toMarkerActivity(payload.activity || nextStatus);
        setMarkerActivity((prev) => {
          if (prev && prev !== next) {
            const cls = next === 'active' ? 'pulse-online' : 'pulse-offline';
            setMarkerPulse(cls);
            try { if (markerPulseTimerRef.current) clearTimeout(markerPulseTimerRef.current); } catch (_) {}
            markerPulseTimerRef.current = setTimeout(() => setMarkerPulse(null), 4500);
          }
          return next;
        });
      } catch (_) {}
      // Trigger a one-shot animation when status changes (online/offline)
      try {
        if (prevStatus && prevStatus !== nextStatus) {
          const cls = nextStatus === 'Streaming' ? 'went-online' : 'went-offline';
          setStatusChange(cls);
            if (statusAnimTimerRef.current) clearTimeout(statusAnimTimerRef.current);
            statusAnimTimerRef.current = setTimeout(() => setStatusChange(null), 4500);
        }
      } catch (_) {}
      prevStatusRef.current = nextStatus;

      const demoFlag = window.ENV && window.ENV.REACT_APP_SEIS_DEMO === '1';
      if (payload.status === 'Streaming' && demoFlag) {
        // Demo enabled and station is streaming: show demo
        stopDemoMseed();
        await ensureSeis();
        await startDemoFromMseed();
      } else if (payload.status === 'Streaming') {
        // Non-demo mode: start the real streaming graph
        stopDemoMseed();
        await ensureSeis();
        initDatalink();
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
      setStatusState({ status: null, statusSince: null, activity: null });
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
    try { const el = map && map.getContainer && map.getContainer(); el && el.classList.remove('hide-marker-tooltips'); } catch (_) {}
    try {
      if (selectedId === `station:${code}`) {
        dispatch({ type: 'DESELECT' });
      }
    } catch (_) {}
  };

  const start_time = moment().subtract(1, 'days');
  const FDSNWS = window['ENV'].REACT_APP_FDSNWS;

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

  const handleDownloadMetadata = async (e) => {
    // Download station metadata (XML) from the configured FDSNWS only,
    // saving with a custom filename.
    try {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();

      const url = `${FDSNWS}${stationMetaQuery}`;
      const resp = await axios.get(url, {
        responseType: 'blob',
        withCredentials: false,
        validateStatus: () => true,
        timeout: 10000,
        headers: { Accept: 'application/xml, text/xml; q=0.9, */*; q=0.1' },
      });

      if (resp.status !== 200) {
        logDownload({ type: 'metadata', format: 'xml', status: 'fallback' });
        try { window.open(url, '_blank', 'noreferrer'); } catch (_) {}
        return;
      }

      const blob = resp.data instanceof Blob ? resp.data : new Blob([resp.data]);
      const ct = (resp.headers && resp.headers['content-type']) || '';
      const looksXml = typeof ct === 'string' && ct.toLowerCase().includes('xml');
      if (!blob || blob.size === 0 || (!looksXml && blob.size < 64)) {
        logDownload({ type: 'metadata', format: 'xml', status: 'fallback' });
        try { window.open(url, '_blank', 'noreferrer'); } catch (_) {}
        return;
      }

      const filename = `${network.toUpperCase()}.${code.toUpperCase()}.00.MULTI.xml`;
      const objUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(objUrl);
      logDownload({
        type: 'metadata',
        format: 'xml',
        status: 'success',
        size_bytes: blob.size || 0,
      });
    } catch (_) {
      logDownload({ type: 'metadata', format: 'xml', status: 'error' });
      try { window.open(metadata_download_URL, '_blank', 'noreferrer'); } catch (_) {}
    }
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
  const markerRef = useRef(null);
  const dispatch = useDispatch();
  const selectedId = useSelector((state) => state);
  const isSelected = selectedId === `station:${code}`;
  const markerDesc = String(description || '').trim();
  const markerTitle = markerDesc
    ? `Station ${code} - ${markerDesc}`
    : `Station ${code}`;

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
      zIndexOffset={zIndexOffset}
      ref={markerRef}
      title={markerTitle}
      eventHandlers={{
        click: () => {
          try {
            const id = `station:${code}`;
            dispatch({ type: 'SELECT', payload: id });
            try {
              const ev = new CustomEvent('selection:fromMarker', { detail: { id } });
              window.dispatchEvent(ev);
            } catch (_) {}
            trackEvent('station_select', {
              station_code: code,
              network: String(network || 'AM').toUpperCase(),
              source: 'marker',
              status: String(statusState.status || '').toLowerCase() || 'unknown',
            });
          } catch (_) {}
        },
        // Fetch status and start graph whenever the popup actually opens
        // (works for both map-click and programmatic open from sidebar)
        popupopen: handleStationClick,
        popupclose: handlePopupClose,
      }}
    >
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
                ${normalizeDeviceActivity(statusState.activity || statusState.status) === 'active' ? styles['streaming'] : styles['not-streaming']}
                ${statusChange ? styles[statusChange] : ''}
              `
              }
            ></span>
            {(() => {
              const state = normalizeDeviceActivity(statusState.activity || statusState.status);
              if (state === 'unlinked') return 'Device Offline';
              const label = statusState.status || (state === 'active' ? 'Streaming' : 'Inactive');
              if (!statusState.statusSince) return label;
              if (state === 'active' || moment(statusState.statusSince) > moment().subtract(1, 'month')) {
                return `${label} since ${moment(statusState.statusSince).fromNow()}`;
              }
              return 'Device Offline';
            })()}
          </p>
          <a href={data_download_URL} target="_blank" rel="noreferrer" onClick={handleDownloadData}>
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
