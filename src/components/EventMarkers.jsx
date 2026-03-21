import React, { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import { filterEvents, eventDepth } from '../utils/eventFilters';
import EventMarker from './EventMarker';

/**
 * Renders earthquake markers filtered by magnitude/date.
 * @param {{initEvents: Array, selectedEvent?: any, filters?: Object, sseEnabled?: boolean, datasetKey?: string, popupAutoPanPadding?: {topLeft:number[], bottomRight:number[]}}} props
 */
const EventMarkers = ({
  initEvents,
  selectedEvent: _selectedEvent,
  filters,
  sseEnabled: _sseEnabled = true,
  datasetKey,
  popupAutoPanPadding,
}) => {
  const map = useMap();
  const [events, setEvents] = useState(initEvents);
  // Track center longitude so we can render markers on the nearest world copy
  const [centerLng, setCenterLng] = useState(() => {
    try {
      return map?.getCenter?.().lng ?? 0;
    } catch (_) {
      return 0;
    }
  });
  // Keep events in sync when initEvents or dataset key changes (e.g., preset switch)
  useEffect(() => {
    setEvents(initEvents || []);
  }, [initEvents, datasetKey]);

  useEffect(() => {
    if (!map) return undefined;
    const onMove = () => {
      try { setCenterLng(map.getCenter().lng); } catch (_) {}
    };
    map.on('moveend', onMove);
    return () => {
      map.off('moveend', onMove);
    };
  }, [map]);

  const filtered = filterEvents(events, filters);

  const toFinite = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const eventsWithCoords = filtered.filter((event) => {
    return toFinite(event.latitude_value) != null && toFinite(event.longitude_value) != null;
  });

  // Normalize longitude to the nearest copy relative to reference longitude
  const normalizeLngNear = (lng, refLng) => {
    if (!Number.isFinite(lng) || !Number.isFinite(refLng)) return lng;
    let x = lng;
    while (x - refLng > 180) x -= 360;
    while (x - refLng < -180) x += 360;
    return x;
  };

  return eventsWithCoords.map((event) => {
    const lat = toFinite(event.latitude_value);
    const lng = toFinite(event.longitude_value);
    if (lat == null || lng == null) {
      return null;
    }

    const magnitude = Number.isFinite(Number(event.magnitude_value))
      ? Number(event.magnitude_value)
      : 0;
    const locationText =
      event && event.place && !['Unavailable', 'Unable to geocode', ''].includes(event.place)
        ? event.place
        : event?.text || '';

    const displayLng = normalizeLngNear(lng, centerLng);

    return (
      <EventMarker
        key={`${datasetKey || 'ds'}-${event.publicID}`}
        publicID={event.publicID}
        time={event.OT}
        lat={lat}
        lng={displayLng}
        mag={magnitude}
        depthKm={eventDepth(event)}
        status={event.eventType ? event.eventType : null}
        last_modification={event.last_modification}
        location={locationText}
        // Suppress only the initial mount/appear animation on All Stations
        enableAnimation={datasetKey !== 'all-stations'}
        suppressInitialRadiate={datasetKey === 'all-stations'}
        popupAutoPanPadding={popupAutoPanPadding}
      />
    );
  });
};

export default EventMarkers;
