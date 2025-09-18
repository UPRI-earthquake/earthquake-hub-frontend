import React, { useEffect, useContext, useState }  from 'react';
import { useMap } from 'react-leaflet';
import { ZOOM } from '../config/mapStyles';
import SSEContext from "../SSEContext";
import EventMarker from "./EventMarker";

const EventMarkers = ({initEvents, selectedEvent, filters, sseEnabled = true}) => {
  const map = useMap();
  const [events, setEvents] = useState(initEvents)
  const [zoom, setZoom] = useState(() => (map ? map.getZoom() : 6));
  // Keep events in sync when initEvents changes (e.g., preset switch)
  useEffect(() => {
    setEvents(initEvents || []);
  }, [initEvents]);
  useEffect(() => {
    if (!map) return undefined;
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoomend', onZoom);
    return () => map.off('zoomend', onZoom);
  }, [map]);

  const eventSource = useContext(SSEContext);
  useEffect(() => {
    if (!sseEnabled) return; // disable live updates for curated presets
    const handleEQEvent = (event) => {
      const data = JSON.parse(event.data);// to parse to get valid json-obj

      switch (data.eventType){
        case 'NEW': {
          const depthValue = data.depth_km ?? data.depthKm ?? data.depth_value ?? data.depthValue ?? data.depth;
          setEvents(prevEvents => {
            const nextEvent = {
              publicID: data.publicID,
              OT: data.OT,
              latitude_value: data.latitude_value,
              longitude_value: data.longitude_value,
              magnitude_value: data.magnitude_value,
              depth_km: depthValue,
              eventType: 'NEW',
              last_modification: data.last_modification
            };

            const existingIndex = prevEvents.findIndex(event => event.publicID === data.publicID);
            if (existingIndex !== -1) {
              const updated = [...prevEvents];
              updated[existingIndex] = { ...prevEvents[existingIndex], ...nextEvent };
              return updated;
            }

            return [nextEvent, ...prevEvents];
          });
          break;
        }
        case 'UPDATE':
          setEvents(prevEvents => prevEvents.map(event =>{
            if (event.publicID !== data.publicID){
              return event;
            }

            const nextEvent = { ...event };
            Object.entries(data).forEach(([key, value]) => {
              if (value !== undefined) {
                nextEvent[key] = value;
              }
            });

            const mergedDepth = data.depth_km ?? data.depthKm ?? data.depth_value ?? data.depthValue ?? data.depth;

            nextEvent.OT = data.OT ?? event.OT;
            nextEvent.latitude_value = data.latitude_value ?? event.latitude_value;
            nextEvent.longitude_value = data.longitude_value ?? event.longitude_value;
            nextEvent.magnitude_value = data.magnitude_value ?? event.magnitude_value;
            nextEvent.depth_km = mergedDepth ?? event.depth_km ?? event.depthKm ?? event.depth_value ?? event.depthValue ?? event.depth ?? null;
            nextEvent.eventType = 'UPDATE';
            nextEvent.last_modification = data.last_modification ?? event.last_modification;

            return nextEvent;
          }));
          break;
        default:
          ;
      }
    };
    eventSource.addEventListener('SC_EVENT', handleEQEvent);
    return () => eventSource.removeEventListener('SC_EVENT', handleEQEvent);
  }, [eventSource, sseEnabled]);
  // Client-side filters from sidebar (magnitude + date)
  const magMin = typeof filters?.magMin === 'number' ? filters.magMin : -Infinity;
  const magMax = typeof filters?.magMax === 'number' ? filters.magMax : Infinity;
  const startDate = filters?.startDate ? new Date(filters.startDate) : null;
  const endDate = filters?.endDate ? new Date(filters.endDate + 'T23:59:59') : null;

  const filtered = (events || []).filter((e) => {
    const mag = Number(e.magnitude_value) || 0;
    if (Number.isFinite(magMin) && mag < magMin) return false;
    if (Number.isFinite(magMax) && mag > magMax) return false;
    const t = e.OT ? new Date(e.OT) : null;
    if (startDate && t && t < startDate) return false;
    if (endDate && t && t > endDate) return false;
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

  return (
    eventsWithCoords.map(event => {
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
          key={event.publicID}
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
    })
  );
}

export default EventMarkers;
