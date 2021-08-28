import React, {useEffect, useState} from 'react';
import ReactDOMServer from 'react-dom/server';
import { Marker } from "react-leaflet";
import { DivIcon } from "leaflet";
import {ReactComponent as Logo} from './triangle.svg';
import styles from './StationMarker.module.css'

const StationMarker = ({code, latLng, isPicked}) => {

  const [dynamicOrStatic, setDynamism] = useState('static')

  useEffect(() => { 
    if (isPicked){
      setDynamism('dynamic')
    }else{
      setDynamism('static')
    }
  }, [isPicked]);

  const divTriangle = new DivIcon({
    className: styles[dynamicOrStatic],
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

//export default StationMarker
export default React.memo(StationMarker, (prev, next)=>{
  if (prev.isPicked === next.isPicked) {
    // do not re-render
    return true
  }
  else {
    // log how man times component is rendered
    console.count(`Re-rendered ${next.code} StationMarker`)
    return false;
  }
});
