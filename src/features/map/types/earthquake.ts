export interface EarthquakeShortInfo {
  OT: string;
  publicID: string;
}

export interface EarthquakesDataFilter {
  searchText?: string;
  scope?: "all" | "latest";
  magMin?: number;
  magMax?: number;
  startDate?: string;
  endDate?: string;
}

export namespace SSEPayload {
  export interface Earthquake {
    publicID: string,
    OT: string,
    depth_value: number,
    eventType: string,
    last_modification: string,
    latitude_value: number,
    longitude_value: number,
    magnitude_value: number,
    method: string,
    place: string,
    text: string
  }
}
