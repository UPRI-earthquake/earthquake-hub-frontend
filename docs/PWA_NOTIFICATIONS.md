# PWA & Notifications

Describes service worker behavior and push subscription.

## Service Worker

- CRA v4 workbox setup with custom worker in `src/service-worker.js`
- Registered in `src/serviceWorkerRegistration.js`

## Push Subscription

- Client code: `src/services/subscription.js`
- Flow:
  1. Request permission from user
  2. Subscribe to push with VAPID key
  3. POST subscription to backend for storage

## Notes

- Ensure backend exposes endpoints to accept and manage subscriptions
- Validate permission state before re‑subscribing; handle denied state gracefully

