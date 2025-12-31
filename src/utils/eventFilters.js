import moment from './time';

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const eventDepth = (event) =>
  event?.depth_km ?? event?.depthKm ?? event?.depth_value ?? event?.depthValue ?? event?.depth;

export function matchesEventFilters(event, filters = {}) {
  const mag = toNumber(event?.magnitude_value);
  const magMin = typeof filters.magMin === 'number' ? filters.magMin : -Infinity;
  const magMax = typeof filters.magMax === 'number' ? filters.magMax : Infinity;
  const text = String(filters.searchText || '').trim().toLowerCase();

  const isClosedRange =
    Number.isFinite(magMin) && Number.isFinite(magMax) && Math.abs(magMax - magMin) < 1e-9;
  const magnitude = Number.isFinite(mag) ? mag : 0;
  if (isClosedRange) {
    const target = Math.round(magMin * 10) / 10;
    const roundedMag = Math.round(magnitude * 10) / 10;
    if (roundedMag !== target) return false;
  } else {
    if (Number.isFinite(magMin) && magnitude < magMin) return false;
    if (Number.isFinite(magMax) && magnitude > magMax) return false;
  }

  const start = filters.startDate ? moment(filters.startDate, 'YYYY-MM-DD') : null;
  const end = filters.endDate ? moment(filters.endDate, 'YYYY-MM-DD').endOf('day') : null;
  const originTime = event?.OT ? moment(event.OT) : null;
  if (start && originTime && originTime.isBefore(start)) return false;
  if (end && originTime && originTime.isAfter(end)) return false;

  if (text) {
    const hay = `${event?.place || ''} ${event?.text || ''}`.toLowerCase();
    if (!hay.includes(text)) return false;
  }

  return true;
}

export function filterEvents(events, filters) {
  return (events || []).filter((ev) => matchesEventFilters(ev, filters));
}

export function sortEvents(events, sort = { by: 'time', order: 'desc' }) {
  const by = sort?.by || 'time';
  const dir = sort?.order === 'asc' ? 1 : -1;
  const arr = (events || []).slice();
  arr.sort((a, b) => {
    if (by === 'mag') {
      const av = toNumber(a?.magnitude_value) ?? 0;
      const bv = toNumber(b?.magnitude_value) ?? 0;
      return (av - bv) * dir;
    }
    if (by === 'depth') {
      const av = toNumber(eventDepth(a)) ?? Infinity;
      const bv = toNumber(eventDepth(b)) ?? Infinity;
      return (av - bv) * dir;
    }
    const at = a?.OT ? new Date(a.OT).getTime() : 0;
    const bt = b?.OT ? new Date(b.OT).getTime() : 0;
    return (at - bt) * dir;
  });
  return arr;
}

export const filterAndSortEvents = (events, filters, sort) =>
  sortEvents(filterEvents(events, filters), sort);
