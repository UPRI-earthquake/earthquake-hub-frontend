# API Map

- **Base configuration**

  - **Environment:** `window['ENV']` values generated from `.env` via `import-env.sh` (`import-env.sh:1`)
  - **Backends switch by `NODE_ENV`:**

    - `REACT_APP_BACKEND`, `REACT_APP_BACKEND_DEV`
    - `REACT_APP_RINGSERVER_WS`, `REACT_APP_RINGSERVER_WS_DEV`
    - `REACT_APP_FDSNWS`, `REACT_APP_RS_FDSNWS`

- **Earthquake Events**

  - **Initial events:** `GET ${BACKEND}/eq-events?startTime=...&endTime=...` (`src/hooks/useEventsFeed.js:1` via `src/hooks/useAppData.js:1`)
  - **Event summary contract:** event responses expose `generatedSummary`,
    `effectiveSummary`, and `summaryPublication`. The public UI renders
    `effectiveSummary`; only Approved custom summaries are selected by default.
    `eventSummary` remains a compatibility alias, and the local generator is a
    fallback for older backend responses. `SC_EVENT` SSE payloads use the same
    public summary projection.
  - **Live updates (SSE):** `EventSource` to `${BACKEND}/messaging` (`src/hooks/useEventsFeed.js:1`), events:

    - `SC_EVENT` → NEW/UPDATE of events; merged into live list used by `EventMarkers` and `SidebarItems` (`src/hooks/useEventsFeed.js:1` → `src/components/EventMarkers.jsx:1`, `src/components/SidebarItems.jsx:1`)
    - `SC_PICK` → station pick highlight handled in `StationMarker` via `SSEContext` (`src/components/StationMarker.jsx:1`)

- **Stations**

  - **All stations:** `GET ${BACKEND}/device/all` (`src/pages/HomePage.jsx:1`)
  - **Station status on popup open:** `GET ${BACKEND}/device/status?network=...&station=...` (`src/components/StationMarker.jsx:1`)
  - **Ringserver/WebSocket** (miniseed via DataLink): `${RINGSERVER_WS}` or dev variant (seisplotjs) (`src/components/StationMarker.jsx:1`)
  - **Download links:**

    - **Data:** `${REACT_APP_FDSNWS}/dataselect/1/query?...` (`src/components/StationMarker.jsx:1`)
    - **Metadata:** `${REACT_APP_FDSNWS}/station/1/query?...` (`src/components/StationMarker.jsx:1`)
    - Notes: The Station popup downloads fetch as Blob to apply custom filenames and use short timeouts; fallback to other hosts has been removed.

- **Significant Earthquakes**

  - **List:** `GET ${BACKEND}/significant-eqs/all` (`src/pages/SignificantEQsPage.jsx:1`)
  - **Detail by id:** `POST ${BACKEND}/significant-eqs` with `{ id }` (`src/pages/EQInfoPage.jsx:1`)
  - **Detail page download buttons** (configured FDSNWS endpoint): fdsnws query at `https://earthquake.up.edu.ph/fdsnws/...` (`src/components/StationDownloadButton.jsx:1`)

- **Auth + Accounts**

  - **Sign in:** `POST ${BACKEND}/accounts/authenticate` (`src/components/Form.jsx:1`)
  - **Profile (check token):** `GET ${BACKEND}/accounts/profile` (`src/components/Header.jsx:1`)
  - **Sign up:** `POST ${BACKEND}/accounts/register` (`src/components/Form.jsx:1`)
  - **Acquire barangay token:** `POST ${BACKEND}/accounts/acquire-brgy-token` (`src/components/Dashboard.jsx:1`)
  - **Sign out:** `POST ${BACKEND}/accounts/signout` (`src/components/Dashboard.jsx:1`)

- **Notifications**

  - **Subscribe:** `POST ${BACKEND}/notifications/subscribe` with `PushSubscription` (`src/services/subscription.js:1`)
  - **VAPID public key:** `REACT_APP_PUBLIC_VAPID_KEY` (`src/services/subscription.js:1`)

- **Map Tiles & Overlays**

  - **Basemaps:** via leaflet-providers (OSM, Carto Light/Dark, Esri Imagery) (`src/config/mapLayers.js:1`, `src/components/layers/BasemapLayers.jsx:1`)
  - **Overlays:**
    - Faults (GEM) and Plates (PB2002) loaded as GeoJSON from CDN (`src/config/datasets.js:1`, `src/components/layers/OverlayLayers.jsx:1`)
    
