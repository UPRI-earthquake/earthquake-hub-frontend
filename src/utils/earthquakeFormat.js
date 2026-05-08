import moment from './time';

export function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function formatMagnitude(value) {
  const num = toFiniteNumber(value);
  return num == null ? null : `M${num.toFixed(1).replace(/\.0$/, '')}`;
}

export function formatMagnitudeValue(earthquakeInfo) {
  if (typeof earthquakeInfo?.magnitude === 'number') {
    return earthquakeInfo.magnitude.toFixed(1).replace(/\.0$/, '');
  }
  if (typeof earthquakeInfo?.magnitude_value === 'number') {
    return earthquakeInfo.magnitude_value.toFixed(1).replace(/\.0$/, '');
  }
  return earthquakeInfo?.magnitude;
}

export function formatDepth(value) {
  const num = toFiniteNumber(value);
  return num == null ? null : `${num.toFixed(0)} km`;
}

export function formatCoordinate(value, positiveLabel, negativeLabel, options = {}) {
  const num = toFiniteNumber(value);
  if (num == null) return null;
  const separator = options.separator ?? ' ';
  return `${Math.abs(num).toFixed(3)}${separator}${num >= 0 ? positiveLabel : negativeLabel}`;
}

export function formatEventTimePh(eventTime, includeTimezone = false) {
  const parsed = moment.utc(eventTime);
  if (!parsed || !parsed.isValid()) return 'Date unavailable';
  const suffix = includeTimezone ? ' [UTC+08:00]' : '';
  return parsed.add(8, 'hour').format(`YYYY-MM-DD HH:mm:ss${suffix}`);
}

export function formatEventTimeUtc(eventTime) {
  const parsed = moment.utc(eventTime);
  if (!parsed || !parsed.isValid()) return 'Date unavailable';
  return parsed.format('YYYY-MM-DD HH:mm:ss');
}

export function stripMagnitudePrefix(value) {
  if (!value) return null;
  return String(value).replace(/^M\s*[\d.]+\s*-\s*/i, '').trim();
}
