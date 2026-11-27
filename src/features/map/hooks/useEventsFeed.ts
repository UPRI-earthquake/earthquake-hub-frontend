import { useCallback, useRef } from 'react';
import { emitToast } from '@/shared/utils/toast';
import { getAPIURL } from '@/shared/api';
// Performance: avoid shipping the EventSource polyfill to modern browsers.
// We dynamically import it only if the native API is unavailable.

/**
 * Events feed helper: fetch ranges and wire SSE into a shared setEvents state.
 */
export function useEventsFeed({ sseEnabledRef }) {
  const eventSourceRef = useRef(null);
  const toastCacheRef = useRef(new Map());

  const maybeToastEvent = useCallback((data, kind = 'new') => {
    try {
      const id = data && (data.publicID || data.publicId || data.id);
      if (!id) return;
      const t = String(kind || 'new').toLowerCase();
      const cache = toastCacheRef.current;
      const now = Date.now();
      const key = `${t}:${id}`;
      const last = cache.get(key);
      if (last && now - last < 3 * 60 * 1000) return;
      cache.set(key, now);
      if (cache.size > 120) {
        const entries = Array.from(cache.entries()).sort((a, b) => a[1] - b[1]);
        entries.slice(0, 40).forEach(([key]) => cache.delete(key));
      }
      const magValue = Number(data.magnitude_value ?? data.magnitude ?? data.mag);
      const magText = Number.isFinite(magValue) ? `M${magValue.toFixed(1)}` : 'M?';
      const isUnavailable = (value) => {
        if (!value) return true;
        const v = String(value).trim().toLowerCase();
        return (
          !v ||
          v === 'unavailable' ||
          v === 'unable to geocode' ||
          v === 'nominatim unavailable'
        );
      };
      const place = !isUnavailable(data.place) ? String(data.place).trim() : '';
      const text = !isUnavailable(data.text) ? String(data.text).trim() : '';
      const location = place || text || '';
      const suffix = location ? ` • ${location}` : '';
      if (t === 'update') emitToast(`Earthquake updated: ${magText}${suffix}`, 'warning');
      else emitToast(`New earthquake: ${magText}${suffix}`, 'error');
    } catch (_) {}
  }, []);


  const bindSSE = useCallback(() => {
    let stopped = false;
    const url = getAPIURL("backend", "/messaging");

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
        const eventType = String(data.eventType || '').toUpperCase();
        if (eventType === 'NEW') {
          maybeToastEvent(data, 'new');
        } else if (eventType === 'UPDATE') {
          maybeToastEvent(data, 'update');
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
  }, [maybeToastEvent, sseEnabledRef]);

  const closeSSE = useCallback(() => {
    if (eventSourceRef.current) {
      try {
        eventSourceRef.current.close();
      } catch (_) {}
      eventSourceRef.current = null;
    }
  }, []);

  return { eventSourceRef, bindSSE, closeSSE };
}
