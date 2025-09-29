# Station Markers

Displays seismic station locations and handles transient highlight on picks.

## Components

- `StationMarkers`: collection builder: `src/components/StationMarkers.jsx`
- `StationMarker`: single marker with popup: `src/components/StationMarker.jsx`

## Data

- Initial: `/device/all`
- Live: SSE `SC_PICK` includes `stationCode` to highlight the marker for ~15s

## Behavior

- Shows a triangle icon for stations; status and quick info in popup
- On `SC_PICK`, toggles a visible highlight state on the matching `stationCode`

## Styling

- CSS Modules: `src/components/StationMarker.module.css`

## Extending

- Add mini‑sparklines or health indicators to popups if available
- Consider clustering only if station count becomes very large

