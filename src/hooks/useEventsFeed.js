import { useCallback, useRef } from 'react';
import axios from 'axios';
import moment from '../utils/time';
// Performance: avoid shipping the EventSource polyfill to modern browsers.
// We dynamically import it only if the native API is unavailable.
function backendHost() {
  return (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) === 'production'
    ? window['ENV'].REACT_APP_BACKEND
    : window['ENV'].REACT_APP_BACKEND_DEV;
}

// Choose the best doc among duplicates that represent the same event.
// Preference: UPDATE > NEW, then by newest last_modification, then newest OT.
const pickBest = (arr) => {
  const score = (ev) => {
    const isUpd = String(ev?.eventType || '').toUpperCase() === 'UPDATE' ? 1 : 0;
    const lm = ev?.last_modification ? new Date(ev.last_modification).getTime() : 0;
    const ot = ev?.OT ? new Date(ev.OT).getTime() : 0;
    return [isUpd, lm, ot];
  };
  return arr.slice().sort((a, b) => {
    const as = score(a);
    const bs = score(b);
    for (let i = 0; i < as.length; i += 1) {
      const d = bs[i] - as[i];
      if (d) return d; // descending
    }
    return 0;
  })[0];
};

// Dedupe initial payload by publicID only (assuming stable IDs from upstream).
const dedupeInitial = (input) => {
  const list = Array.isArray(input) ? input : [];
  if (!list.length) return [];
  const groups = new Map();
  const passthrough = [];
  for (const ev of list) {
    const id = ev && ev.publicID;
    if (id == null || id === '' || id === 'null' || id === 'undefined') {
      // Keep items without a usable id as-is
      passthrough.push(ev);
      continue;
    }
    const g = groups.get(id) || [];
    g.push(ev);
    groups.set(id, g);
  }
  const chosen = [];
  groups.forEach((g) => chosen.push(pickBest(g)));
  chosen.push(...passthrough);
  // Keep a stable order by OT desc so UI defaults look sane
  chosen.sort((a, b) => new Date(b?.OT || 0) - new Date(a?.OT || 0));
  return chosen;
};

/**
 * Events feed helper: fetch ranges and wire SSE into a shared setEvents state.
 */
export function useEventsFeed({ sseEnabledRef, setEvents }) {
  const eventSourceRef = useRef(null);

  const fetchEventsForRange = useCallback(
    async (startDateISO, endDateISO, { setState = true } = {}) => {
      const startTs = moment(startDateISO).startOf('day').format('YYYY-MM-DD HH:mm:ss');
      const endTs = moment(endDateISO).endOf('day').format('YYYY-MM-DD HH:mm:ss');
      try {
        axios.defaults.withCredentials = true;
      } catch (_) {}
      const res = await axios.get(`${backendHost()}/eq-events`, {
        params: { startTime: startTs, endTime: endTs },
      });
      const arr = (res.data?.payload || []).slice();
      const deduped = dedupeInitial(arr);
      if (setState) setEvents(deduped);
      return deduped;
    },
    [setEvents],
  );

  const bindSSE = useCallback(() => {
    let stopped = false;
    const url = `${backendHost()}/messaging`;

    // Helper to set up listeners on a created EventSource instance
    const wire = (src) => {
      eventSourceRef.current = src;
    // With stable publicID, no similarity matching is needed.
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
              // Include descriptive text so Sidebar can display it
              text: data.text,
              eventType: 'NEW',
              last_modification: data.last_modification,
            };
            if (idx !== -1) {
              const copy = prev.slice();
              copy[idx] = { ...prev[idx], ...nextEvent };
              return copy;
            }
            // No similarity matching; rely on stable publicID
            // In production, discard very old NEW events that don't match anything to
            // avoid flooding from historical replays.
            try {
              if (
                (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) === 'production'
              ) {
                const tooOld =
                  nextEvent.OT && new Date(nextEvent.OT).getTime() < Date.now() - 48 * 3600 * 1000; // 48h
                if (tooOld) return prev;
              }
            } catch (_) {}
            return [nextEvent, ...prev];
          });
        } else if (data.eventType === 'UPDATE') {
          setEvents((prev) => {
            const idx = prev.findIndex((e) => e.publicID === data.publicID);
            if (idx !== -1) {
              const ev = prev[idx];
              const mergedDepth =
                depthVal ??
                ev.depth_km ??
                ev.depthKm ??
                ev.depth_value ??
                ev.depthValue ??
                ev.depth ??
                null;
              const copy = prev.slice();
              copy[idx] = {
                ...ev,
                OT: data.OT ?? ev.OT,
                latitude_value: data.latitude_value ?? ev.latitude_value,
                longitude_value: data.longitude_value ?? ev.longitude_value,
                magnitude_value: data.magnitude_value ?? ev.magnitude_value,
                depth_km: mergedDepth,
                text: data.text ?? ev.text,
                eventType: 'UPDATE',
                last_modification: data.last_modification ?? ev.last_modification,
              };
              return copy;
            }
            // No similarity fallback; if not found by ID, ignore.
            return prev;
          });
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
        try { src.removeEventListener('error', onError); } catch (_) {}
        try { src.removeEventListener('SC_EVENT', onSC); } catch (_) {}
      };
      return { unbind };
    };

    // Create EventSource with native implementation or lazy-loaded polyfill
    let ret = { unbind: () => { stopped = true; try { eventSourceRef.current && eventSourceRef.current.close && eventSourceRef.current.close(); } catch (_) {} } };
    try {
      // Prefer native EventSource when available
      if (typeof window !== 'undefined' && 'EventSource' in window) {
        const src = new window.EventSource(url);
        ret = wire(src);
      } else {
        // Lazy-load the polyfill only for browsers without EventSource
        import('event-source-polyfill')
          .then(({ EventSourcePolyfill }) => {
            if (stopped) return; // unbound before polyfill loaded
            const src = new EventSourcePolyfill(url);
            ret = wire(src);
          })
          .catch(() => {});
      }
    } catch (_) {}

    return ret;
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
