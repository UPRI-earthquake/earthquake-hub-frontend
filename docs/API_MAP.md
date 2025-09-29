# API Map

* **Base configuration**

  * **Environment:** `window['ENV']` values generated from `.env` via `import-env.sh` (`import-env.sh:1`)
  * **Backends switch by `NODE_ENV`:**

    * `REACT_APP_BACKEND`, `REACT_APP_BACKEND_DEV`
    * `REACT_APP_RINGSERVER_WS`, `REACT_APP_RINGSERVER_WS_DEV`
    * `REACT_APP_FDSNWS`, `REACT_APP_RS_FDSNWS`
* **Earthquake Events**

  * **Initial events:** `GET ${BACKEND}/eq-events?startTime=...&endTime=...` (`src/pages/HomePage.js:1`)
  * **Live updates (SSE):** `EventSource` to `${BACKEND}/messaging`, events:

    * `SC_EVENT` → NEW/UPDATE of events (`src/components/EventMarkers.js:1`, `src/components/SidebarItems.js:1`)
    * `SC_PICK` → station pick highlight (`src/components/StationMarker.js:1`)
* **Stations**

  * **All stations:** `GET ${BACKEND}/device/all` (`src/pages/HomePage.js:1`)
  * **Station status on popup open:** `GET ${BACKEND}/device/status?network=...&station=...` (`src/components/StationMarker.js:1`)
  * **Ringserver/WebSocket** (miniseed via DataLink): `${RINGSERVER_WS}` or dev variant (seisplotjs) (`src/components/StationMarker.js:1`)
  * **Download links:**

    * **Data:** `${REACT_APP_FDSNWS}/dataselect/1/query?...` (`src/components/StationMarker.js:1`)
    * **Metadata:** `${REACT_APP_RS_FDSNWS}/station/1/query?...` (`src/components/StationMarker.js:1`)
* **Significant Earthquakes**

  * **List:** `GET ${BACKEND}/significant-eqs/all` (`src/pages/SignificantEQsPage.js:1`)
  * **Detail by id:** `POST ${BACKEND}/significant-eqs` with `{ id }` (`src/pages/EQInfoPage.js:1`)
  * **Detail page download buttons** (hardcoded domain): fdsnws query at `https://earthquake.science.upd.edu.ph/fdsnws/...` (`src/components/StationDownloadButton.js:1`)
* **Auth + Accounts**

  * **Sign in:** `POST ${BACKEND}/accounts/authenticate` (`src/components/Form.js:1`)
  * **Profile (check token):** `GET ${BACKEND}/accounts/profile` (`src/components/Header.js:1`)
  * **Sign up:** `POST ${BACKEND}/accounts/register` (`src/components/Form.js:1`)
  * **Acquire barangay token:** `POST ${BACKEND}/accounts/acquire-brgy-token` (`src/components/Dashboard.js:1`)
  * **Sign out:** `POST ${BACKEND}/accounts/signout` (`src/components/Dashboard.js:1`)
* **Notifications**

  * **Subscribe:** `POST ${BACKEND}/notifications/subscribe` with `PushSubscription` (`src/subscription.js:1`)
  * **VAPID public key:** `REACT_APP_PUBLIC_VAPID_KEY` (`src/subscription.js:1`)
* **Map Tiles**

  * **Basemap:** CARTO light tiles URL in `TileLayer` (`src/pages/HomePage.js:1`)
