# earthquake-hub-frontend

This is the user interface for the earthquake-hub web application which is the client-side code served as static html files by the backend. It is the front-end component of the web application that provides real-time information about seismic events, sensor data visualization, access to the data archive, and citizen science account information.

## Local Development Setup

To run this repository on your local machine, please follow the instructions provided under the [Setting Up The Repository On Your Local Machine](CONTRIBUTING.md#setting-up-the-repository-on-your-local-machine) section of the [contributing.md](CONTRIBUTING.md).

## Basemaps & Overlays

- Run locally: `npm start` (this generates `public/config.js` from `.env` via `import-env.sh`).
- Environment: copy `.env.example` to `.env` and adjust as needed. Common keys:
  - Backend/API: `REACT_APP_BACKEND`, `REACT_APP_BACKEND_DEV`
  - Ringserver/WebSocket: `REACT_APP_RINGSERVER_WS`, `REACT_APP_RINGSERVER_WS_DEV`
  - FDSNWS (data/metadata): `REACT_APP_FDSNWS`, `REACT_APP_RS_FDSNWS`
  - Web Push: `REACT_APP_PUBLIC_VAPID_KEY`
  - Optional raster overlay: `REACT_APP_POP_XYZ_URL` (XYZ tile template for population density)

### Basemap Choices

- OSM Standard, CartoDB Positron/Dark Matter, and Esri World Imagery via `leaflet-providers`.
- Attribution is handled by each provider; the default Leaflet prefix is removed.

### Overlays

- Fault Lines and Plate Boundaries are fetched as GeoJSON from public CDNs by default and rendered interactively.
  - Datasets: see `src/config/datasets.js` and usage in `src/components/layers/OverlayLayers.jsx`.
- Population Density (optional) uses a raster XYZ tile (`TileLayer`) if `REACT_APP_POP_XYZ_URL` is set.

For advanced vector tile pipelines (MBTiles/PBF), including local generation and hosting, see `docs/LAYERS_SETUP.md`.

### Licensing & Attribution

- OSM: follow Tile Usage Policy.
- Carto: attribution required; CDN suitable for moderate use.
- Esri World Imagery: raster is fine for dev; production may require an API key.
- WorldPop/GHSL: ensure proper attribution (WorldPop is CC BY 4.0).

## Project Structure and Conventions

- `src/`
  - `components/` — Presentational and interactive UI components (`*.jsx`) with co-located styles/tests.
  - `pages/` — Route-level React components (`*.jsx`).
  - `utils/` — Pure utilities and constants (`*.js`).
  - `services/` — Side-effect helpers (e.g., push notifications) (`*.js`).
  - `config/` — Map configs, datasets, and styling helpers (`*.js`).
  - `SSEContext.js` — React context for the EventSource instance.
- Naming: components use `.jsx`; utilities/config/services use `.js`.

More details and diagrams:

- API map: `docs/API_MAP.md`
- Component map: `docs/COMPONENT_MAP.md`
- Live updates flow: `docs/LIVE_EVENT_FLOW.md`
- Map features: `docs/MAP_FEATURES_DESIGN.md`

## Development Workflow

See `CONTRIBUTING.md` for setup. When refactoring:

- Keep user-visible behavior and component props stable.
- Prefer small, focused components and functions.
- Keep state local; extract shared network/SSE wiring into hooks or services.
- Respect accessibility (labels, alt text, keyboard focus).

### NPM Scripts

- `npm run lint` — ESLint over `src` with `react-app` config.
- `npm run format` — Prettier write for JS/JSX/CSS/MD files.
