import React from 'react';
import { Marker } from "react-leaflet";
import { Icon } from "leaflet";

const StationMarker = ({code, latLng, svg_path}) => {
  const triangle = new Icon({
    iconUrl: svg_path,
    iconSize: [10,10]
  });

  return (
    <Marker 
      position={latLng}
      icon={triangle}
    />
  )
}

export default React.memo(StationMarker, (prev, next)=>{
  if (prev.svg_path === next.svg_path) {
    // do not re-render
    return true
  }
  else {
    // log how many times component is rendered
    console.count(`Re-rendered ${next.code} StationMarker`)
    return false;
  }
});
