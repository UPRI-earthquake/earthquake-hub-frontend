import React, { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import { ZOOM } from '../config/mapStyles';
import EventMarker from './EventMarker';

/**
 * Renders earthquake markers filtered by magnitude/date and current zoom level.
 * @param {{initEvents: Array, selectedEvent?: any, filters?: Object, sseEnabled?: boolean, datasetKey?: string}} props
 */
const EventMarkers = ({
  initEvents,
  selectedEvent: _selectedEvent,
  filters,
  sseEnabled: _sseEnabled = true,
  datasetKey,
}) => {
  const map = useMap();
  const [events, setEvents] = useState(initEvents);
  const [zoom, setZoom] = useState(() => (map ? map.getZoom() : 6));
  // Keep events in sync when initEvents or dataset key changes (e.g., preset switch)
  useEffect(() => {
    setEvents(initEvents || []);
  }, [initEvents, datasetKey]);

  useEffect(() => {
    if (!map) return undefined;
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoomend', onZoom);
    return () => map.off('zoomend', onZoom);
  }, [map]);

  // Client-side filters from sidebar (magnitude + date + text)
  const magMin = typeof filters?.magMin === 'number' ? filters.magMin : -Infinity;
  const magMax = typeof filters?.magMax === 'number' ? filters.magMax : Infinity;
  const startDate = filters?.startDate ? new Date(filters.startDate) : null;
  const endDate = filters?.endDate ? new Date(filters.endDate + 'T23:59:59') : null;
  const text = String(filters?.searchText || '').trim().toLowerCase();

  const filtered = (events || []).filter((e) => {
    const mag = Number(e.magnitude_value) || 0;
    // If both knobs are at the same value, treat it as a bin rounded to 1 decimal
    const isClosedRange =
      Number.isFinite(magMin) && Number.isFinite(magMax) && Math.abs(magMax - magMin) < 1e-9;
    if (isClosedRange) {
      const target = Math.round(magMin * 10) / 10;
      const roundedMag = Math.round(mag * 10) / 10;
      if (roundedMag !== target) return false;
    } else {
      if (Number.isFinite(magMin) && mag < magMin) return false;
      if (Number.isFinite(magMax) && mag > magMax) return false;
    }
    const t = e.OT ? new Date(e.OT) : null;
    if (startDate && t && t < startDate) return false;
    if (endDate && t && t > endDate) return false;
    if (text) {
      const hay = `${e.place || ''} ${e.text || ''}`.toLowerCase();
      if (!hay.includes(text)) return false;
    }
    return true;
  });

  const visible = ZOOM.country(zoom)
    ? filtered.filter((e) => (Number(e.magnitude_value) || 0) >= 5)
    : filtered;

  const pickDepth = (ev) => {
    // support multiple backend keys
    return ev.depth_km ?? ev.depthKm ?? ev.depth_value ?? ev.depthValue ?? ev.depth ?? null;
  };

  const toFinite = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const eventsWithCoords = visible.filter((event) => {
    return toFinite(event.latitude_value) != null && toFinite(event.longitude_value) != null;
  });

  return eventsWithCoords.map((event) => {
    const lat = toFinite(event.latitude_value);
    const lng = toFinite(event.longitude_value);
    if (lat == null || lng == null) {
      return null;
    }

    const magnitude = Number.isFinite(Number(event.magnitude_value))
      ? Number(event.magnitude_value)
      : 0;

    return (
      <EventMarker
        key={`${datasetKey || 'ds'}-${event.publicID}`}
        publicID={event.publicID}
        time={event.OT}
        lat={lat}
        lng={lng}
        mag={magnitude}
        depthKm={pickDepth(event)}
        status={event.eventType ? event.eventType : null}
        last_modification={event.last_modification}
      />
    );
  });
};

export default EventMarkers;
