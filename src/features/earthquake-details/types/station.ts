export interface Station {
  network: string;
  code: string;
  latitude: number;
  longitude: number;
  activity: "active" | "inactive" | "streaming" | "online" | "offline" | "not streaming" | "unlinked";
  description: string;

  /** LEGACY FIELDS */
  station?: string;
}