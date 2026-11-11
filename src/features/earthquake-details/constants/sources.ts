
export const UPRI_FAVICON_URL = '/favicon-32x32.png';

export const SOURCE_DISPLAY = {
  'earthquake-hub': {
    label: 'UPRI',
    abbreviation: 'UP',
    iconUrl: UPRI_FAVICON_URL,
  },
  'upri-current': {
    label: 'UPRI',
    abbreviation: 'UP',
    iconUrl: UPRI_FAVICON_URL,
  },
  'upri-legacy': {
    label: 'UPRI Legacy',
    abbreviation: 'UL',
    iconUrl: UPRI_FAVICON_URL,
  },
  'legacy-old-server': {
    label: 'UPRI Legacy',
    abbreviation: 'UL',
    iconUrl: UPRI_FAVICON_URL,
  },
  phivolcs: {
    label: 'PHIVOLCS',
    abbreviation: 'PH',
    iconUrl: 'https://earthquake.phivolcs.dost.gov.ph/favicon.ico',
  },
  usgs: {
    label: 'USGS',
    abbreviation: 'US',
    iconUrl: 'https://earthquake.usgs.gov/favicon.ico',
  },
};

export const MATCH_QUALITY_LABELS = {
  high: 'Strong match',
  medium: 'Likely match',
  low: 'Possible match',
};

export const MATCH_QUALITY_THRESHOLDS = {
  high: { timeMinutes: 2, distanceKm: 100, magnitude: 0.5 },
  medium: { timeMinutes: 5, distanceKm: 250, magnitude: 1 },
  low: { timeMinutes: 10, distanceKm: 500, magnitude: 1.5 },
};

export const CATALOG_CONTENT_FIELDS = [
  'dateTime',
  'detailUrl',
  'id',
  'title',
  'place',
  'location',
  'url',
  'detail',
  'queryUrl',
  'time',
  'latitude',
  'longitude',
  'depth',
  'depthKm',
  'magnitude',
  'distanceKm',
  'timeDifferenceMinutes',
  'magnitudeDifference',
  'score',
];
