import React, {useEffect, useState} from 'react';
import ReactDOMServer from 'react-dom/server';
import { Marker } from "react-leaflet";
import { DivIcon } from "leaflet";
import {ReactComponent as Logo} from './triangle.svg';
import styles from './StationMarker.module.css'

const StationMarker = ({code, latLng, eventSource}) => {

  const [pick, setPick] = useState(false)

  useEffect(() => {
    const handlePickEvent = (event) => {
      const data = JSON.parse(event.data)// to parse to get valid json-obj
      if(data.stationCode === code){
        if (data.stationCode === 'RE722'){
          console.log('Run handlePickEvent w data:', data)
        }
        setPick(true);
        setTimeout(()=>setPick(false), 6000);
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
