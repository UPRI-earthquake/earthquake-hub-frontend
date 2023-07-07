import React, {useEffect, useState, useRef, useContext} from 'react';
import ReactDOMServer from 'react-dom/server';
import { Marker, Popup } from "react-leaflet";
import { DivIcon } from "leaflet";
import {ReactComponent as Logo} from './triangle.svg';
import styles from './StationMarker.module.css'
import SSEContext from "../SSEContext";
import moment from 'moment';
import axios from 'axios';

const StationMarker = ({code, latLng, description}) => {

  const [pick, setPick] = useState(false);
  const timerId = useRef(null); // hold running timeout-id across renders
  const eventSource = useContext(SSEContext);
  const [statusState, setStatusState] = useState({status: null, statusSince: null});
  const backend_host = process.env.NODE_ENV === 'production'
                       ? process.env.REACT_APP_BACKEND
                       : process.env.REACT_APP_BACKEND_DEV

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
        }, 15000);
      }
    }

    eventSource.addEventListener('SC_PICK', handlePickEvent);

    return () => {
      eventSource.removeEventListener('SC_PICK', handlePickEvent);
    };
  }, [code, eventSource]);

  const divTriangle = new DivIcon({
    className: pick ? styles.dynamic : styles.static,
    html: ReactDOMServer.renderToString(<Logo />),
    iconSize: [25,25]
  })

  const handleStationClick = async () => {
    try{
      const response = await axios.get(
        `${backend_host}/device/status?network=AM&station=${code.toUpperCase()}`);
      const payload = response.data.payload;
      setStatusState({
        status: payload.status,
        statusSince: payload.statusSince
      })
    } catch (error) {
      console.error('Error occurred while fetching device status:', error);
      setStatusState({ status: null, statusSince: null });
    }
  }

  const start_time = moment().subtract(1, 'days')
  const data_download_URL = process.env.REACT_APP_FDSNWS
    +"/dataselect/1/query?"
    +"starttime="+start_time.format("YYYY-MM-DDTHH:mm:ss")
    +"&endtime="+moment().format("YYYY-MM-DDTHH:mm:ss")
    +"&network=AM&station="+code
    +"&location=00&channel=E*&nodata=404"
  const metadata_download_URL = process.env.REACT_APP_RS_FDSNWS
    +"/station/1/query?"
    +"&network=AM&station="+code
    +"&level=resp&format=sc3ml"
  return (
    <Marker
      position={latLng}
      icon={divTriangle}
      eventHandlers={{
        click: handleStationClick
      }}
    >
      <Popup >
        <div>
          <h3>Station {code}</h3>
          <p>{description}</p>
          <p>
          {statusState.status && statusState.status} 
          {statusState.statusSince && ` since ${moment(statusState.statusSince).fromNow()}`}
          </p>
          <a href={data_download_URL} target="_blank" rel="noreferrer">Get past 24hrs data</a><br/>
          <a href={metadata_download_URL} target="_blank" rel="noreferrer">Get station metadata</a><br/>
        </div>
      </Popup>
    </Marker>
  )
}

export default StationMarker
