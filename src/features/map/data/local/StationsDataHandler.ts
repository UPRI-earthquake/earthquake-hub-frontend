import { TypedEventTarget } from "@/shared/utils/events";
import RemoteStationsDataHandler from "../remote/RemoteStationsDataHandler";
import { StationMessageEvent, StationUpdateEvent, StationUpdateFiltersEvent, StationUpdateListEvent, StationUpdateStatusEvent } from "./stations.events";
import { Station } from "../../types/station";

type StationEventsMap = { 
  "update": StationUpdateEvent;
  "update-list": StationUpdateListEvent;
  "message": StationMessageEvent;
  "update-status": StationUpdateStatusEvent;
  "update-filters": StationUpdateFiltersEvent;
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

  private eventTarget = new TypedEventTarget<StationEventsMap>();

  async reloadStations() {
    const rawStationsData = await this.remote.fetchAllStations();
    this.store.stations.splice(0, this.store.stations.length);
    for(const station of rawStationsData) {
      this.store.stations.push(station);
    }

    const allStations = this.getAllStations();
    this.emitEvent(new StationUpdateListEvent(allStations));

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
    this.emitEvent(new StationUpdateFiltersEvent(this.getFilters()));
  }


  
  getStatus() {
    return { ...this.status };
  }

  setStatus(partialStatus: StationsDataStatus) {
    for(const key in partialStatus) {
      this.status[key] = partialStatus[key];
    }

    // Notify listeners
    this.emitEvent(new StationUpdateStatusEvent(this.getStatus()));
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
    stationData.activity = rawStationsStatus.activity;
    stationData.status = rawStationsStatus.status;
    stationData.statusSince = rawStationsStatus.statusSince;

    // Notify listeners
    this.emitEvent(new StationUpdateEvent({ ...stationData }));
    this.emitEvent(new StationUpdateListEvent(this.getAllStations()));
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

  addEventListener<K extends keyof StationEventsMap>(type: K, listener: (event: StationEventsMap[K]) => void) {
    this.eventTarget.addEventListener(type, listener);

    return listener;
  }

  removeEventListener<K extends keyof StationEventsMap>(type: K, listener: (event: StationEventsMap[K]) => void) {
    this.eventTarget.removeEventListener(type, listener);

    return listener;
  }

  private emitEvent<K extends keyof StationEventsMap>(event: StationEventsMap[K]) {
    this.eventTarget.emit(event);
  }
}