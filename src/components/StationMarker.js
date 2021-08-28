import React, {useEffect, useState, useRef} from 'react';
import ReactDOMServer from 'react-dom/server';
import { Marker } from "react-leaflet";
import { DivIcon } from "leaflet";
import {ReactComponent as Logo} from './triangle.svg';
import styles from './StationMarker.module.css'

const StationMarker = ({code, latLng, eventSource}) => {

  const [pick, setPick] = useState(false)
  const timerId = useRef(null) // hold running timeout-id across renders

  useEffect(() => {
    const handlePickEvent = (event) => {
      const data = JSON.parse(event.data)// to parse to get valid json-obj
      if(data.stationCode === code){
        setPick(true);
        // clear previous timeouts, if any
        clearTimeout(timerId.current) // it's ok to clear on null
        timerId.current = setTimeout(()=>{
          setPick(false)
          timerId.current = null // to avoid clearing other ids
        }, 6000);
      }
    }

    eventSource.addEventListener('eventName', handlePickEvent);

    return () => {
      eventSource.removeEventListener('eventName', handlePickEvent);
    };
  }, [code, eventSource]);

  const divTriangle = new DivIcon({
    className: pick ? styles.dynamic : styles.static,
    html: ReactDOMServer.renderToString(<Logo />),
    iconSize: [25,25]
  })

  return (
    <Marker 
      position={latLng}
      icon={divTriangle}
    />
  )
}

export default StationMarker
