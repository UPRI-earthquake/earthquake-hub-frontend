import { getNewEarthquakeHubUrl, isLegacyEarthquakeHubHost } from '../OldDomainMigrationNotice';

describe('OldDomainMigrationNotice helpers', () => {
  test('matches only the legacy Earthquake Hub host', () => {
    expect(isLegacyEarthquakeHubHost('earthquake.science.upd.edu.ph')).toBe(true);
    expect(isLegacyEarthquakeHubHost('EARTHQUAKE.SCIENCE.UPD.EDU.PH')).toBe(true);
    expect(isLegacyEarthquakeHubHost('earthquake.up.edu.ph')).toBe(false);
    expect(isLegacyEarthquakeHubHost('localhost')).toBe(false);
  });

  test('preserves path, query, and hash when building the new site URL', () => {
    expect(
      getNewEarthquakeHubUrl({
        pathname: '/earthquake-detail',
        search: '?publicID=abc123',
        hash: '#reports',
      }),
    ).toBe('https://earthquake.up.edu.ph/earthquake-detail?publicID=abc123#reports');
  });
});
