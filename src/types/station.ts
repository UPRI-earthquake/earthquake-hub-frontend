declare global {
  type StationActivity = "active" | "inactive" | "streaming" | "online" | "offline" | "not streaming" | "unlinked";
  type StationActivityCanonical = "active" | "inactive" | "unlinked" | "";
}

export {};