## Event Markers

Renders earthquake events as circle markers with magnitude styling and selection behavior.

### Components

- `EventMarkers`: collection builder, filtering/animation: `src/components/EventMarkers.jsx`
- `EventMarker`: single marker with popup & selection: `src/components/EventMarker.jsx`

### Data

- Source: `/eq-events` (initial fetch) and SSE `SC_EVENT` updates
- Fields: `publicID`, `latitude_value`, `longitude_value`, `magnitude_value`, `place`, `eventType`, `last_modification`

### Behavior

- Scales marker radius by magnitude; supports optional depth ramp (Legend setting)
- Animates on NEW/UPDATE events using `eventType` and `last_modification`
- When selected (Redux), opens popup and `flyTo` to marker
- On deselect (Redux set to `null` or different id), the previously selected marker closes its popup

### Styling

- CSS Modules: `src/components/EventMarker.module.css`
- Theming reacts to `data-basemap-theme` attribute on map container

### Extending

- Add new visual encodings in `EventMarker` based on props (e.g., depth, uncertainty)
- Keep heavy computations outside render loop; memoize styles by zoom/theme
