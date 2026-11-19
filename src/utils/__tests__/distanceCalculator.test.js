import { calculateDistance } from '../../utils/distanceCalculator';

describe('calculateDistance', () => {
  test('returns 0 for identical coordinates', () => {
    expect(calculateDistance(14.5, 121.0, 14.5, 121.0)).toBe(0);
  });

  test('is symmetric: distance A→B equals B→A', () => {
    const ab = calculateDistance(14.5, 121.0, 10.3, 123.8);
    const ba = calculateDistance(10.3, 123.8, 14.5, 121.0);
    expect(ab).toBeCloseTo(ba, 5);
  });

  test('computes a known reference distance (Manila to Cebu City ≈ 571 km)', () => {
    // Manila: 14.5995°N, 120.9842°E  |  Cebu City: 10.3157°N, 123.8854°E
    const dist = calculateDistance(14.5995, 120.9842, 10.3157, 123.8854);
    expect(dist).toBeGreaterThan(560);
    expect(dist).toBeLessThan(585);
  });

  test('handles the origin point (0°, 0°) to itself', () => {
    expect(calculateDistance(0, 0, 0, 0)).toBe(0);
  });
});
