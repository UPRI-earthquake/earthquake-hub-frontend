import { Station, StationsDataFilter } from "../../types/station";

export class StationUpdateListEvent extends Event {
  stations: Station[];

  constructor(stations: Station[]) {
    super("update-list");
    this.stations = stations;
  }
}

export class StationUpdateEvent extends Event {
  station: Station;

  constructor(station: Station) {
    super("update");
    this.station = station;
  }
}

export class StationMessageEvent extends Event {
  type: string;
  content: any;

  constructor(type: string, content: any) {
    super("message");
    this.type = type;
    this.content = content;
  }
}

export class StationUpdateStatusEvent extends Event {
  status: { isPending?: boolean, isLoading?: boolean };

  constructor(status: { isPending?: boolean, isLoading?: boolean }) {
    super("update-status");
    this.status = status;
  }
}

export class StationUpdateFiltersEvent extends Event {
  filters: StationsDataFilter;

  constructor(filters: StationsDataFilter) {
    super("update-filters");
    this.filters = filters;
  }
}