function formatDate(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (isNaN(date)) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (isNaN(date)) return '—';
  return date.toISOString().substring(11, 19); 
}

function formatMagnitude(value) {
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(num)) return '—';
  return num.toFixed(1).replace(/\.0$/, '');
}

function formatDepth(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(0) : '—';
}

function formatCoordinate(value, positiveDir, negativeDir) {
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(num)) return null;
  const dir = num >= 0 ? positiveDir : negativeDir;
  return `${Math.abs(num).toFixed(3)}°${dir}`;
}

function parseProximity(placeString) {
  if (!placeString || placeString === 'Unavailable') return null;

  const match = placeString?.match(/^(\d+)\s*km\s+(.+?)\s+of\s+(.+)$/i);
  if (!match) return null; 

  return {
    full: placeString,                        
    distance: `${parseInt(match[1], 10)} km`, 
    direction: match[2].trim(),               
    locality: match[3].trim(),                
  };
}


export function generateEventSummary(earthquakeInfo) {
  if (!earthquakeInfo) return '';

  const magnitude =
    typeof earthquakeInfo.magnitude === 'number'
      ? formatMagnitude(earthquakeInfo.magnitude)
      : typeof earthquakeInfo.magnitude_value === 'number'
      ? formatMagnitude(earthquakeInfo.magnitude_value)
      : '—';

  const rawPlace = earthquakeInfo.place || '';
  const isPlaceValid = rawPlace && rawPlace !== 'Unavailable';
  const genericLocation = earthquakeInfo.location || earthquakeInfo.text || null;

  let proximityPhrase;
  if (isPlaceValid) {
    const { distance, direction, locality } = parseProximity(rawPlace);
    proximityPhrase =
      distance && direction
        ? `${distance} ${direction} of ${locality}`
        : locality || rawPlace;
  } else if (genericLocation) {
    proximityPhrase = genericLocation;
  } else {
    // Event was detected — coordinates will carry the location context
    proximityPhrase = null;
  }

  // — Time fields (mirrors page's eventTime logic) —
  const eventTime = earthquakeInfo.eventTime || earthquakeInfo.OT;
  const updatedTime = earthquakeInfo.updatedTime || earthquakeInfo.lastUpdate;

  // — Depth (mirrors page's depthValue logic) —
  const depth = formatDepth(earthquakeInfo.depth ?? earthquakeInfo.depth_value);

  // — Coordinates —
  const lat = formatCoordinate(earthquakeInfo.lat, 'N', 'S');
  const lon = formatCoordinate(earthquakeInfo.lon, 'E', 'W');

  // — Assemble sentence 1 —
  const struckPhrase = proximityPhrase
    ? `earthquake struck ${proximityPhrase}`
    : 'earthquake was detected'; // graceful when place is truly absent

  let summary =
    `A magnitude ${magnitude} ${struckPhrase} ` +
    `on ${formatDate(eventTime)}, at ${formatTime(eventTime)} UTC+00:00, ` +
    `with a depth of ${depth} km.`;

  // — Assemble sentence 2 (coordinates) —
  // Only render if we have at least one valid coordinate
  if (lat && lon) {
    summary += ` The earthquake was located at ${lat} latitude and ${lon} longitude`;

    const formattedUpdate = formatTime(updatedTime);
    summary += formattedUpdate !== '—'
      ? `, and was last updated at ${formattedUpdate} UTC+00:00.`
      : '.';
  }

  return summary;
}