import { devlog } from '../utils/devlog';
import { emitToast } from '../utils/toast';

// Lightweight UI notification bridge: emit a global event that Header listens for
function notifyUser(message, type = 'error') {
  emitToast(message, type);
}
let convertedVapidKey;
try {
  const raw = (window && window['ENV'] && window['ENV'].REACT_APP_PUBLIC_VAPID_KEY) || '';
  convertedVapidKey = urlBase64ToUint8Array(raw);
} catch (e) {
  // Surface a helpful message in dev if env is missing/malformed
  devlog('Invalid or missing REACT_APP_PUBLIC_VAPID_KEY in window["ENV"].');
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  // eslint-disable-next-line
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function sendSubscription(subscription) {
  const backend_host =
    process.env.NODE_ENV === 'production'
      ? window['ENV'].REACT_APP_BACKEND
      : window['ENV'].REACT_APP_BACKEND_DEV;
  return fetch(`${backend_host}/notifications/subscribe`, {
    method: 'POST',
    body: JSON.stringify(subscription),
    headers: {
      'Content-Type': 'application/json',
    },
  }).catch((e) => {
    devlog('Error occurred in sending subscription', e);
  });
}

/**
 * Register or refresh Push API subscription and send to backend.
 */
export function subscribeUser() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      if (!registration.pushManager) {
        devlog('Push manager unavailable in browser.');
        // Inform end users when Push API support is missing
        notifyUser(
          'Push notifications are not available in this browser. Please use a supported browser.',
          'warning',
        );
        return;
      }

      // Ensure we have permission first. Some browsers require a user gesture
      // before showing the permission prompt; if denied, bail early.
      const ensurePermission = async () => {
        if (Notification.permission === 'granted') return true;
        if (Notification.permission === 'denied') {
          devlog('Notification permission denied by the user.');
          notifyUser('Notifications are blocked. Enable them in your browser settings.', 'warning');
          return false;
        }
        try {
          const res = await Notification.requestPermission();
          const ok = res === 'granted';
          if (!ok) notifyUser('Notifications are blocked. Enable them in your browser settings.', 'warning');
          return ok;
        } catch (_) {
          notifyUser('Notifications setup failed while requesting permission.', 'error');
          return false;
        }
      };

      registration.pushManager
        .getSubscription()
        .then((existedSubscription) => {
          if (existedSubscription === null) {
            devlog('No subscription detected, make a request.');
            // Permission + subscribe with VAPID, then POST to backend
            ensurePermission().then((ok) => {
              if (!ok) return;
              if (!convertedVapidKey || !(convertedVapidKey instanceof Uint8Array)) {
                devlog('VAPID key is not set or invalid.');
                // notifyUser('Notifications setup failed: missing or invalid VAPID key.', 'error');
                return;
              }
              registration.pushManager
                .subscribe({
                  applicationServerKey: convertedVapidKey,
                  userVisibleOnly: true,
                })
                .then((newSubscription) => {
                  devlog('New subscription added.');
                  try { devlog(JSON.stringify(newSubscription)); } catch (_) {}
                  // Persist to backend so server can send pushes later
                  sendSubscription(newSubscription);
                })
                .catch((e) => {
                  if (Notification.permission !== 'granted') {
                    devlog('Notification permission was not granted.');
                    notifyUser('Notifications are blocked. Enable them in your browser settings.', 'warning');
                  } else {
                    devlog('Error occurred in subscription.', e);
                    const msg = String(e && (e.message || e.name || e));
                    // Chromium builds without Google push services often throw
                    // messages like "Registration failed - push service not available".
                    const maybeGoogleServicesDisabled = /push service not available|gcm|fcm/i.test(msg);
                    if (maybeGoogleServicesDisabled) {
                      // Offer actionable guidance for web users
                      notifyUser(
                        'Push cannot be enabled: Google services for push messaging are disabled. Enable it in your browser settings or use Google Chrome.',
                        'warning',
                      );
                    } else {
                      notifyUser('Notifications setup failed. Please try again later.', 'error');
                    }
                  }
                });
            });
          } else {
            devlog('Existing subscription detected.');
            sendSubscription(existedSubscription);
          }
        })
        .catch((e) => {
          devlog('Error occurred during SW registration.', e);
          notifyUser('Notifications setup failed. Please refresh and try again.', 'error');
        });
    });
  }
}
