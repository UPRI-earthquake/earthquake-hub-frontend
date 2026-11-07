import { useCallback } from 'react';
import { useStations } from './useStations';
import { useEventsFeed } from './useEventsFeed';

/**
 * Encapsulates initial data loading and SSE wiring for the app.
 * Returns refs and helpers used by HomePage without changing behavior.
 */
export function useAppData({
  sseEnabledRef,
  setEvents,
  setStationsRef,
  setLoading,
  setServerError,
  applyStationUpdate,
}) {
  const { fetchStations } = useStations();
  const { eventSourceRef, fetchEventsForRange, fetchLatestEvents, bindSSE, closeSSE } = useEventsFeed({
    sseEnabledRef,
    setEvents,
  });

  const performInitialLoad = useCallback(() => {
    let isMounted = true;
    const waitingPromise = new Promise((resolve) => setTimeout(resolve, 3000));
    let unbind = null;
    const stationTask = fetchStations()
      .then((arr) => {
        setStationsRef(arr);
        return { ok: true };
      })
      .catch((e) => {
        if (
          (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) !== 'production'
        ) {
          /* eslint-disable-next-line no-console */ console.error('Stations load error', e);
        }
        return { ok: false, error: e };
      });
    const eventsTask = fetchLatestEvents()
      .then(() => ({ ok: true }))
      .catch((e) => {
        if (
          (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) !== 'production'
        ) {
          /* eslint-disable-next-line no-console */ console.error('Events load error', e);
        }
        return { ok: false, error: e };
      });

    Promise.allSettled([stationTask, eventsTask, waitingPromise]).then((results) => {
      const st = results[0]?.value || results[0];
      const ev = results[1]?.value || results[1];
      const okStations = st && st.ok !== false;
      const okEvents = ev && ev.ok !== false;
      const { unbind: un } = bindSSE();
      unbind = un;
      // Attach station-status listeners to the shared EventSource, if provided
      try {
        const src = eventSourceRef.current;
        if (src && typeof src.addEventListener === 'function' && applyStationUpdate) {
          const onStationStatus = (event) => {
            try {
              const data = JSON.parse(event.data);
              applyStationUpdate(data);
            } catch (_) {}
          };
          const names = [
            'STATION_STATUS',
            'SC_STATION_STATUS',
            'SC_STATION',
            'SC_DEVICE',
            'DEVICE_STATUS',
            'STATION_EVENT',
          ];
          names.forEach((n) => src.addEventListener(n, onStationStatus));

          // Save a tiny unbinder on the instance for cleanup
          src.__station_unbind__ = () => {
            try { names.forEach((n) => src.removeEventListener(n, onStationStatus)); } catch (_) {}
          };
        }
      } catch (_) {}
      if (isMounted) {
        if (!okStations && !okEvents) setServerError(true);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      try { unbind && unbind(); } catch (_) {}
      try { eventSourceRef.current && eventSourceRef.current.__station_unbind__ && eventSourceRef.current.__station_unbind__(); } catch (_) {}
      closeSSE();
    };
  }, [
    fetchStations,
    fetchLatestEvents,
    bindSSE,
    closeSSE,
    setStationsRef,
    setLoading,
    setServerError,
    applyStationUpdate,
    eventSourceRef,
  ]);

  return { eventSourceRef, fetchEventsForRange, fetchLatestEvents, performInitialLoad, fetchStations };
}
