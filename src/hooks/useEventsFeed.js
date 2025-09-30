import { useCallback, useRef } from 'react';
import axios from 'axios';
import moment from 'moment';
import { EventSourcePolyfill } from 'event-source-polyfill';

function backendHost() {
  return (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) === 'production'
    ? window['ENV'].REACT_APP_BACKEND
    : window['ENV'].REACT_APP_BACKEND_DEV;
}

/**
 * Events feed helper: fetch ranges and wire SSE into a shared setEvents state.
 */
export function useEventsFeed({ sseEnabledRef, setEvents }) {
  const eventSourceRef = useRef(null);

  const fetchEventsForRange = useCallback(
    async (startDateISO, endDateISO) => {
      const startTs = moment(startDateISO).startOf('day').format('YYYY-MM-DD HH:mm:ss');
      const endTs = moment(endDateISO).endOf('day').format('YYYY-MM-DD HH:mm:ss');
      try {
        axios.defaults.withCredentials = true;
      } catch (_) {}
      const res = await axios.get(`${backendHost()}/eq-events`, {
        params: { startTime: startTs, endTime: endTs },
      });
      const arr = (res.data?.payload || []).slice();
      setEvents(arr);
      return arr;
    },
    [setEvents],
  );

  const bindSSE = useCallback(() => {
    const src = new EventSourcePolyfill(`${backendHost()}/messaging`);
    eventSourceRef.current = src;
    const onError = () => {
      if (
        (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) !== 'production'
      ) {
        // eslint-disable-next-line no-console
        console.warn('EventSource error (may be reconnecting)');
      }
    };
    src.addEventListener('error', onError);

    const onSC = (event) => {
      try {
        if (!sseEnabledRef.current) return;
        const data = JSON.parse(event.data);
        const depthVal =
          data.depth_km ?? data.depthKm ?? data.depth_value ?? data.depthValue ?? data.depth;
        if (data.eventType === 'NEW') {
          setEvents((prev) => {
            const idx = prev.findIndex((e) => e.publicID === data.publicID);
            const nextEvent = {
              publicID: data.publicID,
              OT: data.OT,
              latitude_value: data.latitude_value,
              longitude_value: data.longitude_value,
              magnitude_value: data.magnitude_value,
              depth_km: depthVal,
              eventType: 'NEW',
              last_modification: data.last_modification,
            };
            if (idx !== -1) {
              const copy = prev.slice();
              copy[idx] = { ...prev[idx], ...nextEvent };
              return copy;
            }
            return [nextEvent, ...prev];
          });
        } else if (data.eventType === 'UPDATE') {
          setEvents((prev) =>
            prev.map((ev) => {
              if (ev.publicID !== data.publicID) return ev;
              const mergedDepth =
                depthVal ??
                ev.depth_km ??
                ev.depthKm ??
                ev.depth_value ??
                ev.depthValue ??
                ev.depth ??
                null;
              return {
                ...ev,
                OT: data.OT ?? ev.OT,
                latitude_value: data.latitude_value ?? ev.latitude_value,
                longitude_value: data.longitude_value ?? ev.longitude_value,
                magnitude_value: data.magnitude_value ?? ev.magnitude_value,
                depth_km: mergedDepth,
                eventType: 'UPDATE',
                last_modification: data.last_modification ?? ev.last_modification,
              };
            }),
          );
        }
      } catch (err) {
        if (
          (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) !== 'production'
        ) {
          // eslint-disable-next-line no-console
          console.warn('SC_EVENT parse/handle error', err);
        }
      }
    };
    src.addEventListener('SC_EVENT', onSC);

    const unbind = () => {
      try {
        src.removeEventListener('error', onError);
      } catch (_) {}
      try {
        src.removeEventListener('SC_EVENT', onSC);
      } catch (_) {}
    };

    return { unbind };
  }, [setEvents, sseEnabledRef]);

  const closeSSE = useCallback(() => {
    if (eventSourceRef.current) {
      try {
        eventSourceRef.current.close();
      } catch (_) {}
      eventSourceRef.current = null;
    }
  }, []);

  return { eventSourceRef, fetchEventsForRange, bindSSE, closeSSE };
}
