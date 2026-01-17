/**
 * Resolve the backend base URL from runtime (window.ENV) or build-time env vars.
 * Keeps a single source of truth for the frontend to reach the API regardless of
 * production runtime injection or local .env usage.
 *
 * @returns {string|undefined} backend base URL (no trailing slash)
 */
export function getBackendHost() {
  const runtimeEnv =
    typeof window !== 'undefined' ? window.ENV || window['ENV'] || {} : {};
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    return runtimeEnv.REACT_APP_BACKEND || process.env.REACT_APP_BACKEND;
  }

  return (
    runtimeEnv.REACT_APP_BACKEND_DEV ||
    runtimeEnv.REACT_APP_BACKEND ||
    process.env.REACT_APP_BACKEND_DEV ||
    process.env.REACT_APP_BACKEND
  );
}

export default getBackendHost;
