import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
// Defer non-critical modules to reduce main bundle size
// - service worker registration already waits for 'load' internally
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

import { createStore } from 'redux';
import { Provider } from 'react-redux';

const selectedEventReducer = (state = null, action) => {
  switch (action.type) {
    case 'SELECT':
      return action.payload;
    case 'DESELECT':
      return null;
    default:
      return state;
  }
};
const store = createStore(selectedEventReducer);

// Note: GA Measurement Protocol headers are intentionally disabled for now.
// When backend request telemetry returns, reintroduce the axios interceptor
// here so every API request carries the GA client_id for correlation.

ReactDOM.render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
  document.getElementById('root'),
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://cra.link/PWA
serviceWorkerRegistration.register();

// Performance: avoid pulling web-vitals and push subscription into the main bundle.
// Load them after the app is interactive (idle or post-load), which keeps LCP fast.
const scheduleIdle = (fn) =>
  (typeof window !== 'undefined' && 'requestIdleCallback' in window)
    ? window.requestIdleCallback(fn)
    : setTimeout(fn, 0);

// Delay push subscription setup
scheduleIdle(() => {
  import('./services/subscription')
    .then(({ subscribeUser }) => {
      try { subscribeUser(); } catch (_) {}
    })
    .catch(() => {});
});

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// Lazy-load web-vitals and run when idle so it does not impact TBT
scheduleIdle(() => {
  import('./reportWebVitals')
    .then(({ default: reportWebVitals }) => {
      try { reportWebVitals(); } catch (_) {}
    })
    .catch(() => {});
});
