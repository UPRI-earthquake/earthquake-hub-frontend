# Accessibility

This app includes keyboard and screen reader affordances for map controls and lists.

## Keyboard Shortcuts

- `L`: Toggle Layers panel
- `G`: Toggle Legend panel
- `Esc`: Close the active panel (Layers or Legend)

## Layers Panel

- Adds `aria-label` to the toggle button and an `aria-controls` link to the panel container.
- Disables Leaflet’s hover-expand behavior to prevent accidental collapses.
- Installs a focus trap when open so Tab cycles within controls.
- Radio/checkbox inputs use brand `accent-color` and proper labels.

Code: `src/components/MapLayersControl.jsx`, `src/components/mapLayers.css`

## Legend Panel

- Toggle button exposes `title` and `aria-label`.
- Tooltip text and labels are present for symbols and sources.

Code: `src/components/LegendControl.jsx`, `src/components/legend.css`

## Lists and Items

- Sidebar items are keyboard-focusable; selection updates map focus and popups.
- Color and weight changes are paired with text changes for non-color cues where relevant.

Code: `src/components/SidebarItems.jsx`, `src/components/SidebarItem.jsx`

## Testing

- See `src/__tests__/LayersA11y.test.js` for controls coverage. Add tests for new controls that include:
  - Focus trap behavior
  - Aria attributes
  - Keyboard toggle behavior

