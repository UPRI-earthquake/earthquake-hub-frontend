Performance TODOs and Risk Assessment

Scope: Frontend (CRA + Leaflet) and static serving via Nginx.

Safe changes already applied
- Non‑blocking Leaflet CSS in `public/index.html` using preload+onload swap. Keeps initial paint fast without changing appearance.
- `config.js` marked `defer` to avoid blocking HTML parsing while preserving execution order.
- `web-vitals` and push `subscribeUser()` are lazy‑loaded on idle to keep main bundle lean.
- EventSource polyfill is now conditionally loaded only when needed (older browsers).
- Nginx now serves hashed assets with long cache lifetimes, disables HTML/config caching, and enables gzip.
- Service worker adds runtime caching for common map tile providers to speed up repeat visits.

Proposed changes requiring validation (may be breaking)
1) Replace `moment` with `dayjs`
   - Why: `moment` is heavy and blocks tree‑shaking. `dayjs` is ~2KB/core and plugin‑based.
   - Risk: Formatting/parse differences; reliance on implicit UTC/local rules. Many files rely on `moment()` behavior (filters, timers, SSE timestamps).
   - Plan:
     - Introduce `dayjs` with `utc`, `duration`, `relativeTime` plugins and unit tests for date math used in filters and badges.
     - Convert features incrementally: start with `SidebarItems.jsx` and UI formatting, then map popups, then SSE processing.
     - Keep `moment` temporarily for components needing hard‑to‑migrate semantics; remove once parity is verified.

2) Extract map‑only CSS out of `src/index.css`
   - Why: Reduce unused CSS on routes without the map. Allows CSS to load with the lazy map chunk.
   - Risk: Missing selector specificity when moved; timing of CSS load if map renders immediately.
   - Plan:
     - Move `.leaflet-*` and map control selectors into `src/map.css`.
     - Import `map.css` from a lazily loaded `MapView` component.
     - Verify visual parity across light/dark/imagery themes.

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
     - Identify safe endpoints (e.g., significant events summaries).
     - Add `Cache-Control` with conservative max‑age and `ETag` if feasible.

7) HTTP/2 and TLS termination
   - Why: Multiplexing reduces request latency for many small assets.
   - Risk: Infra change; outside of app repo.
   - Plan: Enable HTTP/2 on the reverse proxy/ingress that fronts Nginx.

Validation checklist
- Lighthouse: Verify render‑blocking CSS eliminated, TBT doesn’t regress, and cache lifetimes recognized.
- Bundle size: Track main bundle reduction after lazy imports and optional moment→dayjs migration.
- Functional tests: Map renders fine, SSE updates flow, station realtime plot works after on‑demand load.

