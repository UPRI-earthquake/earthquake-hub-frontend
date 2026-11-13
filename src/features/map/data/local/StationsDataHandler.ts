import { TypedEventTarget } from "@/shared/utils/events";
import RemoteStationsDataHandler from "../remote/RemoteStationsDataHandler";
import { GeneralStationsUpdateFiltersEvent, GeneralStationsUpdateListEvent, GeneralStationsUpdateStatusEvent, StationUpdateEvent } from "./stations.events";
import { Station } from "../../types/station";

type GeneralStationsEventsMap = { 
  "general-update-status": GeneralStationsUpdateStatusEvent;
  "general-update-filters": GeneralStationsUpdateFiltersEvent;
  "general-update-list": GeneralStationsUpdateListEvent;
};

type StationEventsMap = { 
  "update": StationUpdateEvent;
};

interface StationsDataStatus {
  isPending?: boolean;
  isLoading?: boolean;
}

interface StationFilters {
  searchText?: string;
  statusFilter?: null | "active" | "inactive";
}

interface DataStore {
  stations: Station[];
  latestPicksCollection: {
    [stationCode: string]: string
  }
}



export default class StationsDataHandler {
  private status: StationsDataStatus = {
    isPending: true,
    isLoading: true
  };

  private remote = new RemoteStationsDataHandler();

  private filters: StationFilters = {
    searchText: "",
    statusFilter: "active"
  };

  private store: DataStore = {
    stations: [],
    latestPicksCollection: {}
  };

  private eventTarget = new TypedEventTarget<GeneralStationsEventsMap>();
  private stationEventTargets: { [stationCode: string]: TypedEventTarget<StationEventsMap> } = {};

  async reloadStations() {
    const rawStationsData = await this.remote.fetchAllStations();
    this.store.stations.splice(0, this.store.stations.length);
    for(const station of rawStationsData) {
      this.store.stations.push(station);
    }

    const allStations = this.getAllStations();
    this.emitEvent(new GeneralStationsUpdateListEvent(allStations));

    return allStations;
  }

  getFilters() {
    return { ...this.filters };
  }

  setFilters(filters: StationFilters) {
    for(const key in filters) {
      this.filters[key] = filters[key];
    }

    // Notify listeners
    this.emitEvent(new GeneralStationsUpdateFiltersEvent(this.getFilters()));
  }


  
  getStatus() {
    return { ...this.status };
  }

  setStatus(partialStatus: StationsDataStatus) {
    for(const key in partialStatus) {
      this.status[key] = partialStatus[key];
    }

    // Notify listeners
    this.emitEvent(new GeneralStationsUpdateStatusEvent(this.getStatus()));
  }
  
  getAllStations() {
    return [...this.store.stations];
  }

  getStation(stationCode: string): Station | null {
    const stationData = this.store.stations.find(s => s.code === stationCode);
    return stationData ? {...stationData} : null;
  }

  async reloadStationStatus(stationCode: string, network: string) {
    const rawStationsStatus = await this.remote.getStationStatus(stationCode, network);
    if(!rawStationsStatus) return;

    const stationData = this.store.stations.find(s => s.code === stationCode);
    if(!stationData) return;

    stationData.activity = rawStationsStatus.activity;
    stationData.status = rawStationsStatus.status as StationStatus;
    stationData.statusSince = rawStationsStatus.statusSince;

    // Notify listeners
    this.emitStationEvent(stationCode, new StationUpdateEvent({ ...stationData }));
  }

  receivePickFromStream(stationCode: string, timestamp: string) {
    // Try update latest pick for station
    const prevLatestPick = this.store.latestPicksCollection[stationCode];
    if(!prevLatestPick || prevLatestPick.localeCompare(timestamp) === -1) {
      this.store.latestPicksCollection[stationCode] = timestamp;
    }
  }

  getStationLatestPick(stationCode: string): string | null {
    return this.store.latestPicksCollection[stationCode] || null;
  }


  /* ==== GENERAL EVENTS ==== */
  addEventListener<K extends keyof GeneralStationsEventsMap>(type: K, listener: (event: GeneralStationsEventsMap[K]) => void) {
    this.eventTarget.addEventListener(type, listener);

    return listener;
  }

  removeEventListener<K extends keyof GeneralStationsEventsMap>(type: K, listener: (event: GeneralStationsEventsMap[K]) => void) {
    this.eventTarget.removeEventListener(type, listener);

    return listener;
  }

  private emitEvent<K extends keyof GeneralStationsEventsMap>(event: GeneralStationsEventsMap[K]) {
    this.eventTarget.emit(event);
  }


  /* ==== STATION-SPECIFIC EVENTS ==== */
  private getStationEventsTarget(stationCode: string) {
    if(!this.stationEventTargets[stationCode]) {
      this.stationEventTargets[stationCode] = new TypedEventTarget();
    }

    return this.stationEventTargets[stationCode];
  }

  addStationEventListener<K extends keyof StationEventsMap>(stationCode: string, type: K, listener: (event: StationEventsMap[K]) => void) {
    this.getStationEventsTarget(stationCode).addEventListener(type, listener);

    return listener;
  }

  removeStationEventListener<K extends keyof StationEventsMap>(stationCode: string, type: K, listener: (event: StationEventsMap[K]) => void) {
    this.getStationEventsTarget(stationCode).removeEventListener(type, listener);

    return listener;
  }

  private emitStationEvent<K extends keyof StationEventsMap>(stationCode: string, event: StationEventsMap[K]) {
    this.getStationEventsTarget(stationCode).emit(event);
  }
}