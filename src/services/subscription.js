import { devlog } from '../utils/devlog';
const convertedVapidKey = urlBase64ToUint8Array(window['ENV'].REACT_APP_PUBLIC_VAPID_KEY);

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
    devlog('Error occured in sending subscription', e);
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
        return;
      }

      registration.pushManager
        .getSubscription()
        .then((existedSubscription) => {
          if (existedSubscription === null) {
            devlog('No subscription detected, make a request.');
            // create subscription obj, containing details to contact client
            registration.pushManager
              .subscribe({
                applicationServerKey: convertedVapidKey, // TODO: fetch from backend
                userVisibleOnly: true,
              })
              .then((newSubscription) => {
                devlog('New subscription added.');
                devlog(JSON.stringify(newSubscription));
              })
              .catch((e) => {
                if (Notification.permission !== 'granted')
                  devlog('Notification permission was not granted.');
                else devlog('Error occured in subscription.', e);
              });
          } else {
            devlog('Existed subscription detected.');
            sendSubscription(existedSubscription);
          }
        })
        .catch((e) => {
          devlog('Error occured during SW registration.', e);
        });
    });
  }
}
