self.addEventListener('push', (event) => {
  const payload = (() => {
    if (!event || !event.data) return {};
    try {
      return event.data.json();
    } catch (_) {
      try {
        const text = event.data.text();
        return text ? JSON.parse(text) : {};
      } catch (err) {
        return {};
      }
    }
  })();

  const data = (payload && payload.data) || payload || {};
  const publicID = data.publicID || data.publicId || data.id;
  const title = payload.title || data.title || 'Earthquake Alert';
  const body = payload.body || data.body || '';
  const targetUrl =
    data.url || payload.url || (publicID ? `/?event=${encodeURIComponent(publicID)}` : '/');

  const options = {
    body,
    badge: payload.badge || data.badge || './badge-92x92.png',
    icon: payload.icon || data.icon || './android-chrome-192x192.png',
    tag: payload.tag || data.tag,
    renotify: Boolean(payload.renotify ?? data.renotify),
    data: {
      url: targetUrl,
      publicID,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  try {
    event.notification && event.notification.close();
  } catch (_) {}

  const targetUrl = (event.notification && event.notification.data && event.notification.data.url) || '/';
  const absoluteUrl = (() => {
    try {
      return new URL(targetUrl, self.location.origin).href;
    } catch (_) {
      return `${self.location.origin}/`;
    }
  })();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = (clientsArr || []).find(
        (client) => client && typeof client.url === 'string' && client.url === absoluteUrl,
      );
      if (existing && typeof existing.focus === 'function') return existing.focus();
      if (self.clients.openWindow) return self.clients.openWindow(absoluteUrl);
      return undefined;
    }),
  );
});
