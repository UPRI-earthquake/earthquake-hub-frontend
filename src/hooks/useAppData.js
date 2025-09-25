import { useCallback } from 'react';
import moment from 'moment';
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
}) {
  const { fetchStations } = useStations();
  const { eventSourceRef, fetchEventsForRange, bindSSE, closeSSE } = useEventsFeed({
    sseEnabledRef,
    setEvents,
  });

  const performInitialLoad = useCallback(() => {
    let isMounted = true;
    const start_time =
      (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) === 'production'
        ? moment().subtract(1, 'months')
        : moment('2021-09-09 14:30:00.0');

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
    const eventsTask = fetchEventsForRange(
      start_time.format('YYYY-MM-DD HH:mm:ss'),
      moment().format('YYYY-MM-DD HH:mm:ss'),
    )
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
      if (isMounted) {
        if (!okStations && !okEvents) setServerError(true);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      try {
        unbind && unbind();
      } catch (_) {}
      closeSSE();
    };
  }, [
    fetchStations,
    fetchEventsForRange,
    bindSSE,
    closeSSE,
    setStationsRef,
    setLoading,
    setServerError,
  ]);

  return { eventSourceRef, fetchEventsForRange, performInitialLoad };
}
