import React, { useState, useEffect } from 'react';
import { render } from "react-dom";

const PickEventListener = () => {
  const [data, updateData] = useState(null);

  useEffect(() => {
    const source = new EventSource('http://localhost:5000/messaging');

    source.onmessage = function logEvents(event) {      
      updateData(JSON.parse(event.data));     
      console.log(JSON.parse(event.data))
    }
  }, [])
  return <div/>
  //if(!data){return <div/>}
  //return <div> {data.stationCode} and {data.networkCode} </div>
}

export default PickEventListener
