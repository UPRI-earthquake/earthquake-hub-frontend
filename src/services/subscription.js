import { devlog } from '../utils/devlog';
import { emitToast } from '../utils/toast';
import { backendHost } from '../utils/env';

// Lightweight UI notification bridge: emit a global event that Header listens for
function notifyUser(message, type = 'error') {
  emitToast(message, type);
}

const primarySwSuffix = '/service-worker.js';

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

const buildClientMeta = (registration) => {
  return {
    swScriptUrl: registrationScriptUrl(registration) || null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    appVersion: (window && window.ENV && window.ENV.REACT_APP_VERSION) || null,
    time: new Date().toISOString(),
  };
};

function sendSubscription(subscription, registration) {
  const backend_host = backendHost();
  const payload = {
    ...subscription,
    clientMeta: buildClientMeta(registration),
  };
  return fetch(`${backend_host}/notifications/subscribe`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  }).catch((e) => {
    devlog('Error occurred in sending subscription', e);
  });
}

function isPrimaryRegistration(registration) {
  const url = registrationScriptUrl(registration);
  return typeof url === 'string' && url.includes(primarySwSuffix);
}

async function getRegistrationsForSync() {
  const list = [];
  try {
    const readyReg = await navigator.serviceWorker.ready;
    if (readyReg) list.push(readyReg);
  } catch (_) {}
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    regs.forEach((r) => {
      if (!list.find((x) => x && r && x.scope === r.scope && registrationScriptUrl(x) === registrationScriptUrl(r))) {
        list.push(r);
      }
    });
  } catch (_) {}
  return list.filter(Boolean);
}

async function syncExistingSubscriptions(registrations) {
  const seenEndpoints = new Set();
  await Promise.all(
    registrations.map(async (registration) => {
      if (!registration || !registration.pushManager) return;
      try {
        const existing = await registration.pushManager.getSubscription();
        if (!existing) return;
        const endpoint = existing.endpoint || '';
        if (!endpoint || seenEndpoints.has(endpoint)) return;
        seenEndpoints.add(endpoint);
        await sendSubscription(existing.toJSON ? existing.toJSON() : existing, registration);
      } catch (_) {}
    }),
  );
}

function pickPrimaryRegistration(registrations) {
  const primary = registrations.find((registration) => isPrimaryRegistration(registration));
  return primary || registrations[0] || null;
}

/**
 * Register or refresh Push API subscription and send to backend.
 */
export function subscribeUser() {
  if (!('serviceWorker' in navigator)) return;

  (async () => {
    const registrations = await getRegistrationsForSync();
    const registration = pickPrimaryRegistration(registrations);
    if (!registration || !registration.pushManager) {
      devlog('Push manager unavailable in browser.');
      notifyUser(
        'Push notifications are not available in this browser. Please use a supported browser.',
        'warning',
      );
      return;
    }

    // Persist any existing subscriptions first (covers sw cutover without manual action).
    await syncExistingSubscriptions(registrations);

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

    try {
      const existedSubscription = await registration.pushManager.getSubscription();
      if (existedSubscription) {
        devlog('Existing subscription detected.');
        await sendSubscription(existedSubscription.toJSON ? existedSubscription.toJSON() : existedSubscription, registration);
        return;
      }
      devlog('No subscription detected, make a request.');
      const ok = await ensurePermission();
      if (!ok) return;
      if (!convertedVapidKey || !(convertedVapidKey instanceof Uint8Array)) {
        devlog('VAPID key is not set or invalid.');
        return;
      }
      const newSubscription = await registration.pushManager.subscribe({
        applicationServerKey: convertedVapidKey,
        userVisibleOnly: true,
      });
      devlog('New subscription added.');
      try { devlog(JSON.stringify(newSubscription)); } catch (_) {}
      await sendSubscription(newSubscription.toJSON ? newSubscription.toJSON() : newSubscription, registration);
    } catch (e) {
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
          notifyUser(
            'Push cannot be enabled: Google services for push messaging are disabled. Enable it in your browser settings or use Google Chrome.',
            'warning',
          );
        } else {
          notifyUser('Notifications setup failed. Please try again later.', 'error');
        }
      }
    }
  })().catch((e) => {
    devlog('Error occurred during SW registration.', e);
    notifyUser('Notifications setup failed. Please refresh and try again.', 'error');
  });
}
