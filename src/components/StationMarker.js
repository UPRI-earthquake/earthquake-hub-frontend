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

const StationMarker = ({code, latLng, description}) => {
    
  const realtimeDivRef = useRef(null);
  const graphListRef = useRef(new Map());
  const numPacketsRef = useRef(0);
  const redrawInProgressRef = useRef(false);
  const datalinkRef = useRef(null);

  function getRealTimeTrace(){
    const matchPattern = 'CO_BIRD_00_HHZ/MSEED';
    const duration = sp.luxon.Duration.fromISO('PT3M');
    const timeWindow = new sp.util.durationEnd(duration, sp.luxon.DateTime.utc());
    const seisPlotConfig = new sp.seismographconfig.SeismographConfig();
    seisPlotConfig.wheelZoom = false;
    seisPlotConfig.isYAxisNice = true;
    seisPlotConfig._yLabel = 'Amplitude';
    seisPlotConfig.linkedTimeScale.offset = sp.luxon.Duration.fromMillis(-1.2 * duration.toMillis()); // BINAGO KO TO FROM -1 to -1.2
    seisPlotConfig.linkedTimeScale.duration = duration;
    seisPlotConfig.linkedAmplitudeScale = new sp.scale.IndividualAmplitudeScale();
    seisPlotConfig.doGain = true;

    const packetHandler = function (packet) {
      if (packet.isMiniseed()) {
        numPacketsRef.current++;
        let seisSegment = sp.miniseed.createSeismogramSegment(packet.asMiniseed());
        const codes = seisSegment.codes();
        let seisPlot = graphListRef.current.get(codes);
        if (!seisPlot) {
          let seismogram = new sp.seismogram.Seismogram([seisSegment]);
          let seisData = sp.seismogram.SeismogramDisplayData.fromSeismogram(seismogram);
          seisData.alignmentTime = sp.luxon.DateTime.utc();
          seisPlot = new sp.seismograph.Seismograph([seisData], seisPlotConfig);
          realtimeDivRef.current.appendChild(seisPlot);
          graphListRef.current.set(codes, seisPlot);
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
      if (datalinkRef.current) { datalinkRef.current.close(); }
    };

    datalinkRef.current = new sp.datalink.DataLinkConnection(
      "wss://rtserve.iris.washington.edu/datalink",
      packetHandler,
      errorFn
    );
    console.log(datalinkRef.current)

    let timer;
    const timerInterval = duration.toMillis() /
      (realtimeDivRef.current.offsetWidth - seisPlotConfig.margin.left - seisPlotConfig.margin.right);
    const drawGraph = function (timestamp) {
      if (redrawInProgressRef.current) return;
      redrawInProgressRef.current = true;
      window.requestAnimationFrame(() => {
        const now = sp.luxon.DateTime.utc();
        graphListRef.current.forEach(function (graph) {
          graph.seisData.forEach(sdd => {
            sdd.alignmentTime = now;
          });
          graph.calcTimeScaleDomain();
          graph.calcAmpScaleDomain();
          graph.draw();
        });
        redrawInProgressRef.current = false;
      });
    };

    const toggleConnect = function () {
      if (datalinkRef.current) {
        datalinkRef.current.connect()
          .then(serverId => {
            return datalinkRef.current.match(matchPattern);
          }).then(response => {
            if (response.isError()) {
              console.log(`response is not OK, ignore... ${response}`);
            }
            return datalinkRef.current.infoStatus();
          }).then(response => {
            return datalinkRef.current.infoStreams();
          }).then(response => {
            return datalinkRef.current.positionAfter(timeWindow.start);
          }).then(response => {
            if (response.isError()) {
              console.log(`Oops, positionAfter response is not OK, ignore... ${response}`);
            }
            return datalinkRef.current.stream();
          }).catch(function (error) {
            console.log("Error: " + error);
            console.assert(false, error);
          });
      }
    };

    const startGraph = function () {
      timer = window.setInterval(drawGraph, timerInterval);
      toggleConnect();
    };

    // const stopGraph = function () {
    //   if (timer) {
    //     clearInterval(timer);
    //     timer = null;
    //   }
    //   if (datalinkRef.current) {
    //     datalinkRef.current.endStream();
    //     datalinkRef.current.close();
    //   }
    // };

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
        `${backend_host}/device/status?network=AM&station=${code.toUpperCase()}`);
      const payload = response.data.payload;
      setStatusState({
        status: payload.status,
        statusSince: payload.statusSince
      })
      getRealTimeTrace(); // call the function that traces the realtime data received by the ringserver 

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
          <div ref={realtimeDivRef}></div>
          <a href={data_download_URL} target="_blank" rel="noreferrer">Get past 24hrs data</a><br/>
          <a href={metadata_download_URL} target="_blank" rel="noreferrer">Get station metadata</a><br/>
        </div>
      </Popup>
    </Marker>
  )
}

export default StationMarker
