import getBackendHost from './backendHost';

// Helpers to safely read runtime env values from window.ENV (created by public/config.js)
// NOTE: We assume .env and public/config.js are configured correctly in each environment.
// Therefore we intentionally avoid providing hard-coded defaults here.
// If a value is missing, these helpers will return an empty string.
export function getEnv(key) {
  try {
    const v = (typeof window !== 'undefined' && window.ENV && window.ENV[key]) || '';
    return v != null ? v : '';
  } catch (_) {
    return '';
  }
}

export function backendHost() {
  return getBackendHost() || '';
}

export function ringserverWS() {
  const isProd =
    typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production';
  return isProd ? getEnv('REACT_APP_RINGSERVER_WS') : getEnv('REACT_APP_RINGSERVER_WS_DEV');
}
