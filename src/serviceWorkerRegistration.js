import { devlog, deverror } from './utils/devlog';
// This optional code is used to register a service worker.
// register() is not called by default.

// This lets the app load faster on subsequent visits in production, and gives
// it offline capabilities. However, it also means that developers (and users)
// will only see deployed updates on subsequent visits to a page, after all the
// existing tabs open on the page have been closed, since previously cached
// resources are updated in the background.

// To learn more about the benefits of this model and instructions on how to
// opt-in, read https://cra.link/PWA
const env = (typeof process !== 'undefined' && process.env) ? process.env : {};
const nodeEnv = env.NODE_ENV || 'development';
const publicUrlEnv = env.PUBLIC_URL || '';
const isProd = nodeEnv === 'production';
const primarySwUrl = `${publicUrlEnv}/service-worker.js`;

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    // [::1] is the IPv6 localhost address.
    window.location.hostname === '[::1]' ||
    // 127.0.0.0/8 are considered localhost for IPv4.
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/),
);

const registrationScriptUrl = (registration) => {
  try {
    return (
      registration?.active?.scriptURL ||
      registration?.waiting?.scriptURL ||
      registration?.installing?.scriptURL ||
      ''
    );
  } catch (_) {
    return '';
  }
};

async function unregisterLegacyCustomWorkers() {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map(async (registration) => {
        const scriptUrl = registrationScriptUrl(registration);
        if (typeof scriptUrl === 'string' && scriptUrl.includes('/custom-sw.js')) {
          try { await registration.unregister(); } catch (_) {}
        }
      }),
    );
  } catch (_) {}
}

/** Register the app's primary service worker for offline support and web push. */
export function register(config) {
  if (!('serviceWorker' in navigator)) return;

  // Keep development free of service worker caching drift.
  if (!isProd) {
    window.addEventListener('load', () => {
      unregister();
    });
    return;
  }

  // The URL constructor is available in all browsers that support SW.
  const publicUrl = new URL(publicUrlEnv, window.location.href);
  if (publicUrl.origin !== window.location.origin) {
    // Our service worker won't work if PUBLIC_URL is on a different origin
    // from what our page is served on. This might happen if a CDN is used to
    // serve assets; see https://github.com/facebook/create-react-app/issues/2374
    return;
  }

  window.addEventListener('load', async () => {
    await unregisterLegacyCustomWorkers();

    if (isLocalhost) {
      // This is running on localhost. Let's check if a service worker still exists or not.
      checkValidServiceWorker(primarySwUrl, config);

      // Add some additional logging to localhost, pointing developers to the
      // service worker/PWA documentation.
      navigator.serviceWorker.ready.then(() => {
        if (nodeEnv !== 'production')
          devlog(
            'This web app is being served cache-first by a service ' +
              'worker. To learn more, visit https://cra.link/PWA',
          );
      });
    } else {
      // Is not localhost. Just register service worker
      registerValidSW(primarySwUrl, config);
    }
  });
}

function registerValidSW(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // At this point, the updated precached content has been fetched,
              // but the previous service worker will still serve the older
              // content until all client tabs are closed.
              if (nodeEnv !== 'production')
                devlog(
                  'New content is available and will be used when all ' +
                    'tabs for this page are closed. See https://cra.link/PWA.',
                );

              // Execute callback
              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
            } else {
              // At this point, everything has been precached.
              // It's the perfect time to display a
              // "Content is cached for offline use." message.
              if (nodeEnv !== 'production')
                devlog('Content is cached for offline use.');

              // Execute callback
              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }
            }
          }
        };
      };
    })
    .catch((error) => {
      if (nodeEnv !== 'production')
        deverror('Error during service worker registration:', error);
    });
}

function checkValidServiceWorker(swUrl, config) {
  // Check if the service worker can be found. If it can't reload the page.
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response) => {
      // Ensure service worker exists, and that we really are getting a JS file.
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        // No service worker found. Probably a different app. Reload the page.
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        // Service worker found. Proceed as normal.
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      if (nodeEnv !== 'production')
        devlog('No internet connection found. App is running in offline mode.');
    });
}

/** Unregister the app's service worker. */
export function unregister() {
  if ('serviceWorker' in navigator) {
    if (typeof navigator.serviceWorker.getRegistrations === 'function') {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch((error) => {
          console.error(error.message);
        });
      return;
    }
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}
