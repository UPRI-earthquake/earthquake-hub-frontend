import { generateEventSummary } from '../../utils/generateEventSummary';

describe('generateEventSummary', () => {
  test('returns empty string for null or undefined input', () => {
    expect(generateEventSummary(null)).toBe('');
    expect(generateEventSummary(undefined)).toBe('');
  });

  test('includes magnitude and depth in the output', () => {
    const info = { magnitude: 5.2, depth: 10, eventTime: '2025-01-15T08:30:00Z' };
    const result = generateEventSummary(info);
    expect(result).toContain('magnitude 5.2');
    expect(result).toContain('depth of 10 km');
  });

  test('formats time as UTC HH:MM:SS from ISO string', () => {
    const info = { magnitude: 5.0, depth: 5, eventTime: '2025-06-20T14:32:10Z' };
    const result = generateEventSummary(info);
    expect(result).toContain('14:32:10 UTC+00:00');
  });

  test('parses standard proximity place format into a human-readable phrase', () => {
    const info = {
      magnitude: 6.2,
      place: '67 km N 87 E of Cagwait',
      depth: 15,
      eventTime: '2025-01-15T08:30:00Z',
    };
    const result = generateEventSummary(info);
    expect(result).toContain('67 km N 87 E of Cagwait');
  });

  test('falls back to rawPlace when place does not match proximity pattern', () => {
    const info = {
      magnitude: 5.0,
      place: 'Mindanao, Philippines',
      depth: 20,
      eventTime: '2025-01-15T08:30:00Z',
    };
    const result = generateEventSummary(info);
    expect(result).toContain('Mindanao, Philippines');
  });

  test('uses location field when place is absent', () => {
    const info = {
      magnitude: 4.5,
      location: 'Philippine Islands Region',
      depth: 30,
      eventTime: '2025-01-15T08:30:00Z',
    };
    const result = generateEventSummary(info);
    expect(result).toContain('Philippine Islands Region');
  });

  test('generates "was detected" phrase when no location context is available', () => {
    const info = { magnitude: 3.0, depth: 5, eventTime: '2025-01-15T08:30:00Z' };
    const result = generateEventSummary(info);
    expect(result).toContain('earthquake was detected');
  });

  test('includes coordinates when latitude_value and longitude_value are present', () => {
    const info = {
      magnitude: 5.5,
      latitude_value: 14.5,
      longitude_value: 121.0,
      depth: 10,
      eventTime: '2025-01-15T08:30:00Z',
    };
    const result = generateEventSummary(info);
    expect(result).toContain('14.500°N');
    expect(result).toContain('121.000°E');
  });

  test('omits coordinate sentence when coordinates are missing', () => {
    const info = { magnitude: 5.0, depth: 10, eventTime: '2025-01-15T08:30:00Z' };
    const result = generateEventSummary(info);
    expect(result).not.toContain('latitude');
  });
});
