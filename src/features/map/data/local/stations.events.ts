import { Station, StationsDataFilter } from "../../types/station";

export class GeneralStationsUpdateListEvent extends Event {
  stations: Station[];

  constructor(stations: Station[]) {
    super("general-update-list");
    this.stations = stations;
  }
}


export class GeneralStationsUpdateFiltersEvent extends Event {
  filters: StationsDataFilter;

  constructor(filters: StationsDataFilter) {
    super("general-update-filters");
    this.filters = filters;
  }
}

export class GeneralStationsUpdateStatusEvent extends Event {
  status: { isPending?: boolean, isLoading?: boolean };

  constructor(status: { isPending?: boolean, isLoading?: boolean }) {
    super("general-update-status");
    this.status = status;
  }
}

export class StationUpdateEvent extends Event {
  station: Station;

  constructor(station: Station) {
    super("update");
    this.station = station;
  }
}
