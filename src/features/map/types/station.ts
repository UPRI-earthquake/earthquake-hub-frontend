export interface Station {
  network: string;
  code: string;
  latitude: number;
  longitude: number;
  activity: StationActivity;
  description: string;
  status?: string;
  statusSince?: string;

  /** LEGACY FIELDS */
  station?: string;
  activityToggleTime?: string;
  lastActive?: string;
}

export interface StationsDataFilter {
  searchText?: string;
  statusFilter?: null | "active" | "inactive";
}