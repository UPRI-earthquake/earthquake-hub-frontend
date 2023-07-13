import React, {useEffect, useState, useRef, useContext} from 'react';
import ReactDOMServer from 'react-dom/server';
import { Marker, Popup } from "react-leaflet";
import { DivIcon } from "leaflet";
import {ReactComponent as Logo} from './triangle.svg';
import styles from './StationMarker.module.css'
import SSEContext from "../SSEContext";
import moment from 'moment';
import axios from 'axios';
import * as sp from 'seisplotjs';

const StationMarker = ({network, code, latLng, description}) => {
    
  const realtimeDivRef = useRef(null);
  const graphListRef = useRef(new Map());
  const numPacketsRef = useRef(0);
  const redrawInProgressRef = useRef(false);
  const datalinkRef = useRef(null);

  function getRealTimeTrace(net, sta){
    const matchPattern = `${net}_${sta}_([0-9]{2})?_.HZ/MSEED`; 
    const duration = sp.luxon.Duration.fromObject({ minutes: 3, seconds: 30 });
    const graphDuration = sp.luxon.Duration.fromObject({ minutes: 2, seconds: 30 }); // Set the graphDuration 1 minute shorter than the duration to make the trace look more realtime
    const timeWindow = new sp.util.durationEnd(duration, sp.luxon.DateTime.utc());
    const seisPlotConfig = new sp.seismographconfig.SeismographConfig();
    seisPlotConfig.wheelZoom = false;
    seisPlotConfig.linkedTimeScale.offset = sp.luxon.Duration.fromMillis(-1 * duration.toMillis());
    seisPlotConfig.linkedTimeScale.duration = graphDuration;
    seisPlotConfig.linkedAmplitudeScale = new sp.scale.IndividualAmplitudeScale();  
    seisPlotConfig.doGain = true;
    seisPlotConfig.isRelativeTime = false; // This can be set to true to set the time to be relative from the current time (in millis)

    const packetHandler = function (packet) {
      if (packet.isMiniseed()) {
        numPacketsRef.current++; // Increment the packet counter
        let seisSegment = sp.miniseed.createSeismogramSegment(packet.asMiniseed()); // Create a SeismogramSegment from the packet
        let codes = seisSegment.codes(); // Get the codes (stream ID) of the SeismogramSegment
        let seisPlot = graphListRef.current.get(codes); // Retrieve the corresponding graph for the codes from the graphListRef

        if (!seisPlot) { // If the graph doesn't exist
          // seisPlotConfig.title = codes; // Set the title of the graph based on the stream_id

          let seismogram = new sp.seismogram.Seismogram([seisSegment]); // Create a Seismogram with the SeismogramSegment
          let seisData = sp.seismogram.SeismogramDisplayData.fromSeismogram(seismogram); // Create SeismogramDisplayData from the Seismogram
          seisData.alignmentTime = sp.luxon.DateTime.utc(); // Set the alignment time to current UTC time

          seisPlot = new sp.seismograph.Seismograph([seisData], seisPlotConfig); // Create a new Seismograph with the SeismogramDisplayData and SeismographConfig
          realtimeDivRef.current.appendChild(seisPlot); // Append the Seismograph to the realtimeDiv
          graphListRef.current.set(codes, seisPlot); // Store the Seismograph in the graphListRef for future reference

          console.log(`new plot: ${codes}`)
        } else {
          seisPlot.seisData[0].append(seisSegment);
          seisPlot.recheckAmpScaleDomain();
        }
        seisPlot.draw();
      } else {
        console.log(`not a mseed packet: ${packet.streamId}`)
      }
    };

    const errorFn = function (error) {
      console.assert(false, error);
      if (datalinkRef.current) { datalinkRef.current.close(); } // Close the websocket connection
    };

    /***************************************************************************
     * new DataLinkConnection:
     *     A websocket based Datalink connection
     * Parameters:  
     *     url            (string)                                    websocket url to the ringserver
     *     packetHandler  (function (packet: DataLinkPacket): void)   callback for packets as they arrive
     *     errorHandler   (function (error: Error): void)             callback for errors
     *     
     ***************************************************************************/
    datalinkRef.current = new sp.datalink.DataLinkConnection(
      "ws://127.0.0.1:16000/datalink",
      packetHandler,
      errorFn
    );

    const timerInterval = duration.toMillis() /
      (realtimeDivRef.current.offsetWidth - seisPlotConfig.margin.left - seisPlotConfig.margin.right);

    const drawGraph = function (timestamp) {
      if (redrawInProgressRef.current) return; // Skip if redraw is already in progress
      redrawInProgressRef.current = true; // Mark redraw as in progress
      window.requestAnimationFrame(() => {
        const now = sp.luxon.DateTime.utc();
        graphListRef.current.forEach(function (graph) {
          graph.seisData.forEach(sdd => {
            sdd.alignmentTime = now;
          });
          graph.calcTimeScaleDomain(); // Recalculate time scale domain
          graph.calcAmpScaleDomain(); // Recalculate amplitude scale domain
          graph.draw();
        });
        redrawInProgressRef.current = false; // Mark redraw as complete
      });
    };

    const toggleConnect = async function () {
      if (datalinkRef.current) {
        try {
          await datalinkRef.current.connect(); // Create websocket connection and send the client ID

          const matchResponse = await datalinkRef.current.match(matchPattern); // Send match command
          if (matchResponse.isError()) {
            console.log(`response is not OK, ignore... ${matchResponse}`);
          }

          const positionResponse = await datalinkRef.current.positionAfter(timeWindow.start); // Send position after match command
          if (positionResponse.isError()) {
            console.log(`Oops, positionAfter response is not OK, ignore... ${positionResponse}`);
          }
    
          await datalinkRef.current.stream(); // Switch to streaming mode to receive data packets from the ringserver
        } catch (error) {
          console.log("Error: " + error);
          console.assert(false, error);
        }
      }
    };

    const startGraph = function () {
      window.setInterval(drawGraph, timerInterval);
      toggleConnect();
    };

    startGraph();
  }

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
        `${backend_host}/device/status?network=${network.toUpperCase()}&station=${code.toUpperCase()}`);
      const payload = response.data.payload;
      setStatusState({
        status: payload.status,
        statusSince: payload.statusSince
      })
      getRealTimeTrace(network, code); // Call the function that traces the realtime data received by the ringserver
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
      <Popup className={styles.popUp}>
        <div className={styles.popUpBody}>
          <div><b>Station {code} </b><i>{description}</i></div> 
          <hr/>
          <div ref={realtimeDivRef} className={styles.realtimeGraphDiv}></div>
          <p>
            <span
              className={`${styles.statusIndicator} 
              ${statusState.status === 'Streaming' 
                ? styles.streaming 
                : statusState.status === 'Not streaming' 
                ? styles['not-streaming'] 
                : styles['not-linked']}`}
            ></span>
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
