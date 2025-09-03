# Map Features Design

This document defines UX placement, behaviors, data contracts, and implementation notes for the core map features. Use the provided Figma layout as visual reference for placement and spacing.

- Mapping library: React Leaflet 4.x + Leaflet
- Current map entry: `src/pages/HomePage.js` (`MapContainer`, `TileLayer`)
- Existing data sources: `/device/all` (stations), `/eq-events` (earthquakes), `/messaging` (SSE)

## Legend & Layers

Purpose: Provide users a single control to switch base maps and toggle overlays: Fault Lines, Stations, Earthquakes.

Placement (Figma reference): Top-right, floating panel with rounded corners. Matches screenshot “Base maps / Overlays” panel.

Interactions
- Toggle items: Checkbox per overlay. Instant show/hide without re-querying when data already present.
- Base map: Radio selection (one active). Immediately swaps the underlying `TileLayer`.
- Collapsible: Chevron button to collapse to a pill on small screens; expands on tap.
- Keyboard: Arrow keys navigate items, Space/Enter toggles.
- Mobile: 44px touch targets; panel docks below zoom on small heights to avoid overlap.

Data & Layers
- Base maps:
  - `Carto Light` (default): `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`
  - `OpenStreetMap`: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
  - Optional: `ESRI World Imagery` if keys/terms OK.
- Overlays:
  - Earthquakes: GeoJSON-like array from `/eq-events` (already used). Styled by magnitude with circle markers, clustered at low zoom.
  - Stations: From `/device/all` (already used). Triangle/marker icon; color by status (streaming/offline/unknown).
  - Fault Lines: Static GeoJSON loaded once (prefer `/geodata/fault-lines` if available; fallback to `/public/data/fault-lines.json`). Red line style with subtle casing.

Performance
- Lazy-load overlays on first expand or first toggle; cache in memory.
- Use React Leaflet `Pane`s to control z-order: `base` (tiles), `faultlines` (zIndex 400), `stations` (450), `earthquakes` (500).
- Debounce rapid toggle changes (150ms) to avoid reflows.

Accessibility
- Use `aria-labelledby` for section headers “Base maps” and “Overlays”.
- Maintain focus on collapse/expand; ensure checkboxes are real inputs.

State Shape
```js
mapUi: {
  legendOpen: boolean,
  basemap: 'carto-light' | 'osm' | 'esri',
  overlays: { earthquakes: boolean, stations: boolean, faultlines: boolean }
}
mapData: {
  earthquakes?: FeatureCollection | null,
  stations?: FeatureCollection | null,
  faultlines?: FeatureCollection | null
}
```

Components
- `MapLegend` (new): panel UI; owns toggles, emits events.
- `BaseMapLayer` (new): switches tile sources.
- `FaultLinesLayer` (new): loads and renders GeoJSON.
- Reuse: `EventMarkers`, `StationMarkers`.

Acceptance Criteria
- Toggling overlays show/hide instantly without page reload.
- Base map swap < 300ms on broadband with tile cache warm.
- Panel collapses to a small button on screens < 768px width.

## Map Legend (Symbols)

Purpose: Explain visual encodings (magnitude, stations status, fault line style) and provide quick reference counts.

Placement: Co-located with Layers panel (same container), below toggle lists.

Content
- Earthquakes: Scaled circles with sample sizes and matching color ramp; label “by magnitude”.
- Stations: Green triangle (streaming), red (offline), gray (unknown). Counts shown when layer enabled.
- Fault Lines: Red line swatch with a thin dark casing.

Behavior
- Auto-updates counts from current filtered dataset (see Advanced Search).
- Clicking a legend item toggles the corresponding overlay (same as checkbox).
- Tooltip on hover: short description and data source.

Implementation Notes
- Use CSS-only swatches; no map dependency for samples.
- Props: `{ overlayState, counts }` from parent.

## Advanced Search with Presets

Purpose: Filter earthquakes (and optionally stations) by time, magnitude, depth, and region; expose common presets.

Placement: Left sidebar panel above the results list. Matches Figma “Latest Earthquakes, Past 30 Days” header with search and filter icon.

Filters
- Time range: relative (past 24h, 7d, 30d, YTD) and custom date range.
- Magnitude: min/max (default none). Quick chips: M4+, M5+, M6+.
- Depth: min/max km.
- Location: within Philippines bounds, region dropdown, or radius from point.
- Event type: earthquake (default), aftershock, swarm (if provided by API).

Presets (initial set)
- Latest Earthquakes, Past 24 Hours.
- Latest Earthquakes, Past 30 Days. [default]
- Significant (M6+), Past 30 Days.
- Near Philippines (within 300 km), Past 7 Days.
- Felt Reports Only (if field available).

URL & State Sync
- All filters sync to URL query string for share/deeplink: `?preset=m30&magMin=4&start=YYYY-MM-DD&end=YYYY-MM-DD&bbox=...`.
- On load: parse query → hydrate sidebar and trigger fetch.
- On change: update URL with `replaceState` debounced by 300ms.

Data Flow
1) User selects preset/filter → construct API query.
2) Fetch earthquakes; stations unaffected unless “filter stations by region” is enabled.
3) Update map layers and counts; update list in sidebar.

API Contracts (proposed; aligns with existing endpoints)
- `GET /eq-events`
  - Query params: `startTime`, `endTime` (YYYY-MM-DD HH:mm:ss), optional `magMin`, `magMax`, `depthMin`, `depthMax`, `bbox` (minLon,minLat,maxLon,maxLat), `radiusKm`, `centerLat`, `centerLon`, `limit`, `offset`, `sort`.
  - Response: `{ payload: EqEvent[] }` where each event includes `id, time, lat, lon, depthKm, mag, region, type`.
- `GET /device/all`
  - Optionally accept `bbox` to reduce payload when filtering by region (non-breaking if ignored by backend).
- `GET /geodata/fault-lines` (optional new) → GeoJSON FeatureCollection of LineStrings.

Component Contracts
- `SearchPanel` (new): houses filters + preset selector; emits `onChange(filters)`.
- `useEqSearch` (new hook): debounced fetch, cache last N queries; exposes `{ data, loading, error }`.
- `SidebarItems` (existing): consume filtered data; show list and counts.

Performance & UX
- Debounce text inputs by 300ms; apply immediately on preset chip click.
- Show skeleton list while fetching; maintain previous results until new arrive.
- Paginate results: 50 per page; infinite scroll in sidebar.

Acceptance Criteria
- Changing preset updates URL and results within 1s on broadband.
- Legend counts reflect filtered results.
- Map zooms/fitBounds to filtered extent when user clicks “Focus results”.

## Optional: Feedback Button

Purpose: Allow users to report issues or suggest improvements with current map context attached.

Placement: Bottom-right floating button (envelope icon) stacked with other utilities (see Figma).

Behavior
- Click opens modal: name (optional), email, message (required), consent checkbox.
- Auto-attaches context: current URL (with filters), viewport center/zoom, enabled layers, browser info.
- Submit to `POST /feedback` (proposed). Fallback: `mailto:` if API unavailable.
- Show toast on success; disable during submission; handle offline by queueing to `localStorage` and retrying on next load.

Security & Abuse
- Consider CAPTCHA or simple rate-limit by IP if API introduced.

## Optional: Scalebar

Purpose: Provide distance scale for spatial context.

Placement: Bottom-left above the map edge; matches screenshot.

Implementation
- Leaflet native control: `L.control.scale({ position: 'bottomleft', imperial: false })`.
- React Leaflet helper component `ScaleControl` using `useMap` in an effect to add/remove control.

Acceptance
- Appears at zoom ≥ 3; updates as user zooms.

## Optional: PH Zoom (Overview)

Purpose: One-tap zoom to the Philippines extent.

Placement: Small floating button near zoom controls (top-left of map) or in the bottom-right utilities stack per Figma. Label: “PH”. Tooltip: “Zoom to Philippines”.

Behavior
- On click: `map.fitBounds(phBounds, { padding: [20,20] })`.
- `phBounds` (approx): `[[4.5, 116.0], [21.3, 127.5]]` (lat,lon min/max) to include outlying islands.
- If filters specify a smaller extent, provide a “Focus results” secondary action in the search panel.

## Visual & Theming

- Follow green brand color for buttons and panel headers as in Figma.
- Light base map by default; ensure sufficient contrast for markers and fault lines.
- Panel uses subtle shadow; 8px radius; 12–14px text sizes.

## Analytics (optional)

- Log presets usage, layer toggles, and PH zoom clicks with minimal payload and privacy in mind.

## Open Questions

- Is a public GeoJSON source for fault lines available from the backend? If not, we will include a vetted static dataset under `public/data/`.
- Should station filtering be part of “Advanced Search”, or remain global with a separate toggle only?
- Any additional base map providers requiring API keys or attribution changes?

## Implementation Plan (phased)

1) Legend/Layers panel with working toggles and base map switch.
2) Fault Lines overlay (static GeoJSON), panes and z-indexing.
3) Advanced Search panel with presets, URL sync, filtered fetch.
4) Optional utilities: Feedback modal, Scalebar control, PH Zoom.
5) Polishing: accessibility, loading states, analytics hooks.
