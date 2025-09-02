# Component Map

* **App Router:** three routes in `src/App.js:1`

  * `/` → **HomePage** (`src/pages/HomePage.js:1`)
  * `/significant-eqs` → **SignificantEQsPage** (`src/pages/SignificantEQsPage.js:1`)
  * `/significant-eq-info` → **EQInfoPage** (`src/pages/EQInfoPage.js:1`)
* **Home Page:** map + live feeds

  * **Header** (`src/components/Header.js:1`) with auth/dashboard UI
  * **Sidebar** (`src/components/Sidebar.js:1`) containing:

    * **SidebarInfo** (`src/components/SidebarInfo.js:1`)
    * **SidebarItems** live list (`src/components/SidebarItems.js:1`)
  * **Map:** react-leaflet `MapContainer` + `TileLayer` (`src/pages/HomePage.js:1`)
  * **Earthquakes:** `EventMarkers` → `EventMarker` (`src/components/EventMarkers.js:1`, `src/components/EventMarker.js:1`)
  * **Stations:** `StationMarkers` → `StationMarker` (`src/components/StationMarkers.js:1`, `src/components/StationMarker.js:1`)
  * **SSE Context Provider:** wraps Sidebar + Map (`src/pages/HomePage.js:1`, `src/SSEContext.js:1`)
  * **Loading/Error states:** `LoadingScreen`, `ErrorScreen` (`src/components/LoadingScreen.js:1`, `src/components/ErrorScreen.js:1`)
* **Significant Earthquakes**

  * **List page:** `SignificantEQsPage` renders `Card` grid (`src/pages/SignificantEQsPage.js:1`, `src/components/Card.js:1`)
  * **Detail page:** `EQInfoPage` with table, `StationDownloadButtons`, `Articles` links (`src/pages/EQInfoPage.js:1`, `src/components/StationDownloadButton.js:1`, `src/components/Articles.js:1`)
* **Auth/Dashboard UI**

  * **Header** controls auth flow, shows `SignInForm`, `SignUpForm`, `Dashboard` as overlays (`src/components/Header.js:1`, `src/components/Form.js:1`, `src/components/Dashboard.js:1`)
  * “Significant Earthquakes” **FAB** from home: `FloatingButton` (`src/components/FloatingButton.js:1`)
* **Redux**

  * Minimal store for selected event → auto-center/popups (`src/index.js:1` used by `EventMarker` and `SidebarItem`)
* **Service Worker + Push**

  * PWA registration + notifications subscription (`src/serviceWorkerRegistration.js:1`, `src/subscription.js:1`)