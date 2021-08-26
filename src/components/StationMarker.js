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
      key={code} 
      position={latLng}
      icon={triangle}
    />
  )
}

export default StationMarker;
