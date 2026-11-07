import moment from './time';
import { PH_BOUNDS } from './resetView';

export const LATEST_EVENT_COUNT = 30;
export const EARLIEST_EVENT_DATE = '1900-01-01';

// Use the same regional bounds as the Philippines map, including offshore events.
export function selectLatestPhilippineEvents(events) {
  return events
    .filter((event) => {
      const lat = Number(event.latitude_value);
      const lon = Number(event.longitude_value);
      return (
        lat >= PH_BOUNDS[0][0] && lat <= PH_BOUNDS[1][0] &&
        lon >= PH_BOUNDS[0][1] && lon <= PH_BOUNDS[1][1] &&
        Number.isFinite(new Date(event.OT).getTime())
      );
    })
    .sort((a, b) => new Date(b.OT) - new Date(a.OT))
    .slice(0, LATEST_EVENT_COUNT);
}

// Search progressively older, non-overlapping windows using the existing API.
// Stop at the same catalogue boundary used by the All tab.
export async function loadLatestPhilippineEvents(fetchRange, now = moment()) {
  let end = now.endOf('day');
  let windowDays = 30;
  let events = [];
  const earliest = moment(EARLIEST_EVENT_DATE);
  while (end.valueOf() >= earliest.valueOf()) {
    const candidate = end.subtract(windowDays - 1, 'days').startOf('day');
    const start = candidate.valueOf() < earliest.valueOf() ? earliest : candidate;
    const batch = await fetchRange(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'), {
      setState: false,
    });
    const unique = new Map([...events, ...batch].map((event) => [event.publicID, event]));
    events = selectLatestPhilippineEvents([...unique.values()]);
    if (events.length >= LATEST_EVENT_COUNT) break;
    end = start.subtract(1, 'day').endOf('day');
    windowDays *= 2;
  }
  return events;
}
