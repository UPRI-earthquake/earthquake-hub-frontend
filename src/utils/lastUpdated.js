/*
 Utility to determine "Last updated" for CDN GitHub GeoJSON sources.
 Primary: GitHub Commits API filtered by path+sha.
 Fallback: HTTP HEAD Last-Modified on the CDN URL.
*/

const MEMORY_CACHE = new Map();

function cacheKeyFromParts(parts) {
  const { owner, repo, path, ref, cdnUrl } = parts || {};
  if (owner && repo && path && ref) return `gh:${owner}/${repo}@${ref}:${path}`;
  if (cdnUrl) return `cdn:${cdnUrl}`;
  return null;
}

function getSessionCache(key) {
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(`lastUpdated:${key}`);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj && obj.expiresAt && Date.now() < obj.expiresAt) return obj.value;
    return null;
  } catch (_) {
    return null;
  }
}

function setSessionCache(key, value, ttlMs) {
  if (!key) return;
  try {
    const obj = { value, expiresAt: Date.now() + (ttlMs || 0) };
    sessionStorage.setItem(`lastUpdated:${key}`, JSON.stringify(obj));
  } catch (_) {}
}

/**
 * Parse a jsDelivr GitHub URL into { owner, repo, ref, path } parts.
 */
export function parseJsDelivrGitHubUrl(url) {
  // Example: https://cdn.jsdelivr.net/gh/<owner>/<repo>@<ref>/<path>
  try {
    const u = new URL(String(url));
    if (u.hostname !== 'cdn.jsdelivr.net') return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const ghIndex = parts.indexOf('gh');
    if (ghIndex === -1) return null;
    const owner = parts[ghIndex + 1];
    const repoAndRef = parts[ghIndex + 2];
    if (!owner || !repoAndRef) return null;
    const [repo, refRaw] = repoAndRef.split('@');
    const ref = refRaw || 'master';
    const path = parts.slice(ghIndex + 3).join('/');
    return { owner, repo, ref, path };
  } catch (_) {
    return null;
  }
}

/**
 * Build a jsDelivr GitHub URL from parts.
 */
export function jsDelivrFromParts({ owner, repo, ref, path }) {
  if (!owner || !repo || !ref || !path) return null;
  return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${ref}/${path}`;
}

function toLocalManila(date) {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (!d || Number.isNaN(d.getTime())) return null;
    const fmt = new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Manila',
    });
    return fmt.format(d);
  } catch (_) {
    return null;
  }
}

async function fetchGitHubCommit({ owner, repo, path, ref, token, signal }) {
  const q = new URLSearchParams({ path, sha: ref, per_page: '1' }).toString();
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?${q}`;
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers, signal });
  if (!res.ok) {
    const err = new Error(`GitHub API error ${res.status}`);
    err.status = res.status; // may be 403 rate-limited, 404 path not found, etc.
    err.headers = res.headers;
    throw err;
  }
  const arr = await res.json();
  if (!Array.isArray(arr) || arr.length === 0) {
    const err = new Error('GitHub API returned empty list');
    err.status = 404;
    throw err;
  }
  const item = arr[0];
  const date = item?.commit?.committer?.date || item?.commit?.author?.date;
  const sha = item?.sha;
  const html_url = item?.html_url;
  if (!date || !sha) throw new Error('Missing date or sha in GitHub response');
  return { isoDate: date, sha, html_url };
}

async function fetchCdnLastModified(cdnUrl, signal) {
  const res = await fetch(cdnUrl, { method: 'HEAD', cache: 'no-cache', signal });
  if (!res.ok) throw new Error(`HEAD failed ${res.status}`);
  const lm = res.headers.get('Last-Modified') || res.headers.get('last-modified');
  if (!lm) throw new Error('No Last-Modified header');
  const isoDate = new Date(lm).toISOString();
  return { isoDate };
}

/**
 * Determine last updated metadata, preferring GitHub commits API then falling back
 * to CDN Last-Modified header. Caches results in-memory and in sessionStorage.
 */
export async function getLastUpdated(meta, opts = {}) {
  const { owner, repo, path, ref, cdnUrl } = meta || {};
  const token =
    opts.token ||
    (typeof process !== 'undefined' && process.env && process.env.REACT_APP_GITHUB_TOKEN);
  const ttlMs = opts.ttlMs != null ? opts.ttlMs : 6 * 60 * 60 * 1000; // 6 hours
  const key = cacheKeyFromParts({ owner, repo, path, ref }) || cacheKeyFromParts({ cdnUrl });

  // Memory cache
  if (MEMORY_CACHE.has(key)) return MEMORY_CACHE.get(key);
  // Session cache
  const ses = getSessionCache(key);
  if (ses) {
    MEMORY_CACHE.set(key, ses);
    return ses;
  }

  const controller = new AbortController();
  const { signal } = controller;

  // Try GitHub first with up to 2 attempts (backoff)
  for (let i = 0; i < 2; i++) {
    try {
      const gh = await fetchGitHubCommit({ owner, repo, path, ref, token, signal });
      const value = {
        source: 'github',
        isoDate: gh.isoDate,
        displayDate: toLocalManila(gh.isoDate),
        commitSha: String(gh.sha).slice(0, 7),
        commitUrl: gh.html_url,
        tooltip: 'Based on the last commit that changed this file in GitHub.',
      };
      MEMORY_CACHE.set(key, value);
      setSessionCache(key, value, ttlMs);
      return value;
    } catch (e) {
      // Rate limit or transient: simple exponential backoff then retry once
      await new Promise((r) => setTimeout(r, (i + 1) * 400));
    }
  }

  // Fallback: HEAD Last-Modified
  try {
    const cdn = await fetchCdnLastModified(
      cdnUrl || jsDelivrFromParts({ owner, repo, ref, path }),
      signal,
    );
    const value = {
      source: 'cdn',
      isoDate: cdn.isoDate,
      displayDate: toLocalManila(cdn.isoDate),
      commitSha: null,
      commitUrl: null,
      tooltip: 'Fallback to CDN Last-Modified header; may not match repo history.',
    };
    MEMORY_CACHE.set(key, value);
    setSessionCache(key, value, ttlMs);
    return value;
  } catch (e) {
    // Final: unknown
    const value = {
      source: 'unknown',
      isoDate: null,
      displayDate: null,
      commitSha: null,
      commitUrl: null,
      tooltip: 'Last updated is unknown; GitHub and CDN metadata unavailable.',
    };
    MEMORY_CACHE.set(key, value);
    setSessionCache(key, value, ttlMs);
    return value;
  }
}

/** Format a human-friendly last updated string from a result object. */
export function formatLastUpdated(result) {
  if (!result) return 'Last updated: Unknown';
  const base = result.displayDate ? `Last updated: ${result.displayDate}` : 'Last updated: Unknown';
  if (result.source === 'github' && result.commitSha) {
    return `${base} (${result.commitSha})`;
  }
  if (result.source === 'cdn') {
    return `${base} (from CDN header)`;
  }
  return base;
}

/** Shortcut to parse parts while retaining original cdnUrl. */
export function partsForCdnUrl(cdnUrl) {
  const gh = parseJsDelivrGitHubUrl(cdnUrl) || {};
  return { ...gh, cdnUrl };
}

export function _testInternals() {
  // exposed for unit tests
  return { parseJsDelivrGitHubUrl, jsDelivrFromParts, toLocalManila };
}
