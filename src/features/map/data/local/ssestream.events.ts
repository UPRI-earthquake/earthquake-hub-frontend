import { EarthquakesDataFilter, EarthquakeShortInfo } from "../../types/earthquake";

export class EarthquakeUpdateListEvent extends Event {
  earthquakes: EarthquakeShortInfo[];

  constructor(earthquakes: EarthquakeShortInfo[]) {
    super("update-list");
    this.earthquakes = earthquakes;
  }
}

export class EarthquakeUpdateEvent extends Event {
  earthquake: EarthquakeShortInfo;

  constructor(earthquake: EarthquakeShortInfo) {
    super("update");
    this.earthquake = earthquake;
  }
}


export class EarthquakeUpdateStatusEvent extends Event {
  status: { isPending?: boolean, isLoading?: boolean };

  constructor(status: { isPending?: boolean, isLoading?: boolean }) {
    super("update-status");
    this.status = status;
  }
}

export class EarthquakeUpdateFiltersEvent extends Event {
  filters: EarthquakesDataFilter;

  constructor(filters: EarthquakesDataFilter) {
    super("update-filters");
    this.filters = filters;
  }
}