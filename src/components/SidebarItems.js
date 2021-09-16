import React, {useState, useContext, useEffect} from "react"
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
          setItems([{
            publicID: data.publicID,
            magnitude_value: data.magnitude_value,
            place: data.place,
            OT: data.OT,
            text: data.text,
            eventType: 'NEW'
          }, ...items])
          break;
        case 'UPDATE':
          setItems(items.map(item=>{
            if (item.publicID === data.publicID){
              return {
                publicID: data.publicID,
                magnitude_value: data.magnitude_value,
                place: data.place,
                OT: data.OT,
                text: data.text,
                eventType: 'UPDATE'
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
  }, [eventSource, items]);

  return(items.map(item => 
    <SidebarItem 
      key={item.publicID}
      publicID={item.publicID}
      title={+item.magnitude_value.toFixed(1)}
      description={item.place !== 'Nominatim unavailable' 
                    ? item.place : item.text}
      subDescription={item.OT}
      status={item.eventType ? item.eventType : ''}
    />
  ))
}

export default SidebarItems
