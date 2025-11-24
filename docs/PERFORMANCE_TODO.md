Performance TODOs and Risk Assessment

Scope: Frontend (CRA + Leaflet) and API backend (Express).

Safe changes applied (non‑breaking)
- Leaflet CSS is loaded non‑blocking via `preload` with onload‑swap in `public/index.html`.
- Reduced preconnects in `public/index.html` to <= 4 origins (OSM + one Carto) to address Lighthouse’s “too many preconnects”.
- `web-vitals` and push `subscribeUser()` are lazy‑loaded on idle to keep main bundle lean (see `src/index.js`).
- EventSource polyfill is now conditionally loaded only when needed (older browsers) in `hooks/useEventsFeed.js`.
- Added short `Cache-Control` for `GET /device/all` (60s) to reduce backend load on initial map load; SSE updates still reflect live status.
- Sidebar earthquake items, station list items, and significant‑EQ cards are keyboard accessible (role=button, tabIndex, Enter/Space handlers).
- Service worker includes runtime caching for common map tile providers to improve repeat visits.
- Leaflet CSS deduped: removed bundled import in `src/components/MapView.jsx:1` and kept the non‑blocking CDN link in `public/index.html`. This reduces render‑blocking.

Notes about dev vs prod measurements
- Lighthouse warnings like “minify JS/CSS” and “render‑blocking requests” often reflect the CRA Dev Server. Build with `npm run build` for a minified, code‑split, deferred production bundle.
- `public/config.js` intentionally remains non‑deferred to guarantee it loads before dev server bundles execute (apps read `window.ENV`). In production this is a tiny file and not material to TTI.

Proposed changes requiring validation (may be breaking)
1) Replace `moment` with `dayjs`
   - Why: `moment` is heavy and blocks tree‑shaking. `dayjs` is ~2KB/core and plugin‑based.
   - Risk: Formatting/parse differences; reliance on implicit UTC/local rules. Many files rely on `moment()` behavior (filters, timers, SSE timestamps).
   - Plan:
     - Introduce `dayjs` with `utc`, `duration`, `relativeTime` plugins and unit tests for date math used in filters and badges.
     - Convert features incrementally: start with `SidebarItems.jsx` and UI formatting, then map popups, then SSE processing.
     - Keep `moment` temporarily for components needing hard‑to‑migrate semantics; remove once parity is verified.

2) Leaflet CSS source of truth (DONE: CDN)
   - We chose the CDN non‑blocking link and removed the bundled import. This improves first paint.
   - Risk: Offline dev or networks blocking unpkg could see missing core Leaflet styles. If this is a common scenario, revert to bundled import or host the CSS locally under `public/` and preload from there.

3) Lazy‑load Leaflet + map tree as a separate chunk
   - Why: Further shorten the critical path; the homepage is map‑first but splitting reduces script parse/compile on slow devices.
   - Risk: Brief gap before map UI mounts on very slow networks; ensure controls fallbacks are fine.
   - Plan:
     - Create `components/MapView.jsx` that imports `react-leaflet` and current map children inside.
     - Render `<MapView />` behind a `<Suspense fallback={null}>` in `HomePage.jsx`.
     - Ensure `window.__leaflet_map__` is still set via `whenCreated`.

4) Defer/conditional load for `seisplotjs`
   - Why: Large dependency used only when station realtime plots render.
   - Risk: Refactor required in `StationMarker.jsx` (top‑level `sp.*` usage). Must avoid regressions in demo playback and live DataLink.
   - Plan:
     - Replace top‑level `import * as sp from 'seisplotjs'` with lazy `import('seisplotjs')` when a realtime plot is first requested.
     - Move `SeismographConfig` setup into a function executed after import resolves.
     - Add guard rails/timeouts to prevent race conditions during popup open/close.

5) Modernize JS targets (browserslist)
   - Why: Avoid serving legacy/transpiled JS to modern browsers; improve parse/execute time.
   - Risk: Dropping support for older browsers (e.g., Safari < 13, old Android WebViews).
   - Plan:
     - Decide supported browsers. If modern‑only, set production browserslist to a modern baseline (e.g., last 2 Chrome/Firefox/Safari, Firefox ESR).
     - Validate on target devices/browsers; monitor error reporting.

6) Backend caching headers (select endpoints)
   - Why: Some GET endpoints could permit short‑lived caching to reduce load and TTFB.
   - Risk: Stale data for rapidly changing feeds; SSE endpoints must remain non‑cached.
   - Plan:
     - Already added: `GET /device/all` (60s). Validate with prod traffic.
     - Consider: `GET /significant-eqs/all` (already 300s). Optionally add `ETag` for stronger caching.
     - Avoid caching: auth, `/device/status`, and SSE.

7) HTTP/2 and TLS termination
   - Why: Multiplexing reduces request latency for many small assets.
   - Risk: Infra change; outside of app repo.
   - Plan: Enable HTTP/2 on the reverse proxy/ingress that fronts Nginx.

Validation checklist
- Lighthouse: Verify render‑blocking requests reduced (esp. preconnect warning), TBT doesn’t regress, and cache lifetimes recognized.
- Bundle size: Track main bundle reduction after lazy imports and optional moment→dayjs migration.
- Functional tests: Map renders fine, SSE updates flow, station realtime plot works after on‑demand load.

Quick TODOs (small, safe)
- [ ] Audit other clickable containers for keyboard accessibility (e.g., any remaining `onClick` on `div`).
- [ ] If ArcGIS is often selected as base, swap one Carto preconnect for ArcGIS to keep ≤ 4 preconnects.
- [ ] Confirm `Cache-Control` headers propagate correctly through reverse proxy/CDN.
