import { getLastUpdated, parseJsDelivrGitHubUrl, jsDelivrFromParts, partsForCdnUrl, formatLastUpdated, _testInternals } from '../../utils/lastUpdated';

describe('lastUpdated utils', () => {
  const { toLocalManila } = _testInternals();

  beforeEach(() => {
    jest.spyOn(global, 'fetch');
    sessionStorage.clear();
  });

  afterEach(() => {
    global.fetch.mockRestore();
  });

  test('parse and build jsDelivr GitHub URL', () => {
    const url = 'https://cdn.jsdelivr.net/gh/owner/repo@v1.2.3/data/file.geojson';
    const p = parseJsDelivrGitHubUrl(url);
    expect(p).toEqual({ owner: 'owner', repo: 'repo', ref: 'v1.2.3', path: 'data/file.geojson' });
    const back = jsDelivrFromParts(p);
    expect(back).toBe(url);
  });

  test('GitHub commit preferred over CDN', async () => {
    const cdnUrl = 'https://cdn.jsdelivr.net/gh/a2/b2@main/c2.geojson';
    const parts = partsForCdnUrl(cdnUrl);

    // 1st call: GitHub commits
    global.fetch.mockImplementationOnce(async () => ({
      ok: true,
      json: async () => ([{ sha: 'abcdef1234567890', html_url: 'https://github/commit/abcdef1', commit: { committer: { date: '2020-01-02T03:04:05Z' } } }]),
    }));

    const res = await getLastUpdated(parts, { ttlMs: 1000 });
    expect(res.source).toBe('github');
    expect(res.commitSha).toBe('abcdef1');
    expect(res.displayDate).toBe(toLocalManila('2020-01-02T03:04:05Z'));
  });

  test('Fallback to CDN Last-Modified when GitHub fails', async () => {
    const cdnUrl = 'https://cdn.jsdelivr.net/gh/a3/b3@main/c3.geojson';
    const parts = partsForCdnUrl(cdnUrl);

    const h1 = { get: () => null };
    const h2 = { get: (k) => (String(k).toLowerCase() === 'last-modified' ? 'Mon, 31 Aug 2020 12:00:00 GMT' : null) };
    global.fetch.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('api.github.com')) return { ok: false, status: 403, headers: h1 };
      // fallback HEAD on CDN
      return { ok: true, headers: h2 };
    });

    const res = await getLastUpdated(parts, { ttlMs: 1000 });
    expect(res.source).toBe('cdn');
    expect(res.displayDate).toBeDefined();
  });

  test('Unknown when neither source returns usable data', async () => {
    const cdnUrl = 'https://cdn.jsdelivr.net/gh/a/b@main/c.geojson';
    const parts = partsForCdnUrl(cdnUrl);

    const h = { get: () => null };
    global.fetch.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('api.github.com')) return { ok: false, status: 500, headers: h };
      return { ok: true, headers: h };
    });

    const res = await getLastUpdated(parts, { ttlMs: 1000 });
    expect(res.source).toBe('unknown');
    expect(formatLastUpdated(res)).toMatch(/Unknown/);
  });
});
