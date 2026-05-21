import {
  formatCoordinate,
  formatDepth,
  formatEventTimePh,
  formatEventTimeUtc,
  formatMagnitude,
  formatMagnitudeValue,
  stripMagnitudePrefix,
  toFiniteNumber,
} from '../earthquakeFormat';

describe('earthquakeFormat utilities', () => {
  test('formats magnitudes consistently', () => {
    expect(formatMagnitude(7)).toBe('M7');
    expect(formatMagnitude(7.35)).toBe('M7.3');
    expect(formatMagnitude('not-a-number')).toBeNull();
    expect(formatMagnitudeValue({ magnitude_value: 6.4 })).toBe('6.4');
    expect(formatMagnitudeValue({ magnitude: 5 })).toBe('5');
  });

  test('formats depth and coordinates', () => {
    expect(formatDepth(35.4)).toBe('35 km');
    expect(formatDepth(null)).toBeNull();
    expect(formatCoordinate(1.1172, 'N', 'S')).toBe('1.117 N');
    expect(formatCoordinate(-126.2962, 'E', 'W')).toBe('126.296 W');
    expect(formatCoordinate(0.85, 'N', 'S', { separator: '°' })).toBe('0.850°N');
  });

  test('formats UTC and UTC+08 event times', () => {
    expect(formatEventTimeUtc('2026-04-02T00:48:13.000Z')).toBe('2026-04-02 00:48:13');
    expect(formatEventTimePh('2026-04-02T00:48:13.000Z')).toBe('2026-04-02 08:48:13');
    expect(formatEventTimePh('2026-04-02T00:48:13.000Z', true)).toBe('2026-04-02 08:48:13 UTC+08:00');
  });

  test('parses finite numbers and strips redundant magnitude prefixes', () => {
    expect(toFiniteNumber('7.4')).toBe(7.4);
    expect(toFiniteNumber(undefined)).toBeNull();
    expect(stripMagnitudePrefix('M 7.4 - 126 km WNW of Ternate, Indonesia')).toBe('126 km WNW of Ternate, Indonesia');
    expect(stripMagnitudePrefix('126 km WNW of Ternate, Indonesia')).toBe('126 km WNW of Ternate, Indonesia');
  });
});
