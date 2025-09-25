# Component Map

- **App Router:** three routes in `src/App.jsx:1`

  - `/` → **HomePage** (`src/pages/HomePage.jsx:1`)
  - `/significant-eqs` → **SignificantEQsPage** (`src/pages/SignificantEQsPage.jsx:1`)
  - `/significant-eq-info` → **EQInfoPage** (`src/pages/EQInfoPage.jsx:1`)

- **Home Page:** map + live feeds + overlays

  - **Header** (`src/components/Header.jsx:1`) with auth/dashboard UI
  - **Sidebar** (`src/components/Sidebar.jsx:1`) containing:

    - **SidebarInfo** (`src/components/SidebarInfo.jsx:1`)
    - **SidebarItems** live list (`src/components/SidebarItems.jsx:1`)

  - **Map:** react-leaflet `MapContainer` with controls (`src/pages/HomePage.jsx:1`)
    - Base maps and overlays via **MapLayersControl** (`src/components/MapLayersControl.jsx:1`)
      - Base maps provided by `src/components/layers/BasemapLayers.jsx:1`
      - Overlays (Faults, Plates, Population) by `src/components/layers/OverlayLayers.jsx:1`
    - Layer visibility sync/context: **OverlayStateProvider** (`src/components/OverlayStateContext.js:1`)
    - Bottom-right legend and metadata: **LegendControl** (`src/components/LegendControl.jsx:1`)
    - Top-left controls: **ZoomControl**, **ResetViewControl** (`src/components/ResetViewControl.jsx:1`)
    - Map attribution without Leaflet prefix: **AttributionControl** (`src/components/AttributionControl.jsx:1`)
  - **Earthquakes:** `EventMarkers` → `EventMarker` (`src/components/EventMarkers.jsx:1`, `src/components/EventMarker.jsx:1`)
  - **Stations:** `StationMarkers` → `StationMarker` (`src/components/StationMarkers.jsx:1`, `src/components/StationMarker.jsx:1`)
  - **Data hooks:** `useAppData` wires initial fetch + SSE and exposes refs (`src/hooks/useAppData.js:1`)
  - **SSE Context Provider:** provides EventSource for station picks (`src/pages/HomePage.jsx:1`, `src/SSEContext.js:1`)
  - **Loading/Error states:** `LoadingScreen`, `ErrorScreen` (`src/components/LoadingScreen.jsx:1`, `src/components/ErrorScreen.jsx:1`)

- **Significant Earthquakes**

  - **List page:** `SignificantEQsPage` renders `Card` grid (`src/pages/SignificantEQsPage.jsx:1`, `src/components/Card.jsx:1`)
  - **Detail page:** `EQInfoPage` with table, `StationDownloadButtons`, `Articles` links (`src/pages/EQInfoPage.jsx:1`, `src/components/StationDownloadButton.jsx:1`, `src/components/Articles.jsx:1`)

- **Auth/Dashboard UI**

  - **Header** controls auth flow, shows `SignInForm`, `SignUpForm`, `Dashboard` as overlays (`src/components/Header.jsx:1`, `src/components/Form.jsx:1`, `src/components/Dashboard.jsx:1`)
  - “Significant Earthquakes” **FAB** from home: `FloatingButton` (`src/components/FloatingButton.jsx:1`)

- **Redux**

  - Minimal store for selected event → auto-center/popups (`src/index.js:1` used by `EventMarker` and `SidebarItem`)

- **Service Worker + Push**

  - PWA registration + notifications subscription (`src/serviceWorkerRegistration.js:1`, `src/services/subscription.js:1`)

- **Configuration**
  - Base maps and overlay endpoints: `src/config/mapLayers.js:1`, `src/config/datasets.js:1`, `src/config/mapStyles.js:1`
