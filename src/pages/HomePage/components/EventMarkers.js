import React, { useEffect, useContext, useState }  from 'react';
import SSEContext from "../../../SSEContext";
import EventMarker from "./EventMarker";

const EventMarkers = ({initEvents, selectedEvent}) => {
  const [events, setEvents] = useState(initEvents)

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
  return (
    events.map(event => 
      <EventMarker
        key={event.publicID}
        publicID={event.publicID}
        time={event.OT}
        lat={event.latitude_value}
        lng={event.longitude_value}
        mag={event.magnitude_value}
        status={event.eventType ? event.eventType : null}
        last_modification={event.last_modification}
      />
    )
  );
}

export default EventMarkers;

