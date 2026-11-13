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
import { Station } from '@/features/map/types/station';
/**
 * Single station marker with real-time miniseed plot via DataLink WebSocket.
 */


interface StationMarkerItemProps {
  station: Station;
}

export default function StationMarkerItem({
  station: initialStationData
}: StationMarkerItemProps) {

  const [ station, setStationData ] = useState<Station>(initialStationData);
  const { network, code, latitude, longitude, description, activity, status } = station;

  
  const { stationsDataHandler } = useMapView();

  const map = useMap();




  useEffect(() => {
    // Listen to changes in the station

    const stationUpdateListener = stationsDataHandler.addStationEventListener(code, "update", ({ station }) => {
      setStationData(station);
      

      // // Also update marker activity color based on current status
      // const next = toMarkerActivity(station.activity || station.status as any);
      // setMarkerActivity((prev) => {
      //   if (prev && prev !== next) {
      //     const cls = next === 'active' ? 'pulse-online' : 'pulse-offline';
      //     setMarkerPulse(cls);
      //     try { if (markerPulseTimerRef.current) clearTimeout(markerPulseTimerRef.current); } catch (_) {}
      //     markerPulseTimerRef.current = setTimeout(() => setMarkerPulse(null), 4500);
      //   }
      //   return next;
      // });

    });

    

    return (() => {
      stationsDataHandler.removeStationEventListener(code, "update", stationUpdateListener);
    });

  }, []);


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

  // Keep per-marker unique SVG ids so gradients don't collide across markers
  const gradientIdRef = useRef(null);
  if (!gradientIdRef.current) {
    const safeNet = String(network || 'am').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const safeCode = String(code || 'station').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const salt = Math.random().toString(36).slice(2, 8);
    gradientIdRef.current = `${safeNet || 'net'}-${safeCode || 'station'}-${salt}`;
  }

  // Derive display activity from live state, status, or initial prop
  const displayActivity = normalizeDeviceActivity(activity);

  const isInactive = displayActivity !== 'active';
  // Online markers should float above offline ones; add a small extra for pick highlight
  
  const [markerTheme, setMarkerTheme] = useState(() =>
    themeFromMapContainer(map?.getContainer?.()),
  );
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
  
  const zIndexOffset = (isInactive ? 0 : 200) + (pick ? 20 : 0);
  const triangleMarkup = buildTriangleSVG(baseHex, gradientIdRef.current);
  const divTriangle = new DivIcon({
    className: `station-marker ${pick ? styles.dynamic : styles.static} ${isInactive ? styles.offline : ''}`,
    html: triangleMarkup,
    iconSize: [25, 25],
  });

  const handleStationClick = async () => {
    try { const el = map && map.getContainer && map.getContainer(); el && el.classList.add('hide-marker-tooltips'); } catch (_) {}
    // Ensure map UI panels (Layers/Legend) collapse when a popup opens
    try { window.dispatchEvent(new CustomEvent('ui:popup:open')); } catch (_) {}

    stationsDataHandler.reloadStationStatus(code, network);
  };



  const dispatch = useDispatch();
  const markerDesc = String(description || '').trim();
  const markerTitle = markerDesc
    ? `Station ${code} - ${markerDesc}`
    : `Station ${code}`;


  return (
    <Marker
      position={[ latitude, longitude ]}
      icon={divTriangle}
      zIndexOffset={zIndexOffset}
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
              status: status ?? 'unknown',
            });
          } catch (_) {}
        },
        // Fetch status and start graph whenever the popup actually opens
        // (works for both map-click and programmatic open from sidebar)
        popupopen: handleStationClick,
      }}
    >
      <StationMarkerPopup 
        station={station}
        setMarkerTheme={setMarkerTheme} />
    </Marker>
  );
}
