# earthquake-hub-frontend

This is the user interface for the earthquake-hub web application which is the client-side code served as static html files by the backend. It is the front-end component of the web application that provides real-time information about seismic events, sensor data visualization, access to the data archive, and citizen science account information.

## Admin-reviewed event summaries

The public event UI consumes the backend-owned Approved-only summary
publication contract shared by REST and SSE. See
[Admin-reviewed event summary integration](docs/ADMIN_EVENT_SUMMARIES.md) for
field semantics, compatibility behavior, implementation files, and coordinated
rollout requirements.

## Local Development Setup

To run this repository on your local machine, please follow the instructions provided under the [Setting Up The Repository On Your Local Machine](CONTRIBUTING.md#setting-up-the-repository-on-your-local-machine) section of the [contributing.md](CONTRIBUTING.md).

## Development Workflow

See `CONTRIBUTING.md` for setup. When refactoring:

- Keep user-visible behavior and component props stable.
- Prefer small, focused components and functions.
- Keep state local; extract shared network/SSE wiring into hooks or services.
- Respect accessibility (labels, alt text, keyboard focus).

### NPM Scripts

- `npm run lint` — ESLint over `src` with `react-app` config.
- `npm run format` — Prettier write for JS/JSX/CSS/MD files.

## Map Attribution & Licenses

The map shows several layers with distinct licensing and attribution requirements. These attributions are shown in the map’s attribution control, and summarized here for clarity.

- Basemaps
  - OpenStreetMap Standard — © OSM contributors. https://www.openstreetmap.org/copyright
  - CARTO Positron/DarkMatter — © CARTO. https://carto.com/attributions
  - Esri World Imagery — Tiles © Esri (Esri, i‑cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR‑EGP, and the GIS User Community)

- Overlays
  - Fault Lines — GEM Global Active Faults Database (CC BY‑SA 4.0). Styron & Pagani (2020). https://github.com/GEMScienceTools/gem-global-active-faults
  - Plate Boundaries — PB2002: Bird (2003), processed by Nordpil (ODC‑By 1.0). https://github.com/fraxen/tectonicplates

Notes
- Basemap attributions are provided by leaflet‑providers and shown automatically. Overlay attributions are added when layers are toggled on.
