# Map Features Design

This document defines UX placement, behaviors, data contracts, and implementation notes for the core map features. Use the provided Figma layout as visual reference for placement and spacing.

- Mapping library: React Leaflet v3 (fork) + Leaflet 1.7.1
- Current map entry: `src/pages/HomePage.jsx` (`MapContainer`, controls via `MapLayersControl`)
- Existing data sources: `/device/all` (stations), `/eq-events` (earthquakes), `/messaging` (SSE)

## Legend & Layers

Purpose: Provide users controls to switch base maps and toggle overlays: Fault Lines, Plate Boundaries, Stations, and Earthquakes.

Placement: Layers panel at top-right; Legend panel at bottom-right (collapsible).

Interactions

- Toggle items: Checkbox per overlay. Instant show/hide without re-querying when data already present.
- Base map: Radio selection (one active). Immediately swaps the underlying `TileLayer`.
- Collapsible: Chevron button to collapse to a pill on small screens; expands on tap.
- Keyboard: Arrow keys navigate items, Space/Enter toggles.
- Mobile: 44px touch targets; panel docks below zoom on small heights to avoid overlap.

Data & Layers

- Base maps (leaflet-providers): OSM Standard, Carto Light (default), Carto Dark, Esri World Imagery.
- Overlays:
  - Earthquakes: Array from `/eq-events`. Styled by magnitude with circle markers (no clustering); optional depth color ramp toggle in Legend.
  - Stations: From `/device/all`. Triangle icon; status shown in popup with real-time plot when streaming.
  - Fault Lines: Static GeoJSON (GEM) loaded from CDN.
  - Plate Boundaries: Static GeoJSON (PB2002) loaded from CDN.
 

Performance

- Overlays are loaded once and re-used; styles react to theme and zoom.
- Z-order is managed via default panes; earthquakes and stations render in marker pane; faults/plates in overlay pane.

Accessibility

- Layers toggle and Legend include tooltips and ARIA labels; keyboard shortcuts: L (Layers), G (Legend), Esc to close.

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

- Layers: `MapLayersControl` → `BasemapLayers`, `OverlayLayers`.
- Legend: `LegendControl` (collapsible, synced to overlay state; shows symbology and source/last update).
- Reuse: `EventMarkers`, `StationMarkers`.

Acceptance Criteria

- Toggling overlays show/hide instantly without page reload.
- Base map swap < 300ms on broadband with tile cache warm.
- Panel collapses to a small button on screens < 768px width.

### Implementation Notes (Updated)

- A custom Leaflet control (`LegendControl`) renders a collapsible legend in the bottom-right, synced to `LayersControl` via a lightweight overlay registry.
- Supported overlays for dynamic legend entries: Faults, Plate Boundaries.
- Tooltips: the Layers toggle and Legend collapse button expose `title` and `aria-label` attributes for mouse/keyboard users.
- No new dependencies; control uses React portal to render into a Leaflet control container.

## Map Legend (Symbols)

Purpose: Explain visual encodings (magnitude, stations status, fault line style) and provide quick reference counts.

Placement: Co-located with Layers panel (same container), below toggle lists.

Content

- Earthquakes: Scaled circles; label “by magnitude”. Optional inline toggle for Depth ramp (On/Off).
- Stations: Triangle swatch; status indicated in station popup (no counts in legend).
- Fault Lines: Line swatch matching current theme/zoom.
- Plates: Dashed line swatch.
 

Behavior

- Symbology and last-update metadata react to theme/zoom and overlay visibility.
- Tooltip on hover: short description and data source.

Implementation Notes

- Use CSS-only swatches; no map dependency for samples.
- Props: `{ overlayState, counts }` from parent.

## Advanced Search with Presets

Purpose: Filter earthquakes (and optionally stations) by time, magnitude, depth, and region; expose common presets.

Placement: Left sidebar panel above the results list. Matches Figma “Latest Earthquakes, Past 30 Days” header with search and filter icon.

Filters (current)

- Time range: custom date range.
- Magnitude: min/max.
- Text search: matches place/text.
- Sort: by time or magnitude, asc/desc.

Presets (implemented)

- Latest Earthquakes, Past 30 Days. [default]
- 2025 Earthquakes.
- 2024 Earthquakes.
- 2023 Earthquakes.

URL & State Sync

- No URL query sync at present; state is local to the page.

Data Flow

1. User selects preset/filter → update state.
2. Fetch earthquakes for selected range; stations list unchanged.
3. Update map overlays and sidebar list.

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

- Changing preset updates results within ~1s on broadband.
- Legend symbology and metadata reflect active overlays.

## Scalebar

Purpose: Provide distance scale for spatial context.

Placement: Bottom-left on desktop; top-left on small screens.

Implementation

- `<ScaleControl>` from react-leaflet with `metric` only; width adapts to viewport.

Acceptance

- Appears at zoom ≥ 3; updates as user zooms.

## PH Zoom (Reset View)

Purpose: One-tap zoom to the Philippines extent.

Placement: Button under Zoom controls (top-left). Tooltip: “Reset to Philippines”.

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

1. Legend/Layers panel with working toggles and base map switch.
2. Fault Lines overlay (static GeoJSON), panes and z-indexing.
3. Advanced Search panel with presets, URL sync, filtered fetch.
4. Optional utilities: Feedback modal, Scalebar control, PH Zoom.
5. Polishing: accessibility, loading states, analytics hooks.
