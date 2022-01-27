import React, {useState, useContext, useEffect} from "react"
import moment from 'moment';
import SidebarItem from "./SidebarItem"
import SSEContext from "../SSEContext";

function SidebarItems({initData}) {
  const [items, setItems] = useState(initData.sort((a, b)=>{
    return new Date(b.OT) - new Date(a.OT);
  }))

  const eventSource = useContext(SSEContext); 
  useEffect(() => {
    const handleEQEvent = (event) => {
      const data = JSON.parse(event.data)// to parse to get valid json-obj

      switch (data.eventType){
        case 'NEW':
          setItems(prevItems => [{
            publicID: data.publicID,
            magnitude_value: data.magnitude_value,
            place: data.place,
            OT: data.OT,
            text: data.text,
            eventType: 'NEW',
            last_modification: data.last_modification,

          }, ...prevItems])
          break;
        case 'UPDATE':
          setItems(prevItems => prevItems.map(item=>{
            if (item.publicID === data.publicID){
              return {
                publicID: data.publicID,
                magnitude_value: data.magnitude_value,
                place: data.place,
                OT: data.OT,
                text: data.text,
                eventType: 'UPDATE',
                last_modification: data.last_modification,
              }
            }else{ return item }
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

  return(items.map(item => 
    <SidebarItem 
      key={item.publicID}
      publicID={item.publicID}
      title={+item.magnitude_value.toFixed(1)}
      description={
        (item.place !== 'Nominatim unavailable' 
          && item.place !== 'Unable to geocode')
           ? item.place : item.text}
      subDescription={moment(item.OT).fromNow()}
      status={item.eventType ? item.eventType : null}
      last_modification={item.last_modification}
    />
  ))
}

export default SidebarItems
