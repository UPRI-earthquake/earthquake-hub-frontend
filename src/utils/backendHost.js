/**
 * Resolve the backend base URL from runtime (window.ENV) or build-time env vars.
 * Keeps a single source of truth for the frontend to reach the API regardless of
 * production runtime injection or local .env usage.
 *
 * @returns {string|undefined} backend base URL (no trailing slash)
 */
export function normalizeBackendHost(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/+$/, '');
}

export function getBackendHost() {
  const runtimeEnv =
    typeof window !== 'undefined' ? window.ENV || window['ENV'] || {} : {};
  const isProd = process.env.NODE_ENV === 'production';
  const backend = isProd
    ? runtimeEnv.REACT_APP_BACKEND || process.env.REACT_APP_BACKEND
    : runtimeEnv.REACT_APP_BACKEND_DEV ||
      runtimeEnv.REACT_APP_BACKEND ||
      process.env.REACT_APP_BACKEND_DEV ||
      process.env.REACT_APP_BACKEND;

  return normalizeBackendHost(backend);
}

export default getBackendHost;
