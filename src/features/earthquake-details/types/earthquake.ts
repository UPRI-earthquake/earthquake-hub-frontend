export type EarthquakeRecordingAvailabilityStatus = "verified" | "pending" | "unavailable";
export interface EarthquakeInfo {
  __v: number;
  summaryOverride?: {
    text?: string;
  } | null;
  _id: string;
  publicID: string;
  OT: string;
  createdAt: string;
  depth_value: number;
  last_modification: string;
  latitude_value: number;
  longitude_value: number;
  magnitude_value: number;
  text: string;
  type: string;
  updatedAt: string;
  onlineStations: string[];
  enrichmentAttempts: number;
  upForEnrichment: boolean;
  additionalInformation: {
    source: string;
    sourceLabel: string;
    sourceIconUrl: string
    dateTime: string;
    detailUrl: string;
    hasFeltIntensity: boolean;
    time: string;
    latitude: number;
    longitude: number;
    depthKm: number;
    magnitude: number;
    location: string;
    distanceKm: number;
    timeDifferenceMinutes: number;
    magnitudeDifference: number;
    score: number;
    matchQuality: string;
  }[];
  
  candidateStations: string[];

  catalogEnrichmentAttempts: {
      phivolcs: number;
      usgs: number;
  };
  catalogEnrichmentStatus: {
      phivolcs: string;
      usgs: string;
  },
  isLegacyRecord: boolean;
  legacyImportedAt: string;
  legacySourcePublicID: string;
  pendingCatalogSources: string[],
  recordingAvailabilityAttempts: number;
  recordingAvailabilityStatus: EarthquakeRecordingAvailabilityStatus;
  recordingStations: string[];
  sourceCatalog: string;
  sourceServer: string;
  place: string;
  recordingAvailabilityCheckedAt: string;


  /** LEGACY FIELDS */
  eventSummary?: string;
  updated?: string;
  modified?: string;
  eventTime?: string;
  id?: string;
  event_id?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  depth_km?: number;
  depth?: number;
  magnitude?: number;
  mag?: number;
  magnitudeValue?: number;
  title?: string;
  location?: string;
}

export interface RemoteTimelyEarthquakeEntry {
  publicID: string;
  latitude_value: number;
  longitude_value: number;
  OT: string;

  /** LEGACY FIELDS */
  eventTime?: string;
}

export interface RelatedEarthquakeEntry {
  distance: number;
  timeDeltaMinutes: number;
  publicID: string;
  latitude_value: number;
  longitude_value: number;
  OT: string;
  eventTime?: string;
}



export interface EarthquakeReportComment {
  commentId: string;
  username: string;
  content: string;
  imageURL: string;
  helpfulCount: number;
  viewerHasMarkedHelpful: boolean;
  createdAt: string;
  updatedAt: string;


  /** LEGACY FIELDS */
  id?: string;
  _id?: string;

  comment?: string;
  description?: string;
  report?: string;
  text?: string;

  imageUrl?: string;
  image?: string;
  photoUrl?: string;
  photo?: string;
  attachmentUrl?: string;

  author?: string;
  user?: {
    username?: string;
    name?: string;
  };

  helpful_count?: number;
  viewer_has_marked_helpful?: boolean;

  anonymous?: boolean;
  isAnonymous?: boolean;

  created_at?: boolean;
  timestamp?: boolean;
  date?: boolean;
}
