export function trackEvent(name, params = {}) {
  try {
    window.gtag && window.gtag('event', name, params);
  } catch (_) {}
}
