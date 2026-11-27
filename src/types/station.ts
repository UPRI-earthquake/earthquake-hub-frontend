declare global {
  type StationActivity = "active" | "inactive" | "streaming" | "online" | "offline" | "not streaming" | "unlinked";
  type StationStatus = "streaming" | "not streaming";
  type StationActivityCanonical = "active" | "inactive" | "unlinked" | "";
}

export {};