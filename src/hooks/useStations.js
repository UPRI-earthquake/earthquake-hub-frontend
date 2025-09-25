import { useCallback } from 'react';
import axios from 'axios';

function backendHost() {
  return (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) === 'production'
    ? window['ENV'].REACT_APP_BACKEND
    : window['ENV'].REACT_APP_BACKEND_DEV;
}

/**
 * Stations data helper. Provides a fetch function returning the array of stations.
 */
export function useStations() {
  const fetchStations = useCallback(async () => {
    try {
      axios.defaults.withCredentials = true;
    } catch (_) {}
    const res = await axios.get(`${backendHost()}/device/all`);
    const arr = res.data?.payload || [];
    return arr.map((s) => ({ ...s, isPicked: false }));
  }, []);

  return { fetchStations };
}
