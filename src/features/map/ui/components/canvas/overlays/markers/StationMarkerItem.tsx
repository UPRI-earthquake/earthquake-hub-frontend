import React, { useEffect, useState, useRef, useContext, useCallback, useMemo } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import { DivIcon, LatLngExpression } from 'leaflet';
import styles from '../../../../styles/canvas/overlays/markers/StationMarkerItem.module.css';
import SSEContext from '../../../../../../../SSEContext';
import moment from '@/shared/utils/time';
import axios from 'axios';
import { normalizeDeviceActivity, toMarkerActivity } from '@/shared/services/stations/deviceStatus';
// Defer loading of the heavy seisplotjs library until the popup/graph is used
import { devlog, deverror } from '@/shared/utils/devlog';
import { useSelector, useDispatch } from 'react-redux';
import { buildThemeTokens, themeFromMapContainer, zoomFromMap } from '../../../../../services/mapStyles';
import { trackEvent } from '@/analytics';
import { buildTriangleSVG } from '@/shared/utils/triangleMarker';
import { ringserverWS } from '@/config/env';
import StationMarkerPopup from '../popups/StationMarkerPopup';
import useMapView from '@/features/map/hooks/useMapView';
import { getAPIURL } from '@/shared/api';
import { isLatest } from '@/shared/utils/duration';
/**
 * Single station marker with real-time miniseed plot via DataLink WebSocket.
 */


const STREAM_LINE_COLOR = '#0ea5e9';
const STREAM_TITLE_COLOR = '#0ea5e9';

interface StationMarkerItemProps {
  network: string;
  code: string;
  latLng: any;
  description: string;
  activity: string;
}

export default function StationMarkerItem({
  network,
  code,
  latLng,
  description,
  activity: initActivity,
}: StationMarkerItemProps) {
  const map = useMap();
  const realtimeDivRef = useRef(null);
  const graphListRef = useRef(new Map());
  const redrawInProgressRef = useRef(false);
  const datalinkRef = useRef(null);
  const connected = useRef(false); // flag used in connectDataLinkWS(), ws is not connected by default
  const [markerTheme, setMarkerTheme] = useState(() =>
    themeFromMapContainer(map?.getContainer?.()),
  );
  const demoTimerRef = useRef(null);
  const demoPlaybackRef = useRef({ plot: null, sdd: null, alignStart: null, alignEnd: null });
  const ringserver_ws = ringserverWS();

  const { stationsDataHandler } = useMapView();




  // Lazy-loaded seisplotjs and derived config/state
  const spRef = useRef(null);
  const durationRef = useRef(null);
  const graphDurationRef = useRef(null);
  const timeWindowRef = useRef(null);
  const seisPlotConfigRef = useRef(null);

  useEffect(() => {
    // Listen to changes in the station

    const stationUpdateListener = stationsDataHandler.addEventListener("update", ({ station }) => {
      setStatusState({
        status: station.status,
        statusSince: station.statusSince,
        activity: station.activity
      });

      // Also update marker activity color based on current status
      const next = toMarkerActivity(station.activity || station.status as any);
      setMarkerActivity((prev) => {
        if (prev && prev !== next) {
          const cls = next === 'active' ? 'pulse-online' : 'pulse-offline';
          setMarkerPulse(cls);
          try { if (markerPulseTimerRef.current) clearTimeout(markerPulseTimerRef.current); } catch (_) {}
          markerPulseTimerRef.current = setTimeout(() => setMarkerPulse(null), 4500);
        }
        return next;
      });

      // Trigger a one-shot animation when status changes (online/offline)
      const cls = station.status === 'Streaming' ? 'went-online' : 'went-offline';
      setStatusChange(cls);
      if (statusAnimTimerRef.current) clearTimeout(statusAnimTimerRef.current);
      statusAnimTimerRef.current = setTimeout(() => setStatusChange(null), 4500);

      if (station.status === 'Streaming') {
        stopDemoMseed();
        ensureSeis().then(() => {
          initDatalink();
          startGraph(network, code);
        });
      } else {
        // Not streaming: ensure no demo lingering
        stopDemoMseed();
      }
    });

    

    return (() => {
      stationsDataHandler.removeEventListener("update", stationUpdateListener);
    });

  }, []);

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

  const [pick, setPick] = useState(false);
  useEffect(() => {
    const pickInterval = setInterval(() => {
      const latestPick = stationsDataHandler.getStationLatestPick(code);
      if(!latestPick) {
        setPick(false);
        return;
      }
      
      const displayDuration = 10_000; // Display pick for 10s after timestamp
      setPick(isLatest(latestPick, displayDuration));
    }, 1_000);

    return (() => {
      clearInterval(pickInterval);
    })
  }, []);

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

  // Derive display activity from live state, status, or initial prop
  const displayActivity = normalizeDeviceActivity(
    markerActivity || statusState.activity || initActivity,
  );

  const isInactive = displayActivity !== 'active';
  // Online markers should float above offline ones; add a small extra for pick highlight
  const zIndexOffset = (isInactive ? 0 : 200) + (pick ? 20 : 0);
  const stationTokens = useMemo(() => {
    try {
      return buildThemeTokens({
        theme: markerTheme,
        zoom: zoomFromMap(map),
        overlays: null,
      }).stations;
    } catch (_) {
      return { fill: '#22c55e', offlineFill: '#9ca3af' };
    }
  }, [markerTheme, map]);
  const baseHex = isInactive ? stationTokens.offlineFill : stationTokens.fill;
  const triangleMarkup = buildTriangleSVG(baseHex, gradientIdRef.current);
  const divTriangle = new DivIcon({
    className: `station-marker ${pick ? styles.dynamic : styles.static} ${isInactive ? styles.offline : ''} ${
      markerPulse ? styles[markerPulse] : ''
    }`,
    html: triangleMarkup,
    iconSize: [25, 25],
  });

  const handleStationClick = async () => {
    try { const el = map && map.getContainer && map.getContainer(); el && el.classList.add('hide-marker-tooltips'); } catch (_) {}
    // Ensure map UI panels (Layers/Legend) collapse when a popup opens
    try { window.dispatchEvent(new CustomEvent('ui:popup:open')); } catch (_) {}

    stationsDataHandler.reloadStationStatus(code, network);
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
      <StationMarkerPopup
        network={network}
        code={code}
        markerDesc={markerDesc}
        statusChange={statusChange}
        statusState={statusState}
        realtimeDivRef={realtimeDivRef} />
    </Marker>
  );
}
