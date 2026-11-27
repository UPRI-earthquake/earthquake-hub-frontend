import { devlog } from "@/shared/utils/devlog";
import { getAPIURL } from '@/shared/api';
import StationsDataHandler from './StationsDataHandler';
import EarthquakesDataHandler from './EarthquakesDataHandler';
import type { StreamEarthquake } from '../../types/earthquake';

const StreamEventNames = [ 
  'SC_EVENT',
  'STATION_STATUS',
  'SC_STATION_STATUS',
  'SC_STATION',
  'SC_DEVICE',
  'DEVICE_STATUS',
  'STATION_EVENT',
  'SC_PICK'
] as const;

interface DataHandlers { stations: StationsDataHandler, earthquakes: EarthquakesDataHandler }

export default class SSEStreamHandler {
  
  private eventSource: EventSource | null = null;
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
      this.eventSource.addEventListener(eventName, (e: MessageEvent<string>) => this.processStationStreamMessage(eventName, JSON.parse(e.data)));
    }
  
  }

  private processStationStreamMessage(eventName: typeof StreamEventNames[number], raw: unknown) {
    devlog("[STREAM] Event received: ", eventName, { raw });
    switch(eventName) {
      case "SC_PICK": {
        const { stationCode, timestamp } = raw as { stationCode: string; timestamp: string };
        this.dataHandlers.stations.receivePickFromStream(stationCode, timestamp);
        break;
      }
      case "SC_EVENT":
        this.dataHandlers.earthquakes.receiveEarthquakeFromStream(raw as StreamEarthquake);
        break;
      case "STATION_STATUS": {
        const { station, activity, status, statusSince } = raw as {
          station: string;
          activity: StationActivity;
          status: StationStatus;
          statusSince: string;
        };
        this.dataHandlers.stations.receiveStationStatusFromStream(station, activity, status, statusSince);
        break;
      }
    }
  }


  destroy() {
    // Close SSE Stream
    this.isSSEStreamStopped = true;
    this.eventSource?.close();
  }
}