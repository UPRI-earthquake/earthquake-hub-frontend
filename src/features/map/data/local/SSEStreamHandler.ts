import { getAPIURL } from '@/shared/api';
import StationsDataHandler from './StationsDataHandler';
import EarthquakesDataHandler from './EarthquakesDataHandler';

const StreamEventNames = [ 
  'SC_EVENT',
  'STATION_STATUS',
  'SC_STATION_STATUS',
  'SC_STATION',
  'SC_DEVICE',
  'DEVICE_STATUS',
  'STATION_EVENT',
  'SC_PICK' 
];

interface DataHandlers { stations: StationsDataHandler, earthquakes: EarthquakesDataHandler }

export default class SSEStreamHandler {
  
  private eventSource: any = null;
  private isSSEStreamStopped: boolean = false;

  
  private dataHandlers: DataHandlers;

  constructor(dataHandlers: DataHandlers) {
    this.dataHandlers = dataHandlers;
    
    // For streamed events
    this.startSSEStream();
  }


  private async startSSEStream() {
    const url = getAPIURL("backend", "/messaging");
    if (typeof window !== 'undefined' && 'EventSource' in window) {
      this.eventSource = new window.EventSource(url);
    } else {
      // Lazy-load the polyfill only for browsers wit`hout EventSource
      const { EventSourcePolyfill } = await import('event-source-polyfill');
      if (this.isSSEStreamStopped) return; // unbound before polyfill loaded
      this.eventSource = new EventSourcePolyfill(url);
    }
    
    // With stable publicID, no similarity matching is needed.
    this.eventSource.addEventListener('error', () => {
      if (
        (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) !== 'production'
      ) {
        // eslint-disable-next-line no-console
        console.warn('EventSource error (may be reconnecting)');
      }
    });

    for(const eventName of StreamEventNames) {
      this.eventSource.addEventListener(eventName, (e) => this.processStationStreamMessage(eventName, JSON.parse(e.data)));
    }
  
  }

  private processStationStreamMessage(eventName: typeof StreamEventNames[number], raw: any) {
    console.log("[STREAM] Event received: ", eventName, { raw });
    switch(eventName) {
      case "SC_PICK":
        this.dataHandlers.stations.receivePickFromStream(raw.stationCode, raw.timestamp);
        break;
      case "SC_EVENT":
        this.dataHandlers.earthquakes.receiveEarthquakeFromStream(raw);
        break;
    }
  }


  destroy() {
    // Close SSE Stream
    this.isSSEStreamStopped = true;
    this.eventSource.close();
  }
}