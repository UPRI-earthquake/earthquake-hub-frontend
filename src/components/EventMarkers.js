import React, { useEffect, useContext, useState }  from 'react';
import { useMap } from 'react-leaflet';
import { ZOOM } from '../config/mapStyles';
import SSEContext from "../SSEContext";
import EventMarker from "./EventMarker";

const EventMarkers = ({initEvents, selectedEvent}) => {
  const map = useMap();
  const [events, setEvents] = useState(initEvents)
  const [zoom, setZoom] = useState(() => (map ? map.getZoom() : 6));
  useEffect(() => {
    if (!map) return undefined;
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoomend', onZoom);
    return () => map.off('zoomend', onZoom);
  }, [map]);

  const eventSource = useContext(SSEContext); 
  useEffect(() => {
    const handleEQEvent = (event) => {
      const data = JSON.parse(event.data)// to parse to get valid json-obj

      switch (data.eventType){
        case 'NEW':
          setEvents(prevEvents => [{
            publicID: data.publicID,
            OT: data.OT,
            latitude_value: data.latitude_value,
            longitude_value: data.longitude_value,
            magnitude_value: data.magnitude_value,
            depth_km: (data.depth_km ?? data.depthKm ?? data.depth_value ?? data.depthValue ?? data.depth),
            eventType: 'NEW',
            last_modification: data.last_modification
          }, ...prevEvents])
          break;
        case 'UPDATE':
          setEvents(prevEvents => prevEvents.map(event =>{
            if (event.publicID === data.publicID){
              return {
                publicID: data.publicID,
                OT: data.OT,
                latitude_value: data.latitude_value,
                longitude_value: data.longitude_value,
                magnitude_value: data.magnitude_value,
                depth_km: (data.depth_km ?? data.depthKm ?? data.depth_value ?? data.depthValue ?? data.depth),
                eventType: 'UPDATE',
                last_modification: data.last_modification
              }
            }else{ return event  }
          }));
          break;
        default:
          ;
      }
    }
    eventSource.addEventListener('SC_EVENT', handleEQEvent);

    return () => {
      eventSource.removeEventListener('SC_EVENT', handleEQEvent);
    };
  }, [eventSource]);
  const visible = ZOOM.country(zoom)
    ? events.filter((e) => (Number(e.magnitude_value) || 0) >= 5)
    : events;

  const pickDepth = (ev) => {
    // support multiple backend keys
    return ev.depth_km ?? ev.depthKm ?? ev.depth_value ?? ev.depthValue ?? ev.depth ?? null;
  };

  return (
    visible.map(event => (
      <EventMarker
        key={event.publicID}
        publicID={event.publicID}
        time={event.OT}
        lat={event.latitude_value}
        lng={event.longitude_value}
        mag={event.magnitude_value}
        depthKm={pickDepth(event)}
        status={event.eventType ? event.eventType : null}
        last_modification={event.last_modification}
      />
    ))
  );
}

export default EventMarkers;
