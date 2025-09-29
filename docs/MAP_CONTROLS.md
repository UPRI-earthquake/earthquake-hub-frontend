# Map Controls

Documents the custom Leaflet controls and their responsibilities.

## Layers Control

- Component: `src/components/MapLayersControl.jsx`
- Subcomponents: `src/components/layers/BasemapLayers.jsx`, `src/components/layers/OverlayLayers.jsx`
- CSS: `src/components/mapLayers.css`
- Notes: click‑to‑expand (hover disabled), ARIA labels, focus trap, keyboard shortcuts

## Legend Control

- Component: `src/components/LegendControl.jsx`
- CSS: `src/components/legend.css`
- Shows symbology and metadata (source, last updated) for Faults, Plates, and Population tiles
- Collapsible; mirrors overlay visibility state

## Reset View

- Component: `src/components/ResetViewControl.jsx`
- Provides a one‑click return to the default Philippines view

## Attribution

- Component: `src/components/AttributionControl.jsx`
- Removes Leaflet prefix and adds provider credits matching active basemap/overlays

## Built‑in Controls

- `ZoomControl`, `ScaleControl` configured in `src/pages/HomePage.jsx`
- Styling and theming in `src/index.css`

