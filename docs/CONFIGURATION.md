# Configuration

Environment and runtime configuration for the frontend.

## Env injection

- At startup, `./import-env.sh` writes `public/config.js` so env is available at `window.ENV`.
- Scripts: `npm start` runs the injector, then CRA.

## Important variables

- `REACT_APP_BACKEND` / `REACT_APP_BACKEND_DEV`: API base URLs
 

## Map configuration

- Basemaps: `src/config/mapLayers.js`
- Overlays and dataset URLs: `src/config/datasets.js`
- Styles and theme tokens: `src/config/mapStyles.js`
- Attribution strings: `src/config/attribution.js`

## Service worker

- Registration: `src/serviceWorkerRegistration.js`
- Worker: `src/service-worker.js`
