import { TypedEventTarget } from "@/shared/utils/events";
import { EarthquakeShortInfo, SSEPayload } from "../../types/earthquake";
import latestRangeDefaults from "../../utils/filters";
import RemoteEarthquakesDataHandler from "../remote/RemoteEarthquakesDataHandler";
import { EarthquakeUpdateActiveListEvent, EarthquakeUpdateEvent, EarthquakeUpdateFiltersEvent, EarthquakeUpdateListEvent, EarthquakeUpdateStatusEvent } from "./earthquakes.events";
import { getAPIURL } from "@/shared/api";
import { normalizeDeviceActivity } from "@/shared/services/stations/deviceStatus";
import { isLatest } from "@/shared/utils/duration";
import { areSetsEqual } from "@/shared/utils/object";

interface EarthquakeFilters {
  searchText?: string;
  scope?: "all" | "latest";
  magMin?: number;
  magMax?: number;
  startDate?: string;
  endDate?: string;
}

type EarthquakeEventsMap = { 
  "update": EarthquakeUpdateEvent;
  "update-list": EarthquakeUpdateListEvent;
  "update-active-list": EarthquakeUpdateActiveListEvent;
  "update-status": EarthquakeUpdateStatusEvent;
  "update-filters": EarthquakeUpdateFiltersEvent;
};

interface EarthquakesDataStatus { 
  isPending?: boolean; 
  isLoading?: boolean;
}

interface DataStore {
  earthquakes: EarthquakeShortInfo[];
  activeEarthquakes: Set<string>; // based on publicID
}


export default class EarthquakesDataHandler {
  private status: EarthquakesDataStatus = {
    isPending: true,
    isLoading: true
  };

  private remote = new RemoteEarthquakesDataHandler();

  private filters: EarthquakeFilters = {
    searchText: "",
    scope: "latest"
  };

  private store: DataStore = {
    earthquakes: [],
    activeEarthquakes: new Set()
  };

  private eventTarget = new TypedEventTarget<EarthquakeEventsMap>();

  private activeEarthquakesTracker;

  constructor() {
    const initialRange = latestRangeDefaults();
    this.filters.startDate = initialRange.startDate;
    this.filters.endDate = initialRange.endDate;

    // For every 1s, track active events
    this.activeEarthquakesTracker = setInterval(() => {
      const activeEarthquakesSet = new Set<string>();
      const maxDuration = 15_000;
      for(const eq of this.store.earthquakes) {
        if(isLatest(eq.OT, maxDuration)) activeEarthquakesSet.add(eq.publicID);
      }

      // If set is different, update
      if(!areSetsEqual(this.store.activeEarthquakes, activeEarthquakesSet)) {
        this.store.activeEarthquakes = activeEarthquakesSet;
        
        // Notify listeners
        this.emitEvent(new EarthquakeUpdateActiveListEvent(this.getActiveEarthquakes()));
      }
    }, 1000);
  }

  async reloadEarthquakes() {
    this.setStatus({ isLoading: true });
    
    const rawEarthquakesData = await this.remote.fetchEarthquakes(this.filters);
    
    this.store.earthquakes.splice(0, this.store.earthquakes.length);
    for(const station of rawEarthquakesData) {
      this.store.earthquakes.push(station);
    }
    
    const allEarthquakes = this.getEarthquakes();
    this.setStatus({ isLoading: false, isPending: false });
    this.emitEvent(new EarthquakeUpdateListEvent(allEarthquakes));

    return allEarthquakes;
  }

  getFilters() {
    return { ...this.filters };
  }

  setFilters(filters: EarthquakeFilters) {
    for(const key in filters) {
      this.filters[key] = filters[key];
    }

    // Notify listeners
    this.emitEvent(new EarthquakeUpdateFiltersEvent(this.getFilters()));
  }


  
  getStatus() {
    return { ...this.status };
  }

  setStatus(partialStatus: EarthquakesDataStatus) {
    for(const key in partialStatus) {
      this.status[key] = partialStatus[key];
    }

    // Notify listeners
    this.emitEvent(new EarthquakeUpdateStatusEvent(this.getStatus()));
  }
  
  getEarthquakes() {
    return [...this.store.earthquakes];
  }

  getActiveEarthquakes() {
    return new Set(this.store.activeEarthquakes);
  }

  receiveEarthquakeFromStream(earthquakeData: SSEPayload.Earthquake) {
    const existingIndex = this.store.earthquakes.findIndex(e => e.publicID === earthquakeData.publicID);
    
    if(existingIndex >= 0) {
      this.store.earthquakes[existingIndex] = earthquakeData;
    } else {
      this.store.earthquakes.push(earthquakeData);
    }

    // Notify listeners
    this.emitEvent(new EarthquakeUpdateListEvent(this.getEarthquakes()));
  }

  addEventListener<K extends keyof EarthquakeEventsMap>(type: K, listener: (event: EarthquakeEventsMap[K]) => void) {
    this.eventTarget.addEventListener(type, listener);

    return listener;
  }

  removeEventListener<K extends keyof EarthquakeEventsMap>(type: K, listener: (event: EarthquakeEventsMap[K]) => void) {
    this.eventTarget.removeEventListener(type, listener);

    return listener;
  }

  private emitEvent<K extends keyof EarthquakeEventsMap>(event: EarthquakeEventsMap[K]) {
    this.eventTarget.emit(event);
  }

  destroy() {
    clearTimeout(this.activeEarthquakesTracker);
  }

}